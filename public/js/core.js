// === ЯДРО ГРИ: ЛОГІКА ТА ПРАВИЛА (core.js) ===

// --- 1. МАЛЮВАННЯ ПОЛЯ ТА ОНОВЛЕННЯ UI ---
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
        cell.style.gridRow = pos.r; cell.style.gridColumn = pos.c;
        
        let content = (data.emoji ? `<div class="cell-emoji">${data.emoji}</div>` : '') + `<div class="cell-name">${data.name}</div>`;
        if (data.group && colors[data.group]) cell.innerHTML += `<div class="district-bar" style="background:${colors[data.group]}"></div>`;
        cell.innerHTML += `${content}<div class="houses-container" id="houses-${i}"></div><div class="tokens-area" id="tokens-${i}"></div>`;
        if (data.price) cell.innerHTML += `<div class="cell-price">i₴${data.price}</div>`; 
        cell.innerHTML += `<div class="owner-bar" id="owner-${i}"></div>`;
        board.appendChild(cell);
    }
    players.forEach(p => { 
        const token = document.createElement('div'); token.id = `token-${p.id}`; token.className = 'pawn'; 
        token.style.backgroundColor = p.color;
        // Візуалізація скінів (Золота галушка, Богдан, Танк)
        if (p.equippedToken === 'token_gold') { token.style.border = '2px solid #fff'; token.style.boxShadow = '0 0 10px #f59e0b'; token.style.backgroundColor = '#f59e0b'; }
        if (p.equippedToken === 'token_bogdan') { token.style.background = 'transparent'; token.innerHTML = '🚐'; token.style.fontSize = '20px'; }
        if (p.equippedToken === 'token_tank') { token.style.background = 'transparent'; token.innerHTML = '🚜'; token.style.fontSize = '20px'; }
        document.getElementById('tokens-0').appendChild(token); 
    });
}

function updateUI() {
    const dash = document.getElementById('dashboard'); 
    if(!dash) return;
    dash.innerHTML = ''; 
    let isDebtActive = players.some(p => p.debtMode);
    
    players.forEach((p, i) => {
        let activeClass = isDebtActive ? (p.debtMode ? 'debt-player-stat' : '') : (turn === i ? 'active-player-stat' : '');
        dash.innerHTML += `
            <div class="player-stat ${activeClass} ${p.isBankrupt ? 'bankrupt-stat' : ''}">
                <div style="display:flex; align-items:center; gap:5px;">
                    <div class="color-dot" style="background:${p.color}"></div>
                    <b>${p.name}</b> ${p.isBot ? '🤖' : ''}
                </div>
                <span style="color: ${p.money < 0 ? '#ef4444' : '#10b981'};">i₴${p.money}</span>
            </div>`;
    });
    
    if(document.getElementById('jackpot-display')) document.getElementById('jackpot-display').innerText = `i₴${jackpotAmount}`;
    
    let btnRoll = document.getElementById('roll-btn');
    if (btnRoll) btnRoll.disabled = !isMyTurn() || isRolling || (players[turn] && players[turn].isBot && !isOnlineMode);
    
    updatePropertyColors();
}

// --- 2. ДВИГУН ПЕРЕМІЩЕННЯ ТА КУБИКІВ ---
async function startTurnLocal() {
    if (isRolling) return;
    let v1 = Math.floor(Math.random() * 6) + 1; 
    let v2 = Math.floor(Math.random() * 6) + 1; 
    await processRollAndMove(v1, v2);
}

async function processRollAndMove(v1, v2) {
    isRolling = true; updateUI();
    const p = players[turn];
    
    // Анімація кубиків
    playSound('sfx-dice');
    for (let i = 0; i < 8; i++) {
        render2DDie('die1', Math.floor(Math.random() * 6) + 1);
        render2DDie('die2', Math.floor(Math.random() * 6) + 1);
        await sleep(60);
    }
    render2DDie('die1', v1); render2DDie('die2', v2);
    lastDiceSum = v1 + v2;
    await sleep(400);

    // Логіка в'язниці
    if (p.inJail) {
        if (v1 === v2) {
            logMsg(`🎲 <b>${p.name}</b> кинув дубль і виходить на волю!`);
            p.inJail = false;
        } else {
            p.jailTurns++;
            if (p.jailTurns >= 3) {
                logMsg(`⚖️ <b>${p.name}</b> відсидів термін і сплачує i₴500.`);
                deductMoney(p, 500); p.inJail = false;
            } else {
                logMsg(`🔒 <b>${p.name}</b> залишається в колонії.`);
                return processNextTurn(p);
            }
        }
    }

    await movePlayer(lastDiceSum);
}

async function movePlayer(steps) {
    const p = players[turn];
    for (let i = 0; i < steps; i++) {
        p.pos = (p.pos + 1) % 40;
        if (p.pos === 0) { 
            p.money += 2000; 
            logMsg(`💸 <b>${p.name}</b> пройшов СТАРТ: +i₴2000`); 
            playSound('sfx-earn');
        }
        const target = document.getElementById(`tokens-${p.pos}`);
        const token = document.getElementById(`token-${p.id}`);
        if (target && token) {
            playSound('sfx-step');
            target.appendChild(token);
            await sleep(180);
        }
    }
    handleLanding(p.pos, p);
}

function render2DDie(id, num) { 
    let el = document.getElementById(id); 
    if (el && dotL[num]) el.innerHTML = dotL[num].map(v => `<div class="dot ${v === 0 ? 'hidden' : ''}"></div>`).join(''); 
}

function getGridArea(i) { 
    if (i <= 10) return { r: 11, c: 11 - i }; 
    if (i <= 19) return { r: 11 - (i - 10), c: 1 }; 
    if (i <= 30) return { r: 1, c: (i - 20) + 1 }; 
    return { r: (i - 30) + 1, c: 11 }; 
}

function deductMoney(p, amount) {
    p.money -= amount;
    jackpotAmount += Math.ceil(amount * jackpotRate);
    playSound('sfx-spend');
}

function updatePropertyColors() {
    for (let i = 0; i < 40; i++) {
        let cell = document.getElementById(`cell-${i}`);
        let ownerBar = document.getElementById(`owner-${i}`);
        if (properties[i]) {
            let pColor = players.find(x => x.id === properties[i].owner).color;
            if(ownerBar) ownerBar.style.backgroundColor = pColor;
            if(cell) cell.style.borderColor = pColor;
        }
    }
}
