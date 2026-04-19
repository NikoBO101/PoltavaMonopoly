let players = []; let turn = 0; let properties = {}; let jackpotAmount = 0;
let lastRollWasDouble = false; let lastDiceSum = 0;
let currentModalCanClose = false; let isRolling = false; let jackpotRate = 0.5;
let currentRound = 1; let debtAlertShown = false;
let timerInterval = null; let timeLeft = 0; let timeLimitSetting = 0; let timerAction = null;
let isOnlineMode = false;

let stocks = { PTC: { price: 500, pool: 0 }, RTL: { price: 1000, pool: 0 }, TRN: { price: 1000, pool: 0 }, PST: { price: 1000, pool: 0 }, GOV: { price: 2000, pool: 0, totalMax: 50, issued: 0 } };

const socket = typeof io !== 'undefined' ? io() : null;
let myMultiplayerId = null;
let currentLobby = null;

if(socket) {
    socket.on('connect', () => { myMultiplayerId = socket.id; });
    socket.on('globalOnlineCount', (count) => { let el = document.getElementById('online-badge'); if(el) el.innerText = `🟢 Онлайн: ${count}`; });
    
    socket.on('updateRoomsList', (roomsList) => {
        const container = document.getElementById('mp-room-list'); if (!container) return;
        if(roomsList.length === 0) { container.innerHTML = '<div style="color:#888; text-align:center; padding:10px;">Немає відкритих кімнат. Створіть свою!</div>'; return; }
        let html = '';
        roomsList.forEach(r => {
            let lock = r.hasPassword ? '🔒' : '🔓'; let status = r.status === 'waiting' ? '<span style="color:#2ecc71;">Очікування</span>' : '<span style="color:#e74c3c;">В грі</span>';
            html += `<div class="room-item"><div><b>${r.name}</b> <span style="font-size:10px; color:#888;">(Код: ${r.id})</span><br><span style="font-size:11px;">${lock} Гравців: ${r.playersCount}/6 | ${status}</span></div><button class="btn-green" onclick="joinRoomFromList('${r.id}', ${r.hasPassword})">Увійти</button></div>`;
        });
        container.innerHTML = html;
    });
    
    socket.on('roomJoined', (roomData) => {
        currentLobby = roomData; document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none'); document.querySelectorAll('.menu-tabs').forEach(t => t.style.display = 'none');
        document.getElementById('lobby-screen').style.display = 'block'; document.getElementById('lobby-code').innerText = roomData.id; renderLobbyPlayers(roomData.players);
    });
    
    socket.on('roomPlayersUpdated', (playersList) => { if(currentLobby) { currentLobby.players = playersList; renderLobbyPlayers(playersList); } });
    socket.on('joinError', (msg) => { alert(msg); });

    socket.on('gameStarted', (serverGameState) => {
        isOnlineMode = true; currentRound = serverGameState.currentRound; turn = serverGameState.turn; players = serverGameState.players;
        document.getElementById('lobby-screen').style.display = 'none'; document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-container').style.display = 'flex';
        render2DDie('die1', 1); render2DDie('die2', 1); initBoard(); updateUI(); logMsg(`🎮 Онлайн гру запущено!`);
    });

    // 🔴 ЖОРСТКА СИНХРОНІЗАЦІЯ СТАНУ (Вирішення багу)
    socket.on('syncAction', (data) => {
        if (data.type === 'STATE_SYNC') {
            if (!isMyTurn() || data.force) {
                players = data.players; properties = data.properties; turn = data.turn; 
                currentRound = data.currentRound; jackpotAmount = data.jackpotAmount; stocks = data.stocks;
                syncBoardVisuals(); // Оновлюємо картинку на екрані
            }
        } else if (data.type === 'LOG_MSG') {
            if (!isMyTurn()) logMsgLocal(data.msg);
        }
    });

    socket.on('diceRolled', async (data) => {
        if (isRolling || processDebts()) return; isRolling = true;
        document.getElementById('roll-btn').disabled = true; document.getElementById('trade-btn').disabled = true;
        playSound('sfx-dice');
        const d1 = document.getElementById('die1'), d2 = document.getElementById('die2');
        d1.classList.add('rolling-anim'); d2.classList.add('rolling-anim');
        for(let i=0; i<10; i++) { render2DDie('die1', Math.floor(Math.random()*6)+1); render2DDie('die2', Math.floor(Math.random()*6)+1); await sleep(50); }
        d1.classList.remove('rolling-anim'); d2.classList.remove('rolling-anim');
        render2DDie('die1', data.v1); render2DDie('die2', data.v2); 
        lastDiceSum = data.v1 + data.v2; lastRollWasDouble = (data.v1 === data.v2);
        await sleep(300); await movePlayer(lastDiceSum);
    });
}

// Функція-транслятор стану
function broadcastState() {
    if (isOnlineMode && isMyTurn() && currentLobby) {
        socket.emit('playerAction', currentLobby.id, { type: 'STATE_SYNC', players, properties, turn, currentRound, jackpotAmount, stocks });
    }
}

function isMyTurn() {
    if (!isOnlineMode) return true; 
    let activeP = players.find(x => x.debtMode) || players[turn];
    return activeP && activeP.id === myMultiplayerId;
}

document.addEventListener("DOMContentLoaded", () => { generatePlayerInputs(); updateVolume(); });
function switchTab(tabId) { document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.getElementById(tabId).classList.add('active'); event.currentTarget.classList.add('active'); }

// ДОДАНО ГАЛОЧКИ ДЛЯ БОТА
function generatePlayerInputs() {
    let selectEl = document.getElementById('player-count'); if(!selectEl) return;
    const c = parseInt(selectEl.value); const cont = document.getElementById('player-names-container'); cont.innerHTML = '';
    let defs = ['Коля', 'Надя', 'Бот', 'Бот 2', 'Гравець 5', 'Гравець 6']; 
    for(let i=0; i<c; i++) {
        cont.innerHTML += `<div style="display:flex; align-items:center; gap:5px;"><input type="text" id="p${i}-name" value="${defs[i]}" style="flex-grow:1;"><label style="font-size:12px; font-weight:bold; color:#f1c40f; display:flex; align-items:center; gap:3px;"><input type="checkbox" id="p${i}-isbot" ${defs[i].includes('Бот') ? 'checked' : ''}> Бот</label></div>`;
    }
}

function openSettingsModal() {
    let bgmVal = document.getElementById('vol-bgm') ? document.getElementById('vol-bgm').value : 0.2; let sfxVal = document.getElementById('vol-sfx') ? document.getElementById('vol-sfx').value : 0.5;
    let html = `<div style="text-align: left;"><p><b>🎵 Музика:</b> <input type="range" id="vol-bgm-game" min="0" max="1" step="0.1" value="${bgmVal}" onchange="if(document.getElementById('vol-bgm')) document.getElementById('vol-bgm').value=this.value; updateVolume();" style="width:100%;"></p><p><b>🔊 Звуки:</b> <input type="range" id="vol-sfx-game" min="0" max="1" step="0.1" value="${sfxVal}" onchange="if(document.getElementById('vol-sfx')) document.getElementById('vol-sfx').value=this.value; updateVolume();" style="width:100%;"></p></div>`;
    openModal("⚙️ Налаштування", html, `<button class="btn-blue" onclick="closeModal()">Закрити</button>`, true);
}
function updateVolume() {
    let bgmVol = document.getElementById('vol-bgm') ? document.getElementById('vol-bgm').value : (document.getElementById('vol-bgm-game') ? document.getElementById('vol-bgm-game').value : 0.2);
    let sfxVol = document.getElementById('vol-sfx') ? document.getElementById('vol-sfx').value : (document.getElementById('vol-sfx-game') ? document.getElementById('vol-sfx-game').value : 0.5);
    let bgm = document.getElementById('bgm'); if(bgm) bgm.volume = bgmVol;
    ['sfx-dice', 'sfx-step', 'sfx-earn', 'sfx-spend', 'sfx-bankrupt'].forEach(id => { let el = document.getElementById(id); if(el) el.volume = sfxVol; });
}
function changeRadio() { let val = document.getElementById('setting-radio').value; let bgm = document.getElementById('bgm'); if(!bgm) return; document.getElementById('custom-radio-url-container').style.display = 'none'; if(val === 'custom-url') { document.getElementById('custom-radio-url-container').style.display = 'block'; val = document.getElementById('custom-radio-url').value; } if(!val || val === "") { bgm.pause(); } else { bgm.src = val; bgm.play().catch(e => {}); } }
function applyCustomRadioUrl() { let bgm = document.getElementById('bgm'); let val = document.getElementById('custom-radio-url').value; if(bgm && val) { bgm.src = val; bgm.play().catch(e => {}); } }
function playSound(id) { let el = document.getElementById(id); if(el && el.getAttribute('src') && el.getAttribute('src') !== "") { el.currentTime = 0; el.play().catch(e => {}); } }
function render2DDie(id, num) { let el = document.getElementById(id); if(el) el.innerHTML = dotL[num].map(v=>`<div class="dot ${v===0?'hidden':''}"></div>`).join(''); }
function getRentArray(base) { return [base, base*5, base*15, base*40, base*50, base*60]; }

function openModal(t, b, btn, canClose = false, defaultAction = null) { 
    currentModalCanClose = canClose; let closeHtml = canClose ? '<span class="close-btn" onclick="closeModal()">×</span>' : '';
    document.getElementById('modal-title').innerHTML = t + closeHtml; document.getElementById('modal-body').innerHTML = b; 
    document.getElementById('modal-buttons').innerHTML = btn; document.getElementById('modal-overlay').style.display = 'flex'; 
    if(timeLimitSetting > 0 && defaultAction) { startTimer(timeLimitSetting, defaultAction); }
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; document.getElementById('modal-content').className = 'modal'; stopTimer(); }
function startTimer(seconds, timeoutAction) { stopTimer(); if(timeLimitSetting <= 0) return; timeLeft = seconds; timerAction = timeoutAction; const display = document.getElementById('timer-display'); display.innerText = `⏳ ${timeLeft}`; display.classList.add('active'); timerInterval = setInterval(() => { timeLeft--; display.innerText = `⏳ ${timeLeft}`; if (timeLeft <= 0) { stopTimer(); if(timerAction) timerAction(); } }, 1000); }
function stopTimer() { if(timerInterval) clearInterval(timerInterval); document.getElementById('timer-display').classList.remove('active'); }

function createRoom() { if(!socket) return alert("Сервер недоступний!"); const pName = document.getElementById('mp-player-name').value.trim(); if(!pName) return alert("Введіть ваше ім'я!"); socket.emit('createRoom', { playerName: pName, roomName: document.getElementById('mp-room-name').value.trim(), password: document.getElementById('mp-room-pass').value.trim() }); }
function joinRoomFromList(roomId, hasPassword) { if(!socket) return alert("Сервер недоступний!"); const pName = document.getElementById('mp-player-name').value.trim(); if(!pName) return alert("Введіть ваше ім'я!"); let pass = ''; if(hasPassword) { pass = prompt("Введіть пароль:"); if(pass === null) return; } socket.emit('joinRoom', { roomId: roomId, playerName: pName, password: pass }); }
function joinRoomByCode() { if(!socket) return alert("Сервер недоступний!"); const pName = document.getElementById('mp-player-name').value.trim(); if(!pName) return alert("Введіть ваше ім'я!"); const code = document.getElementById('mp-join-code').value.trim().toUpperCase(); if(!code) return alert("Введіть код кімнати!"); socket.emit('joinRoom', { roomId: code, playerName: pName, password: document.getElementById('mp-join-pass').value.trim() }); }
function leaveLobby() { window.location.reload(); }
function startOnlineGameAction() { if(socket && currentLobby) { socket.emit('startGame', currentLobby.id); } }

function startLocalGame() {
  isOnlineMode = false;
  changeRadio(); jackpotRate = parseFloat(document.getElementById('setting-jackpot').value); timeLimitSetting = parseInt(document.getElementById('setting-timer').value); currentRound = 1;
  const c = parseInt(document.getElementById('player-count').value); const sm = parseInt(document.getElementById('start-money').value) || 15000;
  players = [];
  for(let i=0; i<c; i++) {
      let isBot = document.getElementById(`p${i}-isbot`).checked;
      players.push({ id: i, name: document.getElementById(`p${i}-name`).value, isBot: isBot, color: playerColors[i], money: sm, deposit: 0, loan: 0, loanTurns: 0, pos: 0, inJail: false, jailTurns: 0, doublesCount: 0, isBankrupt: false, skipTurns: 0, skipMsg: "", reverseMove: false, portfolio: { PTC: 0, RTL: 0, TRN: 0, PST: 0, GOV: 0 }, stockHistory: [], debtMode: false });
  }
  document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-container').style.display = 'flex';
  render2DDie('die1', 1); render2DDie('die2', 1); initBoard(); updateUI();
  if(timeLimitSetting > 0) startTimer(timeLimitSetting, () => userClickedRoll());
}

function renderLobbyPlayers(playersList) {
    const listEl = document.getElementById('lobby-players-list'); let html = ''; let iAmHost = false;
    playersList.forEach((p, i) => { let hostBadge = p.isHost ? '👑 ' : ''; let youBadge = p.id === myMultiplayerId ? ' <span style="color:#888; font-size:12px;">(Ви)</span>' : ''; if(p.id === myMultiplayerId && p.isHost) iAmHost = true; html += `<div class="lobby-player-item ${p.isHost ? 'is-host' : ''}" style="color:${playerColors[i % playerColors.length]}">${hostBadge}${p.name}${youBadge}</div>`; });
    listEl.innerHTML = html; document.getElementById('lobby-start-btn').style.display = iAmHost ? 'inline-block' : 'none';
}

function getGridArea(i) { if (i <= 10) return { r: 11, c: 11 - i }; if (i <= 19) return { r: 11 - (i - 10), c: 1 }; if (i <= 30) return { r: 1, c: (i - 20) + 1 }; return { r: (i - 30) + 1, c: 11 }; }
function initBoard() {
  document.querySelectorAll('.cell').forEach(e => e.remove()); const board = document.getElementById('board');
  for (let i = 0; i < 40; i++) {
    const data = mapData[i]; const cell = document.createElement('div'); cell.className = `cell ${data.type === 'corner' ? 'corner' : ''}`; cell.id = `cell-${i}`; cell.onclick = () => showPropertyInfo(i); 
    let pos = getGridArea(i); cell.style.gridRow = pos.r; cell.style.gridColumn = pos.c;
    if (data.bgImage) cell.innerHTML += `<div class="cell-bg" style="background-image: url('${data.bgImage}')"></div>`;
    let topContent = ''; if(data.emoji) topContent += `<div class="cell-emoji">${data.emoji}</div>`; topContent += `<div class="cell-name">${data.name}</div>`;
    if (data.group && colors[data.group]) cell.innerHTML += `<div class="district-bar" style="background:${colors[data.group]}"></div>`;
    cell.innerHTML += `${topContent}<div class="houses-container" id="houses-${i}"></div><div class="tokens-area" id="tokens-${i}"></div>`;
    if (data.price) cell.innerHTML += `<div class="cell-price">i₴${data.price}</div>`; cell.innerHTML += `<div class="owner-bar" id="owner-${i}"></div>`;
    board.appendChild(cell);
  }
  players.forEach(p => { const token = document.createElement('div'); token.id = `token-${p.id}`; token.className = 'pawn'; token.style.backgroundColor = p.color; document.getElementById('tokens-0').appendChild(token); });
}

// Жорстке оновлення дошки при отриманні стану від сервера
function syncBoardVisuals() {
    players.forEach(p => { const token = document.getElementById(`token-${p.id}`); const targetArea = document.getElementById(`tokens-${p.pos}`); if (token && targetArea) targetArea.appendChild(token); });
    updatePropertyColors(); for(let i in properties) drawHouses(i, properties[i].houses); updateUI();
}

function updatePropertyColors() {
    for(let i=0; i<40; i++) {
        let cell = document.getElementById(`cell-${i}`); let ownerBar = document.getElementById(`owner-${i}`);
        if(properties[i] && !properties[i].isMortgaged) { let pColor = players.find(x => x.id === properties[i].owner).color; ownerBar.style.backgroundColor = pColor; cell.style.boxShadow = `inset 0 0 15px ${pColor}88`; cell.style.borderColor = pColor; } 
        else { ownerBar.style.backgroundColor = 'transparent'; cell.style.boxShadow = 'none'; cell.style.borderColor = '#bdc3c7'; }
    }
}

function updateUI() {
  const dash = document.getElementById('dashboard'); dash.innerHTML = ''; let isDebtActive = players.some(p => p.debtMode);
  
  players.forEach(p => {
    let iconHTML = ''; if(p.skipTurns > 0) iconHTML += '<span class="status-icon" title="Пропуск ходу">⏸️</span>'; if(p.reverseMove) iconHTML += '<span class="status-icon" title="Рух назад">⏪</span>'; if(p.loan > 0) iconHTML += '<span class="status-icon" title="Кредит">💳</span>';
    let depHTML = p.deposit > 0 ? `<br><span style="font-size:10px; color:#f1c40f;">Банка: i₴${p.deposit}</span>` : '';
    let cryptoHTML = (p.portfolio.PTC>0 || p.portfolio.RTL>0 || p.portfolio.TRN>0 || p.portfolio.PST>0 || p.portfolio.GOV>0) ? `<br><span style="font-size:10px; color:#00cec9;">Акції: 📈</span>` : '';
    let activeClass = ''; if (isDebtActive) { if(p.debtMode) activeClass = 'debt-player-stat'; } else { if(p.id === players[turn].id) activeClass = 'active-player-stat'; }
    dash.innerHTML += `<div class="player-stat ${activeClass} ${p.isBankrupt ? 'bankrupt-stat' : ''}"><div><div class="color-dot" style="background:${p.color}"></div>${p.name} ${iconHTML}</div><span style="color: ${p.money < 0 ? '#e74c3c' : '#2ecc71'};">i₴${p.money}</span>${depHTML} ${cryptoHTML}</div>`;
  });
  if(!isDebtActive && !players[turn].isBankrupt) { document.getElementById('current-turn').innerHTML = `Круг ${currentRound} | Хід: <span style="color:${players[turn].color}">${players[turn].name}</span>`; }
  document.getElementById('jackpot-display').innerText = `i₴${jackpotAmount}`;
  
  let activeP = isDebtActive ? players.find(p=>p.debtMode) : players[turn];
  let btnLoan = document.getElementById('loan-btn');
  if(activeP && activeP.loan > 0) { btnLoan.innerText = `💳 Погасити (i₴2500, зал. ${activeP.loanTurns} х.)`; btnLoan.className = 'btn-red'; } else { btnLoan.innerText = `💳 Взяти Кредит (i₴2000)`; btnLoan.className = 'btn-purple'; }
  
  document.getElementById('roll-btn').disabled = (!isMyTurn() || isRolling);
  document.getElementById('trade-btn').disabled = (!isMyTurn() || isRolling);
  document.getElementById('deposit-btn').disabled = !isMyTurn();
  
  updatePropertyColors();
  checkBotTurn();
}

function logMsgLocal(msg) { const log = document.getElementById('log'); log.innerHTML = `<div style="margin-bottom:4px; border-bottom:1px solid #444; padding-bottom:3px;">${msg}</div>` + log.innerHTML; }
function logMsg(msg) { logMsgLocal(msg); if(isOnlineMode && isMyTurn() && currentLobby) socket.emit('playerAction', currentLobby.id, { type: 'LOG_MSG', msg: msg }); }

// --- РОЗУМНИЙ БОТ ---
function checkBotTurn() {
    if (isOnlineMode || isRolling) return; // Боти працюють тільки в локалці
    let p = players[turn];
    if (p && p.isBot && !p.isBankrupt && !p.debtMode) {
        setTimeout(() => {
            if (document.getElementById('modal-overlay').style.display === 'none') {
                botPreRollActions(p); // Бот пробує будувати будинки
                if(!document.getElementById('roll-btn').disabled) userClickedRoll();
            }
        }, 1500);
    }
}

function botPreRollActions(p) {
    if (p.money < 1000) return;
    let colorsOwned = {};
    for(let i in properties) { if (properties[i].owner === p.id) { let g = mapData[i].group; colorsOwned[g] = (colorsOwned[g] || 0) + 1; } }
    for (let g in colorsOwned) {
        let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === g);
        if (colorsOwned[g] === groupCells.length) { // Є монополія!
            for(let cellData of groupCells) {
                let idx = cellData.i; let prop = properties[idx];
                if (prop.houses < 5 && p.money >= cellData.c.housePrice + 500) {
                    p.money -= cellData.c.housePrice; prop.houses++;
                    logMsg(`🤖 <b>${p.name}</b> будує дім на ${cellData.c.name.replace('<br>',' ')}.`);
                    drawHouses(idx, prop.houses); updateUI();
                }
            }
        }
    }
}

function buyProperty(index) {
  const p = players[turn]; const cell = mapData[index]; p.money -= cell.price; properties[index] = { owner: p.id, houses: 0, isMortgaged: false }; playSound('sfx-spend');
  let rBuy = buyMsgs[Math.floor(Math.random() * buyMsgs.length)]; logMsg(`<b>${p.name}</b> ${rBuy} <b>${cell.name.replace('<br>',' ')}</b>.`); updateUI(); closeModal(); 
  if(!processDebts()) nextTurn(); else broadcastState();
}

function skipProperty() { closeModal(); nextTurn(); }

function payRentConfirm(index, ownerId, rent) {
    let p = players[turn]; let owner = players.find(pl => pl.id === ownerId); p.money -= rent; owner.money += rent; playSound('sfx-spend');
    let rRent = rentMsgs[Math.floor(Math.random() * rentMsgs.length)]; logMsg(`<b>${p.name}</b> ${rRent} i₴${rent} гравцю <b>${owner.name}</b>.`);
    if (['pink', 'green', 'orange'].includes(mapData[index].group)) { stocks.RTL.pool += Math.ceil(rent * 0.1); }
    if (['yellow'].includes(mapData[index].group)) { stocks.PST.pool += Math.ceil(rent * 0.1); }
    if (['station'].includes(mapData[index].group)) { stocks.TRN.pool += Math.ceil(rent * 0.1); }
    if (mapData[index].type === 'utility') { stocks.GOV.pool += Math.ceil(rent * 0.2); }
    closeModal(); if(!processDebts()) nextTurn(); else broadcastState();
}

function payTax(amount) { deductMoney(players[turn], amount); logMsg(`Сплачено податок: i₴${amount}`); closeModal(); if(!processDebts()) nextTurn(); else broadcastState(); }

function showCardModal(isUrgent, cellType, cIndex) {
    let deck = isUrgent ? urgentNews : (cellType === 'chance' ? chanceCards : newsCards); window.currentCard = deck[cIndex];
    if (isMyTurn()) {
        document.getElementById('modal-content').className = `modal ${isUrgent ? 'urgent-modal' : cellType+'-modal'}`;
        openModal(isUrgent ? "⚡ БЛИСКАВКА" : (cellType === 'chance' ? "🎁 Шанс" : "📰 Новини"), `<p style="font-size:16px; ${isUrgent?'font-weight:bold; color:#e74c3c;':''}">${window.currentCard.text}</p>`, `<button class="btn-blue" onclick="applyCard();">Ок</button>`, false);
    }
}

function applyCard() {
  let p = players[turn]; let c = window.currentCard; closeModal();
  if(c.action === 'pay') { deductMoney(p, c.val); } else if(c.action === 'receive') { p.money += c.val; playSound('sfx-earn'); }
  else if(c.action === 'goto') { p.pos = c.val; document.getElementById(`tokens-${c.val}`).appendChild(document.getElementById(`token-${p.id}`)); setTimeout(() => handleLanding(p.pos, p), 300); return; }
  else if(c.action === 'skip-turn') { p.skipTurns += c.val; p.skipMsg = c.msg || 'пропускає хід'; logMsg(`🛑 <b>${p.name}</b> ${p.skipMsg}!`); }
  else if(c.action === 'reverse-move') { p.reverseMove = true; logMsg(`⏪ Наступного ходу <b>${p.name}</b> піде назад!`); }
  else if(c.action === 'nabu-tax') { let count = 0; for(let i in properties) { if(properties[i].owner === p.id) count++; } let tax = count * c.val; deductMoney(p, tax); logMsg(`НАБУ перевірило ${count} ділянок. Штраф: i₴${tax}`); }
  else if(c.action === 'birthday') { let total = 0; players.forEach(pl => { if(!pl.isBankrupt && pl.id !== p.id) { deductMoney(pl, c.val); total += c.val; logMsg(`🎁 ${pl.name} дарує i₴${c.val}.`); } }); p.money += total; playSound('sfx-earn'); }
  else if(c.action === 'global-pay') { players.forEach(pl => { if(!pl.isBankrupt){ deductMoney(pl, c.val); } }); logMsg(`Усі скинулися по i₴${c.val}.`); }
  else if(c.action === 'global-receive') { players.forEach(pl => { if(!pl.isBankrupt) pl.money += c.val; }); logMsg(`Усі отримали по i₴${c.val}.`); playSound('sfx-earn'); }
  updateUI(); if(!processDebts()) nextTurn(); else broadcastState();
}

function handleLanding(index, p) {
  const cell = mapData[index]; logMsg(`📍 <b>${p.name}</b> стає на <b>${cell.name.replace('<br>',' ')}</b>`);
  
  if(index === 30) { 
      p.pos = 10; p.inJail = true; p.doublesCount = 0; lastRollWasDouble = false; document.getElementById(`tokens-10`).appendChild(document.getElementById(`token-${p.id}`)); logMsg(`<b>${p.name}</b> відправляється в Колонію!`); 
      if(isMyTurn()) nextTurn(); return; 
  }
  if(index === 20) { 
      if(jackpotAmount > 0) { 
          let j = jackpotAmount; p.money += j; playSound('sfx-earn'); logMsg(`🎉 <b>${p.name}</b> зірвав джекпот Парковки: <b>+i₴${j}</b>!`); jackpotAmount = 0; updateUI();
          if (isMyTurn() && !p.isBot) { openModal(`🎉 ДЖЕКПОТ ПАРКОВКИ!`, `<p style="font-size:20px; color:#2ecc71; font-weight:bold;">+i₴${j}</p>`, `<button class="btn-green" onclick="closeModal(); nextTurn();">Забрати</button>`, false); } 
          else if (p.isBot) { setTimeout(() => nextTurn(), 1500); }
          return;
      } 
      if(isMyTurn()) nextTurn(); return; 
  }
  if(cell.type === 'tax') { 
      if (p.isBot) { setTimeout(() => payTax(cell.amount), 1500); }
      else if (isMyTurn()) { openModal(`Податок`, `<p>До сплати: <b>i₴${cell.amount}</b></p>`, `<button class="btn-red" onclick="payTax(${cell.amount})">Заплатити</button>`, false); }
      else { logMsg(`⏳ Очікуємо сплату податку від ${p.name}...`); }
      return; 
  }
  
  if(cell.type === 'chance' || cell.type === 'news') { 
      if (!isMyTurn() && !p.isBot) { logMsg(`⏳ Очікуємо, поки ${p.name} витягне картку...`); return; }
      let isUrgent = (cell.type === 'news' && Math.random() < 0.1); let deck = isUrgent ? urgentNews : (cell.type === 'chance' ? chanceCards : newsCards); 
      let randIndex = Math.floor(Math.random() * deck.length);
      showCardModal(isUrgent, cell.type, randIndex);
      return; 
  }

  if(cell.price) {
      const prop = properties[index];
      if(!prop) { 
          if (p.isBot) {
              if (p.money >= cell.price + 500) { setTimeout(() => buyProperty(index), 1500); } 
              else { setTimeout(() => skipProperty(), 1000); }
          }
          else if (isMyTurn()) { openModal(`Купівля`, `<p>Купити <b>${cell.name.replace('<br>',' ')}</b> за <b>i₴${cell.price}</b>?</p>`, `<button class="btn-green" onclick="buyProperty(${index})">Купити</button><button class="btn-red" onclick="skipProperty()">Відмовитись</button>`, false); }
          else { logMsg(`⏳ Очікуємо рішення гравця ${p.name}...`); }
      } 
      else if(prop.owner !== p.id && !prop.isMortgaged) { 
          payRent(index, p, prop); 
      } 
      else { if(isMyTurn()) nextTurn(); }
  } else { if(isMyTurn()) nextTurn(); }
}

function payRent(index, p, propData) {
  const cell = mapData[index]; const owner = players.find(pl => pl.id === propData.owner); let rent = 0;
  if(cell.type === 'utility') { let c = 0; for(let i in properties) { if(properties[i].owner === owner.id && mapData[i].type === 'utility') c++; } rent = lastDiceSum * (c === 2 ? 250 : 100); } 
  else if(cell.type === 'station') { let c = 0; for(let i in properties) { if(properties[i].owner === owner.id && mapData[i].type === 'station') c++; } rent = cell.baseRent * Math.pow(2, c - 1); }
  else { const rentArr = getRentArray(cell.baseRent); rent = rentArr[propData.houses]; if(propData.houses === 0) { if(mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group).every(x => properties[x.i] && properties[x.i].owner === owner.id)) rent *= 2; } }

  if (p.isBot) { setTimeout(() => payRentConfirm(index, owner.id, rent), 1500); }
  else if (isMyTurn()) {
      document.getElementById('modal-content').className = 'modal';
      let msg = `<p>Ти став на <b>${cell.name.replace('<br>',' ')}</b>.</p><p>Власник: ${owner.name}<br>`; if(cell.type === 'utility') msg += `Сума кубиків: ${lastDiceSum}<br>Множник: x${rent / lastDiceSum}<br>`; msg += `До сплати: <b style="color:#e74c3c;">i₴${rent}</b></p>`;
      openModal(`Оренда`, msg, `<button class="btn-red" onclick="payRentConfirm(${index}, ${owner.id}, ${rent})">Заплатити</button>`, false);
  } else { logMsg(`⏳ Очікуємо, поки ${p.name} заплатить оренду...`); }
}

function showPropertyInfo(index) {
  const cell = mapData[index]; if(!cell.price) return;
  const prop = properties[index]; const ownerName = prop ? players.find(p=>p.id===prop.owner).name : "Нічия";
  const mortgageValue = cell.price / 2; const unmortgageValue = mortgageValue + (mortgageValue * 0.1);
  let viewer = isOnlineMode ? players.find(x => x.id === myMultiplayerId) : (players.find(x => x.debtMode) || players[turn]);
  if (!viewer) viewer = players[0];

  let rentDetails = '';
  if(cell.type === 'station') { rentDetails = `Оренда залежить від кількості АЗС/Доставок.<br>Базова: i₴${cell.baseRent} (х2, х4, х8)`; }
  else if(cell.type === 'utility') { rentDetails = `Оренда: Сума кубиків × 100 (або × 250)`; }
  else { const rentArr = getRentArray(cell.baseRent); rentDetails = `Оренда: i₴${rentArr[0]}<br><div class="prop-card-row"><span>З 1 Будинком</span><span>i₴${rentArr[1]}</span></div><div class="prop-card-row"><span>З 2 Будинками</span><span>i₴${rentArr[2]}</span></div><div class="prop-card-row"><span>З 3 Будинками</span><span>i₴${rentArr[3]}</span></div><div class="prop-card-row"><span>З 4 Будинками</span><span>i₴${rentArr[4]}</span></div><div class="prop-card-row"><span style="color:#e74c3c;font-weight:bold;">З ГОТЕЛЕМ</span><span style="color:#e74c3c;font-weight:bold;">i₴${rentArr[5]}</span></div>`; }

  let html = `<div class="prop-card"><div class="prop-card-header" style="background-color: ${colors[cell.group]}; color: ${cell.group==='yellow'||cell.group==='none'?'#000':'#fff'}">${cell.name.replace('<br>',' ')}</div><div class="prop-card-body">${rentDetails}</div><div class="prop-card-footer"><div>Вартість будинку: i₴${cell.housePrice || '-'}</div><div>Сума застави: i₴${mortgageValue}</div><div style="margin-top:5px; font-weight:bold;">Власник: ${ownerName} ${prop && prop.isMortgaged ? '<span style="color:#e74c3c;">(В ЗАСТАВІ)</span>' : ''}</div></div></div>`;

  let btns = '';
  if(prop && prop.owner === viewer.id) {
      if(!prop.isMortgaged) {
          if(cell.type === 'property') {
              if(prop.houses > 0) btns += `<button class="btn-gold" onclick="sellHouse(${index})">Продати дім (+i₴${cell.housePrice / 2})</button>`;
              if(prop.houses < 5) btns += `<button class="btn-green" onclick="buildHouse(${index})" ${viewer.debtMode?'disabled':''}>Будувати дім (i₴${cell.housePrice})</button>`;
          }
          if(prop.houses === 0) btns += `<button class="btn-red" onclick="mortgage(${index}, ${mortgageValue})">Закласти (+i₴${mortgageValue})</button>`;
      } else { btns += `<button class="btn-blue" onclick="unmortgage(${index}, ${unmortgageValue})" ${viewer.debtMode?'disabled':''}>Викупити (-i₴${unmortgageValue})</button>`; }
  } else if(!prop) { btns += `<button class="btn-blue" onclick="closeModal()">Ок</button>`; }
  document.getElementById('modal-content').className = 'modal'; openModal("Інформація", html, btns, true);
}

function mortgage(i, a) { let p = players.find(x => x.debtMode) || players[turn]; p.money+=a; properties[i].isMortgaged=true; playSound('sfx-earn'); updateUI(); checkDebtResolution(); closeModal(); broadcastState(); }
function unmortgage(i, a) { let p = players.find(x => x.debtMode) || players[turn]; if(p.money<a){alert("Немає грошей!");return;} p.money-=a; properties[i].isMortgaged=false; playSound('sfx-spend'); updateUI(); checkDebtResolution(); closeModal(); broadcastState(); }
function buildHouse(index) {
  const p = players[turn]; const cell = mapData[index]; const prop = properties[index]; if(p.debtMode) return;
  if(p.money < cell.housePrice) { alert("Не вистачає грошей!"); return; }
  p.money -= cell.housePrice; prop.houses++; playSound('sfx-spend'); updateUI(); logMsg(`<b>${p.name}</b> будує дім на <b>${cell.name.replace('<br>',' ')}</b>.`); drawHouses(index, prop.houses); closeModal(); broadcastState();
}
function sellHouse(index) {
  const p = players.find(x => x.debtMode) || players[turn]; const cell = mapData[index]; const prop = properties[index];
  let refund = cell.housePrice / 2; p.money += refund; prop.houses--; playSound('sfx-earn'); updateUI(); logMsg(`<b>${p.name}</b> продає дім за i₴${refund}.`); drawHouses(index, prop.houses); checkDebtResolution(); closeModal(); broadcastState();
}
function drawHouses(index, count) { const hCont = document.getElementById(`houses-${index}`); hCont.innerHTML = ''; if(count < 5) { for(let i=0; i<count; i++) hCont.innerHTML += `<div class="house-icon"></div>`; } else { hCont.innerHTML = `<div class="hotel-icon"></div>`; } }

function deductMoney(p, amount) { p.money -= amount; jackpotAmount += Math.ceil(amount * jackpotRate); playSound('sfx-spend'); }

function processDebts() {
  players.forEach(p => { if (p.money < 0 && p.deposit > 0 && !p.isBankrupt) { let needed = Math.abs(p.money); let w = Math.min(needed, p.deposit); p.deposit -= w; p.money += w; logMsg(`🏦 Авто-зняття i₴${w} з Банки гравця ${p.name}.`); } });
  let debtor = players.find(p => p.money < 0 && !p.isBankrupt);
  if(debtor) {
      debtor.debtMode = true; stopTimer(); 
      document.getElementById('roll-btn').disabled = true; document.getElementById('trade-btn').disabled = true; 
      updateUI();
      if(!debtAlertShown) {
          let amIActivePlayer = (!isOnlineMode || debtor.id === myMultiplayerId);
          if(debtor.isBot) { setTimeout(() => forceBankrupt(), 2000); } // Бот здається, якщо в боргах
          else if(amIActivePlayer) { openModal(`🚨 УВАГА: БОРГ!`, `<p>Ти пішов у мінус на <b>i₴${Math.abs(debtor.money)}</b>.</p>`, `<button class="btn-blue" onclick="closeModal()">Зрозуміло</button>`, false); debtAlertShown = true; }
      }
      return true; 
  }
  return false; 
}

function checkDebtResolution() {
    let debtor = players.find(p => p.debtMode);
    if(debtor && debtor.money >= 0) {
        debtor.debtMode = false; debtAlertShown = false; logMsg(`✅ <b>${debtor.name}</b> успішно погасив заборгованість.`);
        if(!processDebts()) { updateUI(); if(isRolling) { nextTurn(); } else if(isMyTurn()) { document.getElementById('roll-btn').disabled = false; } broadcastState(); }
    }
}

function giveUpConfirm() { let p = players.find(x => x.debtMode) || players[turn]; openModal("🏳️ Здатися", `<p>${p.name}, ти дійсно хочеш оголосити себе банкрутом?</p>`, `<button class="btn-red" onclick="forceBankrupt()">Так, я банкрут</button><button class="btn-blue" onclick="closeModal()">Ні, я ще поборюсь</button>`, true); }
function forceBankrupt() { 
    let p = players.find(x => x.debtMode) || players[turn]; p.money = -1; p.isBankrupt = true; p.debtMode = false; p.deposit = 0; debtAlertShown = false;
    let tokenEl = document.getElementById(`token-${p.id}`); if(tokenEl) tokenEl.remove();
    stocks.GOV.issued -= p.portfolio.GOV; p.portfolio.GOV = 0;
    for(let i in properties) { if(properties[i].owner === p.id) { delete properties[i]; document.getElementById(`houses-${i}`).innerHTML = ''; document.getElementById(`cell-${i}`).classList.remove('mortgaged'); } }
    logMsg(`💀 <b>${p.name}</b> ОГОЛОСИВ БАНКРУТСТВО! Майно повернуто банку.`); playSound('sfx-bankrupt'); closeModal(); updateUI(); 

    let active = players.filter(pl => !pl.isBankrupt);
    if (active.length === 1) { stopTimer(); openModal("🏆 ГРУ ЗАВЕРШЕНО!", `<h1 style="color:${active[0].color}">${active[0].name} ПЕРЕМІГ!</h1>`, `<button class="btn-blue" onclick="window.location.reload()">Нова гра</button>`, false); return; }
    if(!processDebts()) { if(p.id === players[turn].id) nextTurn(); else broadcastState(); } 
}

// ОЦІНКА ТРЕЙДІВ ДЛЯ БОТА
function openTradeMenu() {
  let p = players[turn]; let activeOthers = players.filter(x => x.id !== p.id && !x.isBankrupt); if(activeOthers.length === 0) { alert("Немає з ким торгувати!"); return; }
  let html = `<p>Обери гравця для угоди:</p><select id="trade-target" onchange="renderTradeLists()" style="width:100%; padding:8px; margin-bottom:10px; font-weight:bold;">`; activeOthers.forEach(op => html += `<option value="${op.id}">${op.name}</option>`); html += `</select><div id="trade-ui-container"></div>`;
  document.getElementById('modal-content').className = 'modal trade-modal'; openModal("🤝 Торгівля", html, `<button class="btn-blue" onclick="submitTrade()">Запропонувати</button>`, true); renderTradeLists(); 
}
function renderTradeLists() {
  let p1 = players[turn]; let p2id = parseInt(document.getElementById('trade-target').value); let p2 = players.find(x => x.id === p2id);
  const getList = (pid, prefix) => { let list = ''; for(let i in properties) { if(properties[i].owner === pid) { let c = mapData[i]; list += `<div class="trade-item"><input type="checkbox" id="${prefix}-prop-${i}" value="${i}"> <div class="color-dot" style="background:${colors[c.group]}"></div> ${c.name.replace('<br>',' ')}</div>`; } } return list === '' ? '<div style="color:#888;">Немає нерухомості</div>' : list; };
  document.getElementById('trade-ui-container').innerHTML = `<div class="trade-grid"><div class="trade-col"><h4 style="color:${p1.color}">${p1.name} (Віддає)</h4>Доплата (i₴): <input type="number" id="trade-money-give" class="trade-money-input" value="0" min="0" max="${p1.money}"><div class="trade-prop-list">${getList(p1.id, 'give')}</div></div><div class="trade-col"><h4 style="color:${p2.color}">${p2.name} (Віддає)</h4>Доплата (i₴): <input type="number" id="trade-money-take" class="trade-money-input" value="0" min="0" max="${p2.money}"><div class="trade-prop-list">${getList(p2.id, 'take')}</div></div></div>`;
}
function submitTrade() {
  let p1 = players[turn]; let p2id = parseInt(document.getElementById('trade-target').value); let p2 = players.find(x => x.id === p2id);
  let mGive = parseInt(document.getElementById('trade-money-give').value) || 0; let mTake = parseInt(document.getElementById('trade-money-take').value) || 0;
  if(mGive > p1.money) return alert("Немає грошей!"); if(mTake > p2.money) return alert("У нього немає стільки!");
  let pGive = [], pTake = []; document.querySelectorAll('[id^="give-prop-"]:checked').forEach(cb => pGive.push(parseInt(cb.value))); document.querySelectorAll('[id^="take-prop-"]:checked').forEach(cb => pTake.push(parseInt(cb.value)));
  if(mGive===0 && mTake===0 && pGive.length===0 && pTake.length===0) return alert("Угода порожня!");
  window.pendingTrade = { p1, p2, mGive, mTake, pGive, pTake };

  // РОЗУМНИЙ БОТ ОЦІНЮЄ ТРЕЙД
  if (p2.isBot) {
      let valGive = mGive, valTake = mTake;
      pGive.forEach(i => valGive += mapData[i].price); pTake.forEach(i => valTake += mapData[i].price);
      if (valGive >= valTake + 300) { logMsg(`🤖 <b>${p2.name}</b> погоджується на вигідну угоду!`); acceptTrade(); } 
      else { logMsg(`🤖 <b>${p2.name}</b> відхиляє невигідну угоду.`); closeModal(); }
      return;
  }

  let sGive = `<b>i₴${mGive}</b><br>` + pGive.map(i => mapData[i].name.replace('<br>',' ')).join('<br>'); let sTake = `<b>i₴${mTake}</b><br>` + pTake.map(i => mapData[i].name.replace('<br>',' ')).join('<br>');
  document.getElementById('modal-content').className = 'modal trade-modal';
  openModal(`Підтвердження`, `<p style="color:${p2.color}; font-size:16px;">Гей, ${p2.name}!</p><p>${p1.name} пропонує обмін.</p><div class="trade-grid" style="text-align:center;"><div class="trade-col"><b>Ти отримаєш:</b><br>${sGive}</div><div class="trade-col"><b>Ти віддаси:</b><br>${sTake}</div></div>`, `<button class="btn-green" onclick="acceptTrade()">Прийняти</button><button class="btn-red" onclick="closeModal()">Відмовитись</button>`, false);
}
function acceptTrade() {
  let t = window.pendingTrade; t.p1.money = t.p1.money - t.mGive + t.mTake; t.p2.money = t.p2.money - t.mTake + t.mGive;
  t.pGive.forEach(i => { properties[i].owner = t.p2.id; document.getElementById(`owner-${i}`).style.backgroundColor = t.p2.color; }); t.pTake.forEach(i => { properties[i].owner = t.p1.id; document.getElementById(`owner-${i}`).style.backgroundColor = t.p1.color; });
  logMsg(`🤝 Успішний обмін між <b>${t.p1.name}</b> та <b>${t.p2.name}</b>.`); playSound('sfx-earn'); updateUI(); closeModal(); broadcastState();
}

function userClickedRoll() { stopTimer(); if(isOnlineMode && socket && currentLobby) { socket.emit('rollDice', currentLobby.id); } else { startTurnLocal(); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startTurnLocal() {
  if(isRolling || processDebts()) return; isRolling = true;
  document.getElementById('roll-btn').disabled = true; document.getElementById('trade-btn').disabled = true;
  try {
      const p = players[turn]; lastRollWasDouble = false; 
      if(p.loan > 0) { p.loanTurns--; if(p.loanTurns <= 0) { logMsg(`⏰ Час платити за кредит! Банк списує i₴2500.`); deductMoney(p, 2500); p.loan = 0; p.loanTurns = 0; if(processDebts()) return; } }
      if (p.skipTurns > 0) { p.skipTurns--; logMsg(`🛑 <b>${p.name}</b> ${p.skipMsg || 'пропускає хід'}!`); return nextTurn(); }
      const {v1, v2} = await roll2DDice(); const isDouble = (v1 === v2);
      if (p.inJail) {
          if (isDouble) { logMsg(`🎲 <b>${p.name}</b> кинув ДУБЛЬ! Виходить з Колонії.`); p.inJail = false; p.jailTurns = 0; } 
          else { p.jailTurns++; if (p.jailTurns >= 3) { logMsg(`⏳ <b>${p.name}</b> відсидів 3 ходи. Сплачує штраф i₴1000.`); deductMoney(p, 1000); p.inJail = false; p.jailTurns = 0; if(processDebts()) return; } else { logMsg(`🚫 <b>${p.name}</b> сумує за волею. (Хід ${p.jailTurns}/3)`); return nextTurn(); } }
      } else {
          if (isDouble) { p.doublesCount++; if (p.doublesCount >= 3) { logMsg(`🚨 3 ДУБЛІ підряд! За шахрайство — у Божкове!`); p.inJail = true; p.pos = 10; p.doublesCount = 0; document.getElementById(`tokens-10`).appendChild(document.getElementById(`token-${p.id}`)); return nextTurn(); } logMsg(`🎲 ДУБЛЬ! Додатковий хід.`); lastRollWasDouble = true; } else { p.doublesCount = 0; }
      }
      await movePlayer(v1 + v2);
  } catch(e) { console.error(e); isRolling = false; document.getElementById('roll-btn').disabled = false; }
}

async function roll2DDice() {
  playSound('sfx-dice');
  const d1 = document.getElementById('die1'), d2 = document.getElementById('die2');
  d1.classList.add('rolling-anim'); d2.classList.add('rolling-anim');
  for(let i=0; i<10; i++) { render2DDie('die1', Math.floor(Math.random()*6)+1); render2DDie('die2', Math.floor(Math.random()*6)+1); await sleep(50); }
  let v1 = Math.floor(Math.random()*6)+1; let v2 = Math.floor(Math.random()*6)+1;
  d1.classList.remove('rolling-anim'); d2.classList.remove('rolling-anim');
  render2DDie('die1', v1); render2DDie('die2', v2); lastDiceSum = v1 + v2; await sleep(300); return {v1, v2};
}

async function movePlayer(steps) {
  const p = players[turn]; const token = document.getElementById(`token-${p.id}`); let isReversed = p.reverseMove;
  if (isReversed) { logMsg(`⏪ <b>${p.name}</b> йде НАЗАД на ${steps} кроків!`); p.reverseMove = false; }
  for (let i = 0; i < steps; i++) {
    if (isReversed) { p.pos--; if(p.pos < 0) p.pos = 39; } 
    else {
        p.pos++; 
        if(p.pos >= 40) { 
            p.pos = 0;
            if(isMyTurn()) { let isExactGo = (i === steps - 1); let salary = isExactGo ? 4000 : 2000; p.money += salary; let depBonus = Math.floor(p.deposit * 0.05); if(depBonus > 0) p.deposit += depBonus; logMsg(isExactGo ? `<b>${p.name}</b> став РІВНО на СТАРТ! Премія: <b>+i₴4000</b>` : `<b>${p.name}</b> пройшов СТАРТ. Зарплата <b>+i₴2000</b>`); updateUI(); }
            playSound('sfx-earn');
        }
    }
    const targetArea = document.getElementById(`tokens-${p.pos}`); token.classList.add('jumping'); playSound('sfx-step'); await sleep(150); targetArea.appendChild(token); token.classList.remove('jumping'); await sleep(100);
  }
  if (isMyTurn()) handleLanding(p.pos, p);
}

function nextTurn() { 
  isRolling = false;
  if(lastRollWasDouble && !players[turn].inJail && !players[turn].isBankrupt) { lastRollWasDouble = false; } 
  else { do { turn = (turn + 1) % players.length; if(turn === 0) currentRound++; } while(players[turn].isBankrupt); }
  
  updateUI(); broadcastState(); // СИНХРОНІЗУЄМО СТАН УСІМ!
}
