// === ГЛОБАЛЬНІ ЗМІННІ (БЕЗПЕЧНІ) ===
var currentUser = JSON.parse(localStorage.getItem('poltavaUser')) || null; 
var players = [];
var turn = 0; 
var properties = {}; 
var jackpotAmount = 0;
var lastRollWasDouble = false; 
var lastDiceSum = 0; 
var isRolling = false;
var currentRound = 1; 
var debtAlertShown = false; 
var jackpotRate = 0.5;
var isOnlineMode = false;

// Повноцінна Біржа
var stocks = { 
    PTC: { price: 500, pool: 0, trend: 'up', noVisit: 0 }, 
    RTL: { price: 1000, pool: 0, trend: 'up', noVisit: 0 }, 
    TRN: { price: 1000, pool: 0, trend: 'up', noVisit: 0 }, 
    PST: { price: 1000, pool: 0, trend: 'up', noVisit: 0 }, 
    GOV: { price: 2000, pool: 0, totalMax: 50, issued: 0, trend: 'up' } 
};

// Мережеві змінні
var socket = typeof io !== 'undefined' ? io() : null;
var myMultiplayerId = null; 
var currentLobby = null; 
var pendingTrade = null;

const dotL = { 
    1:[0,0,0,0,1,0,0,0,0], 2:[1,0,0,0,0,0,0,0,1], 3:[1,0,0,0,1,0,0,0,1], 
    4:[1,0,1,0,0,0,1,0,1], 5:[1,0,1,0,1,0,1,0,1], 6:[1,0,1,1,0,1,1,0,1] 
};
const playerColors = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// === ФЕЙКОВИЙ ОНЛАЙН ТА КІМНАТИ ===
let lastRealRooms = [];
let fakeBaseOnline = 18;

// Список кумедних та типових назв, які створюють "люди"
const fakeRoomNames = ["го на всі бабки", "Без нубів", "Полтава центр", "граю з жінкою", "абракадабра", "Тільки свої", "Заходь не бійся", "123123", "Пиво і кубики", "test", "хто зі мною", "Ворскла чемпіон"];

let fakeRooms = [
    { id: 'F1X9', name: 'Полтава VIP', hasPassword: true, playersCount: 3, status: 'waiting', isFake: true },
    { id: 'F2M4', name: 'го на мільйон', hasPassword: false, playersCount: 4, status: 'playing', isFake: true },
    { id: 'F3B7', name: 'Тільки новачки', hasPassword: false, playersCount: 2, status: 'waiting', isFake: true },
    { id: 'F4K0', name: 'Турнір', hasPassword: false, playersCount: 6, status: 'playing', isFake: true }
];

setInterval(() => {
    if (currentLobby || isOnlineMode) return; // Не міняємо нічого, якщо ти вже граєш
    
    // 1. Стрибає загальний онлайн
    let fluct = Math.floor(Math.random() * 5) - 2; 
    fakeBaseOnline += fluct;
    if (fakeBaseOnline < 12) fakeBaseOnline = 12;
    if (fakeBaseOnline > 45) fakeBaseOnline = 45;
    let badge = document.getElementById('online-badge');
    if (badge) badge.innerText = `🟢 Онлайн: ${fakeBaseOnline}`;

    // 2. Випадкова кімната починає жити своїм життям
    let roomToChange = fakeRooms[Math.floor(Math.random() * fakeRooms.length)];
    
    if (roomToChange.status === 'playing') {
        // Якщо гра йшла, вона може закінчитися, і хтось створює нову кімнату з дурною назвою
        if (Math.random() > 0.7) { 
            roomToChange.status = 'waiting';
            roomToChange.playersCount = 1;
            roomToChange.name = fakeRoomNames[Math.floor(Math.random() * fakeRoomNames.length)];
            roomToChange.hasPassword = Math.random() > 0.8; // Іноді ставлять пароль
        }
    } else { 
        // Якщо кімната в очікуванні, люди заходять або виходять
        let change = Math.random() > 0.4 ? 1 : -1; // Частіше заходять, ніж виходять
        roomToChange.playersCount += change;
        
        if (roomToChange.playersCount <= 0) roomToChange.playersCount = 1;
        
        // Якщо набралося достатньо людей — гра запускається і кімната закривається
        if (roomToChange.playersCount >= 6 || (roomToChange.playersCount >= 3 && Math.random() > 0.5)) {
            roomToChange.status = 'playing';
        }
    }

    // Перемальовуємо список кімнат на екрані
    renderRoomsList(lastRealRooms);
}, 3000); // Кожні 3 секунди щось відбувається!

// === МЕРЕЖЕВА ЛОГІКА (SOCKET.IO) ===
if (socket) {
    socket.on('connect', () => { 
        myMultiplayerId = socket.id; 
    });
    
    socket.on('globalOnlineCount', (count) => { 
        fakeBaseOnline = 15 + count * 2; // Додаємо реальних гравців до фейкових
        let el = document.getElementById('online-badge'); 
        if(el) el.innerText = `🟢 Онлайн: ${fakeBaseOnline}`; 
    });
    
socket.on('updateRoomsList', (roomsList) => {
        lastRealRooms = roomsList; // Додай цей рядок!
        renderRoomsList(roomsList);
    });
    
    // Функція, яка ховає меню і показує лобі
socket.on('roomJoined', (room) => {
    currentLobby = room;
    
    // 1. Ховаємо головне меню повністю
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.style.display = 'none';
    
    // 2. Показуємо екран лобі
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) {
        lobbyScreen.style.display = 'block';
    } else {
        console.error("Помилка: Елемент lobby-screen не знайдено в HTML!");
    }
    
    updateLobbyUI();
});

// Оновлення списку гравців
socket.on('roomPlayersUpdated', (players) => {
    if (currentLobby) {
        currentLobby.players = players;
        updateLobbyUI();
    }
});

} // === КІНЕЦЬ БЛОКУ if (socket) ===

function renderRoomsList(realRooms) {
    const container = document.getElementById('mp-room-list'); 
    if (!container) return;
    
    let allRooms = [...realRooms, ...fakeRooms]; // Змішуємо реальні з фейковими
    
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


// === ІНІЦІАЛІЗАЦІЯ ТА UI ===
document.addEventListener("DOMContentLoaded", () => {
    switchTab('tab-newgame');
    generatePlayerInputs();
    updateVolume();
    updateProfileUI();
    
    // Авто-логін, якщо дані є в пам'яті браузера
    let saved = localStorage.getItem('poltavaUser');
    if (saved && socket) {
        let data = JSON.parse(saved);
        // Чекаємо трохи, щоб сокет встиг підключитись
        setTimeout(() => {
            socket.emit('login', { nick: data.nick, pin: data.pin }, (res) => {
                if (res.success) {
                    currentUser = res.user;
                    updateProfileUI();
                }
            });
        }, 1000);
    }

    if(!socket) renderRoomsList([]);
});

function returnToGame() {
    // Перевіряємо, чи є гравці. Якщо ні — гра ще не створена!
    if (!players || players.length === 0) {
        alert("Спершу натисни '🎮 ПОЧАТИ ГРУ' або зайди в Онлайн-кімнату!");
        return;
    }
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
}

function toggleMenuMusic() {
    let bgm = document.getElementById('bgm');
    let btn = document.getElementById('menu-music-toggle');
    if (!window.musicEnabled) {
        bgm.play().catch(() => alert("Клікніть по екрану, щоб дозволити звук!"));
        window.musicEnabled = true;
        if(btn) { btn.innerText = "🎵 Музика: ГРАЄ"; btn.className = "btn-green"; }
    } else {
        bgm.pause();
        window.musicEnabled = false;
        if(btn) { btn.innerText = "🎵 Музика: ВИМКНЕНО"; btn.className = "btn-purple"; }
    }
}

function generatePlayerInputs() {
    let selectEl = document.getElementById('player-count'); 
    if (!selectEl) return;
    const c = parseInt(selectEl.value); 
    const cont = document.getElementById('player-names-container'); 
    cont.innerHTML = '';
    
    let defs = ['Коля', 'Надя', 'Бот Легкий', 'Бот Важкий', 'Гравець 5', 'Гравець 6']; 
    
    for (let i = 0; i < c; i++) {
        cont.innerHTML += `
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="text" id="p${i}-name" value="${defs[i]}" style="flex-grow:1; padding:8px; border-radius:5px; background:#0f172a; color:#fff; border:1px solid #475569;">
                <label style="font-size:12px; font-weight:bold; color:#10b981; display:flex; align-items:center; gap:3px; background:rgba(0,0,0,0.5); padding:8px; border-radius:5px; cursor:pointer;">
                    <input type="checkbox" id="p${i}-isbot" ${defs[i].includes('Бот') ? 'checked' : ''}> Бот
                </label>
            </div>`;
    }
}

// 100% РОБОЧИЙ ЗАПУСК ЗВУКІВ
function unlockAudio() {
    const audios = ['bgm', 'sfx-dice', 'sfx-step', 'sfx-earn', 'sfx-spend', 'sfx-bankrupt'];
    audios.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            el.volume = 0; // Робимо тихо, щоб не вдарило по вухах
            let playPromise = el.play();
            if (playPromise !== undefined) {
                playPromise.then(() => { 
                    el.pause(); 
                    el.currentTime = 0; 
                    updateVolume(); // Повертаємо нормальну гучність
                }).catch(err => { console.log("Аудіо заблоковано браузером: ", err); });
            }
        }
    });
}

function updateVolume() {
    let bgmVol = document.getElementById('vol-bgm') ? document.getElementById('vol-bgm').value / 100 : 0.2; 
    let sfxVol = document.getElementById('vol-sfx') ? document.getElementById('vol-sfx').value / 100 : 0.8;
    
    if (document.getElementById('vol-bgm-val')) document.getElementById('vol-bgm-val').innerText = `${Math.round(bgmVol*100)}%`;
    if (document.getElementById('vol-sfx-val')) document.getElementById('vol-sfx-val').innerText = `${Math.round(sfxVol*100)}%`;
    
    let bgm = document.getElementById('bgm'); 
    if (bgm) bgm.volume = bgmVol;
    
    ['sfx-dice', 'sfx-step', 'sfx-earn', 'sfx-spend', 'sfx-bankrupt'].forEach(id => { 
        let el = document.getElementById(id); 
        if(el) el.volume = sfxVol; 
    });
}

function changeRadio() { 
    let val = document.getElementById('setting-radio').value; 
    let bgm = document.getElementById('bgm'); 
    if (!val) { 
        bgm.pause(); 
    } else { 
        bgm.src = val; 
        bgm.play().catch(e => {}); 
    } 
}

function playSound(id) { 
    let el = document.getElementById(id); 
    if (el && el.getAttribute('src')) { 
        el.currentTime = 0; 
        el.play().catch(e => {}); 
    } 
}

function render2DDie(id, num) { 
    let el = document.getElementById(id); 
    if (el && dotL[num]) {
        el.innerHTML = dotL[num].map(v => `<div class="dot ${v === 0 ? 'hidden' : ''}"></div>`).join(''); 
    }
}

function getRentArray(base) { 
    return [base, base*5, base*15, base*40, base*50, base*60]; 
}

function openModal(t, b, btn) { 
    document.getElementById('modal-title').innerHTML = t; 
    document.getElementById('modal-body').innerHTML = b; 
    document.getElementById('modal-buttons').innerHTML = btn; 
    document.getElementById('modal-overlay').style.display = 'flex'; 
}

function closeModal() { 
    document.getElementById('modal-overlay').style.display = 'none'; 
}

function openSettingsModal() { 
    switchTab('tab-settings'); 
    document.getElementById('main-menu').style.display = 'flex'; 
}


// === ЛОБІ ТА ЗАПУСК ГРИ ===
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
    
    // Перевірка на фейковий код
    let fakeRoom = fakeRooms.find(r => r.id === code);
    if (fakeRoom) {
        return handleJoinRoomClick(fakeRoom.id, fakeRoom.hasPassword, true, fakeRoom.status);
    }
    
    socket.emit('joinRoom', { roomId: code, playerName: pName, password: document.getElementById('mp-join-pass').value.trim() }); 
}

function startOnlineGameAction() { 
    unlockAudio();
    if (socket && currentLobby) { 
        socket.emit('startGame', currentLobby.id); 
    } 
}

function startLocalGame() {
    unlockAudio(); // РОЗБЛОКОВУЄМО ЗВУК
    isOnlineMode = false; 
    changeRadio(); 
    currentRound = 1; 
    jackpotAmount = 0;
    
    let jpSetting = document.getElementById('setting-jackpot');
    jackpotRate = jpSetting ? parseFloat(jpSetting.value) : 0.5;
    
    const c = parseInt(document.getElementById('player-count').value); 
    const sm = parseInt(document.getElementById('start-money').value) || 15000;
    
    players = [];
    for (let i = 0; i < c; i++) {
        let isBotChecked = document.getElementById(`p${i}-isbot`).checked;
        
        // Визначаємо фішку
        let pToken = 'token_default';
        if (i === 0 && currentUser && currentUser.equippedToken) {
            pToken = currentUser.equippedToken;
        }

        players.push({ 
            id: i, 
            name: document.getElementById(`p${i}-name`).value, 
            isBot: isBotChecked, 
            color: playerColors[i], 
            money: sm, 
            deposit: 0, 
            loan: 0, 
            loanTurns: 0, 
            pos: 0, 
            inJail: false, 
            jailTurns: 0, 
            doublesCount: 0, 
            isBankrupt: false, 
            skipTurns: 0, 
            reverseMove: false, 
            portfolio: { PTC: 0, RTL: 0, TRN: 0, PST: 0, GOV: 0 }, 
            stockHistory: [], 
            debtMode: false,
            equippedToken: pToken
        });
    }
    
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('game-container').style.display = 'flex';
    document.getElementById('return-game-btn').style.display = 'block';
    
    render2DDie('die1', 1); 
    render2DDie('die2', 1); 
    initBoard(); 
    updateUI();
}

function renderLobbyPlayers(playersList) {
    const listEl = document.getElementById('lobby-players-list'); 
    let html = ''; 
    let iAmHost = false;
    
    playersList.forEach((p, i) => { 
        let hostBadge = p.isHost ? '👑 ' : ''; 
        let youBadge = p.id === myMultiplayerId ? ' <span style="color:#94a3b8; font-size:12px;">(Ви)</span>' : ''; 
        if(p.id === myMultiplayerId && p.isHost) iAmHost = true; 
        
        html += `<div style="background:#1e293b; padding:10px; border-radius:8px; margin-bottom:5px; border-left:4px solid ${playerColors[i % playerColors.length]}; font-weight:bold;">${hostBadge}${p.name}${youBadge}</div>`; 
    });
    
    listEl.innerHTML = html; 
    document.getElementById('lobby-start-btn').style.display = iAmHost ? 'inline-block' : 'none';
}


// === ДОШКА ТА ВІЗУАЛ ===
function getGridArea(i) { 
    if (i <= 10) return { r: 11, c: 11 - i }; 
    if (i <= 19) return { r: 11 - (i - 10), c: 1 }; 
    if (i <= 30) return { r: 1, c: (i - 20) + 1 }; 
    return { r: (i - 30) + 1, c: 11 }; 
}

function initBoard() {
    document.querySelectorAll('.cell').forEach(e => e.remove()); 
    const board = document.getElementById('board');
    
    for (let i = 0; i < 40; i++) {
        const data = mapData[i]; 
        const cell = document.createElement('div'); 
        cell.className = `cell ${data.type === 'corner' ? 'corner' : ''}`; 
        cell.id = `cell-${i}`; 
        cell.onclick = () => showPropertyInfo(i); 
        
        let pos = getGridArea(i); 
        cell.style.gridRow = pos.r; 
        cell.style.gridColumn = pos.c;
        
        let topContent = ''; 
        if (data.emoji) topContent += `<div class="cell-emoji">${data.emoji}</div>`; 
        topContent += `<div class="cell-name">${data.name}</div>`;
        
        if (data.group && colors[data.group]) {
            cell.innerHTML += `<div class="district-bar" style="background:${colors[data.group]}"></div>`;
        }
        
        cell.innerHTML += `${topContent}<div class="houses-container" id="houses-${i}"></div><div class="tokens-area" id="tokens-${i}"></div>`;
        if (data.price) cell.innerHTML += `<div class="cell-price">i₴${data.price}</div>`; 
        cell.innerHTML += `<div class="owner-bar" id="owner-${i}"></div>`;
        
        board.appendChild(cell);
    }
    
    players.forEach(p => { 
        const token = document.createElement('div'); 
        token.id = `token-${p.id}`; 
        token.className = 'pawn'; 

        // Перевіряємо, який скін вдягнений у гравця
        if (p.equippedToken === 'token_gold') {
            token.style.backgroundColor = '#f59e0b';
            token.style.border = '2px solid #fff';
            token.style.boxShadow = '0 0 10px #f59e0b';
        } else if (p.equippedToken === 'token_bogdan') {
            token.style.background = 'transparent';
            token.style.border = 'none';
            token.style.boxShadow = 'none';
            token.innerHTML = '<div style="font-size:24px; line-height:1; transform: translateY(-5px);">🚐</div>';
        } else if (p.equippedToken === 'token_tank') {
            token.style.background = 'transparent';
            token.style.border = 'none';
            token.style.boxShadow = 'none';
            token.innerHTML = '<div style="font-size:24px; line-height:1; transform: translateY(-5px);">🚜</div>';
        } else {
            token.style.backgroundColor = p.color; // Звичайна фішка
        }

        document.getElementById('tokens-0').appendChild(token); 
    });
}

function updatePropertyColors() {
    for (let i = 0; i < 40; i++) {
        let cell = document.getElementById(`cell-${i}`); 
        let ownerBar = document.getElementById(`owner-${i}`);
        
        if (properties[i] && !properties[i].isMortgaged) { 
            let pColor = players.find(x => x.id === properties[i].owner).color; 
            ownerBar.style.backgroundColor = pColor; 
            cell.style.borderColor = pColor; 
            cell.style.boxShadow = `inset 0 0 15px ${pColor}44`; 
        } else { 
            ownerBar.style.backgroundColor = 'transparent'; 
            cell.style.borderColor = '#cbd5e1'; 
            cell.style.boxShadow = 'none';
        }
    }
}

function updateUI() {
    const dash = document.getElementById('dashboard'); 
    dash.innerHTML = ''; 
    let isDebtActive = players.some(p => p.debtMode);
  
    players.forEach((p, i) => {
        let iconHTML = ''; 
        if (p.skipTurns > 0) iconHTML += '⏸️'; 
        if (p.loan > 0) iconHTML += '💳';
        
        let depHTML = p.deposit > 0 ? `<br><span style="font-size:10px; color:#f59e0b;">Банка: i₴${p.deposit}</span>` : '';
        let cryptoHTML = (p.portfolio.PTC > 0 || p.portfolio.RTL > 0 || p.portfolio.TRN > 0 || p.portfolio.PST > 0 || p.portfolio.GOV > 0) ? `<br><span style="font-size:10px; color:#06b6d4;">Акції: 📈</span>` : '';
        
        let activeClass = ''; 
        if (isDebtActive) { 
            if (p.debtMode) activeClass = 'debt-player-stat'; 
        } else { 
            if (turn === i) activeClass = 'active-player-stat'; 
        }
        
        dash.innerHTML += `
            <div class="player-stat ${activeClass} ${p.isBankrupt ? 'bankrupt-stat' : ''}">
                <div>
                    <div class="color-dot" style="background:${p.color}"></div>
                    ${p.name} ${p.isBot ? '🤖' : ''} ${iconHTML}
                </div>
                <span style="color: ${p.money < 0 ? '#ef4444' : '#10b981'}; font-size:13px;">i₴${p.money}</span>
                ${depHTML} ${cryptoHTML}
            </div>`;
    });
    
    if (!isDebtActive && !players[turn].isBankrupt) { 
        document.getElementById('current-turn').innerHTML = `Круг ${currentRound} | Хід: <span style="color:${players[turn].color}">${players[turn].name}</span>`; 
    }
    
    let jpEl = document.getElementById('jackpot-display');
    if(jpEl) jpEl.innerText = `i₴${jackpotAmount}`;
  
    let activeP = isDebtActive ? players.find(p=>p.debtMode) : players[turn];
    let btnLoan = document.getElementById('loan-btn');
    
    // БЛОКУВАННЯ КНОПОК
    let canAct = isMyTurn() && !isRolling;
    
    if (activeP && activeP.loan > 0 && btnLoan) { 
        btnLoan.innerText = `💳 Погасити (i₴2500)`; 
        btnLoan.className = 'btn-red'; 
    } else if (btnLoan) { 
        btnLoan.innerText = `💳 Кредит`; 
        btnLoan.className = 'btn-purple'; 
    }
  
    let btnRoll = document.getElementById('roll-btn');
    if (btnRoll) btnRoll.disabled = !canAct || (players[turn] && players[turn].isBot && !isOnlineMode);
    
    // Жорстко блокуємо все, якщо не твій хід або летять кубики
    ['trade-btn', 'deposit-btn', 'crypto-btn', 'inv-btn', 'giveup-btn', 'loan-btn'].forEach(id => {
        let btn = document.getElementById(id);
        if (btn) btn.disabled = !canAct; 
    });
  
    updatePropertyColors();
    checkBotTurn();
}

function logMsgLocal(msg) { 
    const log = document.getElementById('log'); 
    log.innerHTML = `<div style="margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${msg}</div>` + log.innerHTML; 
    log.scrollTop = 0;
}

function logMsg(msg) { 
    logMsgLocal(msg); 
    broadcastState(); 
}


// === ЧАТ ТА ДІЇ ===
function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    
    let p = isOnlineMode ? players.find(x => x.id === myMultiplayerId) : players[turn];
    if (!p) p = players[0];

    if (isOnlineMode) {
        socket.emit('playerAction', currentLobby.id, { type: 'chat', val: msg });
    } else {
        executeAction(p, 'chat', 0, msg);
    }
}

function confirmAction(type, idx, val) {
    closeModal();
    let p = players[turn];
    
    if (isOnlineMode) {
        socket.emit('playerAction', currentLobby.id, { type: type, idx: idx, val: val });
    } else {
        executeAction(p, type, idx, val);
    }
}

function executeAction(p, type, idx, val) {
    if (type === 'buy') {
        p.money -= val;
        properties[idx] = { owner: p.id, houses: 0, isMortgaged: false };
        
        let randBuy = buyMsgs[Math.floor(Math.random() * buyMsgs.length)];
        logMsgLocal(`🏙️ <b><span style="color:${p.color}">${p.name}</span></b> ${randBuy} <b>${mapData[idx].name.replace('<br>',' ')}</b>!`);
        
        document.getElementById(`cell-${idx}`).style.border = `3px solid ${p.color}`;
        playSound('sfx-spend');
        processNextTurn(p);
    } 
    else if (type === 'rent') {
        // КОРУПЦІЙНИЙ ФІКС: Якщо кум вирішив питання
        if (kumActive) {
            logMsg(`😎 <b>${p.name}</b> просто кивнув власнику. Кум все вирішив, оренду не платимо!`);
            kumActive = false; // Використали послугу
            processNextTurn(p);
            return;
        }
        
        const owner = players.find(pl => pl.id === properties[idx].owner);
        
        // ОСЬ ЦІ ДВА РЯДКИ БУЛИ ВТРАЧЕНІ (переказ грошей):
        p.money -= val;
        owner.money += val;
        
        let randRent = rentMsgs[Math.floor(Math.random() * rentMsgs.length)];
        logMsgLocal(`💸 <b><span style="color:${p.color}">${p.name}</span></b> ${randRent} <b><span style="color:${owner.color}">${owner.name}</span></b> (i₴${val}).`);
        
        if (['pink', 'green', 'orange'].includes(mapData[idx].group)) { stocks.RTL.pool += Math.ceil(val * 0.1); }
        if (['yellow'].includes(mapData[idx].group)) { stocks.PST.pool += Math.ceil(val * 0.1); }
        if (['station'].includes(mapData[idx].group)) { stocks.TRN.pool += Math.ceil(val * 0.1); }
        if (mapData[idx].type === 'utility') { stocks.GOV.pool += Math.ceil(val * 0.2); }
        playSound('sfx-spend');
        processNextTurn(p);
    }
    else if (type === 'pass') {
        logMsgLocal(`<b>${p.name}</b> відмовився від покупки.`);
        processNextTurn(p);
    } 
    else if (type === 'think') {
        logMsgLocal(`🤔 <span style="color:${p.color}">${p.name}</span> розглядає ділянку <b>${val}</b>...`);
    } 
    else if (type === 'chat') {
        logMsgLocal(`<span style="color:${p.color}"><b>${p.name}:</b></span> ${val}`);
    }
    else if (type === 'auction_start') { 
        window.auctionData = { idx: idx, highestBid: val, highestBidder: -1 }; 
        logMsgLocal(`📢 Почався аукціон на <b>${mapData[idx].name.replace('<br>',' ')}</b>!`);
        openAuctionModal(); 
        return; 
    }
    else if (type === 'auction_bid') { 
        window.auctionData.highestBid = val; 
        window.auctionData.highestBidder = p.id; 
        playSound('sfx-step');
        if(document.getElementById('auc-bid')) {
            document.getElementById('auc-bid').innerText = `i₴${val}`; 
            document.getElementById('auc-leader').innerText = p.name;
        } else {
            openAuctionModal();
        }
        return;
    }
    else if (type === 'auction_pass') {
        logMsgLocal(`${p.name} виходить з торгів.`);
        return;
    }
    else if (type === 'auction_finish') {
        if (window.auctionData.highestBidder === -1) {
            logMsgLocal(`Аукціон завершено. Ділянка нічия.`);
        } else {
            let winner = players.find(x => x.id === window.auctionData.highestBidder);
            winner.money -= window.auctionData.highestBid;
            properties[window.auctionData.idx] = { owner: winner.id, houses: 0, isMortgaged: false };
            logMsgLocal(`🔨 <b>${winner.name}</b> виграв аукціон за i₴${window.auctionData.highestBid}!`);
            playSound('sfx-earn');
            document.getElementById(`cell-${window.auctionData.idx}`).style.border = `3px solid ${winner.color}`;
        }
        processNextTurn(players[turn]);
        return;
    }

    if (isOnlineMode && p.id === myMultiplayerId && type !== 'chat' && type !== 'think') {
        forceSyncState();
    }
}

function processNextTurn(activePlayer) {
    if (processDebts()) return; 

    // БРОНЕБІЙНИЙ ФІКС: Синхронізуємо стан ПЕРЕД зміною ходу
    if (isOnlineMode && activePlayer.id === myMultiplayerId) {
        forceSyncState();
    }

    if (lastRollWasDouble && !activePlayer.inJail && !activePlayer.isBankrupt) {
        lastRollWasDouble = false;
    } else {
        do { 
            turn = (turn + 1) % players.length; 
            if (turn === 0) currentRound++; 
        } while (players[turn].isBankrupt);
    }
    
    isRolling = false;
    updateUI();

    // Синхронізуємо новий хід для всіх
    if (isOnlineMode && activePlayer.id === myMultiplayerId) {
        forceSyncState();
    }

    if (!isOnlineMode && players[turn].isBot && !players[turn].isBankrupt) {
        setTimeout(() => userClickedRoll(), 1500);
    }
}


// === РОЗУМНИЙ БОТ ===
function checkBotTurn() {
    if (isOnlineMode || isRolling) return;
    let p = players[turn];
    
    if (p && p.isBot && !p.isBankrupt && !p.debtMode) {
        setTimeout(() => {
            if (document.getElementById('modal-overlay').style.display === 'none') {
                botPreRollActions(p); 
                let rollBtn = document.getElementById('roll-btn');
                if (rollBtn && !rollBtn.disabled) {
                    userClickedRoll();
                } else if (rollBtn && rollBtn.disabled) {
                    startTurnLocal();
                }
            }
        }, 1500);
    }
}

function botPreRollActions(p) {
    if (p.money < 1500) return;
    let colorsOwned = {};
    
    for (let i in properties) { 
        if (properties[i].owner === p.id) { 
            let g = mapData[i].group; 
            colorsOwned[g] = (colorsOwned[g] || 0) + 1; 
        } 
    }
    
    for (let g in colorsOwned) {
        let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === g);
        if (colorsOwned[g] === groupCells.length) { 
            for (let cellData of groupCells) {
                let idx = cellData.i; 
                let prop = properties[idx];
                if (prop.houses < 5 && p.money >= cellData.c.housePrice + 800) {
                    p.money -= cellData.c.housePrice; 
                    prop.houses++; 
                    playSound('sfx-spend');
                    logMsg(`🤖 <b>${p.name}</b> будує дім на ${cellData.c.name.replace('<br>',' ')}.`);
                    drawHouses(idx, prop.houses); 
                    updateUI(); 
                    return; 
                }
            }
        }
    }
}


// === ІНВЕНТАР, БІРЖА ТА БАНК ===
function showInventory() {
    let p = players.find(x => x.debtMode) || players[turn]; 
    let html = `<div style="max-height: 300px; overflow-y: auto; text-align: left;">`; 
    let count = 0;
    
    for (let i in properties) {
        if (properties[i].owner === p.id) {
            count++; 
            let c = mapData[i]; 
            let h = properties[i].houses; 
            let status = properties[i].isMortgaged ? '<span style="color:#ef4444;">[ЗАСТАВА]</span>' : (h > 0 ? `[Будинків: ${h}]` : '[Чиста]');
            html += `
                <div style="margin-bottom: 5px; padding: 8px; border: 1px solid #334155; border-radius: 6px; background: rgba(0,0,0,0.3); display: flex; align-items: center;">
                    <div class="color-dot" style="background:${colors[c.group] || '#fff'}; margin-right: 10px;"></div>
                    <div style="flex-grow:1; font-size:14px;"><b>${c.name.replace('<br>',' ')}</b></div>
                    <div style="font-size: 11px; color: #94a3b8;">${status}</div>
                </div>`;
        }
    }
    
    if (count === 0) html += `<div style="text-align:center; color:#94a3b8; padding: 20px;">У тебе ще немає майна.</div>`; 
    html += `</div>`;
    openModal(`🎒 Інвентар: ${p.name}`, html, `<button class="btn-blue" onclick="closeModal()">Закрити</button>`);
}

function openCryptoMenu() {
    let p = players.find(x => x.debtMode) || players[turn]; 
    p.stockHistory = p.stockHistory.filter(h => h.round > currentRound - 5);
    let boughtLast5 = p.stockHistory.reduce((s, h) => s + h.amount, 0); 
    let availableToBuy = 5 - boughtLast5;
    
    let html = `<p style="font-size:12px; color:#94a3b8; margin-top:0;">Комісія брокера: 5%. Ліміт: <b>${availableToBuy} акцій</b>.</p>`;
    
    ['PTC', 'RTL', 'TRN', 'PST', 'GOV'].forEach(sym => {
        let s = stocks[sym]; 
        let arrow = s.trend === 'up' ? '<span style="color:#10b981;">▲</span>' : '<span style="color:#ef4444;">▼</span>';
        let poolHtml = sym !== 'PTC' ? `<br><span style="font-size:11px; color:#f59e0b;">Пул дивідендів: i₴${s.pool}</span>` : ''; 
        let availHtml = sym === 'GOV' ? `<br><span style="font-size:11px; color:#cbd5e1;">Доступно: ${s.totalMax - s.issued} шт.</span>` : '';
        
        html += `
            <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; text-align: left;">
                <div>
                    <b>${sym}</b><br>
                    <span style="font-size:16px; font-weight:bold;">${arrow} i₴${s.price}</span><br>
                    <span style="font-size:12px;">В тебе: <b style="color:#06b6d4;">${p.portfolio[sym]} шт.</b></span>
                    ${poolHtml} ${availHtml}
                </div>
                <div style="display:flex; flex-direction:column; gap:5px; width:45%;">
                    <button class="btn-green" style="margin:0; padding:6px; font-size:12px;" onclick="tradeStock('${sym}', 1, true)" ${availableToBuy <= 0 || p.debtMode ? 'disabled' : ''}>Купити</button>
                    <button class="btn-red" style="margin:0; padding:6px; font-size:12px;" onclick="tradeStock('${sym}', 1, false)" ${p.portfolio[sym] <= 0 ? 'disabled' : ''}>Продати</button>
                </div>
            </div>`;
    });
    
    openModal("📈 Фондова Біржа", html, `<button class="btn-blue" onclick="closeModal()">Закрити</button>`);
}

function tradeStock(sym, amt, isBuying) {
    let p = players.find(x => x.debtMode) || players[turn]; 
    let s = stocks[sym]; 
    let cost = amt * s.price;
    
    if (isBuying) {
        if (p.debtMode) return alert("Спочатку погаси борги!"); 
        p.stockHistory = p.stockHistory.filter(h => h.round > currentRound - 5);
        if (p.stockHistory.reduce((s, h) => s + h.amount, 0) + amt > 5) return alert("Ліміт брокера вичерпано!");
        if (sym === 'GOV' && s.issued + amt > s.totalMax) return alert("Облігації розпродані!");
        
        let fee = Math.ceil(cost * 0.05); 
        let totalCost = cost + fee;
        if (p.money < totalCost) return alert(`Немає грошей! З комісією: i₴${totalCost}`);
        
        p.money -= totalCost; 
        playSound('sfx-spend'); 
        p.portfolio[sym] += amt; 
        p.stockHistory.push({round: currentRound, amount: amt});
        if (sym === 'GOV') s.issued += amt; 
        logMsg(`📈 <b>${p.name}</b> купив акції ${sym}.`);
    } else {
        if (p.portfolio[sym] < amt) return alert("У тебе немає цих акцій!");
        
        p.portfolio[sym] -= amt; 
        p.money += cost; 
        playSound('sfx-earn');
        if (sym === 'GOV') s.issued -= amt; 
        logMsg(`📉 <b>${p.name}</b> продав акції ${sym} за i₴${cost}.`);
    }
    updateUI(); 
    checkDebtResolution(); 
    openCryptoMenu(); 
    broadcastState();
}

function distributeDividends(sym) {
    let s = stocks[sym]; 
    if (s.pool < 100) return;
    
    let totalShares = players.reduce((sum, pl) => sum + (pl.isBankrupt ? 0 : pl.portfolio[sym]), 0);
    if (totalShares > 0) {
        let divPerShare = Math.floor(s.pool / totalShares);
        if (divPerShare > 0) {
            let sp = false;
            players.forEach(pl => {
                if (!pl.isBankrupt && pl.portfolio[sym] > 0) {
                    let payout = divPerShare * pl.portfolio[sym]; 
                    pl.money += payout; 
                    logMsg(`📈 <b>${pl.name}</b> отримав дивіденди ${sym}: <b>+i₴${payout}</b>`);
                    if (!sp) { playSound('sfx-earn'); sp = true; }
                }
            });
        }
    }
    s.pool = 0;
}

function openDepositMenu() {
    let p = players.find(x => x.debtMode) || players[turn];
    let html = `
        <p style="font-size:16px;">Готівка: <b style="color:#10b981;">i₴${p.money}</b><br>У Банці: <b style="color:#f59e0b;">i₴${p.deposit}</b></p>
        <p style="font-size:12px; color:#94a3b8;">Банка росте на 5% за кожен пройдений СТАРТ!</p>
        <input type="number" id="deposit-amount" value="1000" min="100" step="100" style="width:100%; padding:12px; margin-bottom:15px; background:#0f172a; color:#fff; border:1px solid #475569; border-radius:8px; font-weight:bold; font-size:16px;">
    `;
    openModal("🏦 Моя Банка", html, `
        <button class="btn-green" onclick="makeDeposit(true)" ${p.debtMode?'disabled':''}>Покласти</button>
        <button class="btn-gold" onclick="makeDeposit(false)">Зняти</button>
        <button class="btn-blue" onclick="closeModal()">Закрити</button>
    `);
}

function makeDeposit(isAdding) {
    let p = players.find(x => x.debtMode) || players[turn]; 
    let amt = parseInt(document.getElementById('deposit-amount').value) || 0; 
    if (amt <= 0) return;
    
    if (isAdding) {
        if (p.debtMode) return alert("Закрий борг перед поповненням депозиту!"); 
        if (p.money < amt) return alert("Немає готівки!");
        p.money -= amt; 
        p.deposit += amt; 
        playSound('sfx-spend'); 
        logMsg(`🏦 <b>${p.name}</b> поклав i₴${amt} в Банку.`);
    } else {
        if (p.deposit < amt) return alert("В Банці недостатньо коштів!");
        p.deposit -= amt; 
        p.money += amt; 
        playSound('sfx-earn'); 
        logMsg(`🏦 <b>${p.name}</b> зняв i₴${amt} з Банки.`);
    }
    updateUI(); 
    checkDebtResolution(); 
    closeModal(); 
    broadcastState();
}

function openLoanMenu() {
    let p = players.find(x => x.debtMode) || players[turn];
    if (p.loan === 0) { 
        openModal("💳 Кредит", `<p style="font-size:15px;">Банк дає тобі <b style="color:#10b981;">i₴2000</b> прямо зараз.</p><p style="color:#ef4444; font-weight:bold; font-size:15px;">Але ти мусиш повернути i₴2500 протягом 5 ходів!</p>`, `<button class="btn-green" onclick="takeLoan()">Беру Кредит</button><button class="btn-blue" onclick="closeModal()">Відміна</button>`); 
    } else { 
        openModal("💳 Погашення", `<p style="font-size:16px;">Твій борг: <b style="color:#ef4444;">i₴2500</b></p><p style="font-size:14px;">Залишилось ходів: <b>${p.loanTurns}</b></p>`, `<button class="btn-red" onclick="repayLoan()">Погасити борг</button><button class="btn-blue" onclick="closeModal()">Закрити</button>`); 
    }
}

function takeLoan() { 
    let p = players.find(x => x.debtMode) || players[turn]; 
    p.money += 2000; 
    p.loan = 2500; 
    p.loanTurns = 5; 
    playSound('sfx-earn'); 
    logMsg(`💳 <b>${p.name}</b> взяв кредит i₴2000.`); 
    updateUI(); 
    checkDebtResolution(); 
    closeModal(); 
    broadcastState(); 
}

function repayLoan() { 
    let p = players.find(x => x.debtMode) || players[turn]; 
    if (p.money < p.loan) return alert("Не вистачає грошей для погашення!"); 
    p.money -= p.loan; 
    p.loan = 0; 
    p.loanTurns = 0; 
    playSound('sfx-spend'); 
    logMsg(`💳 <b>${p.name}</b> успішно погасив борг.`); 
    updateUI(); 
    checkDebtResolution(); 
    closeModal(); 
    broadcastState(); 
}


// === ТОРГІВЛЯ ===
function openTradeMenu() {
    let p = players[turn]; 
    let activeOthers = players.filter(x => x.id !== p.id && !x.isBankrupt); 
    if (activeOthers.length === 0) return alert("Немає з ким торгувати!");
    
    let html = `<p>Обери гравця для угоди:</p><select id="trade-target" onchange="renderTradeLists()" style="width:100%; padding:12px; margin-bottom:15px; font-weight:bold; background:#0f172a; color:#fff; border:1px solid #475569; border-radius:8px;">`; 
    activeOthers.forEach(op => html += `<option value="${op.id}">${op.name}</option>`); 
    html += `</select><div id="trade-ui-container"></div>`;
    
    openModal("🤝 Торгівля", html, `<button class="btn-green" onclick="submitTrade()">Запропонувати</button><button class="btn-blue" onclick="closeModal()">Відміна</button>`); 
    renderTradeLists(); 
}

function renderTradeLists() {
    let p1 = players[turn]; 
    let p2id = parseInt(document.getElementById('trade-target').value); 
    let p2 = players.find(x => x.id === p2id);
    
    const getList = (pid, prefix) => { 
        let list = ''; 
        for(let i in properties) { 
            if(properties[i].owner === pid) { 
                let c = mapData[i]; 
                list += `<div style="display:flex; align-items:center; gap:5px; margin-bottom:6px; background:rgba(255,255,255,0.05); padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);"><input type="checkbox" id="${prefix}-prop-${i}" value="${i}"> <div class="color-dot" style="background:${colors[c.group]}; width:14px; height:14px;"></div> <span style="font-size:12px; font-weight:bold;">${c.name.replace('<br>',' ')}</span></div>`; 
            } 
        } 
        return list === '' ? '<div style="color:#94a3b8; font-size:12px; padding:10px 0;">Немає нерухомості</div>' : list; 
    };
    
    document.getElementById('trade-ui-container').innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:left;">
            <div style="background:var(--glass); padding:10px; border-radius:10px; border:1px solid #334155;">
                <h4 style="color:${p1.color}; margin-top:0; font-size:14px;">${p1.name} віддає:</h4>
                <div style="font-size:12px; margin-bottom:5px;">Доплата (i₴):</div>
                <input type="number" id="trade-money-give" value="0" min="0" max="${p1.money}" style="width:100%; padding:8px; margin-bottom:10px; background:#0f172a; color:#fff; border:1px solid #475569; border-radius:5px;">
                <div style="max-height:140px; overflow-y:auto; padding-right:5px;">${getList(p1.id, 'give')}</div>
            </div>
            <div style="background:var(--glass); padding:10px; border-radius:10px; border:1px solid #334155;">
                <h4 style="color:${p2.color}; margin-top:0; font-size:14px;">${p2.name} віддає:</h4>
                <div style="font-size:12px; margin-bottom:5px;">Доплата (i₴):</div>
                <input type="number" id="trade-money-take" value="0" min="0" max="${p2.money}" style="width:100%; padding:8px; margin-bottom:10px; background:#0f172a; color:#fff; border:1px solid #475569; border-radius:5px;">
                <div style="max-height:140px; overflow-y:auto; padding-right:5px;">${getList(p2.id, 'take')}</div>
            </div>
        </div>`;
}

function submitTrade() {
    let p1 = players[turn]; 
    let p2id = parseInt(document.getElementById('trade-target').value); 
    let p2 = players.find(x => x.id === p2id);
    
    let mGive = parseInt(document.getElementById('trade-money-give').value) || 0; 
    let mTake = parseInt(document.getElementById('trade-money-take').value) || 0;
    
    if (mGive > p1.money) return alert("Немає стільки грошей для доплати!"); 
    if (mTake > p2.money) return alert("У нього немає стільки грошей!");
    
    let pGive = [], pTake = []; 
    document.querySelectorAll('[id^="give-prop-"]:checked').forEach(cb => pGive.push(parseInt(cb.value))); 
    document.querySelectorAll('[id^="take-prop-"]:checked').forEach(cb => pTake.push(parseInt(cb.value)));
    
    // Перевірка будинків
    for (let i of [...pGive, ...pTake]) { 
        for (let j in properties) { 
            if (mapData[j].group === mapData[i].group && properties[j].houses > 0) return alert(`Спершу продайте всі будинки в цьому районі!`); 
        } 
    }
    
    if (mGive === 0 && mTake === 0 && pGive.length === 0 && pTake.length === 0) return alert("Угода порожня!");

    // === 🛡️ ПОДАТКОВА ТА АНТИМОНОПОЛЬНИЙ КОМІТЕТ ===
    let valGive = 0, valTake = 0;
    pGive.forEach(i => valGive += mapData[i].price); 
    pTake.forEach(i => valTake += mapData[i].price);

    // Правило 1: Заборона дарувати більше 1000 просто так
    if (pGive.length === 0 && pTake.length === 0) {
        if (mGive > 1000 || mTake > 1000) return alert("❌ Податкова заблокувала переказ: благодійність обмежена до i₴1000 за раз!");
    }

    // Правило 2: Обмеження націнки х3
    if (mGive > 0 && pTake.length > 0 && mGive > valTake * 3) {
        return alert(`❌ Антимонопольний комітет: ціна завищена! Максимум i₴${valTake * 3} за ці ділянки.`);
    }
    if (mTake > 0 && pGive.length > 0 && mTake > valGive * 3) {
        return alert(`❌ Антимонопольний комітет: ціна завищена! Максимум i₴${valGive * 3} за ці ділянки.`);
    }
    // =================================================

    pendingTrade = { p1, p2, mGive, mTake, pGive, pTake };

    if (!isOnlineMode && p2.isBot) {
        let valGiveBot = mGive + valGive;
        let valTakeBot = mTake + valTake;
        let profitMargin = p2.name.includes('Важк') ? 500 : 100;
        
        if (valGiveBot >= valTakeBot + profitMargin) { 
            logMsg(`🤖 <b>${p2.name}</b> погоджується на вигідну угоду!`); 
            acceptTrade(); 
        } else { 
            logMsg(`🤖 <b>${p2.name}</b> відхиляє невигідну угоду.`); 
            closeModal(); 
        }
        return;
    }

    let sGive = `<b style="color:#10b981; font-size:16px;">i₴${mGive}</b><br>` + pGive.map(i => `<span style="font-size:13px;">${mapData[i].name.replace('<br>',' ')}</span>`).join('<br>'); 
    let sTake = `<b style="color:#10b981; font-size:16px;">i₴${mTake}</b><br>` + pTake.map(i => `<span style="font-size:13px;">${mapData[i].name.replace('<br>',' ')}</span>`).join('<br>');
    
    openModal(`Підтвердження Трейду`, `
        <p style="color:${p2.color}; font-size:18px; font-weight:bold; margin-bottom:5px;">Гей, ${p2.name}!</p>
        <p style="margin-top:0;">${p1.name} пропонує обмін.</p>
        <div style="display:flex; justify-content:space-between; text-align:left; background:var(--glass); padding:15px; border-radius:10px; border:1px solid rgba(255,255,255,0.1);">
            <div style="width:48%;"><b>Отримуєш:</b><br><br>${sGive}</div>
            <div style="width:1px; background:rgba(255,255,255,0.2);"></div>
            <div style="width:48%; padding-left:10px;"><b>Віддаєш:</b><br><br>${sTake}</div>
        </div>
    `, `<button class="btn-green" onclick="acceptTrade()">Прийняти Угоду</button><button class="btn-red" onclick="closeModal()">Відмовитись</button>`);
}

function acceptTrade() {
    let t = pendingTrade; 
    t.p1.money = t.p1.money - t.mGive + t.mTake; 
    t.p2.money = t.p2.money - t.mTake + t.mGive;
    
    t.pGive.forEach(i => { 
        properties[i].owner = t.p2.id; 
        document.getElementById(`cell-${i}`).style.borderColor = t.p2.color; 
        document.getElementById(`owner-${i}`).style.backgroundColor = t.p2.color; 
    }); 
    
    t.pTake.forEach(i => { 
        properties[i].owner = t.p1.id; 
        document.getElementById(`cell-${i}`).style.borderColor = t.p1.color; 
        document.getElementById(`owner-${i}`).style.backgroundColor = t.p1.color; 
    });
    
    logMsg(`🤝 Успішний обмін між <b>${t.p1.name}</b> та <b>${t.p2.name}</b>.`); 
    playSound('sfx-earn'); 
    updateUI(); 
    closeModal(); 
    broadcastState();
}


// === ЛОГІКА ХОДУ ТА ПЕРЕМІЩЕННЯ ===
function userClickedRoll() { 
    if (isOnlineMode && socket && currentLobby) { 
        socket.emit('rollDice', currentLobby.id); 
    } else { 
        startTurnLocal(); 
    } 
}

async function startTurnLocal() {
    let v1 = Math.floor(Math.random() * 6) + 1; 
    let v2 = Math.floor(Math.random() * 6) + 1; 
    await processRollAndMove(v1, v2);
}

async function processRollAndMove(v1, v2) {
    if (isRolling || processDebts()) return; 
    isRolling = true; 
    updateUI();
    
    try {
        const p = players[turn]; 
        lastRollWasDouble = false; 
        
        if (p.loan > 0) { 
            p.loanTurns--; 
            if (p.loanTurns <= 0) { 
                logMsg(`⏰ Час платити за кредит! Банк списує i₴2500.`); 
                deductMoney(p, 2500); 
                p.loan = 0; 
                p.loanTurns = 0; 
                if (processDebts()) { isRolling = false; return; }
            } 
        }
        
        if (p.skipTurns > 0) { 
            p.skipTurns--; 
            logMsg(`🛑 <b>${p.name}</b> пропускає хід!`); 
            isRolling = false;
            if (isMyTurn()) return processNextTurn(p); 
            return; 
        }
        
        const isDouble = (v1 === v2);
        
        playSound('sfx-dice'); 
        const d1 = document.getElementById('die1'), d2 = document.getElementById('die2');
        if (d1 && d2) {
            d1.classList.add('rolling-anim'); 
            d2.classList.add('rolling-anim');
            for (let i = 0; i < 10; i++) { 
                render2DDie('die1', Math.floor(Math.random() * 6) + 1); 
                render2DDie('die2', Math.floor(Math.random() * 6) + 1); 
                await sleep(50); 
            }
            d1.classList.remove('rolling-anim'); 
            d2.classList.remove('rolling-anim');
        }
        
        render2DDie('die1', v1); 
        render2DDie('die2', v2); 
        
        lastDiceSum = v1 + v2; 
        lastRollWasDouble = isDouble;
        
        await sleep(300);

        if (p.inJail) {
            if (isDouble) { 
                logMsg(`🎲 <b>${p.name}</b> кинув ДУБЛЬ! Виходить з Колонії.`); 
                p.inJail = false; 
                p.jailTurns = 0; 
            } else { 
                p.jailTurns++; 
                if (p.jailTurns >= 3) { 
                    logMsg(`⏳ <b>${p.name}</b> відсидів 3 ходи. Сплачує штраф i₴1000.`); 
                    deductMoney(p, 1000); 
                    p.inJail = false; 
                    p.jailTurns = 0; 
                    if (processDebts()) { isRolling = false; return; }
                } else { 
                    logMsg(`🚫 <b>${p.name}</b> сумує за волею. (Хід ${p.jailTurns}/3)`); 
                    isRolling = false;
                    if (isMyTurn()) return processNextTurn(p); 
                    return; 
                } 
            }
        } else {
            if (isDouble) { 
                p.doublesCount++; 
                if (p.doublesCount >= 3) { 
                    logMsg(`🚨 3 ДУБЛІ підряд! За шахрайство — у Божкове!`); 
                    p.inJail = true; 
                    p.pos = 10; 
                    p.doublesCount = 0; 
                    document.getElementById(`tokens-10`).appendChild(document.getElementById(`token-${p.id}`)); 
                    isRolling = false;
                    if (isMyTurn()) return processNextTurn(p); 
                    return; 
                } 
                logMsg(`🎲 ДУБЛЬ! Додатковий хід.`); 
                lastRollWasDouble = true; 
            } else { 
                p.doublesCount = 0; 
            }
        }
        
        await movePlayer(lastDiceSum);
    } catch (e) { 
        console.error(e); 
        isRolling = false; 
        updateUI(); 
    }
}

async function movePlayer(steps) {
    const p = players[turn]; 
    const token = document.getElementById(`token-${p.id}`); 
    let isReversed = p.reverseMove;
    
    if (isReversed) { 
        logMsg(`⏪ <b>${p.name}</b> йде НАЗАД на ${steps} кроків!`); 
        p.reverseMove = false; 
    }
    
    for (let i = 0; i < steps; i++) {
        if (isReversed) { 
            p.pos--; 
            if (p.pos < 0) p.pos = 39; 
        } else {
            p.pos++; 
            if (p.pos >= 40) { 
                p.pos = 0;
                if (isMyTurn()) { 
                    let isExactGo = (i === steps - 1); 
                    let salary = isExactGo ? 4000 : 2000; 
                    p.money += salary; 
                    let depBonus = Math.floor(p.deposit * 0.05); 
                    if (depBonus > 0) p.deposit += depBonus; 
                    logMsg(isExactGo ? `<b>${p.name}</b> став РІВНО на СТАРТ! Премія: <b>+i₴4000</b>` : `<b>${p.name}</b> пройшов СТАРТ. Зарплата <b>+i₴2000</b>`); 
                    updateUI(); 
                }
                playSound('sfx-earn');
            }
        }
        const targetArea = document.getElementById(`tokens-${p.pos}`); 
        if (token && targetArea) {
            token.classList.add('jumping'); 
            playSound('sfx-step'); 
            await sleep(150); 
            targetArea.appendChild(token); 
            token.classList.remove('jumping'); 
            await sleep(100);
        }
    }
    
    if (isMyTurn()) {
        handleLanding(p.pos, p);
    } else {
        isRolling = false;
        updateUI();
    }
}


// === ВЗАЄМОДІЯ З КЛІТИНКАМИ ===
function handleLanding(index, p) {
    const cell = mapData[index]; 
    logMsg(`📍 <b>${p.name}</b> стає на <b>${cell.name.replace('<br>',' ')}</b>`);
  
    if (index === 30) { 
        p.pos = 10; 
        p.inJail = true; 
        p.doublesCount = 0; 
        lastRollWasDouble = false; 
        document.getElementById(`tokens-10`).appendChild(document.getElementById(`token-${p.id}`)); 
        logMsg(`<b>${p.name}</b> відправляється в Колонію!`); 
        return processNextTurn(p); 
    }
    
    if (index === 20) { 
        if (jackpotAmount > 0) { 
            let j = jackpotAmount; 
            p.money += j; 
            playSound('sfx-earn'); 
            logMsg(`🎉 <b>${p.name}</b> зірвав джекпот Парковки: <b>+i₴${j}</b>!`); 
            jackpotAmount = 0; 
            updateUI();
            
            if (!p.isBot) { 
                openModal(`🎉 ДЖЕКПОТ ПАРКОВКИ!`, `<p style="font-size:24px; color:#10b981; font-weight:bold; margin:10px 0;">+i₴${j}</p>`, `<button class="btn-green" onclick="closeModal(); processNextTurn(players[turn]);">Забрати гроші</button>`); 
            } else { 
                setTimeout(() => processNextTurn(p), 1500); 
            }
            return;
        } 
        return processNextTurn(p); 
    }
    
    if (cell.type === 'tax') { 
        if (p.isBot) { 
            setTimeout(() => executeAction(p, 'tax', index, cell.amount), 1500); 
        } else { 
            openModal(`Податок`, `<p style="font-size:16px;">Державний платіж. До сплати: <b style="color:#ef4444;">i₴${cell.amount}</b></p>`, `<button class="btn-red" onclick="confirmAction('tax', ${index}, ${cell.amount})">Заплатити</button>`); 
        }
        return; 
    }
  
    if (cell.type === 'chance' || cell.type === 'news') { 
        let isUrgent = (cell.type === 'news' && Math.random() < 0.1); 
        let deck = isUrgent ? urgentNews : (cell.type === 'chance' ? chanceCards : newsCards); 
        window.currentCard = deck[Math.floor(Math.random() * deck.length)];
        
        if (p.isBot) { 
            setTimeout(() => applyCard(), 1500); 
        } else { 
            openModal(isUrgent ? "⚡ БЛИСКАВКА" : "Картка", `<p style="font-size:16px; ${isUrgent ? 'color:#ef4444; font-weight:bold;' : ''}">${window.currentCard.text}</p>`, `<button class="btn-blue" onclick="applyCard();">Ок</button>`); 
        }
        return; 
    }

    if (cell.price) {
        const prop = properties[index];
        if (!prop) { 
            if (isOnlineMode) socket.emit('playerAction', currentLobby.id, { type: 'think', val: cell.name });
            else executeAction(p, 'think', index, cell.name);

            if (p.isBot) {
                let buffer = p.name.includes('Важк') ? 0 : 800;
                if (p.money >= cell.price + buffer) { 
                    setTimeout(() => executeAction(p, 'buy', index, cell.price), 1500); 
                } else { 
                    setTimeout(() => executeAction(p, 'pass', index, 0), 1000); 
                }
} else { 
                openModal(`Купівля`, `<p style="font-size:16px; margin-bottom:5px;">Купити <b>${cell.name.replace('<br>',' ')}</b>?</p><p style="margin-top:0;">Ціна: <b style="color:#10b981; font-size:18px;">i₴${cell.price}</b></p>`, `<button class="btn-green" onclick="confirmAction('buy', ${index}, ${cell.price})" ${p.money < cell.price ? 'disabled' : ''}>Купити</button><button class="btn-red" onclick="confirmAction('auction_start', ${index}, Math.floor(${cell.price}/2))">Аукціон</button>`); 
            }
        } else if (prop.owner !== p.id && !prop.isMortgaged) { 
            let rent = cell.baseRent;
            if (cell.type === 'utility') { 
                let c = 0; for (let i in properties) { if (properties[i].owner === prop.owner && mapData[i].type === 'utility') c++; } 
                rent = lastDiceSum * (c === 2 ? 250 : 100); 
            } else if (cell.type === 'station') { 
                let c = 0; for (let i in properties) { if (properties[i].owner === prop.owner && mapData[i].type === 'station') c++; } 
                rent = cell.baseRent * Math.pow(2, c - 1); 
            } else { 
                const rentArr = getRentArray(cell.baseRent); rent = rentArr[prop.houses]; 
                if (prop.houses === 0 && mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group).every(x => properties[x.i] && properties[x.i].owner === prop.owner)) { rent *= 2; } 
            }

            if (p.isBot) { 
                setTimeout(() => executeAction(p, 'rent', index, rent), 1500); 
            } else { 
                const owner = players.find(pl => pl.id === prop.owner);
                openModal(`Оренда`, `<p style="font-size:16px;">Власник: <b>${owner.name}</b><br>До сплати: <b style="color:#ef4444; font-size:18px;">i₴${rent}</b></p>`, `<button class="btn-red" onclick="confirmAction('rent', ${index}, ${rent})">Заплатити</button>`); 
            }
        } else { 
            processNextTurn(p); 
        }
    } else { 
        processNextTurn(p); 
    }
}


// === НЕРУХОМІСТЬ (ІНФО) ===
function showPropertyInfo(index) {
    const cell = mapData[index]; 
    if (!cell.price) return;
    
    const prop = properties[index]; 
    const ownerName = prop ? players.find(p=>p.id===prop.owner).name : "Вільна ділянка";
    const mortgageValue = cell.price / 2; 
    const unmortgageValue = mortgageValue + (mortgageValue * 0.1);
    
    let viewer = isOnlineMode ? players.find(x => x.id === myMultiplayerId) : (players.find(x => x.debtMode) || players[turn]);
    if (!viewer) viewer = players[0];

    let rentDetails = '';
    if (cell.type === 'station') { 
        rentDetails = `Оренда залежить від кількості АЗС.<br>Базова: i₴${cell.baseRent} (х2, х4, х8)`; 
    } else if (cell.type === 'utility') { 
        rentDetails = `Оренда: Сума кубиків × 100 (або × 250)`; 
    } else { 
        const rentArr = getRentArray(cell.baseRent); 
        rentDetails = `Оренда: <b style="color:#10b981;">i₴${rentArr[0]}</b><br>
            <div class="prop-card-row"><span>З 1 Будинком</span><span>i₴${rentArr[1]}</span></div>
            <div class="prop-card-row"><span>З 2 Будинками</span><span>i₴${rentArr[2]}</span></div>
            <div class="prop-card-row"><span>З 3 Будинками</span><span>i₴${rentArr[3]}</span></div>
            <div class="prop-card-row"><span>З 4 Будинками</span><span>i₴${rentArr[4]}</span></div>
            <div class="prop-card-row"><span style="color:#ef4444;font-weight:bold;">З ГОТЕЛЕМ</span><span style="color:#ef4444;font-weight:bold;">i₴${rentArr[5]}</span></div>`; 
    }

    let html = `
        <div class="prop-card">
            <div class="prop-card-header" style="background-color: ${colors[cell.group]}; color: ${cell.group==='yellow'||cell.group==='none'?'#000':'#fff'}">${cell.name.replace('<br>',' ')}</div>
            <div class="prop-card-body">${rentDetails}</div>
            <div class="prop-card-footer">
                <div>Вартість будинку: <b style="color:#10b981;">i₴${cell.housePrice || '-'}</b></div>
                <div>Сума застави: <b style="color:#f59e0b;">i₴${mortgageValue}</b></div>
                <div style="margin-top:8px; font-weight:bold; font-size:14px;">Власник: ${ownerName} ${prop && prop.isMortgaged ? '<span style="color:#ef4444;">(ЗАСТАВА)</span>' : ''}</div>
            </div>
        </div>`;

    let btns = '';
    if (prop && prop.owner === viewer.id) {
        if (!prop.isMortgaged) {
            if (cell.type === 'property') {
                if (prop.houses > 0) btns += `<button class="btn-gold" onclick="sellHouse(${index})">Продати дім (+i₴${cell.housePrice / 2})</button>`;
                if (prop.houses < 5) btns += `<button class="btn-green" onclick="buildHouse(${index})" ${viewer.debtMode?'disabled':''}>Будувати дім (i₴${cell.housePrice})</button>`;
            }
            if (prop.houses === 0) btns += `<button class="btn-red" onclick="mortgage(${index}, ${mortgageValue})">Закласти (+i₴${mortgageValue})</button>`;
        } else { 
            btns += `<button class="btn-blue" onclick="unmortgage(${index}, ${unmortgageValue})" ${viewer.debtMode?'disabled':''}>Викупити (-i₴${unmortgageValue})</button>`; 
        }
    } else if (!prop) { 
        btns += `<button class="btn-blue" onclick="closeModal()">Закрити</button>`; 
    }
    
    openModal("Інформація", html, btns);
}

function mortgage(i, a) { 
    let p = players.find(x => x.debtMode) || players[turn]; 
    p.money += a; 
    properties[i].isMortgaged = true; 
    playSound('sfx-earn'); 
    updateUI(); 
    checkDebtResolution(); 
    closeModal(); 
    broadcastState(); 
}

function unmortgage(i, a) { 
    let p = players.find(x => x.debtMode) || players[turn]; 
    if (p.money < a) return alert("Немає грошей!"); 
    p.money -= a; 
    properties[i].isMortgaged = false; 
    playSound('sfx-spend'); 
    updateUI(); 
    checkDebtResolution(); 
    closeModal(); 
    broadcastState(); 
}

function buildHouse(index) {
    const p = players[turn]; 
    const cell = mapData[index]; 
    const prop = properties[index]; 
    if (p.debtMode) return;
    
    let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group);
    if (!groupCells.every(x => properties[x.i] && properties[x.i].owner === p.id)) return alert("Скупи всі ділянки цього кольору!");
    
    let minHouses = 5; 
    groupCells.forEach(x => { if (properties[x.i].houses < minHouses) minHouses = properties[x.i].houses; });
    
    if (prop.houses >= 5) return alert("Тут вже стоїть готель!"); 
    if (prop.houses > minHouses) return alert("Будуй рівномірно!");
    if (p.money < cell.housePrice) return alert("Не вистачає грошей!");
    
    p.money -= cell.housePrice; 
    prop.houses++; 
    playSound('sfx-spend'); 
    updateUI(); 
    logMsg(`<b>${p.name}</b> будує дім на <b>${cell.name.replace('<br>',' ')}</b>.`); 
    drawHouses(index, prop.houses); 
    closeModal(); 
    broadcastState();
}

function sellHouse(index) {
    const p = players.find(x => x.debtMode) || players[turn]; 
    const cell = mapData[index]; 
    const prop = properties[index];
    
    let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group); 
    let maxHouses = 0; 
    groupCells.forEach(x => { if (properties[x.i].houses > maxHouses) maxHouses = properties[x.i].houses; });
    
    if (prop.houses < maxHouses) return alert("Продавай рівномірно! Почни з ділянок, де будинків більше.");
    
    let refund = cell.housePrice / 2; 
    p.money += refund; 
    prop.houses--; 
    playSound('sfx-earn'); 
    updateUI(); 
    logMsg(`<b>${p.name}</b> продає дім за i₴${refund}.`); 
    drawHouses(index, prop.houses); 
    checkDebtResolution(); 
    closeModal(); 
    broadcastState();
}

function drawHouses(index, count) { 
    const hCont = document.getElementById(`houses-${index}`); 
    if(!hCont) return;
    hCont.innerHTML = ''; 
    if (count < 5) { 
        for (let i = 0; i < count; i++) hCont.innerHTML += `<div class="house-icon"></div>`; 
    } else { 
        hCont.innerHTML = `<div class="hotel-icon"></div>`; 
    } 
}


// === КАРТКИ ТА ПОДІЇ ===
function payTax(amount) { 
    deductMoney(players[turn], amount); 
    logMsg(`Сплачено податок: i₴${amount}`); 
    closeModal(); 
    if (!processDebts()) processNextTurn(players[turn]); 
}

function applyCard() {
    let p = players[turn]; 
    let c = window.currentCard; 
    closeModal();

    // ПОВІДОМЛЯЄМО ВСІХ ПРО ПОДІЮ
    let cardMsg = `🃏 <b><span style="color:${p.color}">${p.name}</span></b>: ${c.text}`;
    if (isOnlineMode) {
        socket.emit('playerAction', currentLobby.id, { type: 'chat', val: cardMsg });
    } else {
        logMsgLocal(cardMsg);
    }
    
    if (c.action === 'pay') {
        deductMoney(p, c.val); 
    } else if (c.action === 'receive') { 
        p.money += c.val; 
        playSound('sfx-earn'); 
    } else if (c.action === 'goto') { 
        p.pos = c.val; 
        document.getElementById(`tokens-${c.val}`).appendChild(document.getElementById(`token-${p.id}`)); 
        setTimeout(() => handleLanding(p.pos, p), 300); 
        return; 
    } else if (c.action === 'skip-turn') { 
        p.skipTurns += c.val; 
        logMsg(`🛑 <b>${p.name}</b> пропускає хід!`); 
    } else if (c.action === 'reverse-move') { 
        p.reverseMove = true; 
        logMsg(`⏪ Наступного ходу <b>${p.name}</b> піде назад!`); 
    } else if (c.action === 'nabu-tax') { 
        let count = 0; 
        for (let i in properties) { if (properties[i].owner === p.id) count++; } 
        let tax = count * c.val; 
        deductMoney(p, tax); 
        logMsg(`НАБУ перевірило ${count} ділянок. Штраф: i₴${tax}`); 
    } else if (c.action === 'birthday') { 
        let total = 0; 
        players.forEach(pl => { 
            if (!pl.isBankrupt && pl.id !== p.id) { 
                deductMoney(pl, c.val); 
                total += c.val; 
                logMsg(`🎁 ${pl.name} дарує i₴${c.val}.`); 
            } 
        }); 
        p.money += total; 
        playSound('sfx-earn'); 
    } else if (c.action === 'global-pay') { 
        players.forEach(pl => { 
            if (!pl.isBankrupt) { deductMoney(pl, c.val); } 
        }); 
        logMsg(`Усі скинулися по i₴${c.val}.`); 
    } else if (c.action === 'global-receive') { 
        players.forEach(pl => { 
            if (!pl.isBankrupt) pl.money += c.val; 
        }); 
        logMsg(`Усі отримали по i₴${c.val}.`); 
        playSound('sfx-earn'); 
    } else if (c.action === 'target-pay' || c.action === 'target-receive') {
        let totalEffect = 0; 
        players.forEach(pl => { 
            if (pl.isBankrupt) return; 
            let count = 0; 
            for (let i in properties) { 
                if (mapData[i].group === c.group && properties[i].owner === pl.id) count++; 
            }
            if (count > 0) { 
                let amt = count * c.val; 
                totalEffect += amt; 
                if (c.action === 'target-pay') { 
                    deductMoney(pl, amt); 
                    logMsg(`${pl.name} платить i₴${amt}.`); 
                } else { 
                    pl.money += amt; 
                    logMsg(`${pl.name} отримує i₴${amt}.`); 
                    playSound('sfx-earn'); 
                } 
            } 
        });
        if (totalEffect === 0) logMsg(`Нікого не зачепило.`);
    } else if (c.action === 'pay-owners') {
        let owners = {}; 
        for (let i in properties) { 
            if (mapData[i].group === c.group && !properties[i].isMortgaged) { 
                let oid = properties[i].owner; 
                owners[oid] = (owners[oid] || 0) + 1; 
            } 
        }
        let totalPaid = 0; 
        players.forEach(pl => { 
            if (pl.isBankrupt) return; 
            if (!owners[pl.id]) { 
                deductMoney(pl, c.val); 
                totalPaid += c.val; 
            } 
        });
        let activeOwners = Object.keys(owners).filter(oid => !players.find(x => x.id == oid).isBankrupt);
        if (activeOwners.length > 0 && totalPaid > 0) {
            let totalProps = activeOwners.reduce((sum, oid) => sum + owners[oid], 0);
            activeOwners.forEach(oid => { 
                let share = Math.floor(totalPaid * (owners[oid] / totalProps)); 
                players.find(x => x.id == oid).money += share; 
                logMsg(`💼 Власник отримує i₴${share} прибутку.`); 
            }); 
            playSound('sfx-earn');
        }
    } else if (c.action === 'house-tax') {
        players.forEach(pl => { 
            if (pl.isBankrupt) return; 
            let tax = 0; 
            for (let i in properties) { 
                if (properties[i].owner === pl.id) { 
                    let h = properties[i].houses; 
                    if (h === 5) tax += c.hotel; 
                    else if (h > 0) tax += (h * c.house); 
                } 
            }
            if (tax > 0) { 
                deductMoney(pl, tax); 
                logMsg(`${pl.name} платить i₴${tax} податку на будівлі.`); 
            } 
        });
    }
    updateUI(); 
    if (!processDebts()) processNextTurn(p);
}


// === БОРГИ ТА БАНКРУТСТВО ===
function deductMoney(p, amount) { 
    p.money -= amount; 
    jackpotAmount += Math.ceil(amount * jackpotRate); 
    playSound('sfx-spend'); 
}

function processDebts() {
    players.forEach(p => { 
        if (p.money < 0 && p.deposit > 0 && !p.isBankrupt) { 
            let needed = Math.abs(p.money); 
            let w = Math.min(needed, p.deposit); 
            p.deposit -= w; 
            p.money += w; 
            logMsg(`🏦 Авто-зняття i₴${w} з Банки гравця ${p.name}.`); 
        } 
    });
    
    let debtor = players.find(p => p.money < 0 && !p.isBankrupt);
    if (debtor) {
        debtor.debtMode = true; 
        
        // ФІКС: Кажемо грі, що кубики вже впали, щоб РОЗБЛОКУВАТИ КНОПКИ
        isRolling = false; 
        
        updateUI();
        
        if (!debtAlertShown) {
            let amIActive = (!isOnlineMode || debtor.id === myMultiplayerId);
            if (debtor.isBot) { 
                setTimeout(() => forceBankrupt(), 2000); 
            } else if (amIActive) { 
                openModal(`🚨 УВАГА: БОРГ!`, `<p>Ти пішов у мінус на <b style="color:#ef4444; font-size:18px;">i₴${Math.abs(debtor.money)}</b>.</p><p style="font-size:13px; color:#94a3b8;">Продай акції, заклади майно, візьми кредит або оголоси банкрутство (Здатися).</p>`, `<button class="btn-blue" onclick="closeModal()">Зрозуміло</button>`); 
                debtAlertShown = true; 
            }
        }
        return true; 
    }
    return false; 
}

function checkDebtResolution() {
    let debtor = players.find(p => p.debtMode);
    if (debtor && debtor.money >= 0) {
        debtor.debtMode = false; 
        debtAlertShown = false; 
        logMsg(`✅ <b>${debtor.name}</b> успішно погасив заборгованість.`);
        if (!processDebts()) { 
            updateUI(); 
            if (isRolling) { processNextTurn(debtor); } 
            broadcastState(); 
        }
    }
}

function giveUpConfirm() { 
    if (!isMyTurn()) return;
    let p = players.find(x => x.debtMode) || players[turn]; 
    openModal("🏳️ Здатися", `<p style="font-size:16px;"><b>${p.name}</b>, ти дійсно хочеш оголосити себе банкрутом і вийти з гри?</p>`, `<button class="btn-red" onclick="forceBankrupt()">Так, я банкрут</button><button class="btn-blue" onclick="closeModal()">Ні, я ще поборюсь</button>`); 
}

function forceBankrupt() { 
    let p = players.find(x => x.debtMode) || players[turn]; 
    p.money = -1; 
    p.isBankrupt = true; 
    p.debtMode = false; 
    p.deposit = 0; 
    debtAlertShown = false;
    
    let tokenEl = document.getElementById(`token-${p.id}`); 
    if (tokenEl) tokenEl.remove();
    
    stocks.GOV.issued -= p.portfolio.GOV; 
    p.portfolio.GOV = 0;
    
    for (let i in properties) { 
        if (properties[i].owner === p.id) { 
            delete properties[i]; 
            let houseCont = document.getElementById(`houses-${i}`);
            if(houseCont) houseCont.innerHTML = ''; 
            document.getElementById(`cell-${i}`).style.borderColor = '#cbd5e1'; 
            document.getElementById(`owner-${i}`).style.backgroundColor = 'transparent'; 
        } 
    }
    
    logMsg(`💀 <b>${p.name}</b> ОГОЛОСИВ БАНКРУТСТВО! Майно повернуто банку.`); 
    playSound('sfx-bankrupt'); 
    closeModal(); 
    updateUI(); 

    let active = players.filter(pl => !pl.isBankrupt);
    if (active.length === 1) { 
        openModal("🏆 ГРУ ЗАВЕРШЕНО!", `<h1 style="color:${active[0].color}; font-size:30px; text-shadow:0 0 15px ${active[0].color}88;">${active[0].name} ПЕРЕМІГ!</h1>`, `<button class="btn-green" onclick="window.location.reload()">Нова гра</button>`); 
        broadcastState(); 
        return; 
    }
    
    if (!processDebts()) { 
        processNextTurn(p);
    } 
}
function openAuctionModal() {
    let cell = mapData[window.auctionData.idx];
    let leaderName = window.auctionData.highestBidder !== -1 ? players.find(p => p.id === window.auctionData.highestBidder).name : "немає";
    
    let finishBtn = (isOnlineMode && players.find(p=>p.id===myMultiplayerId)?.isHost) 
        ? `<button class="btn-blue" style="margin-top:10px; width:100%;" onclick="confirmAction('auction_finish', window.auctionData.idx, 0)">Закрити торги (Ви Хост)</button>` 
        : (!isOnlineMode ? `<button class="btn-blue" style="margin-top:10px; width:100%;" onclick="confirmAction('auction_finish', window.auctionData.idx, 0)">Віддати лідеру</button>` : '');

    openModal(`🔨 АУКЦІОН: ${cell.name.replace('<br>',' ')}`, 
        `<p style="font-size:18px;">Ставка: <b id="auc-bid" style="color:#10b981;">i₴${window.auctionData.highestBid}</b></p>
         <p>Лідер: <span id="auc-leader" style="color:#f59e0b; font-weight:bold;">${leaderName}</span></p>`,
        `<div style="display:flex; gap:5px; margin-bottom:5px;">
            <button class="btn-green" onclick="confirmAction('auction_bid', window.auctionData.idx, window.auctionData.highestBid + 100)">+100</button>
            <button class="btn-gold" onclick="confirmAction('auction_bid', window.auctionData.idx, window.auctionData.highestBid + 500)">+500</button>
         </div>
         <button class="btn-red" style="width:100%;" onclick="confirmAction('auction_pass', window.auctionData.idx, 0)">Я пас (не беру участь)</button>
         ${finishBtn}`
    );
}
// === ПРОФІЛЬ, ЛОГІН ТА МАГАЗИН ===

function updateProfileUI() {
    const ids = ['auth-form', 'profile-info', 'shop-auth-warning', 'shop-container', 'friends-auth-warning', 'friends-container', 'game-header'];
    const el = {};
    ids.forEach(id => el[id] = document.getElementById(id));

    if (currentUser) {
        if (el['auth-form']) el['auth-form'].style.display = 'none';
        if (el['profile-info']) el['profile-info'].style.display = 'block';
        if (el['shop-auth-warning']) el['shop-auth-warning'].style.display = 'none';
        if (el['shop-container']) el['shop-container'].style.display = 'block';
        if (el['friends-auth-warning']) el['friends-auth-warning'].style.display = 'none';
        if (el['friends-container']) el['friends-container'].style.display = 'block';
        if (el['game-header']) el['game-header'].style.display = 'flex';

        const setTxt = (id, txt) => { if(document.getElementById(id)) document.getElementById(id).innerText = txt; };
        setTxt('header-galushky', currentUser.galushky || 0);
        setTxt('header-user-name', currentUser.nick);
        setTxt('user-display-name', currentUser.nick);
        setTxt('user-wins', currentUser.wins || 0);
        setTxt('user-coins', (currentUser.galushky || 0) + " 🥟");
        setTxt('shop-balance', (currentUser.galushky || 0) + " 🥟");

        ['token_gold', 'token_bogdan', 'token_tank'].forEach(item => {
            let btn = document.getElementById('equip-' + item);
            if(btn) {
                if (currentUser.inventory && currentUser.inventory.includes(item)) {
                    btn.style.display = 'block'; 
                    btn.innerText = (currentUser.equippedToken === item) ? '✅ Вдягнено' : 'Вдягнути';
                    btn.className = (currentUser.equippedToken === item) ? 'btn-gold' : 'btn-green';
                } else {
                    btn.style.display = 'none';
                }
            }
        });
    } else {
        if (el['auth-form']) el['auth-form'].style.display = 'block';
        if (el['profile-info']) el['profile-info'].style.display = 'none';
        if (el['shop-auth-warning']) el['shop-auth-warning'].style.display = 'block';
        if (el['shop-container']) el['shop-container'].style.display = 'none';
        if (el['friends-auth-warning']) el['friends-auth-warning'].style.display = 'block';
        if (el['friends-container']) el['friends-container'].style.display = 'none';
        if (el['game-header']) el['game-header'].style.display = 'none';
    }
}

function loginAction() {
    let nick = document.getElementById('auth-nick').value.trim();
    let pin = document.getElementById('auth-pin').value.trim();
    if (!nick || nick.length < 3) return alert("Нікнейм має бути мінімум 3 символи!");
    if (!pin || pin.length !== 4) return alert("PIN-код має складатися з 4 цифр!");
    if (socket) socket.emit('login', { nick, pin }, (res) => {
        if (res && res.success) {
            currentUser = res.user;
            localStorage.setItem('poltavaUser', JSON.stringify({ nick, pin }));
            updateProfileUI();
            alert(res.msg);
        } else alert(res.msg || "Помилка авторизації");
    });
}

function buyItemAction(itemId) {
    if (!currentUser) return alert("Спершу увійди в Профіль!");
    if (socket) socket.emit('buyItem', { nick: currentUser.nick, pin: currentUser.pin, itemId: itemId }, (res) => {
        if (res && res.success) {
            currentUser = res.user; updateProfileUI(); alert("🎉 Успішно куплено!");
        } else alert(res.msg);
    });
}

function equipItemAction(itemId) {
    if (socket) socket.emit('equipToken', { nick: currentUser.nick, pin: currentUser.pin, itemId: itemId }, (res) => {
        if (res && res.success) { currentUser = res.user; updateProfileUI(); }
    });
}

// === СИСТЕМА ТАБІВ ТА МЕНЮ ===

function switchTab(tabId) {
    const contents = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    
    contents.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active-tab');
    });
    buttons.forEach(btn => btn.classList.remove('active'));

    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.style.display = 'block';
        activeTab.classList.add('active-tab');
    }
    
    const activeBtn = document.querySelector(`button[onclick="switchTab('${tabId}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// === ОНЛАЙН ЛОГІКА ТА ЛОБІ ===

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
    if (socket && currentLobby) socket.emit('startGame', currentLobby.id);
}

function searchFriend() {
    alert("Функція друзів у розробці!");
}

// === ЗАПУСК ПРИ ЗАВАНТАЖЕННІ ===

if (socket) {
    socket.on('connect', () => {
        let saved = localStorage.getItem('poltavaUser');
        if (saved) {
            let data = JSON.parse(saved);
            socket.emit('login', { nick: data.nick, pin: data.pin }, (res) => {
                if (res && res.success) { currentUser = res.user; updateProfileUI(); }
            });
        }
    });
}
