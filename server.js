const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
let connectedPlayers = 0;

io.on('connection', (socket) => {
    connectedPlayers++;
    io.emit('globalOnlineCount', connectedPlayers);
    
    // Відправляємо список кімнат при підключенні
    socket.emit('updateRoomsList', getPublicRooms());

    // Створення кімнати
    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = {
            id: roomId,
            name: data.roomName || `Полтава ${roomId}`,
            password: data.password || '',
            players: [{ id: socket.id, name: data.playerName, isHost: true }],
            status: 'waiting',
            gameState: null // Тут зберігатиметься копія стану гри
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

    // Кидок кубиків (Серверний рандом)
    socket.on('rollDice', (roomId) => {
        const room = rooms[roomId];
        if (room && room.status === 'playing') {
            const v1 = Math.floor(Math.random() * 6) + 1;
            const v2 = Math.floor(Math.random() * 6) + 1;
            // Передаємо результат усім
            io.to(roomId).emit('diceRolled', { v1, v2 });
        }
    });

    // СИНХРОНІЗАЦІЯ ДІЇ (Важливо: передаємо playerId)
    socket.on('playerAction', (roomId, data) => {
        const room = rooms[roomId];
        if (room) {
            // Додаємо до даних ID того, хто це зробив, щоб інші браузери не помилились
            data.senderId = socket.id;
            // Транслюємо дію всім іншим в кімнаті
            io.to(roomId).emit('syncAction', data);
        }
    });

    // Глобальна синхронізація стану (якщо хтось відстав)
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
