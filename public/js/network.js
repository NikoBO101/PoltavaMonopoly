// === МЕРЕЖЕВА ЛОГІКА ТА ЛОБІ (network.js) ===

// 1. Фейковий онлайн (щоб гра здавалася живою)
let lastRealRooms = [];
let fakeBaseOnline = 18;
const fakeRoomNames = ["го на всі бабки", "Без нубів", "Полтава центр", "граю з жінкою", "абракадабра", "Тільки свої", "Заходь не бійся", "123123", "Пиво і кубики", "test", "хто зі мною", "Ворскла чемпіон"];
let fakeRooms = [
    { id: 'F1X9', name: 'Полтава VIP', hasPassword: true, playersCount: 3, status: 'waiting', isFake: true },
    { id: 'F2M4', name: 'го на мільйон', hasPassword: false, playersCount: 4, status: 'playing', isFake: true },
    { id: 'F3B7', name: 'Тільки новачки', hasPassword: false, playersCount: 2, status: 'waiting', isFake: true },
    { id: 'F4K0', name: 'Турнір', hasPassword: false, playersCount: 6, status: 'playing', isFake: true }
];

setInterval(() => {
    if (currentLobby || isOnlineMode) return; 
    let fluct = Math.floor(Math.random() * 5) - 2; 
    fakeBaseOnline += fluct;
    if (fakeBaseOnline < 12) fakeBaseOnline = 12;
    if (fakeBaseOnline > 45) fakeBaseOnline = 45;
    let badge = document.getElementById('online-badge');
    if (badge) badge.innerText = `🟢 Онлайн: ${fakeBaseOnline}`;

    let roomToChange = fakeRooms[Math.floor(Math.random() * fakeRooms.length)];
    if (roomToChange.status === 'playing') {
        if (Math.random() > 0.7) { 
            roomToChange.status = 'waiting';
            roomToChange.playersCount = 1;
            roomToChange.name = fakeRoomNames[Math.floor(Math.random() * fakeRoomNames.length)];
            roomToChange.hasPassword = Math.random() > 0.8; 
        }
    } else { 
        let change = Math.random() > 0.4 ? 1 : -1; 
        roomToChange.playersCount += change;
        if (roomToChange.playersCount <= 0) roomToChange.playersCount = 1;
        if (roomToChange.playersCount >= 6 || (roomToChange.playersCount >= 3 && Math.random() > 0.5)) {
            roomToChange.status = 'playing';
        }
    }
    renderRoomsList(lastRealRooms);
}, 3000);

// 2. Обробка подій від Сервера
if (socket) {
    socket.on('connect', () => { myMultiplayerId = socket.id; });
    
    socket.on('globalOnlineCount', (count) => { 
        fakeBaseOnline = 15 + count * 2; 
        let el = document.getElementById('online-badge'); 
        if(el) el.innerText = `🟢 Онлайн: ${fakeBaseOnline}`; 
    });
    
    socket.on('updateRoomsList', (roomsList) => {
        lastRealRooms = roomsList; 
        renderRoomsList(roomsList);
    });
    
    socket.on('roomJoined', (room) => {
        currentLobby = room;
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) mainMenu.style.display = 'none';
        const lobbyScreen = document.getElementById('lobby-screen');
        if (lobbyScreen) lobbyScreen.style.display = 'block';
        updateLobbyUI();
    });

    socket.on('roomPlayersUpdated', (players) => {
        if (currentLobby) {
            currentLobby.players = players;
            updateLobbyUI();
        }
    });
}

// 3. Інтерфейс списку кімнат
function renderRoomsList(realRooms) {
    const container = document.getElementById('mp-room-list'); 
    if (!container) return;
    let allRooms = [...realRooms, ...fakeRooms]; 
    if (allRooms.length === 0) { 
        container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:10px;">Немає відкритих кімнат.</div>'; 
        return; 
    }
    let html = '';
    allRooms.forEach(r => {
        let lock = r.hasPassword ? '🔒' : '🔓'; 
        let status = r.status === 'waiting' ? '<span style="color:#10b981;">Очікування</span>' : '<span style="color:#ef4444;">В грі</span>';
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.3); border-radius:8px; margin-bottom:5px;">
                <div>
                    <b>${r.name}</b> <span style="font-size:10px; color:#94a3b8;">(Код: ${r.id})</span><br>
                    <span style="font-size:11px;">${lock} Гравців: ${r.playersCount}/6 | ${status}</span>
                </div>
                <button class="btn-green" style="width:auto; margin:0;" onclick="handleJoinRoomClick('${r.id}', ${r.hasPassword}, ${r.isFake}, '${r.status}')">Увійти</button>
            </div>`;
    });
    container.innerHTML = html;
}

function handleJoinRoomClick(id, hasPass, isFake, status) {
    if (status === 'playing') return alert("Гра вже йде, вхід заблоковано!");
    if (isFake) {
        if (hasPass) {
            let pass = prompt("Введіть пароль:");
            if (pass !== null) alert("Невірний пароль!");
            return;
        } else {
            return alert("Помилка з'єднання з хостом. Спробуйте іншу кімнату.");
        }
    }
    joinRoomFromList(id, hasPass);
}

// 4. Створення та вхід в кімнату
function createRoom() { 
    if (!socket) return alert("Сервер недоступний!"); 
    const pName = document.getElementById('mp-player-name').value.trim(); 
    if (!pName) return alert("Введіть ваше ім'я!"); 
    socket.emit('createRoom', { 
        playerName: pName, 
        roomName: document.getElementById('mp-room-name').value.trim(), 
        password: document.getElementById('mp-room-pass').value.trim() 
    }); 
}

function joinRoomFromList(roomId, hasPassword) { 
    if (!socket) return alert("Сервер недоступний!"); 
    const pName = document.getElementById('mp-player-name').value.trim(); 
    if (!pName) return alert("Введіть ваше ім'я!"); 
    let pass = ''; 
    if (hasPassword) { 
        pass = prompt("Введіть пароль:"); 
        if (pass === null) return; 
    } 
    socket.emit('joinRoom', { roomId: roomId, playerName: pName, password: pass }); 
}

function joinRoomByCode() { 
    if (!socket) return alert("Сервер недоступний!"); 
    const pName = document.getElementById('mp-player-name').value.trim(); 
    if (!pName) return alert("Введіть ваше ім'я!"); 
    const code = document.getElementById('mp-join-code').value.trim().toUpperCase(); 
    if (!code) return alert("Введіть код кімнати!"); 
    
    let fakeRoom = fakeRooms.find(r => r.id === code);
    if (fakeRoom) {
        return handleJoinRoomClick(fakeRoom.id, fakeRoom.hasPassword, true, fakeRoom.status);
    }
    
    socket.emit('joinRoom', { roomId: code, playerName: pName, password: document.getElementById('mp-join-pass').value.trim() }); 
}

// 5. Оновлення Лобі
function updateLobbyUI() {
    if (!currentLobby) return;
    const elName = document.getElementById('lobby-room-name');
    const elCode = document.getElementById('lobby-room-code');
    const elList = document.getElementById('lobby-players-list');
    const elStartBtn = document.getElementById('lobby-start-btn');

    if (elName) elName.innerText = currentLobby.name;
    if (elCode) elCode.innerText = currentLobby.id;
    if (elList) {
        elList.innerHTML = '';
        currentLobby.players.forEach(p => {
            let li = document.createElement('li');
            li.innerHTML = `${p.isHost ? '👑' : '👤'} <b style="color:${p.id === socket.id ? '#10b981' : '#fff'}">${p.name}</b>`;
            elList.appendChild(li);
        });
    }
    if (elStartBtn) {
        const isHost = currentLobby.players.find(p => p.id === socket.id && p.isHost);
        elStartBtn.style.display = (isHost && currentLobby.players.length >= 1) ? 'block' : 'none';
    }
}

function leaveLobby() {
    if(confirm("Вийти з кімнати?")) location.reload();
}

function startOnlineGame() {
    if (socket && currentLobby) {
        if(typeof unlockAudio === "function") unlockAudio(); // Вмикаємо звук
        socket.emit('startGame', currentLobby.id);
    }
}

// 6. Синхронізація (відправка даних іншим гравцям)
function forceSyncState() {
    if (isOnlineMode && currentLobby) {
        socket.emit('syncGameState', currentLobby.id, { 
            players, properties, turn, jackpotAmount, stocks, currentRound 
        });
    }
}

function broadcastState() { 
    if (isOnlineMode && isMyTurn() && currentLobby) { 
        forceSyncState();
    } 
}

function isMyTurn() { 
    if (!isOnlineMode) return true; 
    let activeP = players.find(x => x.debtMode) || players[turn]; 
    return activeP && activeP.id === myMultiplayerId; 
}
