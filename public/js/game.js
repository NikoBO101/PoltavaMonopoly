// === ОСНОВНА ІГРОВА ЛОГІКА ТА ПРАВИЛА (game.js) ===

// --- 0. КЛІК ПО КУБИКУ (ФІКС КНОПКИ) ---
function userClickedRoll() {
    if (gameOver) return; // Якщо гра завершена - кубик не працює
    if (isOnlineMode && typeof socket !== 'undefined' && socket && currentLobby) {
        socket.emit('rollDice', currentLobby.id);
    } else {
        if (typeof startTurnLocal === "function") startTurnLocal();
    }
}

// --- 1. СТАРТ ЛОКАЛЬНОЇ ГРИ ---
function startLocalGame() {
    if(typeof unlockAudio === "function") unlockAudio();
    isOnlineMode = false; 
    gameOver = false; // Скидаємо статус гри
    if(typeof changeRadio === "function") changeRadio(); 
    currentRound = 1; 
    jackpotAmount = 0;
    
    let jpSetting = document.getElementById('setting-jackpot');
    jackpotRate = jpSetting ? parseFloat(jpSetting.value) : 0.5;
    
    const c = parseInt(document.getElementById('player-count').value); 
    const sm = parseInt(document.getElementById('start-money').value) || 15000;
    
    players = [];
    for (let i = 0; i < c; i++) {
        let isBotChecked = document.getElementById(`p${i}-isbot`).checked;
        let pToken = 'token_default';
        if (i === 0 && currentUser && currentUser.equippedToken) { pToken = currentUser.equippedToken; }

        players.push({ 
            id: i, name: document.getElementById(`p${i}-name`).value, isBot: isBotChecked, 
            color: playerColors[i], money: sm, deposit: 0, loan: 0, loanTurns: 0, pos: 0, 
            inJail: false, jailTurns: 0, doublesCount: 0, isBankrupt: false, skipTurns: 0, 
            reverseMove: false, portfolio: { PTC: 0, RTL: 0, TRN: 0, PST: 0, GOV: 0 }, 
            stockHistory: [], debtMode: false, equippedToken: pToken, corruptionUsed: false
        });
    }
    
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('game-container').style.display = 'flex';
    document.getElementById('return-game-btn').style.display = 'block';
    
    render2DDie('die1', 1); render2DDie('die2', 1); 
    initBoard(); 
    updateUI();
    logMsg(`🎮 Гру розпочато! Стартовий капітал: i₴${sm}`);
}

// --- 2. ЛОГІВАННЯ ТА ХІД ГРАВЦЯ ---
function logMsgLocal(msg) { 
    const log = document.getElementById('log'); 
    if(log) {
        log.innerHTML = `<div style="margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${msg}</div>` + log.innerHTML; 
        log.scrollTop = 0; 
    }
}
function logMsg(msg) { 
    logMsgLocal(msg); 
    if(typeof broadcastState === "function") broadcastState(); 
}

function handleLanding(index, p) {
    if (gameOver) return;
    const cell = mapData[index]; 
    logMsg(`📍 <b>${p.name}</b> стає на <b>${cell.name.replace('<br>',' ')}</b>`);
    
    if (index === 30) { 
        p.pos = 10; p.inJail = true; p.doublesCount = 0; lastRollWasDouble = false; 
        document.getElementById(`tokens-10`).appendChild(document.getElementById(`token-${p.id}`)); 
        logMsg(`🚨 <b>${p.name}</b> відправляється в Колонію!`); 
        return processNextTurn(p); 
    }
    if (index === 20) { 
        if (jackpotAmount > 0) { 
            let j = jackpotAmount; p.money += j; playSound('sfx-earn'); 
            logMsg(`🎉 <b>${p.name}</b> зірвав джекпот: <b>+i₴${j}</b>!`); 
            jackpotAmount = 0; updateUI(); 
            if (!p.isBot) { 
                openModal(`🎉 ДЖЕКПОТ!`, `<p style="font-size:24px; color:#10b981; font-weight:bold;">+i₴${j}</p>`, `<button class="btn-green" onclick="closeModal(); processNextTurn(players[turn]);">Забрати гроші</button>`); 
            } else { setTimeout(() => processNextTurn(p), 1500); } 
            return; 
        } 
        return processNextTurn(p); 
    }
    if (cell.type === 'tax') { 
        if (p.isBot) { setTimeout(() => executeAction(p, 'tax', index, cell.amount), 1500); } 
        else { openModal(`Податок`, `<p>До сплати: <b style="color:#ef4444;">i₴${cell.amount}</b></p>`, `<button class="btn-red" onclick="confirmAction('tax', ${index}, ${cell.amount})">Заплатити</button>`); } 
        return; 
    }
    if (cell.type === 'chance' || cell.type === 'news') { 
        let isUrgent = (cell.type === 'news' && Math.random() < 0.1); 
        let deck = isUrgent ? urgentNews : (cell.type === 'chance' ? chanceCards : newsCards); 
        window.currentCard = deck[Math.floor(Math.random() * deck.length)]; 
        if (p.isBot) { setTimeout(() => applyCard(), 1500); } 
        else { openModal(isUrgent ? "⚡ БЛИСКАВКА" : "Картка", `<p>${window.currentCard.text}</p>`, `<button class="btn-blue" onclick="applyCard();">Ок</button>`); } 
        return; 
    }
    if (cell.price) {
        const prop = properties[index];
        if (!prop) { 
            if (isOnlineMode) socket.emit('playerAction', currentLobby.id, { type: 'think', val: cell.name }); else executeAction(p, 'think', index, cell.name);
            if (p.isBot) { 
                let buffer = p.name.includes('Важк') ? 0 : 800; 
                if (p.money >= cell.price + buffer) { setTimeout(() => executeAction(p, 'buy', index, cell.price), 1500); } 
                else { setTimeout(() => executeAction(p, 'pass', index, 0), 1000); } 
            } 
            else { 
                openModal(`Купівля`, `<p>Купити <b>${cell.name.replace('<br>',' ')}</b>?</p><p>Ціна: <b style="color:#10b981;">i₴${cell.price}</b></p>`, `<button class="btn-green" onclick="confirmAction('buy', ${index}, ${cell.price})" ${p.money < cell.price ? 'disabled' : ''}>Купити</button><button class="btn-red" onclick="confirmAction('auction_start', ${index}, Math.floor(${cell.price}/2))">Аукціон</button>`); 
            }
        } else if (prop.owner !== p.id && !prop.isMortgaged) { 
            let rent = cell.baseRent;
            if (cell.type === 'utility') { 
                let c = 0; for (let i in properties) { if (properties[i].owner === prop.owner && mapData[i].type === 'utility') c++; } 
                rent = lastDiceSum * (c === 2 ? 250 : 100); 
            } 
            else if (cell.type === 'station') { 
                let c = 0; for (let i in properties) { if (properties[i].owner === prop.owner && mapData[i].type === 'station') c++; } 
                rent = cell.baseRent * Math.pow(2, c - 1); 
            } 
            else { 
                const rentArr = typeof getRentArray === "function" ? getRentArray(cell.baseRent) : [cell.baseRent, cell.baseRent*5, cell.baseRent*15, cell.baseRent*40, cell.baseRent*50, cell.baseRent*60]; 
                rent = rentArr[prop.houses]; 
                if (prop.houses === 0 && mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group).every(x => properties[x.i] && properties[x.i].owner === prop.owner)) { rent *= 2; } 
            }
            if (p.isBot) { setTimeout(() => executeAction(p, 'rent', index, rent), 1500); } 
            else { 
                const owner = players.find(pl => pl.id === prop.owner); 
                openModal(`Оренда`, `<p>Власник: <b>${owner.name}</b><br>До сплати: <b style="color:#ef4444;">i₴${rent}</b></p>`, `<button class="btn-red" onclick="confirmAction('rent', ${index}, ${rent})">Заплатити</button>`); 
            }
        } else { processNextTurn(p); }
    } else { processNextTurn(p); }
}

function processNextTurn(activePlayer) {
    if (gameOver) return; // ФІКС: Якщо гра закінчена - стоп!
    if (processDebts()) return; 
    
    if (isOnlineMode && activePlayer.id === myMultiplayerId && typeof forceSyncState === "function") forceSyncState();
    
    if (lastRollWasDouble && !activePlayer.inJail && !activePlayer.isBankrupt) { 
        lastRollWasDouble = false; 
    } else { 
        do { 
            turn = (turn + 1) % players.length; 
            if (turn === 0) currentRound++; 
        } while (players[turn].isBankrupt); 
    }
    
    isRolling = false; updateUI();
    if (isOnlineMode && activePlayer.id === myMultiplayerId && typeof forceSyncState === "function") forceSyncState();
    
    if (!isOnlineMode && players[turn].isBot && !players[turn].isBankrupt) { 
        setTimeout(() => { 
            if (gameOver) return; // ФІКС: Бот не грає, якщо гра завершена
            userClickedRoll(); 
        }, 1500); 
    }
}

// --- 3. ОБРОБКА ДІЙ ---
function confirmAction(type, idx, val) { 
    closeModal(); let p = players[turn]; 
    if (isOnlineMode) { socket.emit('playerAction', currentLobby.id, { type: type, idx: idx, val: val }); } 
    else { executeAction(p, type, idx, val); } 
}

function executeAction(p, type, idx, val) {
    if (gameOver) return;
    if (type === 'buy') { 
        p.money -= val; properties[idx] = { owner: p.id, houses: 0, isMortgaged: false }; 
        logMsgLocal(`🏙️ <b><span style="color:${p.color}">${p.name}</span></b> купує <b>${mapData[idx].name.replace('<br>',' ')}</b>!`); 
        document.getElementById(`cell-${idx}`).style.border = `3px solid ${p.color}`; playSound('sfx-spend'); processNextTurn(p); 
    } 
    else if (type === 'rent') { 
        if (typeof kumActive !== 'undefined' && kumActive) { logMsg(`😎 <b>${p.name}</b> просто кивнув власнику. Кум все вирішив, оренду не платимо!`); kumActive = false; processNextTurn(p); return; }
        const owner = players.find(pl => pl.id === properties[idx].owner); 
        p.money -= val; owner.money += val; 
        logMsgLocal(`💸 <b><span style="color:${p.color}">${p.name}</span></b> платить оренду <b><span style="color:${owner.color}">${owner.name}</span></b> (i₴${val}).`); 
        if (['pink', 'green', 'orange'].includes(mapData[idx].group)) stocks.RTL.pool += Math.ceil(val * 0.1); 
        if (['yellow'].includes(mapData[idx].group)) stocks.PST.pool += Math.ceil(val * 0.1); 
        if (['station'].includes(mapData[idx].group)) stocks.TRN.pool += Math.ceil(val * 0.1); 
        if (mapData[idx].type === 'utility') stocks.GOV.pool += Math.ceil(val * 0.2); 
        playSound('sfx-spend'); processNextTurn(p); 
    }
    else if (type === 'tax') { payTax(val); }
    else if (type === 'pass') { logMsgLocal(`<b>${p.name}</b> відмовився від покупки.`); processNextTurn(p); } 
    else if (type === 'think') { logMsgLocal(`🤔 <span style="color:${p.color}">${p.name}</span> розглядає <b>${val}</b>...`); } 
    else if (type === 'chat') { logMsgLocal(`<span style="color:${p.color}"><b>${p.name}:</b></span> ${val}`); }
    else if (type === 'auction_start') { window.auctionData = { idx: idx, highestBid: val, highestBidder: -1 }; logMsgLocal(`📢 Почався аукціон на <b>${mapData[idx].name.replace('<br>',' ')}</b>!`); openAuctionModal(); return; }
    else if (type === 'auction_bid') { window.auctionData.highestBid = val; window.auctionData.highestBidder = p.id; playSound('sfx-step'); if(document.getElementById('auc-bid')) { document.getElementById('auc-bid').innerText = `i₴${val}`; document.getElementById('auc-leader').innerText = p.name; } else { openAuctionModal(); } return; }
    else if (type === 'auction_pass') { logMsgLocal(`${p.name} виходить з торгів.`); return; }
    else if (type === 'auction_finish') { 
        if (window.auctionData.highestBidder === -1) { logMsgLocal(`Аукціон завершено. Ділянка нічия.`); } 
        else { 
            let winner = players.find(x => x.id === window.auctionData.highestBidder); winner.money -= window.auctionData.highestBid; 
            properties[window.auctionData.idx] = { owner: winner.id, houses: 0, isMortgaged: false }; 
            logMsgLocal(`🔨 <b>${winner.name}</b> виграв аукціон за i₴${window.auctionData.highestBid}!`); playSound('sfx-earn'); document.getElementById(`cell-${window.auctionData.idx}`).style.border = `3px solid ${winner.color}`; 
        } 
        processNextTurn(players[turn]); return; 
    }
    if (isOnlineMode && p.id === myMultiplayerId && type !== 'chat' && type !== 'think') { if(typeof forceSyncState === "function") forceSyncState(); }
}

function sendChat() {
    const input = document.getElementById('chat-input'); const msg = input.value.trim(); if (!msg) return; input.value = '';
    let p = isOnlineMode ? players.find(x => x.id === myMultiplayerId) : players[turn]; if (!p) p = players[0];
    if (isOnlineMode) { socket.emit('playerAction', currentLobby.id, { type: 'chat', val: msg }); } else { executeAction(p, 'chat', 0, msg); }
}

// --- 4. БАНКРУТСТВО ТА БОРГИ ---
function payTax(amount) { deductMoney(players[turn], amount); logMsg(`Сплачено податок: i₴${amount}`); closeModal(); if (!processDebts()) processNextTurn(players[turn]); }

function processDebts() {
    let debtor = players.find(p => p.money < 0 && !p.isBankrupt);
    if (debtor) {
        debtor.debtMode = true; isRolling = false; updateUI();
        if (!debtAlertShown) {
            let amIActive = (!isOnlineMode || debtor.id === myMultiplayerId);
            if (debtor.isBot) { setTimeout(() => forceBankrupt(), 2000); } 
            else if (amIActive) { openModal(`🚨 БОРГ!`, `<p>Ти в мінусі на <b style="color:#ef4444;">i₴${Math.abs(debtor.money)}</b>.</p>`, `<button class="btn-blue" onclick="closeModal()">Ок</button>`); debtAlertShown = true; }
        }
        return true; 
    }
    return false; 
}

function checkDebtResolution() {
    let debtor = players.find(p => p.debtMode);
    if (debtor && debtor.money >= 0) { 
        debtor.debtMode = false; debtAlertShown = false; logMsg(`✅ <b>${debtor.name}</b> погасив заборгованість.`); 
        if (!processDebts()) { updateUI(); if (isRolling) { processNextTurn(debtor); } if(typeof broadcastState === "function") broadcastState(); } 
    }
}

function giveUpConfirm() { 
    if (typeof isMyTurn === "function" && !isMyTurn()) return; 
    let p = players.find(x => x.debtMode) || players[turn]; 
    openModal("🏳️ Здатися", `<p>Дійсно хочеш оголосити банкрутство?</p>`, `<button class="btn-red" onclick="forceBankrupt()">Так</button><button class="btn-blue" onclick="closeModal()">Ні</button>`); 
}

function forceBankrupt() { 
    let p = players.find(x => x.debtMode) || players[turn]; p.money = -1; p.isBankrupt = true; p.debtMode = false; debtAlertShown = false;
    let tokenEl = document.getElementById(`token-${p.id}`); if (tokenEl) tokenEl.remove();
    for (let i in properties) { if (properties[i].owner === p.id) { delete properties[i]; document.getElementById(`cell-${i}`).style.borderColor = '#cbd5e1'; document.getElementById(`owner-${i}`).style.backgroundColor = 'transparent'; } }
    logMsg(`💀 <b>${p.name}</b> БАНКРУТ!`); playSound('sfx-bankrupt'); closeModal(); updateUI(); 
    
    let active = players.filter(pl => !pl.isBankrupt);
    if (active.length === 1) { 
        gameOver = true; // ФІКС: ГРА ЗУПИНЕНА
        openModal("🏆 ЗАВЕРШЕНО!", `<h1 style="color:${active[0].color};">${active[0].name} ПЕРЕМІГ!</h1>`, `<button class="btn-green" onclick="window.location.reload()">Нова гра</button>`); 
        if(typeof broadcastState === "function") broadcastState(); 
        return; 
    }
    if (!processDebts()) processNextTurn(p); 
}

// --- 5. КАРТКИ ШАНСУ ---
function applyCard() {
    if (gameOver) return;
    let p = players[turn]; let c = window.currentCard; closeModal();
    let cardMsg = `🃏 <b><span style="color:${p.color}">${p.name}</span></b>: ${c.text}`;
    if (isOnlineMode) { socket.emit('playerAction', currentLobby.id, { type: 'chat', val: cardMsg }); } else { logMsgLocal(cardMsg); }
    if (c.action === 'pay') { deductMoney(p, c.val); } 
    else if (c.action === 'receive') { p.money += c.val; playSound('sfx-earn'); } 
    else if (c.action === 'goto') { p.pos = c.val; document.getElementById(`tokens-${c.val}`).appendChild(document.getElementById(`token-${p.id}`)); setTimeout(() => handleLanding(p.pos, p), 300); return; } 
    else if (c.action === 'skip-turn') { p.skipTurns += c.val; logMsg(`🛑 <b>${p.name}</b> пропускає хід!`); } 
    else if (c.action === 'reverse-move') { p.reverseMove = true; logMsg(`⏪ Наступного ходу <b>${p.name}</b> піде назад!`); } 
    else if (c.action === 'kum') { if(typeof kumActive !== 'undefined') kumActive = true; logMsg(`🤝 <b>${p.name}</b> зателефонував куму. Наступну оренду — не платить!`); }
    updateUI(); if (!processDebts()) processNextTurn(p);
}

// --- 6. МЕНЮ БУДІВНИЦТВА ТА КЕРУВАННЯ ---
function showPropertyInfo(index) {
    if (window.corruptionMode === 'raider') { confirmRaider(index); return; }
    if (window.corruptionMode === 'teleport') { confirmTeleport(index); return; }

    const cell = mapData[index]; if (!cell.price) return;
    const prop = properties[index]; const ownerName = prop ? players.find(p=>p.id===prop.owner).name : "Вільна ділянка";
    const mortgageValue = cell.price / 2; const unmortgageValue = mortgageValue + (mortgageValue * 0.1);
    let viewer = isOnlineMode ? players.find(x => x.id === myMultiplayerId) : (players.find(x => x.debtMode) || players[turn]); if (!viewer) viewer = players[0];
    let rentDetails = '';
    
    if (cell.type === 'station') { rentDetails = `Оренда: i₴${cell.baseRent} (залежить від кількості АЗС)`; } 
    else if (cell.type === 'utility') { rentDetails = `Оренда: Сума кубиків × 100 (або × 250)`; } 
    else { const rentArr = typeof getRentArray === "function" ? getRentArray(cell.baseRent) : [cell.baseRent, cell.baseRent*5, cell.baseRent*15, cell.baseRent*40, cell.baseRent*50, cell.baseRent*60]; rentDetails = `Оренда: <b style="color:#10b981;">i₴${rentArr[0]}</b><br>1 Дім: i₴${rentArr[1]} | 2 Доми: i₴${rentArr[2]} | 3 Доми: i₴${rentArr[3]} | 4 Доми: i₴${rentArr[4]} | ГОТЕЛЬ: i₴${rentArr[5]}`; }
    
    let html = `<div class="prop-card"><div class="prop-card-header" style="background-color: ${colors[cell.group]}">${cell.name.replace('<br>',' ')}</div><div class="prop-card-body">${rentDetails}</div><div class="prop-card-footer"><div>Дім: i₴${cell.housePrice || '-'} | Застава: i₴${mortgageValue}</div><div style="font-weight:bold; font-size:14px;">Власник: ${ownerName} ${prop && prop.isMortgaged ? '<span style="color:#ef4444;">(ЗАСТАВА)</span>' : ''}</div></div></div>`;
    let btns = '';
    if (prop && prop.owner === viewer.id) {
        if (!prop.isMortgaged) {
            if (cell.type === 'property') { if (prop.houses > 0) btns += `<button class="btn-gold" onclick="sellHouse(${index})">Продати дім (+i₴${cell.housePrice / 2})</button>`; if (prop.houses < 5) btns += `<button class="btn-green" onclick="buildHouse(${index})" ${viewer.debtMode?'disabled':''}>Будувати дім (i₴${cell.housePrice})</button>`; }
            if (prop.houses === 0) btns += `<button class="btn-red" onclick="mortgage(${index}, ${mortgageValue})">Закласти (+i₴${mortgageValue})</button>`;
        } else { btns += `<button class="btn-blue" onclick="unmortgage(${index}, ${unmortgageValue})" ${viewer.debtMode?'disabled':''}>Викупити (-i₴${unmortgageValue})</button>`; }
    } else if (!prop) { btns += `<button class="btn-blue" onclick="closeModal()">Закрити</button>`; }
    openModal("Інформація", html, btns);
}

function showInventory() {
    let p = players.find(x => x.debtMode) || players[turn]; let html = `<div style="max-height: 300px; overflow-y: auto; text-align: left;">`; let count = 0;
    for (let i in properties) { if (properties[i].owner === p.id) { count++; let c = mapData[i]; let h = properties[i].houses; let status = properties[i].isMortgaged ? '<span style="color:#ef4444;">[ЗАСТАВА]</span>' : (h > 0 ? `[Будинків: ${h}]` : '[Чиста]'); html += `<div style="margin-bottom: 5px; padding: 8px; border: 1px solid #334155; border-radius: 6px; background: rgba(0,0,0,0.3);"><div class="color-dot" style="background:${colors[c.group] || '#fff'};"></div><b>${c.name.replace('<br>',' ')}</b> - ${status}</div>`; } }
    if (count === 0) html += `<div style="text-align:center; color:#94a3b8; padding: 20px;">Порожньо.</div>`; html += `</div>`;
    openModal(`🎒 Інвентар: ${p.name}`, html, `<button class="btn-blue" onclick="closeModal()">Закрити</button>`);
}

function mortgage(i, a) { let p = players.find(x => x.debtMode) || players[turn]; p.money += a; properties[i].isMortgaged = true; playSound('sfx-earn'); updateUI(); checkDebtResolution(); closeModal(); if(typeof broadcastState === "function") broadcastState(); }
function unmortgage(i, a) { let p = players.find(x => x.debtMode) || players[turn]; if (p.money < a) return alert("Немає грошей!"); p.money -= a; properties[i].isMortgaged = false; playSound('sfx-spend'); updateUI(); checkDebtResolution(); closeModal(); if(typeof broadcastState === "function") broadcastState(); }
function buildHouse(index) { const p = players[turn]; const cell = mapData[index]; const prop = properties[index]; if (p.debtMode) return; let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group); if (!groupCells.every(x => properties[x.i] && properties[x.i].owner === p.id)) return alert("Скупи всі ділянки цього кольору!"); let minHouses = 5; groupCells.forEach(x => { if (properties[x.i].houses < minHouses) minHouses = properties[x.i].houses; }); if (prop.houses >= 5) return alert("Тут вже стоїть готель!"); if (prop.houses > minHouses) return alert("Будуй рівномірно!"); if (p.money < cell.housePrice) return alert("Не вистачає грошей!"); p.money -= cell.housePrice; prop.houses++; playSound('sfx-spend'); updateUI(); logMsg(`<b>${p.name}</b> будує дім на <b>${cell.name.replace('<br>',' ')}</b>.`); drawHouses(index, prop.houses); closeModal(); if(typeof broadcastState === "function") broadcastState(); }
function sellHouse(index) { const p = players.find(x => x.debtMode) || players[turn]; const cell = mapData[index]; const prop = properties[index]; let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === cell.group); let maxHouses = 0; groupCells.forEach(x => { if (properties[x.i].houses > maxHouses) maxHouses = properties[x.i].houses; }); if (prop.houses < maxHouses) return alert("Продавай рівномірно!"); let refund = cell.housePrice / 2; p.money += refund; prop.houses--; playSound('sfx-earn'); updateUI(); logMsg(`<b>${p.name}</b> продає дім за i₴${refund}.`); drawHouses(index, prop.houses); checkDebtResolution(); closeModal(); if(typeof broadcastState === "function") broadcastState(); }
function drawHouses(index, count) { const hCont = document.getElementById(`houses-${index}`); if(!hCont) return; hCont.innerHTML = ''; if (count < 5) { for (let i = 0; i < count; i++) hCont.innerHTML += `<div class="house-icon"></div>`; } else { hCont.innerHTML = `<div class="hotel-icon"></div>`; } }

// --- 7. БІРЖА, ТОРГІВЛЯ, БАНК ---
function openCryptoMenu() {
    let p = players.find(x => x.debtMode) || players[turn]; p.stockHistory = p.stockHistory.filter(h => h.round > currentRound - 5); let availableToBuy = 5 - p.stockHistory.reduce((s, h) => s + h.amount, 0); 
    let html = `<p style="font-size:12px; color:#94a3b8; margin-top:0;">Комісія 5%. Ліміт: <b>${availableToBuy} акцій</b>.</p>`;
    ['PTC', 'RTL', 'TRN', 'PST', 'GOV'].forEach(sym => {
        let s = stocks[sym]; let arrow = s.trend === 'up' ? '<span style="color:#10b981;">▲</span>' : '<span style="color:#ef4444;">▼</span>';
        html += `<div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;"><div><b>${sym}</b><br><span style="font-size:16px;">${arrow} i₴${s.price}</span><br><span style="font-size:12px;">В тебе: <b>${p.portfolio[sym]} шт.</b></span></div><div style="display:flex; flex-direction:column; gap:5px;"><button class="btn-green" style="padding:6px; font-size:12px;" onclick="tradeStock('${sym}', 1, true)" ${availableToBuy <= 0 || p.debtMode ? 'disabled' : ''}>Купити</button><button class="btn-red" style="padding:6px; font-size:12px;" onclick="tradeStock('${sym}', 1, false)" ${p.portfolio[sym] <= 0 ? 'disabled' : ''}>Продати</button></div></div>`;
    });
    openModal("📈 Біржа", html, `<button class="btn-blue" onclick="closeModal()">Закрити</button>`);
}

function tradeStock(sym, amt, isBuying) {
    let p = players.find(x => x.debtMode) || players[turn]; let s = stocks[sym]; let cost = amt * s.price;
    if (isBuying) {
        if (p.debtMode) return alert("Погаси борги!"); p.stockHistory = p.stockHistory.filter(h => h.round > currentRound - 5); if (p.stockHistory.reduce((s, h) => s + h.amount, 0) + amt > 5) return alert("Ліміт!"); if (sym === 'GOV' && s.issued + amt > s.totalMax) return alert("Облігації розпродані!");
        let totalCost = cost + Math.ceil(cost * 0.05); if (p.money < totalCost) return alert(`Треба: i₴${totalCost}`);
        p.money -= totalCost; playSound('sfx-spend'); p.portfolio[sym] += amt; p.stockHistory.push({round: currentRound, amount: amt}); if (sym === 'GOV') s.issued += amt; logMsg(`📈 <b>${p.name}</b> купив ${sym}.`);
    } else {
        if (p.portfolio[sym] < amt) return alert("Немає акцій!"); p.portfolio[sym] -= amt; p.money += cost; playSound('sfx-earn'); if (sym === 'GOV') s.issued -= amt; logMsg(`📉 <b>${p.name}</b> продав ${sym} за i₴${cost}.`);
    }
    updateUI(); checkDebtResolution(); openCryptoMenu(); if(typeof broadcastState === "function") broadcastState();
}

function openDepositMenu() {
    let p = players.find(x => x.debtMode) || players[turn];
    openModal("🏦 Моя Банка", `<p>Готівка: <b style="color:#10b981;">i₴${p.money}</b><br>У Банці: <b style="color:#f59e0b;">i₴${p.deposit}</b></p><p style="font-size:12px; color:#94a3b8;">Росте на 5% за СТАРТ!</p><input type="number" id="deposit-amount" value="1000" min="100" step="100" style="width:100%; padding:12px; background:#0f172a; color:#fff; border-radius:8px;">`, `<button class="btn-green" onclick="makeDeposit(true)" ${p.debtMode?'disabled':''}>Покласти</button><button class="btn-gold" onclick="makeDeposit(false)">Зняти</button><button class="btn-blue" onclick="closeModal()">Закрити</button>`);
}

function makeDeposit(isAdding) {
    let p = players.find(x => x.debtMode) || players[turn]; let amt = parseInt(document.getElementById('deposit-amount').value) || 0; if (amt <= 0) return;
    if (isAdding) { if (p.debtMode) return alert("Закрий борг!"); if (p.money < amt) return alert("Немає готівки!"); p.money -= amt; p.deposit += amt; playSound('sfx-spend'); logMsg(`🏦 <b>${p.name}</b> поклав i₴${amt}.`); } 
    else { if (p.deposit < amt) return alert("В Банці мало коштів!"); p.deposit -= amt; p.money += amt; playSound('sfx-earn'); logMsg(`🏦 <b>${p.name}</b> зняв i₴${amt}.`); }
    updateUI(); checkDebtResolution(); closeModal(); if(typeof broadcastState === "function") broadcastState();
}

function openLoanMenu() {
    let p = players.find(x => x.debtMode) || players[turn];
    if (p.loan === 0) { openModal("💳 Кредит", `<p>Банк дає <b style="color:#10b981;">i₴2000</b>. Поверни i₴2500 за 5 ходів!</p>`, `<button class="btn-green" onclick="takeLoan()">Взяти</button><button class="btn-blue" onclick="closeModal()">Відміна</button>`); } 
    else { openModal("💳 Погашення", `<p>Твій борг: <b style="color:#ef4444;">i₴2500</b> (Залишилось ходів: ${p.loanTurns})</p>`, `<button class="btn-red" onclick="repayLoan()">Погасити</button><button class="btn-blue" onclick="closeModal()">Закрити</button>`); }
}
function takeLoan() { let p = players.find(x => x.debtMode) || players[turn]; p.money += 2000; p.loan = 2500; p.loanTurns = 5; playSound('sfx-earn'); logMsg(`💳 <b>${p.name}</b> взяв кредит.`); updateUI(); checkDebtResolution(); closeModal(); if(typeof broadcastState === "function") broadcastState(); }
function repayLoan() { let p = players.find(x => x.debtMode) || players[turn]; if (p.money < p.loan) return alert("Не вистачає грошей!"); p.money -= p.loan; p.loan = 0; p.loanTurns = 0; playSound('sfx-spend'); logMsg(`💳 <b>${p.name}</b> погасив борг.`); updateUI(); checkDebtResolution(); closeModal(); if(typeof broadcastState === "function") broadcastState(); }

function openTradeMenu() {
    let p = players[turn]; let activeOthers = players.filter(x => x.id !== p.id && !x.isBankrupt); if (activeOthers.length === 0) return alert("Немає з ким торгувати!");
    let html = `<select id="trade-target" onchange="renderTradeLists()" style="width:100%; padding:12px; margin-bottom:15px; background:#0f172a; color:#fff;">`; activeOthers.forEach(op => html += `<option value="${op.id}">${op.name}</option>`); html += `</select><div id="trade-ui-container"></div>`;
    openModal("🤝 Торгівля", html, `<button class="btn-green" onclick="submitTrade()">Запропонувати</button><button class="btn-blue" onclick="closeModal()">Відміна</button>`); renderTradeLists(); 
}

function renderTradeLists() {
    let p1 = players[turn]; let p2id = parseInt(document.getElementById('trade-target').value); let p2 = players.find(x => x.id === p2id);
    const getList = (pid, prefix) => { let list = ''; for(let i in properties) { if(properties[i].owner === pid) { let c = mapData[i]; list += `<div><input type="checkbox" id="${prefix}-prop-${i}" value="${i}"> ${c.name.replace('<br>',' ')}</div>`; } } return list || 'Порожньо'; };
    document.getElementById('trade-ui-container').innerHTML = `<div style="display:flex; gap:10px;"><div style="flex:1;"><b>${p1.name} віддає:</b><br><input type="number" id="trade-money-give" value="0" max="${p1.money}" style="width:100%; padding:5px;"><div style="max-height:100px; overflow-y:auto;">${getList(p1.id, 'give')}</div></div><div style="flex:1;"><b>${p2.name} віддає:</b><br><input type="number" id="trade-money-take" value="0" max="${p2.money}" style="width:100%; padding:5px;"><div style="max-height:100px; overflow-y:auto;">${getList(p2.id, 'take')}</div></div></div>`;
}

function submitTrade() {
    let p1 = players[turn]; let p2id = parseInt(document.getElementById('trade-target').value); let p2 = players.find(x => x.id === p2id);
    let mGive = parseInt(document.getElementById('trade-money-give').value) || 0; let mTake = parseInt(document.getElementById('trade-money-take').value) || 0;
    if (mGive > p1.money) return alert("Немає стільки грошей!"); if (mTake > p2.money) return alert("У нього немає грошей!");
    let pGive = [], pTake = []; document.querySelectorAll('[id^="give-prop-"]:checked').forEach(cb => pGive.push(parseInt(cb.value))); document.querySelectorAll('[id^="take-prop-"]:checked').forEach(cb => pTake.push(parseInt(cb.value)));
    if (mGive === 0 && mTake === 0 && pGive.length === 0 && pTake.length === 0) return alert("Угода порожня!");
    pendingTrade = { p1, p2, mGive, mTake, pGive, pTake };
    
    if (!isOnlineMode && p2.isBot) { logMsg(`🤖 <b>${p2.name}</b> погоджується!`); acceptTrade(); return; }
    openModal(`Підтвердження Трейду`, `<p><b>${p2.name}</b>, тобі пропонують обмін.</p>`, `<button class="btn-green" onclick="acceptTrade()">Прийняти Угоду</button><button class="btn-red" onclick="closeModal()">Відмовитись</button>`);
}

function acceptTrade() {
    let t = pendingTrade; t.p1.money = t.p1.money - t.mGive + t.mTake; t.p2.money = t.p2.money - t.mTake + t.mGive;
    t.pGive.forEach(i => { properties[i].owner = t.p2.id; document.getElementById(`cell-${i}`).style.borderColor = t.p2.color; document.getElementById(`owner-${i}`).style.backgroundColor = t.p2.color; }); 
    t.pTake.forEach(i => { properties[i].owner = t.p1.id; document.getElementById(`cell-${i}`).style.borderColor = t.p1.color; document.getElementById(`owner-${i}`).style.backgroundColor = t.p1.color; });
    logMsg(`🤝 Успішний обмін між <b>${t.p1.name}</b> та <b>${t.p2.name}</b>.`); playSound('sfx-earn'); updateUI(); closeModal(); if(typeof broadcastState === "function") broadcastState();
}

function openAuctionModal() {
    let cell = mapData[window.auctionData.idx]; let leaderName = window.auctionData.highestBidder !== -1 ? players.find(p => p.id === window.auctionData.highestBidder).name : "немає";
    let finishBtn = (isOnlineMode && players.find(p=>p.id===myMultiplayerId)?.isHost) ? `<button class="btn-blue" style="width:100%; margin-top:5px;" onclick="confirmAction('auction_finish', window.auctionData.idx, 0)">Закрити торги (Ви Хост)</button>` : (!isOnlineMode ? `<button class="btn-blue" style="width:100%; margin-top:5px;" onclick="confirmAction('auction_finish', window.auctionData.idx, 0)">Віддати лідеру</button>` : '');
    openModal(`🔨 АУКЦІОН: ${cell.name.replace('<br>',' ')}`, `<p>Ставка: <b id="auc-bid" style="color:#10b981;">i₴${window.auctionData.highestBid}</b><br>Лідер: <span id="auc-leader">${leaderName}</span></p><div style="display:flex; gap:5px;"><button class="btn-green" onclick="confirmAction('auction_bid', window.auctionData.idx, window.auctionData.highestBid + 100)">+100</button><button class="btn-gold" onclick="confirmAction('auction_bid', window.auctionData.idx, window.auctionData.highestBid + 500)">+500</button></div><button class="btn-red" style="width:100%; margin-top:5px;" onclick="confirmAction('auction_pass', window.auctionData.idx, 0)">Я пас</button>${finishBtn}`);
}

// --- 8. БОТИ ---
function checkBotTurn() {
    if (gameOver || isOnlineMode || isRolling) return; 
    let p = players[turn];
    if (p && p.isBot && !p.isBankrupt && !p.debtMode) { 
        setTimeout(() => { 
            if (gameOver) return;
            if (document.getElementById('modal-overlay').style.display === 'none') { 
                botPreRollActions(p); 
                let rollBtn = document.getElementById('roll-btn'); 
                if (rollBtn && !rollBtn.disabled) { userClickedRoll(); } 
                else if (rollBtn && rollBtn.disabled) { startTurnLocal(); } 
            } 
        }, 1500); 
    }
}

function botPreRollActions(p) {
    if (p.money < 1500) return; let colorsOwned = {};
    for (let i in properties) { if (properties[i].owner === p.id) { let g = mapData[i].group; colorsOwned[g] = (colorsOwned[g] || 0) + 1; } }
    for (let g in colorsOwned) { 
        let groupCells = mapData.map((c, i) => ({c, i})).filter(x => x.c.group === g); 
        if (colorsOwned[g] === groupCells.length) { 
            for (let cellData of groupCells) { 
                let idx = cellData.i; let prop = properties[idx]; 
                if (prop.houses < 5 && p.money >= cellData.c.housePrice + 800) { 
                    p.money -= cellData.c.housePrice; prop.houses++; playSound('sfx-spend'); 
                    logMsg(`🤖 <b>${p.name}</b> будує дім на ${cellData.c.name.replace('<br>',' ')}.`); 
                    drawHouses(idx, prop.houses); updateUI(); return; 
                } 
            } 
        } 
    }
}
