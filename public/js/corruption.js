// === СИСТЕМА КОРУПЦІЇ (corruption.js) ===
var kumActive = false; 
window.corruptionMode = null; 

function openCorruptionMenu() {
    if (!currentUser) return alert("Треба увійти в профіль, щоб використовувати зв'язки!");
    if (!isMyTurn()) return alert("Зараз не твій хід!");
    if (players[turn].corruptionUsed) return alert("❌ Ти вже використав свої зв'язки у цій грі! Корупція доступна лише 1 раз.");

    let html = `
        <p style="font-size:12px; color:#94a3b8; margin-bottom:15px;">Тіньові послуги. Доступно <b>1 раз</b> на гру!</p>
        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; border:1px solid #ef4444; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="text-align:left;">
                <b style="color:#fca5a5;">📞 Дзвінок Куму</b><br>
                <span style="font-size:11px; color:#94a3b8;">Не плати оренду 1 раз</span>
            </div>
            <button class="btn-red" style="width:80px; padding:5px;" onclick="buyKum()">150 🥟</button>
        </div>
        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; border:1px solid #10b981; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="text-align:left;">
                <b style="color:#6ee7b7;">🚁 Блатне Таксі</b><br>
                <span style="font-size:11px; color:#94a3b8;">Переліт на будь-яку клітинку</span>
            </div>
            <button class="btn-green" style="width:80px; padding:5px;" onclick="startCorruptionSelection('teleport')">100 🥟</button>
        </div>
        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; border:1px solid #3b82f6; display:flex; justify-content:space-between; align-items:center;">
            <div style="text-align:left;">
                <b style="color:#93c5fd;">🚜 Рейдерство</b><br>
                <span style="font-size:11px; color:#94a3b8;">Забери чужий бізнес за х2 ціни</span>
            </div>
            <button class="btn-blue" style="width:80px; padding:5px;" onclick="startCorruptionSelection('raider')">300 🥟</button>
        </div>
    `;
    openModal("🕵️ ТІНЬОВИЙ РИНОК", html, `<button class="btn-blue" onclick="closeModal()">Закрити</button>`);
}

function buyKum() {
    if (confirm("Точно витратити 150 🥟 на Дзвінок Куму?")) {
        socket.emit('useCorruption', { nick: currentUser.nick, pin: currentUser.pin, cost: 150, serviceName: 'kum' }, (res) => {
            if (res.success) {
                currentUser = res.user; updateProfileUI(); closeModal();
                kumActive = true;
                players[turn].corruptionUsed = true;
                logMsg(`🕵️ <b>${players[turn].name}</b> "подзвонив куму". Наступна оренда безкоштовна!`);
                updateUI(); broadcastState();
            } else alert(res.msg);
        });
    }
}

function startCorruptionSelection(mode) {
    window.corruptionMode = mode;
    closeModal();
    let msg = mode === 'raider' ? "🚜 Клікніть на ЧУЖИЙ БІЗНЕС на полі!" : "🚁 Клікніть на БУДЬ-ЯКУ клітинку!";
    let banner = document.createElement('div');
    banner.id = 'corruption-banner';
    banner.innerHTML = `<b>${msg}</b> <button onclick="cancelCorruption()" style="margin-left:15px; padding:6px 12px; background:#ef4444; color:#fff; border:none; border-radius:5px; cursor:pointer;">Відміна</button>`;
    banner.style.cssText = "position:fixed; top:80px; left:50%; transform:translateX(-50%); background:rgba(245,158,11,0.95); color:#000; padding:10px 20px; border-radius:10px; z-index:10000; box-shadow:0 0 15px rgba(0,0,0,0.5); border:2px solid #fff; font-size:16px;";
    document.body.appendChild(banner);
}

function cancelCorruption() {
    window.corruptionMode = null;
    let banner = document.getElementById('corruption-banner');
    if (banner) banner.remove();
}

function confirmRaider(idx) {
    let cell = mapData[idx];
    let prop = properties[idx];
    if (!prop || !cell.price || prop.houses > 0 || prop.owner === players[turn].id) {
        return alert("❌ Неможливо захопити! Оберіть чужий бізнес без будинків.");
    }
    let raiderPrice = cell.price * 2;
    if (players[turn].money < raiderPrice) return alert(`Не вистачає готівки (i₴)! Потрібно i₴${raiderPrice}.`);
    
    if (confirm(`Захопити ${cell.name.replace('<br>',' ')}?\nСпишеться: 300 🥟 та i₴${raiderPrice}`)) {
        socket.emit('useCorruption', { nick: currentUser.nick, pin: currentUser.pin, cost: 300, serviceName: 'raider' }, (res) => {
            if (res.success) {
                currentUser = res.user; updateProfileUI(); cancelCorruption();
                players[turn].money -= raiderPrice;
                let oldOwner = players.find(p => p.id === prop.owner);
                if (oldOwner) oldOwner.money += raiderPrice;
                properties[idx] = { owner: players[turn].id, houses: 0, isMortgaged: false };
                players[turn].corruptionUsed = true;
                logMsg(`🚜 <b>РЕЙДЕРСТВО!</b> <b>${players[turn].name}</b> силоміць забрав <b>${cell.name.replace('<br>',' ')}</b> у <b>${oldOwner.name}</b>!`);
                playSound('sfx-bankrupt');
                updateUI(); broadcastState();
            } else alert(res.msg);
        });
    }
}

function confirmTeleport(idx) {
    let cell = mapData[idx];
    if (confirm(`Переміститися на ${cell.name.replace('<br>',' ')}?\nСпишеться: 100 🥟`)) {
        socket.emit('useCorruption', { nick: currentUser.nick, pin: currentUser.pin, cost: 100, serviceName: 'teleport' }, (res) => {
            if (res.success) {
                currentUser = res.user; updateProfileUI(); cancelCorruption();
                let p = players[turn]; p.pos = idx; p.corruptionUsed = true;
                logMsg(`🚁 <b>${p.name}</b> викликав Блатне Таксі і перелетів на <b>${cell.name.replace('<br>',' ')}</b>!`);
                document.getElementById(`tokens-${idx}`).appendChild(document.getElementById(`token-${p.id}`));
                playSound('sfx-step');
                setTimeout(() => handleLanding(idx, p), 500);
                updateUI(); broadcastState();
            } else alert(res.msg);
        });
    }
}
