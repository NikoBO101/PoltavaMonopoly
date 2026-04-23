const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { MongoClient } = require('mongodb'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// === ПІДКЛЮЧЕННЯ БАЗИ ДАНИХ ===
const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);
let usersCollection;

async function connectDB() {
    try {
        await client.connect();
        usersCollection = client.db("poltava_db").collection("users");
        console.log("✅ Підключено до хмарної бази MongoDB!");
    } catch (e) {
        console.error("❌ Помилка підключення до MongoDB:", e);
    }
}
connectDB();

app.use(express.static(path.join(__dirname, 'public')));

// === КАТАЛОГ МАГАЗИНУ ===
const shopItems = {
    'token_gold': { type: 'token', name: 'Золота Галушка', price: 500 },
    'token_bogdan': { type: 'token', name: 'Полтавський Богдан', price: 300 },
    'token_tank': { type: 'token', name: 'Танк', price: 1000 }
};

const rooms = {};
let connectedPlayers = 0;

io.on('connection', (socket) => {
    connectedPlayers++;
    io.emit('globalOnlineCount', connectedPlayers);
    
    socket.emit('updateRoomsList', getPublicRooms());

    // === АВТОРИЗАЦІЯ ТА РЕЄСТРАЦІЯ ===
    socket.on('login', async (data, callback) => {
        if (!usersCollection) {
            return callback({ success: false, msg: "База даних завантажується..." });
        }

        let { nick, pin } = data;
        const searchNick = nick.toLowerCase();

        try {
            let user = await usersCollection.findOne({ nick: { $regex: new RegExp(`^${nick}$`, "i") } });

            if (user) {
                if (user.pin === pin) {
                    let needsUpdate = false;
                    let updateData = {};
                    
                    if (user.galushky === undefined) {
                        updateData.galushky = user.coins || 100; 
                        user.galushky = updateData.galushky;
                        needsUpdate = true;
                    }
                    if (!user.inventory) {
                        updateData.inventory = ['token_default'];
                        user.inventory = updateData.inventory;
                        needsUpdate = true;
                    }
                    if (!user.equippedToken) {
                        updateData.equippedToken = 'token_default';
                        user.equippedToken = updateData.equippedToken;
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        await usersCollection.updateOne({ _id: user._id }, { $set: updateData });
                    }

                    return callback({ success: true, user: user, msg: `З поверненням, ${user.nick}!` });
                } else {
                    return callback({ success: false, msg: "❌ Цей нік уже зайнятий. Невірний PIN!" });
                }
            } else {
                const newUser = { 
                    nick: nick, 
                    pin: pin, 
                    wins: 0, 
                    activeTitle: "Новачок", 
                    galushky: 100,
                    titles: ["Новачок"],
                    inventory: ['token_default'],
                    equippedToken: 'token_default',
                    createdAt: new Date()
                };
                await usersCollection.insertOne(newUser);
                return callback({ success: true, user: newUser, msg: "✅ Акаунт створено! Тобі нараховано 100 Галушок." });
            }
        } catch (err) {
            console.error("Помилка БД:", err);
            callback({ success: false, msg: "Помилка сервера бази даних." });
        }
    });

    // === КУПІВЛЯ ТОВАРУ ===
    socket.on('buyItem', async (data, callback) => {
        const { nick, pin, itemId } = data;
        const item = shopItems[itemId];

        if (!item) return callback({ success: false, msg: "Товар не знайдено!" });

        try {
            let user = await usersCollection.findOne({ nick: { $regex: new RegExp(`^${nick}$`, "i") } });
            
            if (!user || user.pin !== pin) {
                return callback({ success: false, msg: "Помилка авторизації!" });
            }

            if (user.inventory && user.inventory.includes(itemId)) {
                return callback({ success: false, msg: "Ти вже маєш цей предмет!" });
            }

            if ((user.galushky || 0) < item.price) {
                return callback({ success: false, msg: `Не вистачає Галушок! Потрібно ${item.price} 🥟` });
            }

            // Знімаємо гроші і додаємо в інвентар
            await usersCollection.updateOne(
                { _id: user._id },
                { 
                    $inc: { galushky: -item.price },
                    $push: { inventory: itemId }
                }
            );

            user.galushky -= item.price;
            user.inventory.push(itemId);

            callback({ success: true, user: user, msg: `✅ Успішно куплено: ${item.name}!` });
        } catch (err) {
            console.error("Помилка покупки:", err);
            callback({ success: false, msg: "Помилка сервера під час покупки." });
        }
    });

    // === ВИКОРИСТАННЯ КОРУПЦІЇ (ЗНЯТТЯ ГАЛУШОК) ===
    socket.on('useCorruption', async (data, callback) => {
        const { nick, pin, cost, serviceName } = data;
        try {
            let user = await usersCollection.findOne({ nick: { $regex: new RegExp(`^${nick}$`, "i") } });
            if (!user || user.pin !== pin) return callback({ success: false, msg: "Помилка авторизації!" });
            if ((user.galushky || 0) < cost) return callback({ success: false, msg: `Не вистачає Галушок! Треба ${cost} 🥟` });

            await usersCollection.updateOne({ _id: user._id }, { $inc: { galushky: -cost } });
            user.galushky -= cost;
            callback({ success: true, user: user, msg: `✅ Послуга "${serviceName}" активована!` });
        } catch (err) {
            callback({ success: false, msg: "Помилка сервера." });
        }
    });

    // === ВИБІР ФІШКИ (ВДЯГНУТИ) ===
    socket.on('equipToken', async (data, callback) => {
        const { nick, pin, itemId } = data;

        try {
            let user = await usersCollection.findOne({ nick: { $regex: new RegExp(`^${nick}$`, "i") } });
            
            if (!user || user.pin !== pin) return callback({ success: false, msg: "Помилка авторизації!" });
            
            if (!user.inventory.includes(itemId)) {
                return callback({ success: false, msg: "У тебе немає цієї фішки!" });
            }

            await usersCollection.updateOne({ _id: user._id }, { $set: { equippedToken: itemId } });
            user.equippedToken = itemId;

            callback({ success: true, user: user, msg: `✅ Фішку змінено!` });
        } catch (err) {
            callback({ success: false, msg: "Помилка зміни фішки." });
        }
    });

    // Створення кімнати
    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = {
            id: roomId,
            name: data.roomName || `Полтава ${roomId}`,
            password: data.password || '',
            players: [{ id: socket.id, name: data.playerName, isHost: true }],
            status: 'waiting',
            gameState: null
        };
        socket.join(roomId);
        socket.emit('roomJoined', rooms[roomId]);
        io.emit('updateRoomsList', getPublicRooms());
    });

    // Приєднання до кімнати
    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomId];
        if (!room) return socket.emit('joinError', 'Кімнату не знайдено!');
        if (room.status !== 'waiting') return socket.emit('joinError', 'Гра вже йде!');
        if (room.players.length >= 6) return socket.emit('joinError', 'Кімната заповнена!');
        if (room.password && room.password !== data.password) return socket.emit('joinError', 'Невірний пароль!');

        room.players.push({ id: socket.id, name: data.playerName, isHost: false });
        socket.join(data.roomId);
        socket.emit('roomJoined', room);
        io.to(data.roomId).emit('roomPlayersUpdated', room.players);
        io.emit('updateRoomsList', getPublicRooms());
    });

    // Запуск гри
    socket.on('startGame', (roomId) => {
        const room = rooms[roomId];
        if (room && room.players[0].id === socket.id) {
            room.status = 'playing';
            io.to(roomId).emit('gameStarted', {
                players: room.players,
                turn: 0,
                currentRound: 1
            });
            io.emit('updateRoomsList', getPublicRooms());
        }
    });

    // Кидок кубиків
    socket.on('rollDice', (roomId) => {
        const room = rooms[roomId];
        if (room && room.status === 'playing') {
            const v1 = Math.floor(Math.random() * 6) + 1;
            const v2 = Math.floor(Math.random() * 6) + 1;
            io.to(roomId).emit('diceRolled', { v1, v2 });
        }
    });

    // Синхронізація дій
    socket.on('playerAction', (roomId, data) => {
        const room = rooms[roomId];
        if (room) {
            data.senderId = socket.id;
            io.to(roomId).emit('syncAction', data);
        }
    });

    socket.on('syncGameState', (roomId, state) => {
        const room = rooms[roomId];
        if (room) {
            room.gameState = state;
            socket.to(roomId).emit('updateGameState', state);
        }
    });

    socket.on('disconnect', () => {
        connectedPlayers--;
        io.emit('globalOnlineCount', connectedPlayers);
        
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const pIndex = room.players.findIndex(p => p.id === socket.id);
            if (pIndex !== -1) {
                const wasHost = room.players[pIndex].isHost;
                room.players.splice(pIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    if (wasHost) room.players[0].isHost = true;
                    io.to(roomId).emit('roomPlayersUpdated', room.players);
                }
                io.emit('updateRoomsList', getPublicRooms());
                break;
            }
        }
    });
});

function getPublicRooms() {
    return Object.values(rooms).map(r => ({
        id: r.id,
        name: r.name,
        hasPassword: r.password.length > 0,
        playersCount: r.players.length,
        status: r.status
    }));
}

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер "Економіка Полтави" запущено на порту ${PORT}`);
});
