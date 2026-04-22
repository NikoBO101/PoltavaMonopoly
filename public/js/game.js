// === ГЛОБАЛЬНІ ЗМІННІ ===
let players = []; 
let turn = 0; 
let properties = {}; 
let jackpotAmount = 0;
let lastRollWasDouble = false; 
let lastDiceSum = 0; 
let isRolling = false;
let currentRound = 1; 
let debtAlertShown = false; 
let jackpotRate = 0.5;
let isOnlineMode = false;

// Повноцінна Біржа
let stocks = { 
    PTC: { price: 500, pool: 0, trend: 'up', noVisit: 0 }, 
    RTL: { price: 1000, pool: 0, trend: 'up', noVisit: 0 }, 
    TRN: { price: 1000, pool: 0, trend: 'up', noVisit: 0 }, 
    PST: { price: 1000, pool: 0, trend: 'up', noVisit: 0 }, 
    GOV: { price: 2000, pool: 0, totalMax: 50, issued: 0, trend: 'up' } 
};

// Мережеві змінні
const socket = typeof io !== 'undefined' ? io() : null;
let myMultiplayerId = null; 
let currentLobby = null; 
let pendingTrade = null;

function stopTimer() {}
const sleep = ms => new Promise(r => setTimeout(r, ms));


// === МЕРЕЖЕВА ЛОГІКА (SOCKET.IO) ===
if (socket) {
    socket.on('connect', () => { 
        myMultiplayerId = socket.id; 
    });
    
    socket.on('globalOnlineCount', (count) => { 
        let el = document.getElementById('online-badge'); 
        if(el) el.innerText = `🟢 Онлайн: ${count}`; 
    });
    
    socket.on('updateRoomsList', (roomsList) => {
        const container = document.getElementById('mp-room-list'); 
        if (!container) return;
        if (roomsList.length === 0) { 
            container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:10px;">Немає відкритих кімнат.</div>'; 
            return; 
        }
        let html = '';
        roomsList.forEach(r => {
            let lock = r.hasPassword ? '🔒' : '🔓'; 
            let status = r.status === 'waiting' ? '<span style="color:#10b981;">Очікування</span>' : '<span style="color:#ef4444;">В грі</span>';
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.3); border-radius:8px; margin-bottom:5px;">
                    <div>
                        <b>${r.name}</b> <span style="font-size:10px; color:#94a3b8;">(Код: ${r.id})</span><br>
                        <span style="font-size:11px;">${lock} Гравців: ${r.playersCount}/6 | ${status}</span>
                    </div>
                    <button class="btn-green" style="width:auto; margin:0;" onclick="joinRoomFromList('${r.id}', ${r.hasPassword})">Увійти</button>
                </div>`;
        });
        container.innerHTML = html;
    });
    
    socket.on('roomJoined', (roomData) => {
        currentLobby = roomData; 
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none'); 
        document.querySelectorAll('.menu-tabs').forEach(t => t.style.display = 'none');
        document.getElementById('lobby-screen').style.display = 'block'; 
        document.getElementById('lobby-code').innerText = roomData.id; 
        renderLobbyPlayers(roomData.players);
    });
    
    socket.on('roomPlayersUpdated', (playersList) => { 
        if (currentLobby) { 
            currentLobby.players = playersList; 
            renderLobbyPlayers(playersList); 
        } 
    });
    
    socket.on('joinError', (msg) => { alert(msg); });

    socket.on('gameStarted', (serverGameState) => {
        isOnlineMode = true; 
        currentRound = serverGameState.currentRound; 
        turn = serverGameState.turn; 
        
        // Виправляємо баг з відсутністю кольору фішки
        players = serverGameState.players.map((p, i) => ({
            ...p, 
            color: playerColors[i % playerColors.length], 
            money: 15000, deposit: 0, loan: 0, loanTurns: 0, pos: 0, 
            inJail: false, jailTurns: 0, doublesCount: 0, isBankrupt: false, 
            skipTurns: 0, reverseMove: false, portfolio: { PTC: 0, RTL: 0, TRN: 0, PST: 0, GOV: 0 }, 
            stockHistory: [], debtMode: false
        }));
        
        document.getElementById('lobby-screen').style.display = 'none'; 
        document.getElementById('main-menu').style.display = 'none'; 
        document.getElementById('game-container').style.display = 'flex';
        
        render2DDie('die1', 1); 
        render2DDie('die2', 1); 
        initBoard(); 
        updateUI(); 
        logMsg(`🎮 Онлайн гру запущено!`);
    });

    socket.on('diceRolled', async (data) => {
        // Використовуємо ту саму логіку, що й у локальній грі, щоб не було зависань
        await processRollAndMove(data.v1, data.v2);
    });

    socket.on('updateGameState', (stateData) => {
        players = stateData.players; 
        properties = stateData.properties; 
        turn = stateData.turn; 
        jackpotAmount = stateData.jackpotAmount; 
        stocks = stateData.stocks; 
        currentRound = stateData.currentRound || currentRound;
        
        players.forEach(p => { 
            const token = document.getElementById(`token-${p.id}`); 
            const target = document.getElementById(`tokens-${p.pos}`); 
            if (token && target) target.appendChild(token); 
        });
        for (let i in properties) {
            drawHouses(i, properties[i].houses);
        }
        updateUI();
    });
}

function broadcastState() { 
    if (isOnlineMode && isMyTurn() && currentLobby) { 
        socket.emit('syncGameState', currentLobby.id, { 
            players, properties, turn, jackpotAmount, stocks, currentRound 
        }); 
    } 
}

function isMyTurn() { 
    if (!isOnlineMode) return true; 
    let activeP = players.find(x => x.debtMode) || players[turn]; 
    return activeP && activeP.id === myMultiplayerId; 
}


// === ІНІЦІАЛІЗАЦІЯ ТА UI ===
document.addEventListener("DOMContentLoaded", () => { 
    generatePlayerInputs(); 
    updateVolume(); 
});

function switchTab(tabId) { 
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(tabId).classList.add('active'); 
    event.currentTarget.classList.add('active'); 
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

function updateVolume() {
    let bgmVol = document.getElementById('vol-bgm') ? document.getElementById('vol-bgm').value / 100 : 0.2; 
    let sfxVol = document.getElementById('vol-sfx') ? document.getElementById('vol-sfx').value / 100 : 0.5;
    
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
        bgm.play().catch(e => console.log("Автовідтворення заблоковано браузером")); 
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
    socket.emit('joinRoom', { roomId: code, playerName: pName, password: document.getElementById('mp-join-pass').value.trim() }); 
}

function startOnlineGameAction() { 
    if (socket && currentLobby) { 
        socket.emit('startGame', currentLobby.id); 
    } 
}

function startLocalGame() {
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
            debtMode: false 
        });
    }
    
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('game-container').style.display = 'flex';
    
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
        token.style.backgroundColor = p.color; 
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
    if (activeP && activeP.loan > 0 && btnLoan) { 
        btnLoan.innerText = `💳 Погасити (i₴2500)`; 
        btnLoan.className = 'btn-red'; 
    } else if (btnLoan) { 
        btnLoan.innerText = `💳 Кредит`; 
        btnLoan.className = 'btn-purple'; 
    }
  
    let canAct = isMyTurn() && !isRolling;
    
    let btnRoll = document.getElementById('roll-btn');
    if (btnRoll) btnRoll.disabled = !canAct || (players[turn] && players[turn].isBot && !isOnlineMode);
    
    ['trade-btn', 'deposit-btn', 'crypto-btn', 'inv-btn', 'giveup-btn'].forEach(id => {
        let btn = document.getElementById(id);
        if (btn) btn.disabled = !canAct;
    });
  
    updatePropertyColors();
    checkBotTurn();
}

function logMsgLocal(msg) { 
    const log = document.getElementById('log'); 
    log.innerHTML = `<div style="margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">• ${msg}</div>` + log.innerHTML; 
    log.scrollTop = 0;
}

function logMsg(msg) { 
    logMsgLocal(msg); 
    broadcastState(); 
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
    
    for (let i of [...pGive, ...pTake]) { 
        for (let j in properties) { 
            if (mapData[j].group === mapData[i].group && properties[j].houses > 0) return alert(`Спершу продайте всі будинки в цьому районі!`); 
        } 
    }
    
    if (mGive === 0 && mTake === 0 && pGive.length === 0 && pTake.length === 0) return alert("Угода порожня!");
    pendingTrade = { p1, p2, mGive, mTake, pGive, pTake };

    if (!isOnlineMode && p2.isBot) {
        let valGive = mGive, valTake = mTake;
        pGive.forEach(i => valGive += mapData[i].price); 
        pTake.forEach(i => valTake += mapData[i].price);
        
        let profitMargin = p2.name.includes('Важк') ? 500 : 100;
        
        if (valGive >= valTake + profitMargin) { 
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

// Виправлено: єдина логіка для онлайну та локалки, щоб не було зависань
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
            if (isMyTurn()) return nextTurn(); 
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
                    if (isMyTurn()) return nextTurn(); 
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
                    if (isMyTurn()) return nextTurn(); 
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
                playSound('sfx-step');
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
    
    // Виправлено: тільки активний гравець викликає картки і купівлю
    if (isMyTurn()) {
        handleLanding(p.pos, p);
    } else {
        // Інші гравці розблоковують інтерфейс і чекають рішення
        isRolling = false; 
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
        return nextTurn(); 
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
                openModal(`🎉 ДЖЕКПОТ ПАРКОВКИ!`, `<p style="font-size:24px; color:#10b981; font-weight:bold; margin:10px 0;">+i₴${j}</p>`, `<button class="btn-green" onclick="closeModal(); nextTurn();">Забрати гроші</button>`); 
            } else { 
                setTimeout(() => nextTurn(), 1500); 
            }
            return;
        } 
        return nextTurn(); 
    }
    
    if (cell.type === 'tax') { 
        if (p.isBot) { 
            setTimeout(() => payTax(cell.amount), 1500); 
        } else { 
            openModal(`Податок`, `<p style="font-size:16px;">Державний платіж. До сплати: <b style="color:#ef4444;">i₴${cell.amount}</b></p>`, `<button class="btn-red" onclick="payTax(${cell.amount})">Заплатити</button>`); 
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
            // КУПІВЛЯ
            if (p.isBot) {
                let buffer = p.name.includes('Важк') ? 0 : 800;
                if (p.money >= cell.price + buffer) { 
                    setTimeout(() => buyProperty(index), 1500); 
                } else { 
                    setTimeout(() => skipProperty(), 1000); 
                }
            } else { 
                openModal(`Купівля`, `<p style="font-size:16px; margin-bottom:5px;">Купити <b>${cell.name.replace('<br>',' ')}</b>?</p><p style="margin-top:0;">Ціна: <b style="color:#10b981; font-size:18px;">i₴${cell.price}</b></p>`, `<button class="btn-green" onclick="buyProperty(${index})" ${p.money < cell.price ? 'disabled' : ''}>Купити</button><button class="btn-red" onclick="skipProperty()">Відмовитись</button>`); 
            }
        } else if (prop.owner !== p.id && !prop.isMortgaged) { 
            payRent(index, p, prop); 
        } else { 
            nextTurn(); 
        }
    } else { 
        nextTurn(); 
    }
}

function buyProperty(index) {
    const p = players[turn]; 
    const cell = mapData[index]; 
    p.money -= cell.price; 
    properties[index] = { owner: p.id, houses: 0, isMortgaged: false }; 
    playSound('sfx-spend');
    logMsg(`<b>${p.name}</b> купив <b>${cell.name.replace('<br>',' ')}</b>.`); 
    updateUI(); 
    closeModal(); 
    if (!processDebts()) nextTurn();
}

function skipProperty() { 
    closeModal(); 
    nextTurn(); 
}

function payRent(index, p, propData) {
    const cell = mapData[index]; 
    const owner = players.find(pl => pl.id === propData.owner); 
    let rent = 0;
    
    if (cell.type === 'utility') { 
        let c = 0; 
        for (let i in properties) { 
            if (properties[i].owner === owner.id && mapData[i].type === 'utility') c++; 
        } 
        rent = lastDiceSum * (c === 2 ? 250 : 100); 
    } else if (cell.type === 'station') { 
        let c = 0; 
        for (let i in properties) { 
            if (properties[i].owner === owner.id && mapData[i].type === 'station') c++; 
        } 
        rent = cell.baseRent * Math.pow(2, c - 1); 
    } else { 
        const rentArr = getRentArray(cell.baseRent); 
        rent = rentArr[propData.houses]; 
        if (propData.houses === 0) { 
            if (mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group).every(x => properties[x.i] && properties[x.i].owner === owner.id)) {
                rent *= 2; 
            }
        } 
    }

    if (p.isBot) { 
        setTimeout(() => payRentConfirm(index, owner.id, rent), 1500); 
    } else { 
        openModal(`Оренда`, `<p style="font-size:16px;">Власник: <b>${owner.name}</b><br>До сплати: <b style="color:#ef4444; font-size:18px;">i₴${rent}</b></p>`, `<button class="btn-red" onclick="payRentConfirm(${index}, ${owner.id}, ${rent})">Заплатити</button>`); 
    }
}

function payRentConfirm(index, ownerId, rent) {
    let p = players[turn]; 
    let owner = players.find(pl => pl.id === ownerId); 
    p.money -= rent; 
    owner.money += rent; 
    playSound('sfx-spend');
    logMsg(`<b>${p.name}</b> сплатив i₴${rent} гравцю <b>${owner.name}</b>.`);
    
    if (['pink', 'green', 'orange'].includes(mapData[index].group)) { stocks.RTL.pool += Math.ceil(rent * 0.1); }
    if (['yellow'].includes(mapData[index].group)) { stocks.PST.pool += Math.ceil(rent * 0.1); }
    if (['station'].includes(mapData[index].group)) { stocks.TRN.pool += Math.ceil(rent * 0.1); }
    if (mapData[index].type === 'utility') { stocks.GOV.pool += Math.ceil(rent * 0.2); }
    
    closeModal(); 
    if (!processDebts()) nextTurn();
}


// === НЕРУХОМІСТЬ (БУДІВНИЦТВО ТА ІНФО) ===
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
        btns += `<button class="btn-blue" onclick="closeModal()">Ок</button>`; 
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
    if (!processDebts()) nextTurn(); 
}

function applyCard() {
    let p = players[turn]; 
    let c = window.currentCard; 
    closeModal();
    
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
    if (!processDebts()) nextTurn();
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
            if (isRolling) { nextTurn(); } 
            broadcastState(); 
        }
    }
}

function giveUpConfirm() { 
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
        if (p.id === players[turn].id) nextTurn(); 
        else broadcastState(); 
    } 
}


// === КІНЕЦЬ ХОДУ ТА ОНОВЛЕННЯ РАУНДІВ ===
function nextTurn() { 
    isRolling = false;
    
    if (Math.random() < 0.1) { 
        stocks.PTC.price = Math.floor(stocks.PTC.price * 0.3); 
        stocks.PTC.trend = 'down'; 
        logMsg(`📉 КРАХ КРИПТИ! PTC падає до i₴${stocks.PTC.price}`); 
    } else { 
        let r = Math.random() * (1.6 - 0.7) + 0.7; 
        stocks.PTC.price = Math.floor(stocks.PTC.price * r); 
        stocks.PTC.trend = r >= 1 ? 'up' : 'down'; 
    }
    
    if (stocks.PTC.price < 50) stocks.PTC.price = 50; 
    if (stocks.PTC.price > 10000) stocks.PTC.price = 10000;
  
    ['RTL', 'TRN', 'PST'].forEach(sym => { 
        stocks[sym].noVisit++; 
        if (stocks[sym].noVisit > 4) { 
            stocks[sym].price = Math.max(100, stocks[sym].price - 100); 
            stocks[sym].trend = 'down'; 
        } 
    });
    
    distributeDividends('RTL'); 
    distributeDividends('TRN'); 
    distributeDividends('PST'); 
    distributeDividends('GOV');

    if (lastRollWasDouble && !players[turn].inJail && !players[turn].isBankrupt) { 
        lastRollWasDouble = false; 
    } else { 
        do { 
            turn = (turn + 1) % players.length; 
            if (turn === 0) currentRound++; 
        } while (players[turn].isBankrupt); 
    }
  
    updateUI(); 
    broadcastState();
}
