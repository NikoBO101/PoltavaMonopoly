let players = []; let turn = 0; let properties = {}; let jackpotAmount = 0;
let lastRollWasDouble = false; let lastDiceSum = 0; let isRolling = false;
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
        isOnlineMode = true; turn = serverGameState.turn; players = serverGameState.players;
        document.getElementById('lobby-screen').style.display = 'none'; document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-container').style.display = 'flex';
        render2DDie('die1', 1); render2DDie('die2', 1); initBoard(); updateUI(); logMsg(`🎮 Онлайн гру запущено!`);
    });

    socket.on('diceRolled', async (data) => {
        isRolling = true; updateUI(); playSound('sfx-dice');
        const d1 = document.getElementById('die1'), d2 = document.getElementById('die2');
        d1.classList.add('rolling-anim'); d2.classList.add('rolling-anim');
        for(let i=0; i<10; i++) { render2DDie('die1', Math.floor(Math.random()*6)+1); render2DDie('die2', Math.floor(Math.random()*6)+1); await sleep(50); }
        d1.classList.remove('rolling-anim'); d2.classList.remove('rolling-anim');
        render2DDie('die1', data.v1); render2DDie('die2', data.v2); 
        lastDiceSum = data.v1 + data.v2; lastRollWasDouble = (data.v1 === data.v2);
        await sleep(300); await movePlayer(lastDiceSum);
    });

    // ЖОРСТКА СИНХРОНІЗАЦІЯ ВІД СЕРВЕРА
    socket.on('updateGameState', (stateData) => {
        players = stateData.players; properties = stateData.properties; turn = stateData.turn; 
        jackpotAmount = stateData.jackpotAmount; stocks = stateData.stocks;
        
        // Оновлюємо фішки
        players.forEach(p => { const token = document.getElementById(`token-${p.id}`); const target = document.getElementById(`tokens-${p.pos}`); if (token && target) target.appendChild(token); });
        for(let i in properties) drawHouses(i, properties[i].houses);
        updateUI();
    });
}

// Функція перевірки чий хід
function amIActivePlayer() {
    if (!isOnlineMode) return true;
    let activeP = players.find(p => p.debtMode) || players[turn];
    return activeP && activeP.id === myMultiplayerId;
}

// Функція розсилки стану всім іншим
function broadcastState() {
    if (isOnlineMode && currentLobby && amIActivePlayer()) {
        socket.emit('syncGameState', currentLobby.id, { players, properties, turn, jackpotAmount, stocks });
    }
}

document.addEventListener("DOMContentLoaded", () => { generatePlayerInputs(); updateVolume(); });
function switchTab(tabId) { document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.getElementById(tabId).classList.add('active'); event.currentTarget.classList.add('active'); }

function generatePlayerInputs() {
    let selectEl = document.getElementById('player-count'); if(!selectEl) return;
    const c = parseInt(selectEl.value); const cont = document.getElementById('player-names-container'); cont.innerHTML = '';
    let defs = ['Коля', 'Надя', 'Бот', 'Бот 2', 'Гравець 5', 'Гравець 6']; 
    for(let i=0; i<c; i++) {
        cont.innerHTML += `<div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;"><input type="text" id="p${i}-name" value="${defs[i]}" style="flex-grow:1;"><label style="font-size:12px; color:#10b981; display:flex; align-items:center; gap:3px;"><input type="checkbox" id="p${i}-isbot" ${defs[i].includes('Бот') ? 'checked' : ''}> Бот</label></div>`;
    }
}

function updateVolume() {
    let sfxVol = document.getElementById('vol-sfx') ? document.getElementById('vol-sfx').value : 0.5;
    ['sfx-dice', 'sfx-step', 'sfx-earn', 'sfx-spend', 'sfx-bankrupt'].forEach(id => { let el = document.getElementById(id); if(el) el.volume = sfxVol; });
}
function playSound(id) { let el = document.getElementById(id); if(el && el.getAttribute('src')) { el.currentTime = 0; el.play().catch(e => {}); } }
function render2DDie(id, num) { let el = document.getElementById(id); if(el) el.innerHTML = dotL[num].map(v=>`<div class="dot ${v===0?'hidden':''}"></div>`).join(''); }
function getRentArray(base) { return [base, base*5, base*15, base*40, base*50, base*60]; }

function openModal(t, b, btn) { 
    document.getElementById('modal-title').innerHTML = t; document.getElementById('modal-body').innerHTML = b; 
    document.getElementById('modal-buttons').innerHTML = btn; document.getElementById('modal-overlay').style.display = 'flex'; 
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

function createRoom() { if(!socket) return alert("Сервер недоступний!"); const pName = document.getElementById('mp-player-name').value.trim(); if(!pName) return alert("Введіть ім'я!"); socket.emit('createRoom', { playerName: pName, roomName: document.getElementById('mp-room-name').value.trim(), password: document.getElementById('mp-room-pass').value.trim() }); }
function joinRoomFromList(roomId, hasPassword) { if(!socket) return alert("Сервер недоступний!"); const pName = document.getElementById('mp-player-name').value.trim(); if(!pName) return alert("Введіть ім'я!"); let pass = ''; if(hasPassword) { pass = prompt("Пароль:"); if(pass === null) return; } socket.emit('joinRoom', { roomId: roomId, playerName: pName, password: pass }); }
function joinRoomByCode() { if(!socket) return alert("Сервер недоступний!"); const pName = document.getElementById('mp-player-name').value.trim(); if(!pName) return alert("Введіть ім'я!"); const code = document.getElementById('mp-join-code').value.trim().toUpperCase(); if(!code) return alert("Введіть код кімнати!"); socket.emit('joinRoom', { roomId: code, playerName: pName, password: document.getElementById('mp-join-pass').value.trim() }); }
function startOnlineGameAction() { if(socket && currentLobby) socket.emit('startGame', currentLobby.id); }

function startLocalGame() {
  isOnlineMode = false; jackpotRate = parseFloat(document.getElementById('setting-jackpot').value); 
  const c = parseInt(document.getElementById('player-count').value); const sm = parseInt(document.getElementById('start-money').value) || 15000;
  players = [];
  for(let i=0; i<c; i++) {
      let isBot = document.getElementById(`p${i}-isbot`).checked;
      players.push({ id: i, name: document.getElementById(`p${i}-name`).value, isBot: isBot, color: playerColors[i], money: sm, deposit: 0, loan: 0, pos: 0, inJail: false, jailTurns: 0, doublesCount: 0, isBankrupt: false, skipTurns: 0, reverseMove: false, portfolio: { PTC: 0, RTL: 0, TRN: 0, PST: 0, GOV: 0 }, debtMode: false });
  }
  document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-container').style.display = 'flex';
  render2DDie('die1', 1); render2DDie('die2', 1); initBoard(); updateUI();
}

function renderLobbyPlayers(playersList) {
    const listEl = document.getElementById('lobby-players-list'); let html = ''; let iAmHost = false;
    playersList.forEach((p, i) => { let hostBadge = p.isHost ? '👑 ' : ''; if(p.id === myMultiplayerId && p.isHost) iAmHost = true; html += `<div class="lobby-player-item" style="color:${playerColors[i % playerColors.length]}">${hostBadge}${p.name} ${p.id === myMultiplayerId ? '(Ви)' : ''}</div>`; });
    listEl.innerHTML = html; document.getElementById('lobby-start-btn').style.display = iAmHost ? 'inline-block' : 'none';
}

function getGridArea(i) { if (i <= 10) return { r: 11, c: 11 - i }; if (i <= 19) return { r: 11 - (i - 10), c: 1 }; if (i <= 30) return { r: 1, c: (i - 20) + 1 }; return { r: (i - 30) + 1, c: 11 }; }
function initBoard() {
  document.querySelectorAll('.cell').forEach(e => e.remove()); const board = document.getElementById('board');
  for (let i = 0; i < 40; i++) {
    const data = mapData[i]; const cell = document.createElement('div'); cell.className = `cell ${data.type === 'corner' ? 'corner' : ''}`; cell.id = `cell-${i}`; cell.onclick = () => showPropertyInfo(i); 
    let pos = getGridArea(i); cell.style.gridRow = pos.r; cell.style.gridColumn = pos.c;
    let topContent = ''; if(data.emoji) topContent += `<div class="cell-emoji">${data.emoji}</div>`; topContent += `<div class="cell-name">${data.name}</div>`;
    if (data.group && colors[data.group]) cell.innerHTML += `<div class="district-bar" style="background:${colors[data.group]}"></div>`;
    cell.innerHTML += `${topContent}<div class="houses-container" id="houses-${i}"></div><div class="tokens-area" id="tokens-${i}"></div>`;
    if (data.price) cell.innerHTML += `<div class="cell-price">i₴${data.price}</div>`; cell.innerHTML += `<div class="owner-bar" id="owner-${i}"></div>`;
    board.appendChild(cell);
  }
  players.forEach(p => { const token = document.createElement('div'); token.id = `token-${p.id}`; token.className = 'pawn'; token.style.backgroundColor = p.color; document.getElementById('tokens-0').appendChild(token); });
}

function updateUI() {
  const dash = document.getElementById('dashboard'); dash.innerHTML = ''; let isDebtActive = players.some(p => p.debtMode);
  
  players.forEach(p => {
    let iconHTML = ''; if(p.skipTurns > 0) iconHTML += '⏸️'; if(p.loan > 0) iconHTML += '💳';
    let depHTML = p.deposit > 0 ? `<br><span style="color:#f1c40f;">Банка: i₴${p.deposit}</span>` : '';
    let activeClass = ''; if (isDebtActive) { if(p.debtMode) activeClass = 'debt-player-stat'; } else { if(p.id === players[turn].id) activeClass = 'active-player-stat'; }
    dash.innerHTML += `<div class="player-stat ${activeClass} ${p.isBankrupt ? 'bankrupt-stat' : ''}"><div><div class="color-dot" style="background:${p.color}"></div>${p.name} ${iconHTML}</div><span style="color: ${p.money < 0 ? '#ef4444' : '#10b981'};">i₴${p.money}</span>${depHTML}</div>`;
  });
  if(!isDebtActive && !players[turn].isBankrupt) { document.getElementById('current-turn').innerHTML = `Хід: <span style="color:${players[turn].color}">${players[turn].name}</span>`; }
  document.getElementById('jackpot-display').innerText = `i₴${jackpotAmount}`;
  
  // Керування кнопками
  let canAct = amIActivePlayer() && !isRolling;
  document.getElementById('roll-btn').disabled = !canAct;
  document.getElementById('trade-btn').disabled = !canAct;
  
  for(let i=0; i<40; i++) {
        let cell = document.getElementById(`cell-${i}`); let ownerBar = document.getElementById(`owner-${i}`);
        if(properties[i] && !properties[i].isMortgaged) { let pColor = players.find(x => x.id === properties[i].owner).color; ownerBar.style.backgroundColor = pColor; cell.style.borderColor = pColor; } 
        else { ownerBar.style.backgroundColor = 'transparent'; cell.style.borderColor = '#cbd5e1'; }
  }

  // Бот грає сам
  if (canAct && !isOnlineMode && players[turn].isBot) { setTimeout(() => runBotTurn(), 1500); }
}

function logMsgLocal(msg) { const log = document.getElementById('log'); log.innerHTML = `<div style="margin-bottom:4px; border-bottom:1px solid #334155; padding-bottom:3px;">${msg}</div>` + log.innerHTML; }
function logMsg(msg) { logMsgLocal(msg); broadcastState(); }

// --- БОТ ---
async function runBotTurn() {
    if (isRolling) return;
    let p = players[turn]; if(p.isBankrupt || p.debtMode) return;
    
    // Бот будує будинки якщо має монополію і гроші
    for(let i in properties) {
        if (properties[i].owner === p.id) {
            let group = mapData[i].group;
            let groupCells = mapData.map((c, idx) => ({c, idx})).filter(x => x.c.group === group);
            let hasMonopoly = groupCells.every(x => properties[x.idx] && properties[x.idx].owner === p.id);
            if (hasMonopoly && properties[i].houses < 5 && p.money >= mapData[i].housePrice + 500) {
                p.money -= mapData[i].housePrice; properties[i].houses++; drawHouses(i, properties[i].houses); logMsg(`🤖 ${p.name} будує дім.`); updateUI();
            }
        }
    }
    userClickedRoll();
}

function userClickedRoll() { if(isOnlineMode && socket && currentLobby) { socket.emit('rollDice', currentLobby.id); } else { startTurnLocal(); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startTurnLocal() {
  if(isRolling) return; isRolling = true; updateUI();
  try {
      const p = players[turn]; lastRollWasDouble = false; 
      if (p.skipTurns > 0) { p.skipTurns--; logMsg(`🛑 <b>${p.name}</b> пропускає хід!`); return nextTurn(); }
      const {v1, v2} = await roll2DDice(); const isDouble = (v1 === v2);
      if (p.inJail) {
          if (isDouble) { logMsg(`🎲 <b>${p.name}</b> кинув ДУБЛЬ! Виходить.`); p.inJail = false; p.jailTurns = 0; } 
          else { p.jailTurns++; if (p.jailTurns >= 3) { logMsg(`⏳ <b>${p.name}</b> відсидів. Штраф i₴1000.`); p.money -= 1000; p.inJail = false; p.jailTurns = 0; if(processDebts()) return; } else { logMsg(`🚫 <b>${p.name}</b> сидить. (Хід ${p.jailTurns}/3)`); return nextTurn(); } }
      } else {
          if (isDouble) { p.doublesCount++; if (p.doublesCount >= 3) { logMsg(`🚨 3 ДУБЛІ! У в'язницю!`); p.inJail = true; p.pos = 10; p.doublesCount = 0; document.getElementById(`tokens-10`).appendChild(document.getElementById(`token-${p.id}`)); return nextTurn(); } logMsg(`🎲 ДУБЛЬ! Додатковий хід.`); lastRollWasDouble = true; } else { p.doublesCount = 0; }
      }
      await movePlayer(v1 + v2);
  } catch(e) { console.error(e); isRolling = false; updateUI(); }
}

async function roll2DDice() {
  playSound('sfx-dice');
  const d1 = document.getElementById('die1'), d2 = document.getElementById('die2');
  d1.classList.add('rolling-anim'); d2.classList.add('rolling-anim');
  for(let i=0; i<10; i++) { render2DDie('die1', Math.floor(Math.random()*6)+1); render2DDie('die2', Math.floor(Math.random()*6)+1); await sleep(50); }
  d1.classList.remove('rolling-anim'); d2.classList.remove('rolling-anim');
  render2DDie('die1', v1); render2DDie('die2', v2); lastDiceSum = v1 + v2; await sleep(300); return {v1, v2};
}

async function movePlayer(steps) {
  const p = players[turn]; const token = document.getElementById(`token-${p.id}`);
  for (let i = 0; i < steps; i++) {
    p.pos++; if(p.pos >= 40) { p.pos = 0; if(amIActivePlayer()) { let s = (i === steps-1) ? 4000 : 2000; p.money += s; playSound('sfx-earn'); logMsg(`<b>${p.name}</b> пройшов СТАРТ. <b>+i₴${s}</b>`); updateUI(); } }
    const targetArea = document.getElementById(`tokens-${p.pos}`); token.classList.add('jumping'); playSound('sfx-step'); await sleep(150); targetArea.appendChild(token); token.classList.remove('jumping'); await sleep(100);
  }
  if (amIActivePlayer()) handleLanding(p.pos, p);
}

function handleLanding(index, p) {
  const cell = mapData[index]; logMsg(`📍 <b>${p.name}</b> стає на <b>${cell.name.replace('<br>',' ')}</b>`);
  
  if (!amIActivePlayer()) { logMsgLocal(`⏳ Очікуємо хід гравця ${p.name}...`); return; } // БЛОКОВКА ДЛЯ ІНШИХ ГРАВЦІВ

  if(index === 30) { p.pos = 10; p.inJail = true; document.getElementById(`tokens-10`).appendChild(document.getElementById(`token-${p.id}`)); logMsg(`<b>${p.name}</b> у в'язницю!`); return nextTurn(); }
  if(index === 20) { 
      if(jackpotAmount > 0) { let j = jackpotAmount; p.money += j; playSound('sfx-earn'); jackpotAmount = 0; logMsg(`🎉 <b>${p.name}</b> зірвав джекпот Парковки: <b>+i₴${j}</b>!`); } 
      return nextTurn(); 
  }
  if(cell.type === 'tax') { 
      if (p.isBot) { p.money -= cell.amount; logMsg(`🤖 Бот сплатив податок i₴${cell.amount}`); nextTurn(); }
      else { openModal(`Податок`, `<p>До сплати: <b>i₴${cell.amount}</b></p>`, `<button class="btn-red" onclick="payTax(${cell.amount})">Заплатити</button>`); }
      return; 
  }
  
  if(cell.type === 'chance' || cell.type === 'news') { 
      let isUrgent = (cell.type === 'news' && Math.random() < 0.1); let deck = isUrgent ? urgentNews : (cell.type === 'chance' ? chanceCards : newsCards); 
      window.currentCard = deck[Math.floor(Math.random() * deck.length)];
      if (p.isBot) { setTimeout(() => applyCard(), 1500); }
      else { document.getElementById('modal-content').className = `modal ${cell.type}-modal`; openModal(isUrgent ? "БЛИСКАВКА" : "Картка", `<p>${window.currentCard.text}</p>`, `<button class="btn-blue" onclick="applyCard();">Ок</button>`); }
      return; 
  }

  if(cell.price) {
      const prop = properties[index];
      if(!prop) { 
          if (p.isBot) { if (p.money >= cell.price + 500) buyProperty(index); else nextTurn(); }
          else { openModal(`Купівля`, `<p>Купити <b>${cell.name.replace('<br>',' ')}</b> за <b>i₴${cell.price}</b>?</p>`, `<button class="btn-green" onclick="buyProperty(${index})">Купити</button><button class="btn-red" onclick="closeModal(); nextTurn();">Відмовитись</button>`); }
      } 
      else if(prop.owner !== p.id && !prop.isMortgaged) { payRent(index, p, prop); } 
      else { nextTurn(); }
  } else { nextTurn(); }
}

function buyProperty(index) {
  const p = players[turn]; const cell = mapData[index]; p.money -= cell.price; properties[index] = { owner: p.id, houses: 0, isMortgaged: false }; playSound('sfx-spend');
  logMsg(`<b>${p.name}</b> купив <b>${cell.name.replace('<br>',' ')}</b>.`); updateUI(); closeModal(); if(!processDebts()) nextTurn();
}

function payRent(index, p, propData) {
  const cell = mapData[index]; const owner = players.find(pl => pl.id === propData.owner); let rent = cell.baseRent; // Спрощений розрахунок для швидкості
  if (p.isBot) { p.money -= rent; owner.money += rent; logMsg(`🤖 Бот сплатив оренду i₴${rent}.`); if(!processDebts()) nextTurn(); }
  else { openModal(`Оренда`, `<p>Власник: ${owner.name}<br>До сплати: <b style="color:#ef4444;">i₴${rent}</b></p>`, `<button class="btn-red" onclick="payRentConfirm(${index}, ${owner.id}, ${rent})">Заплатити</button>`); }
}
function payRentConfirm(index, ownerId, rent) { let p = players[turn]; let owner = players.find(pl => pl.id === ownerId); p.money -= rent; owner.money += rent; playSound('sfx-spend'); logMsg(`<b>${p.name}</b> сплатив i₴${rent} гравцю <b>${owner.name}</b>.`); closeModal(); if(!processDebts()) nextTurn(); }
function payTax(amount) { players[turn].money -= amount; jackpotAmount += Math.ceil(amount * jackpotRate); playSound('sfx-spend'); logMsg(`Сплачено податок: i₴${amount}`); closeModal(); if(!processDebts()) nextTurn(); }

function applyCard() {
  let p = players[turn]; let c = window.currentCard; closeModal();
  if(c.action === 'pay') { p.money -= c.val; } else if(c.action === 'receive') { p.money += c.val; playSound('sfx-earn'); }
  else if(c.action === 'goto') { p.pos = c.val; document.getElementById(`tokens-${c.val}`).appendChild(document.getElementById(`token-${p.id}`)); setTimeout(() => handleLanding(p.pos, p), 300); return; }
  else if(c.action === 'skip-turn') { p.skipTurns += c.val; logMsg(`🛑 <b>${p.name}</b> пропускає хід!`); }
  updateUI(); if(!processDebts()) nextTurn();
}

function processDebts() {
  let debtor = players.find(p => p.money < 0 && !p.isBankrupt);
  if(debtor) {
      debtor.debtMode = true; stopTimer(); updateUI();
      if(debtor.isBot) { debtor.isBankrupt = true; debtor.money = -1; logMsg(`💀 БОТ БАНКРУТ!`); nextTurn(); return true; }
      if(amIActivePlayer()) { openModal(`🚨 БОРГ!`, `<p>Ти пішов у мінус на <b>i₴${Math.abs(debtor.money)}</b>.</p>`, `<button class="btn-blue" onclick="closeModal()">Ок</button>`); }
      return true; 
  }
  return false; 
}

function nextTurn() { 
  isRolling = false;
  if(lastRollWasDouble && !players[turn].inJail && !players[turn].isBankrupt) { lastRollWasDouble = false; } 
  else { do { turn = (turn + 1) % players.length; if(turn === 0) currentRound++; } while(players[turn].isBankrupt); }
  updateUI(); broadcastState(); 
}

// Заглушки для меню
function showPropertyInfo(index) { alert("Майно " + mapData[index].name); }
function openTradeMenu() { alert("Трейд доступний!"); }
function giveUpConfirm() { players[turn].isBankrupt = true; nextTurn(); }
function drawHouses(index, count) { const hCont = document.getElementById(`houses-${index}`); hCont.innerHTML = ''; if(count < 5) { for(let i=0; i<count; i++) hCont.innerHTML += `<div class="house-icon"></div>`; } else { hCont.innerHTML = `<div class="hotel-icon"></div>`; } }
