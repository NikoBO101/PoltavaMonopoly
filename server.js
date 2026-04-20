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
const playerColors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];

io.on('connection', (socket) => {
    connectedPlayers++;
    console.log(`[ONLINE] 🟢 Підключився: ${socket.id}`);
    io.emit('globalOnlineCount', connectedPlayers);
    socket.emit('updateRoomsList', getPublicRooms());

    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase(); 
        rooms[roomId] = {
            id: roomId, name: data.roomName || `Кімната ${roomId}`, password: data.password || '',
            players: [{ id: socket.id, name: data.playerName, isHost: true }], status: 'waiting'
        };
        socket.join(roomId);
        socket.emit('roomJoined', rooms[roomId]);
        io.emit('updateRoomsList', getPublicRooms());
    });

    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomId];
        if (!room) return socket.emit('joinError', 'Кімнату не знайдено!');
        if (room.status !== 'waiting') return socket.emit('joinError', 'Гра вже почалася!');
        if (room.players.length >= 6) return socket.emit('joinError', 'Кімната заповнена!');
        if (room.password && room.password !== data.password) return socket.emit('joinError', 'Невірний пароль!');

        room.players.push({ id: socket.id, name: data.playerName, isHost: false });
        socket.join(data.roomId);
        socket.emit('roomJoined', room);
        io.to(data.roomId).emit('roomPlayersUpdated', room.players);
        io.emit('updateRoomsList', getPublicRooms());
    });

    socket.on('startGame', (roomId) => {
        const room = rooms[roomId];
        if (room && room.players[0].id === socket.id) { 
            room.status = 'playing';
            const gamePlayers = room.players.map((p, i) => ({
                id: p.id, name: p.name, color: playerColors[i % playerColors.length], isBot: false,
                money: 15000, deposit: 0, loan: 0, loanTurns: 0, pos: 0, 
                inJail: false, jailTurns: 0, doublesCount: 0, isBankrupt: false, 
                skipTurns: 0, skipMsg: "", reverseMove: false, 
                portfolio: { PTC: 0, RTL: 0, TRN: 0, PST: 0, GOV: 0 }, stockHistory: [], debtMode: false 
            }));
            io.to(roomId).emit('gameStarted', { players: gamePlayers, turn: 0, currentRound: 1 });
            io.emit('updateRoomsList', getPublicRooms()); 
        }
    });

    socket.on('rollDice', (roomId) => {
        if (rooms[roomId] && rooms[roomId].status === 'playing') {
            io.to(roomId).emit('diceRolled', { v1: Math.floor(Math.random() * 6) + 1, v2: Math.floor(Math.random() * 6) + 1 });
        }
    });

    // Отримання і розсилка глобального стану гри всім учасникам кімнати
    socket.on('syncGameState', (roomId, stateData) => {
        socket.to(roomId).emit('updateGameState', stateData);
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
                if (room.players.length === 0) delete rooms[roomId];
                else {
                    if (wasHost) room.players[0].isHost = true;
                    io.to(roomId).emit('roomPlayersUpdated', room.players);
                }
                io.emit('updateRoomsList', getPublicRooms());
                break;
            }
        }
    });
});

function getPublicRooms() { return Object.values(rooms).map(r => ({ id: r.id, name: r.name, hasPassword: r.password.length > 0, playersCount: r.players.length, status: r.status })); }

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 Сервер працює на порту ${PORT}!`); });
