// === ІНТЕРФЕЙС, МЕНЮ, ЗВУКИ ТА ПРОФІЛЬ (ui.js) ===

// --- 1. НАВІГАЦІЯ ТА МЕНЮ ---
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
    
    const activeBtn = document.querySelector(`button[onclick*="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

function returnToGame() {
    if (!players || players.length === 0) {
        alert("Спершу натисни '🎮 ПОЧАТИ ГРУ' або зайди в Онлайн-кімнату!");
        return;
    }
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
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

// --- 2. МОДАЛЬНІ ВІКНА ---
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

// --- 3. ЗВУКИ ТА МУЗИКА ---
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

function unlockAudio() {
    const audios = ['bgm', 'sfx-dice', 'sfx-step', 'sfx-earn', 'sfx-spend', 'sfx-bankrupt'];
    audios.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            el.volume = 0; 
            let playPromise = el.play();
            if (playPromise !== undefined) {
                playPromise.then(() => { 
                    el.pause(); 
                    el.currentTime = 0; 
                    updateVolume(); 
                }).catch(err => { console.log("Аудіо заблоковано: ", err); });
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
    if (!val) { bgm.pause(); } else { bgm.src = val; bgm.play().catch(e => {}); } 
}

function playSound(id) { 
    let el = document.getElementById(id); 
    if (el && el.getAttribute('src')) { el.currentTime = 0; el.play().catch(e => {}); } 
}

// --- 4. ПРОФІЛЬ ТА КРАМНИЦЯ ---
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

function logoutAction() {
    if(confirm("Дійсно хочеш вийти з акаунту?")) {
        currentUser = null;
        localStorage.removeItem('poltavaUser');
        updateProfileUI();
        location.reload(); 
    }
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

function searchFriend() {
    alert("Функція друзів у розробці!");
}
