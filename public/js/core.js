// === ЯДРО ГРИ: ЛОГІКА ТА ПРАВИЛА (core.js) ===

// --- ДОПОМІЖНА: МАСИВ ОРЕНДНОЇ ПЛАТИ ---
function getRentArray(baseRent) {
    return [
        baseRent,
        baseRent * 5,
        baseRent * 15,
        baseRent * 40,
        baseRent * 50,
        baseRent * 60
    ];
}

// --- 1. МАЛЮВАННЯ ПОЛЯ ТА ОНОВЛЕННЯ UI ---
function initBoard() {
    document.querySelectorAll('.cell').forEach(e => e.remove());
    const board = document.getElementById('board');
    for (let i = 0; i < 40; i++) {
        const data = mapData[i];
        const cell = document.createElement('div');
        cell.className = 'cell' + (data.type === 'corner' ? ' corner' : '');
        cell.id = 'cell-' + i;
        cell.onclick = () => showPropertyInfo(i);
        let pos = getGridArea(i);
        cell.style.gridRow = pos.r;
        cell.style.gridColumn = pos.c;

        let inner = '';
        if (data.group && colors[data.group]) {
            inner += '<div class="district-bar" style="background:' + colors[data.group] + '"></div>';
        }
        if (data.emoji) inner += '<div class="cell-emoji">' + data.emoji + '</div>';
        inner += '<div class="cell-name">' + data.name + '</div>';
        inner += '<div class="houses-container" id="houses-' + i + '"></div>';
        inner += '<div class="tokens-area" id="tokens-' + i + '"></div>';
        if (data.price) inner += '<div class="cell-price">i\u20B4' + data.price + '</div>';
        inner += '<div class="owner-bar" id="owner-' + i + '"></div>';
        cell.innerHTML = inner;
        board.appendChild(cell);
    }

    players.forEach(p => {
        const token = document.createElement('div');
        token.id = 'token-' + p.id;
        token.className = 'pawn';
        token.style.backgroundColor = p.color;
        if (p.equippedToken === 'token_gold') {
            token.style.border = '2px solid #fff';
            token.style.boxShadow = '0 0 10px #f59e0b';
            token.style.backgroundColor = '#f59e0b';
        } else if (p.equippedToken === 'token_bogdan') {
            token.style.background = 'transparent';
            token.innerHTML = '🚐';
            token.style.fontSize = '20px';
        } else if (p.equippedToken === 'token_tank') {
            token.style.background = 'transparent';
            token.innerHTML = '🚜';
            token.style.fontSize = '20px';
        }
        const startTokens = document.getElementById('tokens-0');
        if (startTokens) startTokens.appendChild(token);
    });
}

function updateUI() {
    const dash = document.getElementById('dashboard');
    if (!dash) return;
    dash.innerHTML = '';
    let isDebtActive = players.some(p => p.debtMode);

    players.forEach((p, i) => {
        let activeClass = isDebtActive
            ? (p.debtMode ? 'debt-player-stat' : '')
            : (turn === i ? 'active-player-stat' : '');
        dash.innerHTML += '<div class="player-stat ' + activeClass + ' ' + (p.isBankrupt ? 'bankrupt-stat' : '') + '">' +
            '<div style="display:flex;align-items:center;gap:5px;">' +
            '<div class="color-dot" style="background:' + p.color + '"></div>' +
            '<b>' + p.name + '</b>' + (p.isBot ? ' 🤖' : '') +
            '</div>' +
            '<span style="color:' + (p.money < 0 ? '#ef4444' : '#10b981') + ';">i\u20B4' + p.money + '</span>' +
            '</div>';
    });

    let jpDisplay = document.getElementById('jackpot-display');
    if (jpDisplay) jpDisplay.innerText = 'i\u20B4' + jackpotAmount;

    // Оновлення підпису поточного ходу
    let turnLabel = document.getElementById('current-turn');
    if (turnLabel && players[turn]) {
        let activeP = players.find(x => x.debtMode) || players[turn];
        turnLabel.innerHTML = '<span style="color:' + activeP.color + '">' + activeP.name + '</span>' +
            (activeP.debtMode ? ' — <span style="color:#ef4444;">БОРГ!</span>' : ' — Хід ' + currentRound);
    }

    let btnRoll = document.getElementById('roll-btn');
    if (btnRoll) {
        btnRoll.disabled = !isMyTurn() || isRolling ||
            (players[turn] && players[turn].isBot && !isOnlineMode);
    }

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
    isRolling = true;
    updateUI();
    const p = players[turn];

    playSound('sfx-dice');
    for (let i = 0; i < 8; i++) {
        render2DDie('die1', Math.floor(Math.random() * 6) + 1);
        render2DDie('die2', Math.floor(Math.random() * 6) + 1);
        await sleep(60);
    }
    render2DDie('die1', v1);
    render2DDie('die2', v2);
    lastDiceSum = v1 + v2;
    lastRollWasDouble = (v1 === v2);
    await sleep(400);

    // Логіка в'язниці
    if (p.inJail) {
        if (v1 === v2) {
            logMsg('🎲 <b>' + p.name + '</b> кинув дубль і виходить на волю!');
            p.inJail = false;
        } else {
            p.jailTurns = (p.jailTurns || 0) + 1;
            if (p.jailTurns >= 3) {
                logMsg('⚖️ <b>' + p.name + '</b> відсидів термін і сплачує i\u20B4500.');
                deductMoney(p, 500);
                p.inJail = false;
            } else {
                logMsg('🔒 <b>' + p.name + '</b> залишається в колонії. Хід ' + p.jailTurns + '/3');
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
            // Депозитний відсоток при проходженні старту
            if (p.deposit > 0) {
                let interest = Math.floor(p.deposit * 0.05);
                p.deposit += interest;
                logMsg('🏦 Депозит <b>' + p.name + '</b> зріс на i\u20B4' + interest + '!');
            }
            // Погашення кредиту
            if (p.loan > 0) {
                p.loanTurns--;
                if (p.loanTurns <= 0) {
                    p.money -= p.loan;
                    logMsg('💳 <b>' + p.name + '</b> автоматично погасив кредит i\u20B4' + p.loan + '!');
                    p.loan = 0;
                }
            }
            logMsg('💸 <b>' + p.name + '</b> пройшов СТАРТ: +i\u20B42000');
            playSound('sfx-earn');
        }
        const target = document.getElementById('tokens-' + p.pos);
        const token = document.getElementById('token-' + p.id);
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
    if (el && dotL[num]) {
        el.innerHTML = dotL[num].map(v => '<div class="dot' + (v === 0 ? ' hidden' : '') + '"></div>').join('');
    }
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
        let cell = document.getElementById('cell-' + i);
        let ownerBar = document.getElementById('owner-' + i);
        if (properties[i]) {
            let owner = players.find(x => x.id === properties[i].owner);
            if (owner) {
                if (ownerBar) ownerBar.style.backgroundColor = owner.color;
                if (cell) cell.style.borderColor = owner.color;
            }
        } else {
            if (ownerBar) ownerBar.style.backgroundColor = 'transparent';
            if (cell) cell.style.borderColor = '';
        }
    }
}
