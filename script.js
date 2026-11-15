// ================= НАСТРОЙКИ АДМИНИСТРИРОВАНИЯ =================
// Твой точный цифровой ID из Telegram (из твоего профиля на скриншоте)
const OWNER_ID = 8982002623; 
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

    // СТРОГАЯ ПРОВЕРКА: Кнопка модерации видна ТОЛЬКО тебе!
    const isUserOwner = (Number(currentUserId) === Number(OWNER_ID));
    let displayId = isUserOwner ? "1" : currentUserId;

    const modBtn = document.getElementById('admin-panel-btn');
    if (isUserOwner || isAdmin(currentUserId)) {
        isPremiumUser = true;
        document.getElementById('header-crown-icon').style.display = 'block';
        document.getElementById('profile-crown-icon').style.display = 'block';
        if (modBtn) modBtn.style.display = 'flex'; // Показываем только владелице
    } else {
        if (modBtn) modBtn.style.display = 'none'; // Обычным пользователям СТРОГО СКРЫТО
    }

    document.getElementById('header-user-name').textContent = currentUserName;
    document.getElementById('header-user-id').textContent = `ID: #lure_${displayId}`;
    document.getElementById('profile-name-input').value = currentUserName;
    document.getElementById('profile-id-text').textContent = `#lure_${displayId} 📋`;

    // Запускаем таймер автоудаления комнат через 5 минут
    initRoomCleanupTimer();
    loadRoomsFromStorage();

    // Автообновление списка комнат каждые 3 секунды
    setInterval(() => {
        loadRoomsFromStorage();
    }, 3000);
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

// АВТОУДАЛЕНИЕ ПУСТЫХ КОМНАТ ЧЕРЕЗ 5 МИНУТ (300000 мс)
function initRoomCleanupTimer() {
    setInterval(() => {
        const saved = localStorage.getItem('lure_active_rooms');
        if (!saved) return;
        try {
            let rooms = JSON.parse(saved);
            const now = Date.now();
            const freshRooms = rooms.filter(room => {
                const age = now - (room.createdAt || now);
                return age < 300000; // 5 минут
            });
            if (freshRooms.length !== rooms.length) {
                localStorage.setItem('lure_active_rooms', JSON.stringify(freshRooms));
                loadRoomsFromStorage();
            }
        } catch(e) {}
    }, 5000);
}

function loadRoomsFromStorage() {
    const saved = localStorage.getItem('lure_active_rooms');
    if (saved) {
        try { activeRooms = JSON.parse(saved); } catch(e) { activeRooms = []; }
    } else {
        activeRooms = [];
    }
    renderRoomsList();
}

function saveRooms() {
    localStorage.setItem('lure_active_rooms', JSON.stringify(activeRooms));
}

function renderRoomsList() {
    const container = document.getElementById('rooms-list-container');
    if (!container) return;
    
    if (activeRooms.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">Нет активных комнат. Создайте первую! ✨</div>`;
        return;
    }

    container.innerHTML = '';
    // Своя комната всегда закреплена сверху
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

function submitCreateRoom() {
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
        createdAt: Date.now() // Фиксируем время для автоудаления через 5 минут
    };

    activeRooms.unshift(newRoom);
    saveRooms();
    renderRoomsList();

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
    loadRoomsFromStorage();
}

// ТОЛЬКО ТЫ МОЖЕШЬ ВКЛЮЧАТЬ РЕЖИМ МОДЕРАТОРА
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
        alert("🛡️ Режим модератора ВКЛЮЧЕН. Теперь вам доступны любые закрытые комнаты.");
    } else {
        btn.style.background = 'rgba(255,50,80,0.15)';
        btn.style.borderColor = 'rgba(255,50,80,0.3)';
        alert("🛡️ Режим модератора выключен.");
    }
}

function openNotificationsModal() {
    document.getElementById('notifications-modal').style.display = 'flex';
}
function closeNotificationsModalDirect() {
    document.getElementById('notifications-modal').style.display = 'none';
}
function closeNotificationsModal(event) {
    if (event.target.id === 'notifications-modal') {
        document.getElementById('notifications-modal').style.display = 'none';
    }
}

function openInviteModal() {
    document.getElementById('invite-modal').style.display = 'flex';
}
function closeInviteModalDirect() {
    document.getElementById('invite-modal').style.display = 'none';
}
function closeInviteModal(event) {
    if (event.target.id === 'invite-modal') {
        document.getElementById('invite-modal').style.display = 'none';
    }
}

// Стандартные функции плеера
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
