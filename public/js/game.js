let players = []; let turn = 0; let properties = {}; 
let isRolling = false; let isOnlineMode = false;
const socket = typeof io !== 'undefined' ? io() : null;
let myMultiplayerId = null; let currentLobby = null;

const dotL = { 1:[0,0,0,0,1,0,0,0,0], 2:[1,0,0,0,0,0,0,0,1], 3:[1,0,0,0,1,0,0,0,1], 4:[1,0,1,0,0,0,1,0,1], 5:[1,0,1,0,1,0,1,0,1], 6:[1,0,1,1,0,1,1,0,1] };
const playerColors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];

if(socket) {
    socket.on('connect', () => { myMultiplayerId = socket.id; });
    socket.on('updateRoomsList', (rooms) => { /* логіка оновлення списку */ });
    socket.on('roomJoined', (room) => { currentLobby = room; switchTab(''); document.getElementById('lobby-screen').style.display='block'; document.getElementById('lobby-code').innerText=room.id; });
    socket.on('gameStarted', (state) => {
        isOnlineMode = true; players = state.players; turn = state.turn;
        document.getElementById('lobby-screen').style.display='none'; document.getElementById('main-menu').style.display='none'; document.getElementById('game-container').style.display='flex';
        render2DDie('die1', 1); render2DDie('die2', 1); initBoard(); updateUI(); logMsg(`Гру запущено!`);
    });
    socket.on('diceRolled', async (d) => { await executeRoll(d.v1, d.v2); });
    socket.on('syncAction', (action) => { processSyncAction(action); });
}

function isMyTurn() {
    if (!isOnlineMode) return true;
    return players[turn].id === myMultiplayerId;
}

function broadcastAction(actionData) {
    if (isOnlineMode && currentLobby) {
        socket.emit('playerAction', currentLobby.id, actionData);
    }
}

document.addEventListener("DOMContentLoaded", () => { generatePlayerInputs(); updateVolume(); });
function switchTab(tabId) { document.querySelectorAll('.tab-content').forEach(t => t.style.display='none'); document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); if(tabId){ document.getElementById(tabId).style.display='block'; event.currentTarget.classList.add('active'); } }

function generatePlayerInputs() {
    const c = parseInt(document.getElementById('player-count').value); const cont = document.getElementById('player-names-container'); cont.innerHTML = '';
    let defs = ['Коля', 'Надя', 'Бот', 'Бот 2', 'Гравець 5', 'Гравець 6']; 
    for(let i=0; i<c; i++) {
        let checked = defs[i].includes('Бот') ? 'checked' : '';
        cont.innerHTML += `<div style="display:flex; gap:5px;"><input type="text" id="p${i}-name" value="${defs[i]}"><label><input type="checkbox" id="p${i}-bot" ${checked}> Бот</label></div>`;
    }
}

function updateVolume() {
    let bgmVol = document.getElementById('vol-bgm').value / 100;
    let sfxVol = document.getElementById('vol-sfx').value / 100;
    document.getElementById('vol-bgm-val').innerText = `${Math.round(bgmVol*100)}%`;
    document.getElementById('vol-sfx-val').innerText = `${Math.round(sfxVol*100)}%`;
    let bgm = document.getElementById('bgm'); if(bgm) bgm.volume = bgmVol;
    ['sfx-dice', 'sfx-step', 'sfx-earn', 'sfx-spend'].forEach(id => { let el = document.getElementById(id); if(el) el.volume = sfxVol; });
}
function changeRadio() {
    let val = document.getElementById('setting-radio').value; let bgm = document.getElementById('bgm');
    if(!val) { bgm.pause(); } else { bgm.src = val; bgm.play().catch(e=>console.log("Автоплей заблоковано")); }
}
function playSound(id) { let el = document.getElementById(id); if(el) { el.currentTime = 0; el.play().catch(e=>{}); } }

function startLocalGame() {
    isOnlineMode = false;
    let count = parseInt(document.getElementById('player-count').value);
    let startMoney = parseInt(document.getElementById('start-money').value) || 15000;
    players = [];
    for(let i=0; i<count; i++) {
        players.push({
            id: i, name: document.getElementById(`p${i}-name`).value, color: playerColors[i],
            isBot: document.getElementById(`p${i}-bot`).checked, money: startMoney, pos: 0, isBankrupt: false
        });
    }
    document.getElementById('main-menu').style.display='none'; document.getElementById('game-container').style.display='flex';
    initBoard(); updateUI(); logMsg("Локальна гра почалася!");
}

function getGridArea(i) { if (i <= 10) return { r: 11, c: 11 - i }; if (i <= 19) return { r: 11 - (i - 10), c: 1 }; if (i <= 30) return { r: 1, c: (i - 20) + 1 }; return { r: (i - 30) + 1, c: 11 }; }
function initBoard() {
  document.querySelectorAll('.cell').forEach(e => e.remove()); const board = document.getElementById('board');
  for (let i = 0; i < 40; i++) {
    const data = mapData[i]; const cell = document.createElement('div'); cell.className = `cell ${data.type === 'corner' ? 'corner' : ''}`; cell.id = `cell-${i}`;
    let pos = getGridArea(i); cell.style.gridRow = pos.r; cell.style.gridColumn = pos.c;
    let topContent = data.emoji ? `<div class="cell-emoji">${data.emoji}</div>` : ''; topContent += `<div class="cell-name">${data.name}</div>`;
    if (data.group && colors[data.group]) cell.innerHTML += `<div class="district-bar" style="background:${colors[data.group]}"></div>`;
    cell.innerHTML += `${topContent}<div class="tokens-area" id="tokens-${i}"></div>`;
    if (data.price) cell.innerHTML += `<div class="cell-price">i₴${data.price}</div>`;
    board.appendChild(cell);
  }
  players.forEach(p => { const t = document.createElement('div'); t.id = `token-${p.id}`; t.className = 'pawn'; t.style.background = p.color; document.getElementById('tokens-0').appendChild(t); });
}

function updateUI() {
    const dash = document.getElementById('dashboard'); dash.innerHTML = '';
    players.forEach(p => {
        let activeClass = (p.id === players[turn].id) ? 'active-player-stat' : '';
        dash.innerHTML += `<div class="player-stat ${activeClass}"><div><div class="color-dot" style="background:${p.color}"></div>${p.name} ${p.isBot?'🤖':''}</div><span style="color:${p.money<0?'#ef4444':'#10b981'}">i₴${p.money}</span></div>`;
    });
    document.getElementById('current-turn').innerHTML = `Хід: <b style="color:${players[turn].color}">${players[turn].name}</b>`;
    document.getElementById('roll-btn').disabled = (!isMyTurn() || isRolling || players[turn].isBot);

    // БОТ ХОДИТЬ САМ
    if (!isOnlineMode && players[turn].isBot && !isRolling) {
        setTimeout(() => userClickedRoll(), 1500);
    }
}

function logMsg(msg) { const log = document.getElementById('log'); log.innerHTML = `<div style="margin-bottom:5px;">${msg}</div>` + log.innerHTML; }
function openModal(t, b, btn) { document.getElementById('modal-title').innerHTML = t; document.getElementById('modal-body').innerHTML = b; document.getElementById('modal-buttons').innerHTML = btn; document.getElementById('modal-overlay').style.display = 'flex'; }
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

function userClickedRoll() {
    if (isOnlineMode) { socket.emit('rollDice', currentLobby.id); } 
    else { let v1 = Math.floor(Math.random()*6)+1; let v2 = Math.floor(Math.random()*6)+1; executeRoll(v1, v2); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
function render2DDie(id, num) { document.getElementById(id).innerHTML = dotL[num].map(v=>`<div class="dot ${v===0?'hidden':''}"></div>`).join(''); }

async function executeRoll(v1, v2) {
    isRolling = true; updateUI(); playSound('sfx-dice');
    for(let i=0; i<10; i++) { render2DDie('die1', Math.floor(Math.random()*6)+1); render2DDie('die2', Math.floor(Math.random()*6)+1); await sleep(50); }
    render2DDie('die1', v1); render2DDie('die2', v2); await sleep(300);
    await movePlayer(v1 + v2);
}

async function movePlayer(steps) {
    const p = players[turn]; const token = document.getElementById(`token-${p.id}`);
    for (let i = 0; i < steps; i++) {
        p.pos++; if (p.pos >= 40) { p.pos = 0; p.money += 2000; playSound('sfx-earn'); logMsg(`<b>${p.name}</b> пройшов СТАРТ. +i₴2000`); }
        document.getElementById(`tokens-${p.pos}`).appendChild(token); playSound('sfx-step'); await sleep(150);
    }
    // ЖОРСТКА СИНХРОНІЗАЦІЯ: Тільки той, чий хід, викликає вікна
    if (isMyTurn() || (!isOnlineMode && p.isBot)) {
        handleLanding(p.pos, p);
    } else {
        logMsg(`Очікуємо рішення гравця ${p.name}...`);
    }
}

function handleLanding(index, p) {
    const cell = mapData[index];
    logMsg(`📍 <b>${p.name}</b> стає на <b>${cell.name.replace('<br>',' ')}</b>`);
    
    if (cell.price) {
        if (!properties[index]) {
            // КУПІВЛЯ
            if (p.isBot) {
                if (p.money >= cell.price + 500) { setTimeout(() => actionBuy(index), 1000); } else { setTimeout(() => actionPass(), 1000); }
            } else {
                openModal(`Купівля`, `<p>Купити <b>${cell.name.replace('<br>',' ')}</b> за <b>i₴${cell.price}</b>?</p>`, `<button class="btn-green" onclick="actionBuy(${index})">Купити</button><button class="btn-red" onclick="actionPass()">Відмовитись</button>`);
            }
        } else if (properties[index].owner !== p.id) {
            // ОРЕНДА
            let owner = players.find(x => x.id === properties[index].owner);
            let rent = cell.baseRent; // Спрощено для прикладу
            if (p.isBot) { setTimeout(() => actionPayRent(index, owner.id, rent), 1000); }
            else { openModal(`Оренда`, `<p>Власник: ${owner.name}<br>Сплатити: <b>i₴${rent}</b></p>`, `<button class="btn-red" onclick="actionPayRent(${index}, ${owner.id}, ${rent})">Сплатити</button>`); }
        } else { actionPass(); }
    } else if (cell.type === 'tax') {
        if (p.isBot) { setTimeout(() => actionPayTax(cell.amount), 1000); }
        else { openModal(`Податок`, `<p>Сплатити податок: <b>i₴${cell.amount}</b></p>`, `<button class="btn-red" onclick="actionPayTax(${cell.amount})">Сплатити</button>`); }
    } else {
        actionPass();
    }
}

// Функції дій (Відправляють на сервер, якщо онлайн, або виконують локально)
function actionBuy(idx) { broadcastAction({type: 'buy', idx: idx}); processBuy(idx); closeModal(); }
function actionPass() { broadcastAction({type: 'pass'}); processPass(); closeModal(); }
function actionPayRent(idx, oid, r) { broadcastAction({type: 'rent', idx: idx, oid: oid, r: r}); processRent(idx, oid, r); closeModal(); }
function actionPayTax(amt) { broadcastAction({type: 'tax', amt: amt}); processTax(amt); closeModal(); }

// Обробка дій (для всіх клієнтів)
function processSyncAction(action) {
    if(action.type === 'buy') processBuy(action.idx);
    if(action.type === 'pass') processPass();
    if(action.type === 'rent') processRent(action.idx, action.oid, action.r);
    if(action.type === 'tax') processTax(action.amt);
}

function processBuy(index) {
    let p = players[turn]; p.money -= mapData[index].price; properties[index] = { owner: p.id };
    document.getElementById(`cell-${index}`).style.borderColor = p.color;
    playSound('sfx-spend'); logMsg(`<b>${p.name}</b> купив ділянку.`); passTurn();
}
function processPass() { passTurn(); }
function processRent(index, ownerId, rent) {
    let p = players[turn]; let o = players.find(x=>x.id === ownerId); p.money -= rent; o.money += rent;
    playSound('sfx-spend'); logMsg(`<b>${p.name}</b> сплатив оренду.`); passTurn();
}
function processTax(amt) { players[turn].money -= amt; playSound('sfx-spend'); logMsg(`Сплачено податок.`); passTurn(); }

function passTurn() {
    isRolling = false;
    turn = (turn + 1) % players.length;
    updateUI();
}
