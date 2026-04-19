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
        currentLobby = roomData;
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.menu-tabs').forEach(t => t.style.display = 'none');
        document.getElementById('lobby-screen').style.display = 'block';
        document.getElementById('lobby-code').innerText = roomData.id;
        renderLobbyPlayers(roomData.players);
    });
    
    socket.on('roomPlayersUpdated', (playersList) => { if(currentLobby) { currentLobby.players = playersList; renderLobbyPlayers(playersList); } });
    socket.on('joinError', (msg) => { alert(msg); });

    socket.on('gameStarted', (serverGameState) => {
        isOnlineMode = true; currentRound = serverGameState.currentRound; turn = serverGameState.turn; players = serverGameState.players;
        document.getElementById('lobby-screen').style.display = 'none'; document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-container').style.display = 'flex';
        render2DDie('die1', 1); render2DDie('die2', 1); initBoard(); updateUI();
        logMsg(`🎮 Онлайн гру запущено!`);
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

    // ПРИЙОМ ДІЙ ВІД ІНШИХ ГРАВЦІВ
    socket.on('syncAction', (data) => {
        if(data.type === 'buy') buyProperty(data.index, true);
        if(data.type === 'skip') skipProperty(true);
        if(data.type === 'payRent') payRentConfirm(data.index, data.ownerId, data.rent, true);
        if(data.type === 'payTax') payTax(data.amount, true);
        if(data.type === 'drawCard') showCardModal(data.isUrgent, data.cellType, data.cardIndex);
        if(data.type === 'applyCard') applyCard(true);
        if(data.type === 'nextTurn') nextTurn();
    });
}

document.addEventListener("DOMContentLoaded", () => { generatePlayerInputs(); updateVolume(); });
function switchTab(tabId) { document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.getElementById(tabId).classList.add('active'); event.currentTarget.classList.add('active'); }
function generatePlayerInputs() {
    let selectEl = document.getElementById('player-count'); if(!selectEl) return;
    const c = parseInt(selectEl.value); const cont = document.getElementById('player-names-container'); cont.innerHTML = '';
    let defs = ['Коля', 'Надя', 'Бот', 'Гравець 4', 'Гравець 5', 'Гравець 6']; 
    for(let i=0; i<c; i++) cont.innerHTML += `<input type="text" id="p${i}-name" value="${defs[i]}" placeholder="Ім'я або Бот">`;
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
function changeRadio() { let val = document.getElementById('setting-radio').value; let bgm = document.getElementById('bgm'); if(!bgm) return; document.getElementById('custom-radio-url-container').style.display = 'none'; if(val === 'custom-url') { document.getElementById('custom-radio-url-container').style.display = 'block'; val = document.getElementById('custom-radio-url').value; } if(!val || val === "") { bgm.pause(); } else { bgm.src = val; bgm.play().catch(e => console.log("Радіо")); } }
function applyCustomRadioUrl() { let bgm = document.getElementById('bgm'); let val = document.getElementById('custom-radio-url').value; if(bgm && val) { bgm.src = val; bgm.play().catch(e => {}); } }
function updateCustomAudio(id, url) { let el = document.getElementById(id); if(el && url && url.trim() !== "") el.src = url; }
function uploadSFX(event, id) { const file = event.target.files[0]; if (file) { const r = new FileReader(); r.onload = function(e) { let el = document.getElementById(id); if(el) el.src = e.target.result; }; r.readAsDataURL(file); } }
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
function startTimer(seconds, timeoutAction) {
    stopTimer(); if(timeLimitSetting <= 0) return; timeLeft = seconds; timerAction = timeoutAction;
    const display = document.getElementById('timer-display'); display.innerText = `⏳ ${timeLeft}`; display.classList.add('active');
    timerInterval = setInterval(() => { timeLeft--; display.innerText = `⏳ ${timeLeft}`; if (timeLeft <= 0) { stopTimer(); if(timerAction) timerAction(); } }, 1000);
}
function stopTimer() { if(timerInterval) clearInterval(timerInterval); document.getElementById('timer-display').classList.remove('active'); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('modal-overlay').style.display === 'flex' && currentModalCanClose) closeModal(); });

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
  for(let i=0; i<c; i++) players.push({ id: i, name: document.getElementById(`p${i}-name`).value, color: playerColors[i], money: sm, deposit: 0, loan: 0, loanTurns: 0, pos: 0, inJail: false, jailTurns: 0, doublesCount: 0, isBankrupt: false, skipTurns: 0, skipMsg: "", reverseMove: false, portfolio: { PTC: 0, RTL: 0, TRN: 0, PST: 0, GOV: 0 }, stockHistory: [], debtMode: false });
  document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-container').style.display = 'flex';
  render2DDie('die1', 1); render2DDie('die2', 1); initBoard(); updateUI();
  if(timeLimitSetting > 0) startTimer(timeLimitSetting, () => userClickedRoll());
}

function renderLobbyPlayers(playersList) {
    const listEl = document.getElementById('lobby-players-list'); let html = ''; let iAmHost = false;
    playersList.forEach((p, i) => {
        let hostBadge = p.isHost ? '👑 ' : ''; let youBadge = p.id === myMultiplayerId ? ' <span style="color:#888; font-size:12px;">(Ви)</span>' : '';
        if(p.id === myMultiplayerId && p.isHost) iAmHost = true;
        html += `<div class="lobby-player-item ${p.isHost ? 'is-host' : ''}" style="color:${playerColors[i % playerColors.length]}">${hostBadge}${p.name}${youBadge}</div>`;
    });
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

function updatePropertyColors() {
    for(let i=0; i<40; i++) {
        let cell = document.getElementById(`cell-${i}`); let ownerBar = document.getElementById(`owner-${i}`);
        if(properties[i] && !properties[i].isMortgaged) { let pColor = players.find(x => x.id === properties[i].owner).color; ownerBar.style.backgroundColor = pColor; cell.style.boxShadow = `inset 0 0 15px ${pColor}88`; cell.style.borderColor = pColor; } 
        else { ownerBar.style.backgroundColor = 'transparent'; cell.style.boxShadow = 'none'; cell.style.borderColor = '#bdc3c7'; }
    }
}

function updateUI() {
  const dash = document.getElementById('dashboard'); dash.innerHTML = ''; let isDebtActive = players.some(p => p.debtMode);
  let activeP = isDebtActive ? players.find(p=>p.debtMode) : players[turn];
  let amIActivePlayer = (!isOnlineMode || (activeP && activeP.id === myMultiplayerId));

  players.forEach(p => {
    let iconHTML = ''; if(p.skipTurns > 0) iconHTML += '<span class="status-icon" title="Пропуск ходу">⏸️</span>'; if(p.reverseMove) iconHTML += '<span class="status-icon" title="Рух назад">⏪</span>'; if(p.loan > 0) iconHTML += '<span class="status-icon" title="Кредит">💳</span>';
    let depHTML = p.deposit > 0 ? `<br><span style="font-size:10px; color:#f1c40f;">Банка: i₴${p.deposit}</span>` : '';
    let cryptoHTML = (p.portfolio.PTC>0 || p.portfolio.RTL>0 || p.portfolio.TRN>0 || p.portfolio.PST>0 || p.portfolio.GOV>0) ? `<br><span style="font-size:10px; color:#00cec9;">Акції: 📈</span>` : '';
    let activeClass = ''; if (isDebtActive) { if(p.debtMode) activeClass = 'debt-player-stat'; } else { if(p.id === players[turn].id) activeClass = 'active-player-stat'; }
    dash.innerHTML += `<div class="player-stat ${activeClass} ${p.isBankrupt ? 'bankrupt-stat' : ''}"><div><div class="color-dot" style="background:${p.color}"></div>${p.name} ${iconHTML}</div><span style="color: ${p.money < 0 ? '#e74c3c' : '#2ecc71'};">i₴${p.money}</span>${depHTML} ${cryptoHTML}</div>`;
  });
  if(!isDebtActive && !players[turn].isBankrupt) { document.getElementById('current-turn').innerHTML = `Круг ${currentRound} | Хід: <span style="color:${players[turn].color}">${players[turn].name}</span>`; }
  document.getElementById('jackpot-display').innerText = `i₴${jackpotAmount}`;
  
  let btnLoan = document.getElementById('loan-btn');
  if(activeP.loan > 0) { btnLoan.innerText = `💳 Погасити (i₴2500, зал. ${activeP.loanTurns} х.)`; btnLoan.className = 'btn-red'; } else { btnLoan.innerText = `💳 Взяти Кредит (i₴2000)`; btnLoan.className = 'btn-purple'; }
  
  document.getElementById('roll-btn').disabled = (!amIActivePlayer || isRolling);
  document.getElementById('trade-btn').disabled = (!amIActivePlayer || isRolling);
  document.getElementById('deposit-btn').disabled = !amIActivePlayer;
  
  updatePropertyColors();
  checkBotTurn(); // <-- Запуск Бота
}

function logMsg(msg) { const log = document.getElementById('log'); log.innerHTML = `<div style="margin-bottom:4px; border-bottom:1px solid #444; padding-bottom:3px;">${msg}</div>` + log.innerHTML; }

// --- ЛОГІКА БОТА ---
function checkBotTurn() {
    if (isOnlineMode || isRolling) return;
    let p = players[turn];
    let isBot = p && p.name.toLowerCase().includes('бот');
    if (isBot && !p.isBankrupt && !p.debtMode) {
        setTimeout(() => { if(!document.getElementById('roll-btn').disabled) userClickedRoll(); }, 1500);
    }
}

// --- СИНХРОНІЗОВАНІ ДІЇ ---
function buyProperty(index, isSync = false) {
  if (isOnlineMode && !isSync) { socket.emit('playerAction', currentLobby.id, { type: 'buy', index: index }); return; }
  
  const p = players[turn]; const cell = mapData[index]; p.money -= cell.price; properties[index] = { owner: p.id, houses: 0, isMortgaged: false }; playSound('sfx-spend');
  let rBuy = buyMsgs[Math.floor(Math.random() * buyMsgs.length)]; logMsg(`<b>${p.name}</b> ${rBuy} <b>${cell.name.replace('<br>',' ')}</b>.`); updateUI(); closeModal(); if(!processDebts()) nextTurn();
}

function skipProperty(isSync = false) {
  if (isOnlineMode && !isSync) { socket.emit('playerAction', currentLobby.id, { type: 'skip' }); return; }
  closeModal(); nextTurn();
}

function payRentConfirm(index, ownerId, rent, isSync = false) {
    if (isOnlineMode && !isSync) { socket.emit('playerAction', currentLobby.id, { type: 'payRent', index: index, ownerId: ownerId, rent: rent }); return; }

    let p = players[turn]; let owner = players.find(pl => pl.id === ownerId); p.money -= rent; owner.money += rent; playSound('sfx-spend');
    let rRent = rentMsgs[Math.floor(Math.random() * rentMsgs.length)]; logMsg(`<b>${p.name}</b> ${rRent} i₴${rent} гравцю <b>${owner.name}</b>.`);
    if (['pink', 'green', 'orange'].includes(mapData[index].group)) { stocks.RTL.pool += Math.ceil(rent * 0.1); stocks.RTL.price += 50; stocks.RTL.noVisit = 0; stocks.RTL.trend = 'up'; }
    if (['yellow'].includes(mapData[index].group)) { stocks.PST.pool += Math.ceil(rent * 0.1); stocks.PST.price += 50; stocks.PST.noVisit = 0; stocks.PST.trend = 'up'; }
    if (['station'].includes(mapData[index].group)) { stocks.TRN.pool += Math.ceil(rent * 0.1); stocks.TRN.price += 50; stocks.TRN.noVisit = 0; stocks.TRN.trend = 'up'; }
    if (mapData[index].type === 'utility') { stocks.GOV.pool += Math.ceil(rent * 0.2); stocks.GOV.trend = 'up'; }
    closeModal(); if(!processDebts()) nextTurn();
}

function payTax(amount, isSync = false) { 
    if (isOnlineMode && !isSync) { socket.emit('playerAction', currentLobby.id, { type: 'payTax', amount: amount }); return; }
    deductMoney(players[turn], amount); logMsg(`Сплачено податок: i₴${amount}`); closeModal(); if(!processDebts()) nextTurn(); 
}

function applyCard(isSync = false) {
  if (isOnlineMode && !isSync) { socket.emit('playerAction', currentLobby.id, { type: 'applyCard' }); return; }
  
  let p = players[turn]; let c = window.currentCard; closeModal();
  if(c.action === 'pay') { deductMoney(p, c.val); }
  else if(c.action === 'receive') { p.money += c.val; playSound('sfx-earn'); }
  else if(c.action === 'goto') { p.pos = c.val; document.getElementById(`tokens-${c.val}`).appendChild(document.getElementById(`token-${p.id}`)); setTimeout(() => handleLanding(p.pos, p), 300); return; }
  else if(c.action === 'skip-turn') { p.skipTurns += c.val; p.skipMsg = c.msg || 'пропускає хід'; logMsg(`🛑 <b>${p.name}</b> ${p.skipMsg}!`); }
  else if(c.action === 'reverse-move') { p.reverseMove = true; logMsg(`⏪ Наступного ходу <b>${p.name}</b> піде назад!`); }
  else if(c.action === 'nabu-tax') { let count = 0; for(let i in properties) { if(properties[i].owner === p.id) count++; } let tax = count * c.val; deductMoney(p, tax); logMsg(`НАБУ перевірило ${count} ділянок. Штраф: i₴${tax}`); }
  else if(c.action === 'birthday') { let total = 0; players.forEach(pl => { if(!pl.isBankrupt && pl.id !== p.id) { deductMoney(pl, c.val); total += c.val; logMsg(`🎁 ${pl.name} дарує i₴${c.val}.`); } }); p.money += total; playSound('sfx-earn'); }
  else if(c.action === 'global-pay') { players.forEach(pl => { if(!pl.isBankrupt){ deductMoney(pl, c.val); } }); logMsg(`Усі скинулися по i₴${c.val}.`); }
  else if(c.action === 'global-receive') { players.forEach(pl => { if(!pl.isBankrupt) pl.money += c.val; }); logMsg(`Усі отримали по i₴${c.val}.`); playSound('sfx-earn'); }
  else if(c.action === 'target-pay' || c.action === 'target-receive') {
      let totalEffect = 0;
      players.forEach(pl => {
          if(pl.isBankrupt) return; let count = 0; for(let i in properties) { if(mapData[i].group === c.group && properties[i].owner === pl.id) count++; }
          if(count > 0) { let amt = count * c.val; totalEffect += amt; if(c.action === 'target-pay') { deductMoney(pl, amt); logMsg(`${pl.name} платить i₴${amt}.`); } else { pl.money += amt; logMsg(`${pl.name} отримує i₴${amt}.`); playSound('sfx-earn'); } }
      });
      if(totalEffect === 0) logMsg(`Нікого не зачепило.`);
  }
  else if(c.action === 'pay-owners') {
      let owners = {}; for(let i in properties) { if(mapData[i].group === c.group && !properties[i].isMortgaged) { let oid = properties[i].owner; owners[oid] = (owners[oid] || 0) + 1; } }
      let totalPaid = 0;
      players.forEach(pl => { if(pl.isBankrupt) return; if(!owners[pl.id]) { deductMoney(pl, c.val); totalPaid += c.val; } });
      let activeOwners = Object.keys(owners).filter(oid => !players.find(x=>x.id==oid).isBankrupt);
      if(activeOwners.length > 0 && totalPaid > 0) {
          let totalProps = activeOwners.reduce((sum, oid) => sum + owners[oid], 0);
          activeOwners.forEach(oid => { let share = Math.floor(totalPaid * (owners[oid] / totalProps)); players.find(x=>x.id==oid).money += share; logMsg(`💼 Власник отримує i₴${share} прибутку.`); });
          playSound('sfx-earn');
      }
  }
  else if(c.action === 'house-tax') {
      players.forEach(pl => {
          if(pl.isBankrupt) return; let tax = 0;
          for(let i in properties) { if(properties[i].owner === pl.id) { let h = properties[i].houses; if(h === 5) tax += c.hotel; else if(h > 0) tax += (h * c.house); } }
          if(tax > 0) { deductMoney(pl, tax); logMsg(`${pl.name} платить i₴${tax} податку на будівлі.`); }
      });
  }
  updateUI(); if(!processDebts()) nextTurn();
}

function handleLanding(index, p) {
  const cell = mapData[index]; logMsg(`📍 <b>${p.name}</b> стає на <b>${cell.name.replace('<br>',' ')}</b>`);
  
  let amIActivePlayer = (!isOnlineMode || p.id === myMultiplayerId);
  let isBot = p.name.toLowerCase().includes('бот') && !isOnlineMode;

  if(index === 30) { p.pos = 10; p.inJail = true; p.doublesCount = 0; lastRollWasDouble = false; document.getElementById(`tokens-10`).appendChild(document.getElementById(`token-${p.id}`)); logMsg(`<b>${p.name}</b> відправляється в Колонію!`); return nextTurn(); }
  if(index === 20) { 
      if(jackpotAmount > 0) { 
          let j = jackpotAmount; p.money += j; playSound('sfx-earn'); logMsg(`🎉 <b>${p.name}</b> зірвав джекпот Парковки: <b>+i₴${j}</b>!`); jackpotAmount = 0; updateUI();
          if (amIActivePlayer && !isBot) {
              window.currentCard = { text: `Ти забираєш усі гроші!` }; // Fake card for modal
              openModal(`🎉 ДЖЕКПОТ ПАРКОВКИ!`, `<p style="font-size:20px; color:#2ecc71; font-weight:bold;">+i₴${j}</p><p>Ти забираєш усі гроші зі штрафів та податків!</p>`, `<button class="btn-green" onclick="closeModal(); nextTurn();">Забрати</button>`, false);
          } else { setTimeout(() => nextTurn(), 1500); }
          return;
      } 
      if(amIActivePlayer) { if (isOnlineMode) socket.emit('playerAction', currentLobby.id, { type: 'nextTurn' }); else nextTurn(); }
      return; 
  }
  if(cell.type === 'tax') { 
      if (isBot) { setTimeout(() => payTax(cell.amount), 1500); }
      else if (amIActivePlayer) { openModal(`Податок`, `<p>Обов'язковий платіж.</p><p>До сплати: <b>i₴${cell.amount}</b></p>`, `<button class="btn-red" onclick="payTax(${cell.amount})">Заплатити</button>`, false); }
      else { logMsg(`⏳ Очікуємо сплату податку від ${p.name}...`); }
      return; 
  }
  
  if(cell.type === 'chance' || cell.type === 'news') { 
      if (!amIActivePlayer && !isBot) { logMsg(`⏳ Очікуємо, поки ${p.name} витягне картку...`); return; }
      
      let isUrgent = (cell.type === 'news' && Math.random() < 0.1); let deck = isUrgent ? urgentNews : (cell.type === 'chance' ? chanceCards : newsCards); 
      let cIndex = Math.floor(Math.random() * deck.length);
      
      if (isOnlineMode) { socket.emit('playerAction', currentLobby.id, { type: 'drawCard', isUrgent: isUrgent, cellType: cell.type, cardIndex: cIndex }); } 
      else { showCardModal(isUrgent, cell.type, cIndex); }
      return; 
  }

  if(cell.price) {
      const prop = properties[index];
      if(!prop) { 
          if (isBot) {
              if (p.money >= cell.price + 500) { setTimeout(() => buyProperty(index), 1500); } 
              else { setTimeout(() => skipProperty(), 1000); }
          }
          else if (amIActivePlayer) {
              openModal(`Купівля`, `<p>Купити <b>${cell.name.replace('<br>',' ')}</b> за <b>i₴${cell.price}</b>?</p>`, `<button class="btn-green" onclick="buyProperty(${index})">Купити</button><button class="btn-red" onclick="skipProperty()">Відмовитись</button>`, false); 
          }
          else { logMsg(`⏳ Очікуємо рішення гравця ${p.name}...`); }
      } 
      else if(prop.owner !== p.id && !prop.isMortgaged) { 
          payRent(index, p, prop, isBot, amIActivePlayer); 
      } 
      else { 
          if(amIActivePlayer) { if (isOnlineMode) socket.emit('playerAction', currentLobby.id, { type: 'nextTurn' }); else nextTurn(); }
      }
  } 
  else { 
      if(amIActivePlayer) { if (isOnlineMode) socket.emit('playerAction', currentLobby.id, { type: 'nextTurn' }); else nextTurn(); }
  }
}

function showCardModal(isUrgent, cellType, cIndex) {
    let deck = isUrgent ? urgentNews : (cellType === 'chance' ? chanceCards : newsCards);
    window.currentCard = deck[cIndex];
    let p = players[turn];
    let isBot = p.name.toLowerCase().includes('бот') && !isOnlineMode;
    let amIActivePlayer = (!isOnlineMode || p.id === myMultiplayerId);

    if (isBot) { setTimeout(() => applyCard(), 1500); return; }

    if (amIActivePlayer) {
        document.getElementById('modal-content').className = `modal ${isUrgent ? 'urgent-modal' : cellType+'-modal'}`;
        openModal(isUrgent ? "⚡ БЛИСКАВКА" : (cellType === 'chance' ? "🎁 Шанс" : "📰 Новини"), `<p style="font-size:16px; ${isUrgent?'font-weight:bold; color:#e74c3c;':''}">${window.currentCard.text}</p>`, `<button class="btn-blue" onclick="applyCard();">Ок</button>`, false);
    }
}

function payRent(index, p, propData, isBot, amIActivePlayer) {
  const cell = mapData[index]; const owner = players.find(pl => pl.id === propData.owner); let rent = 0;
  if(cell.type === 'utility') { let c = 0; for(let i in properties) { if(properties[i].owner === owner.id && mapData[i].type === 'utility') c++; } rent = lastDiceSum * (c === 2 ? 250 : 100); } 
  else if(cell.type === 'station') { let c = 0; for(let i in properties) { if(properties[i].owner === owner.id && mapData[i].type === 'station') c++; } rent = cell.baseRent * Math.pow(2, c - 1); }
  else { const rentArr = getRentArray(cell.baseRent); rent = rentArr[propData.houses]; if(propData.houses === 0) { if(mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group).every(x => properties[x.i] && properties[x.i].owner === owner.id)) rent *= 2; } }

  if (isBot) { setTimeout(() => payRentConfirm(index, owner.id, rent), 1500); }
  else if (amIActivePlayer) {
      document.getElementById('modal-content').className = 'modal';
      let msg = `<p>Ти став на <b>${cell.name.replace('<br>',' ')}</b>.</p><p>Власник: ${owner.name}<br>`; if(cell.type === 'utility') msg += `Сума кубиків: ${lastDiceSum}<br>Множник: x${rent / lastDiceSum}<br>`; msg += `До сплати: <b style="color:#e74c3c;">i₴${rent}</b></p>`;
      openModal(`Оренда`, msg, `<button class="btn-red" onclick="payRentConfirm(${index}, ${owner.id}, ${rent})">Заплатити</button>`, false);
  } else { logMsg(`⏳ Очікуємо, поки ${p.name} заплатить оренду...`); }
}

function showPropertyInfo(index) {
  const cell = mapData[index]; if(!cell.price) return;
  const prop = properties[index]; const ownerName = prop ? players.find(p=>p.id===prop.owner).name : "Нічия";
  const mortgageValue = cell.price / 2; const unmortgageValue = mortgageValue + (mortgageValue * 0.1);
  let p = players.find(x => x.debtMode) || players[turn]; 

  let rentDetails = '';
  if(cell.type === 'station') { rentDetails = `Оренда залежить від кількості АЗС/Доставок.<br>Базова: i₴${cell.baseRent} (х2, х4, х8)`; }
  else if(cell.type === 'utility') { rentDetails = `Оренда: Сума кубиків × 100 (або × 250)`; }
  else { const rentArr = getRentArray(cell.baseRent); rentDetails = `Оренда: i₴${rentArr[0]}<br><div class="prop-card-row"><span>З 1 Будинком</span><span>i₴${rentArr[1]}</span></div><div class="prop-card-row"><span>З 2 Будинками</span><span>i₴${rentArr[2]}</span></div><div class="prop-card-row"><span>З 3 Будинками</span><span>i₴${rentArr[3]}</span></div><div class="prop-card-row"><span>З 4 Будинками</span><span>i₴${rentArr[4]}</span></div><div class="prop-card-row"><span style="color:#e74c3c;font-weight:bold;">З ГОТЕЛЕМ</span><span style="color:#e74c3c;font-weight:bold;">i₴${rentArr[5]}</span></div>`; }

  let html = `<div class="prop-card"><div class="prop-card-header" style="background-color: ${colors[cell.group]}; color: ${cell.group==='yellow'||cell.group==='none'?'#000':'#fff'}">${cell.name.replace('<br>',' ')}</div><div class="prop-card-body">${rentDetails}</div><div class="prop-card-footer"><div>Вартість будинку: i₴${cell.housePrice || '-'}</div><div>Сума застави: i₴${mortgageValue}</div><div style="margin-top:5px; font-weight:bold;">Власник: ${ownerName} ${prop && prop.isMortgaged ? '<span style="color:#e74c3c;">(В ЗАСТАВІ)</span>' : ''}</div></div></div>`;

  let btns = '';
  if(prop && prop.owner === p.id) {
      if(!prop.isMortgaged) {
          if(cell.type === 'property') {
              if(prop.houses > 0) btns += `<button class="btn-gold" onclick="sellHouse(${index})">Продати дім (+i₴${cell.housePrice / 2})</button>`;
              if(prop.houses < 5) btns += `<button class="btn-green" onclick="buildHouse(${index})" ${p.debtMode?'disabled':''}>Будувати дім (i₴${cell.housePrice})</button>`;
          }
          if(prop.houses === 0) btns += `<button class="btn-red" onclick="mortgage(${index}, ${mortgageValue})">Закласти (+i₴${mortgageValue})</button>`;
      } else { btns += `<button class="btn-blue" onclick="unmortgage(${index}, ${unmortgageValue})" ${p.debtMode?'disabled':''}>Викупити (-i₴${unmortgageValue})</button>`; }
  } else if(!prop) { btns += `<button class="btn-blue" onclick="closeModal()">Ок</button>`; }
  
  document.getElementById('modal-content').className = 'modal'; openModal("Інформація", html, btns, true);
}

function mortgage(i, a) { let p = players.find(x => x.debtMode) || players[turn]; p.money+=a; properties[i].isMortgaged=true; playSound('sfx-earn'); updateUI(); checkDebtResolution(); closeModal(); }
function unmortgage(i, a) { let p = players.find(x => x.debtMode) || players[turn]; if(p.money<a){alert("Немає грошей!");return;} p.money-=a; properties[i].isMortgaged=false; playSound('sfx-spend'); updateUI(); checkDebtResolution(); closeModal(); }
function buildHouse(index) {
  const p = players[turn]; const cell = mapData[index]; const prop = properties[index]; if(p.debtMode) return;
  let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group);
  if(!groupCells.every(x => properties[x.i] && properties[x.i].owner === p.id)) { alert("Скупи всі ділянки цього кольору!"); return; }
  let minHouses = 5; groupCells.forEach(x => { if(properties[x.i].houses < minHouses) minHouses = properties[x.i].houses; });
  if(prop.houses >= 5) { alert("Тут вже стоїть готель!"); return; } if(prop.houses > minHouses) { alert("Будуй рівномірно!"); return; }
  if(p.money < cell.housePrice) { alert("Не вистачає грошей!"); return; }
  p.money -= cell.housePrice; prop.houses++; playSound('sfx-spend'); updateUI(); logMsg(`<b>${p.name}</b> будує дім на <b>${cell.name.replace('<br>',' ')}</b>.`); drawHouses(index, prop.houses); closeModal();
}
function sellHouse(index) {
  const p = players.find(x => x.debtMode) || players[turn]; const cell = mapData[index]; const prop = properties[index];
  let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group); let maxHouses = 0; groupCells.forEach(x => { if(properties[x.i].houses > maxHouses) maxHouses = properties[x.i].houses; });
  if(prop.houses < maxHouses) { alert("Продавай рівномірно! Почни з ділянок, де будинків більше."); return; }
  let refund = cell.housePrice / 2; p.money += refund; prop.houses--; playSound('sfx-earn'); updateUI(); logMsg(`<b>${p.name}</b> продає дім за i₴${refund}.`); drawHouses(index, prop.houses); checkDebtResolution(); closeModal();
}
function drawHouses(index, count) { const hCont = document.getElementById(`houses-${index}`); hCont.innerHTML = ''; if(count < 5) { for(let i=0; i<count; i++) hCont.innerHTML += `<div class="house-icon"></div>`; } else { hCont.innerHTML = `<div class="hotel-icon"></div>`; } }

// Інші функції (Трейд і т.д.) поки залишаємо локальними (в онлайні вони працюватимуть тільки якщо всі гравці сидять поруч)
function openTradeMenu() { alert("В розробці для серверної версії!"); }

function userClickedRoll() {
    stopTimer();
    if(isOnlineMode && socket && currentLobby) { socket.emit('rollDice', currentLobby.id); } 
    else { startTurnLocal(); }
}

async function startTurnLocal() {
  if(isRolling || processDebts()) return; isRolling = true;
  document.getElementById('roll-btn').disabled = true; document.getElementById('trade-btn').disabled = true;
  try {
      const p = players[turn]; lastRollWasDouble = false; 
      if(p.loan > 0) { p.loanTurns--; if(p.loanTurns <= 0) { logMsg(`⏰ Час платити за кредит! Банк списує i₴2500.`); deductMoney(p, 2500); p.loan = 0; p.loanTurns = 0; if(processDebts()) return; } else { logMsg(`💳 Залишилось ${p.loanTurns} ходів до погашення кредиту.`); } }
      if (p.skipTurns > 0) { p.skipTurns--; logMsg(`🛑 <b>${p.name}</b> ${p.skipMsg || 'пропускає хід'}!`); return nextTurn(); }
      const {v1, v2} = await roll2DDice(); const isDouble = (v1 === v2);
      if (p.inJail) {
          if (isDouble) { logMsg(`🎲 <b>${p.name}</b> кинув ДУБЛЬ! Виходить з Колонії.`); p.inJail = false; p.jailTurns = 0; } 
          else { p.jailTurns++; let jailMsgs = ["сидить у камері", "їсть баланду", "сумує за волею", "мріє про свободу"]; let rJail = jailMsgs[Math.floor(Math.random() * jailMsgs.length)]; if (p.jailTurns >= 3) { logMsg(`⏳ <b>${p.name}</b> відсидів 3 ходи. Сплачує штраф i₴1000.`); deductMoney(p, 1000); p.inJail = false; p.jailTurns = 0; if(processDebts()) return; } else { logMsg(`🚫 <b>${p.name}</b> ${rJail}. (Хід ${p.jailTurns}/3)`); return nextTurn(); } }
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
            p.pos = 0; let isExactGo = (i === steps - 1); let salary = isExactGo ? 4000 : 2000; p.money += salary; playSound('sfx-earn');
            let msg = isExactGo ? `<b>${p.name}</b> став РІВНО на СТАРТ! Премія: <b>+i₴4000</b>` : `<b>${p.name}</b> пройшов СТАРТ. Зарплата <b>+i₴2000</b>`;
            let depBonus = Math.floor(p.deposit * 0.05); if(depBonus > 0) { p.deposit += depBonus; msg += ` (і +i₴${depBonus} відсотків на банку)`; }
            logMsg(msg); updateUI(); 
        }
    }
    const targetArea = document.getElementById(`tokens-${p.pos}`); token.classList.add('jumping'); playSound('sfx-step'); await sleep(150); targetArea.appendChild(token); token.classList.remove('jumping'); await sleep(100);
  }
  handleLanding(p.pos, p);
}

function nextTurn() { 
  isRolling = false;
  if(Math.random() < 0.1) { stocks.PTC.price = Math.floor(stocks.PTC.price * 0.3); stocks.PTC.trend = 'down'; logMsg(`📉 КРАХ КРИПТИ! PTC падає до i₴${stocks.PTC.price}`); }
  else { let r = Math.random() * (1.6 - 0.7) + 0.7; stocks.PTC.price = Math.floor(stocks.PTC.price * r); stocks.PTC.trend = r >= 1 ? 'up' : 'down'; }
  if(stocks.PTC.price < 50) stocks.PTC.price = 50; if(stocks.PTC.price > 10000) stocks.PTC.price = 10000;
  
  ['RTL', 'TRN', 'PST'].forEach(sym => { stocks[sym].noVisit++; if(stocks[sym].noVisit > 4) { stocks[sym].price = Math.max(100, stocks[sym].price - 100); stocks[sym].trend = 'down'; } });
  distributeDividends('RTL'); distributeDividends('TRN'); distributeDividends('PST'); distributeDividends('GOV');

  if(lastRollWasDouble && !players[turn].inJail && !players[turn].isBankrupt) { lastRollWasDouble = false; } 
  else { do { turn = (turn + 1) % players.length; if(turn === 0) currentRound++; } while(players[turn].isBankrupt); }
  
  updateUI(); 
  if(timeLimitSetting > 0) { startTimer(timeLimitSetting, () => { if(!isRolling && document.getElementById('modal-overlay').style.display === 'none') userClickedRoll(); }); }
}
