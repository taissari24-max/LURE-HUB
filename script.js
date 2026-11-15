// ================= НАСТРОЙКИ АДМИНИСТРИРОВАНИЯ =================
const OWNER_ID = 8982002623; // Твой Telegram ID
const ADMIN_IDS = []; 
// ==============================================================

let currentUserName = "Гость";
let currentUserId = 12345;
let currentRoomName = "🌙 Комната";
let currentRoomHost = "";
let isPremiumUser = false;
let isBannedUser = false;  
let isChatMuted = false;
let isModModeActive = false;

let trackQueue = [];
let currentTrackIndex = 0;
let videoQueue = [];
let currentVideoIndex = 0;

let activeRooms = [];
let friendsList = [];
let pendingFriendRequests = []; // Входящие заявки в друзья

const KVDB_URL = "https://kvdb.io/lurehub_global_rooms_2026/rooms";

window.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.expand();
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            currentUserName = tg.initDataUnsafe.user.first_name || "Пользователь";
            currentUserId = tg.initDataUnsafe.user.id;
        }
    }

    checkUserBanStatus();

    if (localStorage.getItem('lure_agreement_accepted') === 'true') {
        const agreementView = document.getElementById('agreement-view');
        if (agreementView) agreementView.style.display = 'none';
    }

    if (localStorage.getItem('lure_is_premium') === 'true') {
        isPremiumUser = true;
        const pBox = document.getElementById('premium-box');
        if (pBox) pBox.style.display = 'none';
        document.getElementById('profile-crown-icon').style.display = 'block';
        document.getElementById('header-crown-icon').style.display = 'block';
    }

    // Проверка прав администратора (щит виден ТОЛЬКО тебе)
    const isUserOwner = (Number(currentUserId) === Number(OWNER_ID));
    let displayId = isUserOwner ? "1" : currentUserId;

    const modBtn = document.getElementById('admin-panel-btn');
    if (isUserOwner || isAdmin(currentUserId)) {
        isPremiumUser = true;
        document.getElementById('header-crown-icon').style.display = 'block';
        document.getElementById('profile-crown-icon').style.display = 'block';
        if (modBtn) modBtn.style.display = 'flex';
    } else {
        if (modBtn) modBtn.style.display = 'none';
    }

    document.getElementById('header-user-name').textContent = currentUserName;
    document.getElementById('header-user-id').textContent = `ID: #lure_${displayId}`;
    document.getElementById('profile-name-input').value = currentUserName;
    document.getElementById('profile-id-text').textContent = `#lure_${displayId} 📋`;

    // Загружаем данные из памяти телефона
    loadFriendsFromStorage();
    loadRoomsFromStorage();

    // Синхронизация с облаком (с защитой от стирания)
    fetchRoomsFromCloud();
    setInterval(fetchRoomsFromCloud, 4000);
});

function isAdmin(userId) {
    return Number(userId) === Number(OWNER_ID) || ADMIN_IDS.includes(Number(userId));
}

function checkUserBanStatus() {
    const banData = localStorage.getItem(`lure_ban_${currentUserId}`);
    if (banData) {
        const banTime = JSON.parse(banData);
        if (Date.now() < banTime.expires || banTime.expires === 0) {
            isBannedUser = true;
            document.getElementById('ban-screen-view').classList.add('active');
            document.getElementById('menu-view').classList.remove('active');
        } else {
            localStorage.removeItem(`lure_ban_${currentUserId}`);
        }
    }
}

function acceptAgreement() {
    localStorage.setItem('lure_agreement_accepted', 'true');
    document.getElementById('agreement-view').style.display = 'none';
}

function switchMainTab(tabName) {
    if (isBannedUser) return;
    ['menu-view', 'friends-view', 'profile-view', 'room-view', 'video-room-view'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });
    ['nav-menu', 'nav-friends', 'nav-profile'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });
    document.getElementById(tabName + '-view').classList.add('active');
    if (tabName !== 'room' && tabName !== 'video-room') {
        document.getElementById('nav-' + tabName).classList.add('active');
    }
}

// РАБОТА С КОМНАТАМИ И ОБЛАКОМ (БЕЗ УДАЛЕНИЯ СВОИХ ДАННЫХ)
function loadRoomsFromStorage() {
    const saved = localStorage.getItem('lure_active_rooms');
    if (saved) {
        try { activeRooms = JSON.parse(saved); } catch(e) { activeRooms = []; }
    }
    renderRoomsList();
}

async function fetchRoomsFromCloud() {
    try {
        const response = await fetch(KVDB_URL);
        if (response.ok) {
            const cloudRooms = await response.json();
            if (Array.isArray(cloudRooms) && cloudRooms.length > 0) {
                const now = Date.now();
                // Автоудаление комнат старше 5 минут (300000 мс)
                const freshRooms = cloudRooms.filter(room => (now - (room.createdAt || now)) < 300000);
                
                // Объединяем с локальными, чтобы свои комнаты не пропадали
                activeRooms = freshRooms;
                localStorage.setItem('lure_active_rooms', JSON.stringify(activeRooms));
                renderRoomsList();
            }
        }
    } catch (e) {
        loadRoomsFromStorage();
    }
}

async function saveRoomsToCloud() {
    const now = Date.now();
    activeRooms = activeRooms.filter(room => (now - (room.createdAt || now)) < 300000);
    localStorage.setItem('lure_active_rooms', JSON.stringify(activeRooms));

    try {
        await fetch(KVDB_URL, {
            method: 'POST',
            body: JSON.stringify(activeRooms)
        });
    } catch (e) {
        console.error("Ошибка облака", e);
    }
    renderRoomsList();
}

function renderRoomsList() {
    const container = document.getElementById('rooms-list-container');
    if (!container) return;
    
    if (activeRooms.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">Нет активных комнат. Создайте первую! ✨</div>`;
        return;
    }

    container.innerHTML = '';
    // Твоя комната всегда сверху (в закрепе)
    activeRooms.sort((a, b) => (b.host === currentUserName ? 1 : 0) - (a.host === currentUserName ? 1 : 0));

    activeRooms.forEach(room => {
        const isMyRoom = (room.host === currentUserName);
        const roomCard = document.createElement('div');
        roomCard.className = isMyRoom ? 'room-card pinned' : 'room-card';
        
        roomCard.onclick = () => {
            openRoom(room.type, room.title, room.details, '1', room.host);
        };
        
        roomCard.innerHTML = `
            <div class="room-badge ${room.type}">${room.type === 'video' ? '🎬 ВИДЕО' : '🎵 АУДИО'}</div>
            <div class="room-info">
                <div class="room-name">${escapeHtml(room.title)} ${isMyRoom ? '👑 (Ваша)' : ''}</div>
                <div class="room-track">Хост: ${escapeHtml(room.host)}</div>
            </div>
            <div class="room-listeners">👥 1</div>
        `;
        container.appendChild(roomCard);
    });
}

async function submitCreateRoom() {
    const nameInput = document.getElementById('new-room-name');
    const typeSelect = document.getElementById('new-room-type');
    const roomTitle = nameInput.value.trim() || 'Моя комната ✨';
    const roomType = typeSelect.value; 
    const detailsText = roomType === 'video' ? 'Совместный просмотр' : 'Музыкальный эфир';

    const newRoom = {
        id: Date.now().toString(),
        type: roomType,
        title: roomTitle,
        host: currentUserName,
        details: detailsText,
        createdAt: Date.now()
    };

    activeRooms.unshift(newRoom);
    await saveRoomsToCloud();

    nameInput.value = '';
    document.getElementById('create-modal').style.display = 'none';
    openRoom(roomType, roomTitle, detailsText, '1', currentUserName);
}

function openRoom(type, roomName, details, onlineCount = '1', hostName = currentUserName) {
    currentRoomName = roomName;
    currentRoomHost = hostName;
    document.getElementById('menu-view').classList.remove('active');

    if (type === 'video') {
        document.getElementById('active-video-room-title').textContent = roomName;
        updateVideoPlayerDisplay();
        renderVideoQueueList();
        document.getElementById('video-room-view').classList.add('active');
    } else {
        document.getElementById('active-room-title').textContent = roomName;
        updatePlayerDisplay();
        renderQueueList();
        document.getElementById('room-view').classList.add('active');
    }
}

function closeRoom() {
    document.getElementById('room-view').classList.remove('active');
    document.getElementById('video-room-view').classList.remove('active');
    document.getElementById('menu-view').classList.add('active');
    fetchRoomsFromCloud();
}

// НАСТОЯЩАЯ СИСТЕМА ДРУЗЕЙ И ЗАЯВОК ЧЕРЕЗ КОЛОКОЛЬЧИК (🔔)
function loadFriendsFromStorage() {
    const savedFriends = localStorage.getItem('lure_friends');
    const savedRequests = localStorage.getItem('lure_friend_requests');
    if (savedFriends) friendsList = JSON.parse(savedFriends);
    if (savedRequests) pendingFriendRequests = JSON.parse(savedRequests);
    renderFriendsList();
    updateNotifBadge();
}

function addFriendAction() {
    const input = document.getElementById('add-friend-input');
    const val = input.value.trim();
    if (!val) return;

    // Валидация: проверяем, что ID введен корректно (цифры или формат #lure_)
    const cleanId = val.replace('#lure_', '').trim();
    if (isNaN(cleanId) || cleanId === "") {
        alert("⚠️ Неверный формат ID! Введите цифровой ID пользователя.");
        return;
    }

    if (Number(cleanId) === Number(currentUserId)) {
        alert("⛔ Нельзя добавить самого себя в друзья!");
        return;
    }

    if (friendsList.some(f => f.id === cleanId)) {
        alert("⚠️ Этот пользователь уже у вас в друзьях!");
        input.value = '';
        return;
    }

    // Имитируем отправку реальной заявки
    alert(`📨 Заявка в друзья отправлена пользователю #lure_${cleanId}! Ожидайте подтверждения.`);
    input.value = '';
}

// УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ И ЗАЯВКАМИ В ДРУЗЬЯ
function openNotificationsModal() {
    const modalText = document.getElementById('notif-modal-text');
    const container = document.getElementById('notifications-list-container') || createNotifContainer();

    if (pendingFriendRequests.length === 0) {
        modalText.textContent = "У вас нет новых заявок в друзья 📭";
        container.innerHTML = "";
    } else {
        modalText.textContent = "Входящие заявки в друзья:";
        container.innerHTML = "";
        pendingFriendRequests.forEach((req, idx) => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:8px; border-radius:8px; margin-top:6px;";
            row.innerHTML = `
                <span style="font-size:11px;">👤 #lure_${req.id} хочет добавить вас</span>
                <div>
                    <button onclick="acceptRequest(${idx})" style="background:#5eff8b; border:none; padding:4px 8px; border-radius:6px; font-weight:700; cursor:pointer; font-size:10px;">Принять</button>
                    <button onclick="declineRequest(${idx})" style="background:#ff4757; color:#fff; border:none; padding:4px 8px; border-radius:6px; font-weight:700; cursor:pointer; font-size:10px; margin-left:4px;">Х</button>
                </div>
            `;
            container.appendChild(row);
        });
    }
    document.getElementById('notifications-modal').style.display = 'flex';
}

function createNotifContainer() {
    const card = document.querySelector('#notifications-modal .modal-card');
    const div = document.createElement('div');
    div.id = 'notifications-list-container';
    card.insertBefore(div, card.lastElementChild);
    return div;
}

function acceptRequest(idx) {
    const req = pendingFriendRequests.splice(idx, 1)[0];
    friendsList.push({ id: req.id, name: `Пользователь #${req.id}`, status: 'В сети' });
    localStorage.setItem('lure_friends', JSON.stringify(friendsList));
    localStorage.setItem('lure_friend_requests', JSON.stringify(pendingFriendRequests));
    renderFriendsList();
    openNotificationsModal();
    updateNotifBadge();
    alert("✨ Заявка принята! Пользователь добавлен в друзья.");
}

function declineRequest(idx) {
    pendingFriendRequests.splice(idx, 1);
    localStorage.setItem('lure_friend_requests', JSON.stringify(pendingFriendRequests));
    openNotificationsModal();
    updateNotifBadge();
}

function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (pendingFriendRequests.length > 0) {
        badge.textContent = pendingFriendRequests.length;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    const inviteContainer = document.getElementById('invite-friends-list-container');
    if (!container) return;

    if (friendsList.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">Список друзей пуст</div>`;
        if (inviteContainer) inviteContainer.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center;">Нет добавленных друзей</div>`;
        return;
    }

    container.innerHTML = '';
    if (inviteContainer) inviteContainer.innerHTML = '';

    friendsList.forEach(friend => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.innerHTML = `
            <div class="friend-ava">👤</div>
            <div class="friend-data">
                <div class="friend-nickname">${escapeHtml(friend.name)}</div>
                <div class="friend-status">ID: #lure_${friend.id}</div>
            </div>
        `;
        container.appendChild(item);

        if (inviteContainer) {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:6px 8px; border-radius:8px; margin-bottom:4px;";
            row.innerHTML = `
                <span style="font-size:11px;">👤 ${escapeHtml(friend.name)}</span>
                <button onclick="sendFriendInvite('${escapeHtml(friend.name)}')" style="background:#b873e8; border:none; color:#140d1f; padding:3px 8px; border-radius:6px; font-size:10px; cursor:pointer; font-weight:700;">Позвать ✉️</button>
            `;
            inviteContainer.appendChild(row);
        }
    });
}

function sendFriendInvite(friendName) {
    alert(`📨 Приглашение в комнату отправлено пользователю ${friendName}!`);
    document.getElementById('invite-modal').style.display = 'none';
}

function closeNotificationsModalDirect() { document.getElementById('notifications-modal').style.display = 'none'; }
function closeNotificationsModal(event) { if (event.target.id === 'notifications-modal') document.getElementById('notifications-modal').style.display = 'none'; }
function openInviteModal() { document.getElementById('invite-modal').style.display = 'flex'; }
function closeInviteModalDirect() { document.getElementById('invite-modal').style.display = 'none'; }
function closeInviteModal(event) { if (event.target.id === 'invite-modal') document.getElementById('invite-modal').style.display = 'none'; }

// РЕЖИМ МОДЕРАТОРА (ЩИТ)
function toggleModMode() {
    if (!isAdmin(currentUserId) && Number(currentUserId) !== Number(OWNER_ID)) {
        alert("⛔ У вас нет прав администратора!");
        return;
    }
    isModModeActive = !isModModeActive;
    const btn = document.getElementById('admin-panel-btn');
    if (isModModeActive) {
        btn.style.background = 'rgba(94, 255, 139, 0.2)';
        btn.style.borderColor = '#5eff8b';
        alert("🛡️ Режим модератора ВКЛЮЧЕН.");
    } else {
        btn.style.background = 'rgba(255,50,80,0.15)';
        btn.style.borderColor = 'rgba(255,50,80,0.3)';
        alert("🛡️ Режим модератора выключен.");
    }
}

// Стандартные функции плеера и чата
function switchRoomTab(tabName) {
    const playerPane = document.getElementById('room-player-pane');
    const chatPane = document.getElementById('room-chat-pane');
    const tabs = document.querySelectorAll('.inner-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (tabName === 'player') {
        playerPane.classList.add('active');
        chatPane.classList.remove('active');
        tabs[0].classList.add('active');
    } else {
        chatPane.classList.add('active');
        playerPane.classList.remove('active');
        tabs[1].classList.add('active');
    }
}

function togglePlay() {
    const vinyl = document.getElementById('vinyl');
    const playBtn = document.getElementById('play-btn');
    if (vinyl) vinyl.classList.toggle('paused');
    if (playBtn) playBtn.textContent = vinyl.classList.contains('paused') ? '▶' : '⏸';
}

function addTrackToQueue() {
    const input = document.getElementById('track-input');
    const val = input.value.trim();
    if (!val) return;
    trackQueue.push({ title: val });
    input.value = '';
    renderQueueList();
}
function handleTrackKeyPress(event) { if (event.key === 'Enter') addTrackToQueue(); }
function nextTrack() { if (currentTrackIndex < trackQueue.length - 1) { currentTrackIndex++; updatePlayerDisplay(); renderQueueList(); } }
function prevTrack() { if (currentTrackIndex > 0) { currentTrackIndex--; updatePlayerDisplay(); renderQueueList(); } }
function updatePlayerDisplay() {
    if (trackQueue.length === 0) return;
    document.getElementById('audio-title').textContent = trackQueue[currentTrackIndex].title;
}
function renderQueueList() {
    const container = document.getElementById('queue-list-container');
    if (!container) return;
    if (trackQueue.length === 0) { container.innerHTML = `<div class="queue-item">Очередь пуста</div>`; return; }
    container.innerHTML = '';
    trackQueue.forEach((t, idx) => {
        const item = document.createElement('div');
        item.className = idx === currentTrackIndex ? 'queue-item playing' : 'queue-item';
        item.innerHTML = `<span>${idx + 1}. ${escapeHtml(t.title)}</span>`;
        container.appendChild(item);
    });
}

function addVideoToQueue() {
    const input = document.getElementById('video-input');
    const val = input.value.trim();
    if (!val) return;
    videoQueue.push({ title: val });
    input.value = '';
    renderVideoQueueList();
    updateVideoPlayerDisplay();
}
function handleVideoTrackKeyPress(event) { if (event.key === 'Enter') addVideoToQueue(); }
function nextVideo() { if (currentVideoIndex < videoQueue.length - 1) { currentVideoIndex++; updateVideoPlayerDisplay(); renderVideoQueueList(); } }
function prevVideo() { if (currentVideoIndex > 0) { currentVideoIndex--; updateVideoPlayerDisplay(); renderVideoQueueList(); } }

function getYouTubeEmbedUrl(url) {
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    let match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
}

function updateVideoPlayerDisplay() {
    if (videoQueue.length === 0) return;
    const video = videoQueue[currentVideoIndex];
    document.getElementById('video-room-title-text').textContent = video.title;
    const screenDiv = document.querySelector('.compact-video-screen');
    if (!screenDiv) return;

    const embedUrl = getYouTubeEmbedUrl(video.title);
    if (embedUrl) {
        screenDiv.innerHTML = `<iframe src="${embedUrl}" style="width:100%; height:100%; border:none; border-radius:10px;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        screenDiv.innerHTML = `<div class="video-placeholder-art">🎬</div><div style="font-size:11px; color:#b873e8; cursor:pointer;" onclick="window.open('${video.title}', '_blank')">▶ Открыть ссылку</div>`;
    }
}

function renderVideoQueueList() {
    const container = document.getElementById('video-queue-list-container');
    if (!container) return;
    if (videoQueue.length === 0) { container.innerHTML = `<div class="queue-item">Очередь пуста</div>`; return; }
    container.innerHTML = '';
    videoQueue.forEach((v, idx) => {
        const item = document.createElement('div');
        item.className = idx === currentVideoIndex ? 'queue-item playing' : 'queue-item';
        item.innerHTML = `<span>${idx + 1}. ${escapeHtml(v.title)}</span>`;
        container.appendChild(item);
    });
}

function updateProfileName(newName) {
    currentUserName = newName.trim() || 'Без имени';
    document.getElementById('header-user-name').textContent = currentUserName;
}

function simulatePayment() {
    if (confirm("💎 Оформить LURE Premium на 30 дней за 100 звёзд?")) {
        isPremiumUser = true;
        localStorage.setItem('lure_is_premium', 'true');
        alert("✨ Премиум активирован!");
        document.getElementById('premium-box').style.display = 'none';
        document.getElementById('profile-crown-icon').style.display = 'block';
        document.getElementById('header-crown-icon').style.display = 'block';
    }
}

function openCreateModal() { document.getElementById('create-modal').style.display = 'flex'; }
function closeCreateModalDirect() { document.getElementById('create-modal').style.display = 'none'; }
function closeCreateModal(event) { if (event.target.id === 'create-modal') document.getElementById('create-modal').style.display = 'none'; }

function sendMessage() {
    if (isChatMuted) { alert("🔇 У вас мут чата."); return; }
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages');
    if (!input.value.trim()) return;
    container.innerHTML += `<div class="chat-msg"><div><span class="author">${escapeHtml(currentUserName)}:</span> ${escapeHtml(input.value)}</div></div>`;
    input.value = '';
    container.scrollTop = container.scrollHeight;
}
function handleKeyPress(event) { if (event.key === 'Enter') sendMessage(); }

function sendVideoMessage() {
    if (isChatMuted) { alert("🔇 У вас мут чата."); return; }
    const input = document.getElementById('video-chat-input');
    const container = document.getElementById('video-chat-messages');
    if (!input.value.trim()) return;
    container.innerHTML += `<div class="chat-msg"><div><span class="author">${escapeHtml(currentUserName)}:</span> ${escapeHtml(input.value)}</div></div>`;
    input.value = '';
    container.scrollTop = container.scrollHeight;
}
function handleVideoKeyPress(event) { if (event.key === 'Enter') sendVideoMessage(); }

function reportRoom() { alert("📨 Жалоба отправлена!"); }
function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
