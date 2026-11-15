// ================= НАСТРОЙКИ БЕЗОПАСНОСТИ И АДМИНИСТРИРОВАНИЯ =================
const OWNER_ID = 8982002623; // Твой цифровой ID
const ADMIN_IDS = [000000000]; 
// ==============================================================================

let currentUserName = "Гость";
let currentUserId = 12345;
let currentRoomName = "🌙 Комната";
let currentRoomHost = "";
let currentNicknameColor = "#b873e8";
let isPremiumUser = false;
let isBannedUser = false;  
let isChatMuted = false;  
let invitesSentCount = 0;
const MAX_FREE_INVITES = 10;

let friendRequests = [];
let roomInvites = [];
let friendsList = [];

let trackQueue = [];
let currentTrackIndex = 0;

let videoQueue = [];
let currentVideoIndex = 0;

// Инициализация при запуске
window.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.expand();
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            currentUserName = tg.initDataUnsafe.user.first_name || "Пользователь";
            currentUserId = tg.initDataUnsafe.user.id;
        }
    }

    // Проверяем память телефона: принимал ли уже оферту
    if (localStorage.getItem('lure_agreement_accepted') === 'true') {
        const agreementView = document.getElementById('agreement-view');
        if (agreementView) agreementView.style.display = 'none';
    }

    // Проверяем память телефона: куплен ли премиум
    if (localStorage.getItem('lure_is_premium') === 'true') {
        isPremiumUser = true;
        const pBox = document.getElementById('premium-box');
        const cBox = document.getElementById('color-picker-box');
        const crownHeader = document.getElementById('header-crown-icon');
        const crownProfile = document.getElementById('profile-crown-icon');
        if (pBox) pBox.style.display = 'none';
        if (cBox) cBox.style.display = 'flex';
        if (crownHeader) crownHeader.style.display = 'block';
        if (crownProfile) crownProfile.style.display = 'block';
    }

    const isUserOwner = (Number(currentUserId) === Number(OWNER_ID));
    let displayId = isUserOwner ? "1" : currentUserId;

    if (isUserOwner) {
        isPremiumUser = true;
        const crownHeader = document.getElementById('header-crown-icon');
        const crownProfile = document.getElementById('profile-crown-icon');
        if (crownHeader) crownHeader.style.display = 'block';
        if (crownProfile) crownProfile.style.display = 'block';
    }

    document.getElementById('header-user-name').textContent = currentUserName;
    document.getElementById('header-user-id').textContent = `ID: #lure_${displayId}`;
    document.getElementById('profile-name-input').value = currentUserName;
    document.getElementById('profile-id-text').textContent = `#lure_${displayId} 📋`;

    updateNotifBadge();
});

// Кнопка «Принять и войти» с сохранением в память
function acceptAgreement() {
    localStorage.setItem('lure_agreement_accepted', 'true');
    document.getElementById('agreement-view').style.display = 'none';
}

function updateNotifBadge() {
    const totalCount = friendRequests.length + roomInvites.length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
        if (totalCount > 0) {
            badge.textContent = totalCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function isOwner(userId) {
    return Number(userId) === Number(OWNER_ID);
}

function isAdmin(userId) {
    return isOwner(userId) || ADMIN_IDS.includes(Number(userId));
}

function switchMainTab(tabName) {
    if (isBannedUser) return;

    const views = ['menu-view', 'friends-view', 'profile-view', 'other-profile-view', 'room-view', 'video-room-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });

    const navItems = ['nav-menu', 'nav-friends', 'nav-profile'];
    navItems.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });

    document.getElementById(tabName + '-view').classList.add('active');

    if (tabName !== 'room' && tabName !== 'video-room' && tabName !== 'other-profile') {
        const navBtn = document.getElementById('nav-' + tabName);
        if (navBtn) navBtn.classList.add('active');
        document.getElementById('main-nav').style.display = 'flex';
    }
}

function openRoom(type, roomName, details, onlineCount = '1', hostName = currentUserName) {
    if (isBannedUser) return;

    currentRoomName = roomName;
    currentRoomHost = hostName;
    document.getElementById('menu-view').classList.remove('active');
    document.getElementById('main-nav').style.display = 'none';

    renderHostControls(type);

    if (type === 'video') {
        document.getElementById('active-video-room-title').textContent = roomName;
        document.querySelector('#video-room-view .online-badge').textContent = `👥 ${onlineCount}`;
        updateVideoPlayerDisplay();
        renderVideoQueueList();
        document.getElementById('video-room-view').classList.add('active');
    } else {
        document.getElementById('active-room-title').textContent = roomName;
        document.querySelector('#room-view .online-badge').textContent = `👥 ${onlineCount}`;
        updatePlayerDisplay();
        renderQueueList();
        document.getElementById('room-view').classList.add('active');
    }
}

function renderHostControls(type) {
    const isHost = (currentRoomHost === currentUserName);
    const containerId = type === 'video' ? 'video-host-close-container' : 'host-close-room-container';
    const container = document.getElementById(containerId);

    if (isHost) {
        container.innerHTML = `<button class="close-room-host-btn" onclick="closeRoomAsHost()">🛑 Закрыть комнату (для всех)</button>`;
    } else {
        container.innerHTML = ``;
    }
}

function closeRoomAsHost() {
    const confirmed = confirm("🛑 Закрыть комнату? Все участники будут отключены.");
    if (confirmed) closeRoom();
}

function closeRoom() {
    document.getElementById('room-view').classList.remove('active');
    document.getElementById('video-room-view').classList.remove('active');
    document.getElementById('menu-view').classList.add('active');
    document.getElementById('main-nav').style.display = 'flex';
}

function switchRoomTab(tabName) {
    const playerPane = document.getElementById('room-player-pane');
    const chatPane = document.getElementById('room-chat-pane');
    const tabs = document.querySelectorAll('.inner-tab');

    tabs.forEach(btn => btn.classList.remove('active'));

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
    vinyl.classList.toggle('paused');
    playBtn.textContent = vinyl.classList.contains('paused') ? '▶' : '⏸';
}

function toggleVideoPlay() {
    const icon = document.getElementById('compact-video-play');
    const playBtn = document.getElementById('video-play-btn');
    const isPaused = icon.textContent === '▶';
    icon.textContent = isPaused ? '⏸' : '▶';
    playBtn.textContent = isPaused ? '⏸' : '▶';
}

function addTrackToQueue() {
    const input = document.getElementById('track-input');
    const val = input.value.trim();
    if (!val) return;

    trackQueue.push({ title: val, artist: "из ссылки" });
    input.value = '';
    renderQueueList();
}

function handleTrackKeyPress(event) {
    if (event.key === 'Enter') addTrackToQueue();
}

function nextTrack() {
    if (currentTrackIndex < trackQueue.length - 1) {
        currentTrackIndex++;
        updatePlayerDisplay();
        renderQueueList();
    }
}

function prevTrack() {
    if (currentTrackIndex > 0) {
        currentTrackIndex--;
        updatePlayerDisplay();
        renderQueueList();
    }
}

function updatePlayerDisplay() {
    if (trackQueue.length === 0) return;
    const track = trackQueue[currentTrackIndex];
    document.getElementById('audio-title').textContent = track.title;
    document.getElementById('audio-artist').textContent = track.artist;
}

function renderQueueList() {
    const container = document.getElementById('queue-list-container');
    if (!container) return;
    if (trackQueue.length === 0) {
        container.innerHTML = `<div class="queue-item">Очередь пуста</div>`;
        return;
    }
    container.innerHTML = '';
    trackQueue.forEach((t, idx) => {
        const item = document.createElement('div');
        item.className = idx === currentTrackIndex ? 'queue-item playing' : 'queue-item';
        item.innerHTML = `<span>${idx + 1}. ${escapeHtml(t.title)}</span> ${idx === currentTrackIndex ? '<b>(Играет)</b>' : ''}`;
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
}

function handleVideoTrackKeyPress(event) {
    if (event.key === 'Enter') addVideoToQueue();
}

function nextVideo() {
    if (currentVideoIndex < videoQueue.length - 1) {
        currentVideoIndex++;
        updateVideoPlayerDisplay();
        renderVideoQueueList();
    }
}

function prevVideo() {
    if (currentVideoIndex > 0) {
        currentVideoIndex--;
        updateVideoPlayerDisplay();
        renderVideoQueueList();
    }
}

function updateVideoPlayerDisplay() {
    if (videoQueue.length === 0) return;
    const video = videoQueue[currentVideoIndex];
    document.getElementById('video-room-title-text').textContent = video.title;
}

function renderVideoQueueList() {
    const container = document.getElementById('video-queue-list-container');
    if (!container) return;
    if (videoQueue.length === 0) {
        container.innerHTML = `<div class="queue-item">Очередь пуста</div>`;
        return;
    }
    container.innerHTML = '';
    videoQueue.forEach((v, idx) => {
        const item = document.createElement('div');
        item.className = idx === currentVideoIndex ? 'queue-item playing' : 'queue-item';
        item.innerHTML = `<span>${idx + 1}. ${escapeHtml(v.title)}</span> ${idx === currentVideoIndex ? '<b>(Смотрим)</b>' : ''}`;
        container.appendChild(item);
    });
}

function updateProfileName(newName) {
    currentUserName = newName.trim() || 'Без имени';
    const headerNameElem = document.getElementById('header-user-name');
    if (headerNameElem) headerNameElem.textContent = currentUserName;
}

// Покупка премиума с сохранением в память телефона
function simulatePayment() {
    const confirmed = confirm("💎 Оформить LURE Premium на 30 дней за 100 звёзд?\n\n(Имитация оплаты)");
    if (confirmed) {
        isPremiumUser = true;
        localStorage.setItem('lure_is_premium', 'true');
        alert("✨ Премиум успешно активирован!");
        document.getElementById('premium-box').style.display = 'none';
        document.getElementById('color-picker-box').style.display = 'flex';
        document.getElementById('profile-crown-icon').style.display = 'block';
        document.getElementById('header-crown-icon').style.display = 'block';
    }
}

function updateNicknameColor(color) {
    currentNicknameColor = color;
}

function openNotificationsModal() {
    if (isBannedUser) return;
    const container = document.getElementById('notifications-list-container');
    container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">Нет новых уведомлений 📭</div>`;
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

function openMembersModal() {
    const container = document.getElementById('members-list-container');
    container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center;">Вы единственный участник</div>`;
    document.getElementById('members-modal').style.display = 'flex';
}

function closeMembersModalDirect() {
    document.getElementById('members-modal').style.display = 'none';
}

function closeMembersModal(event) {
    if (event.target.id === 'members-modal') {
        document.getElementById('members-modal').style.display = 'none';
    }
}

function openCreateModal() {
    if (isBannedUser) return;
    document.getElementById('create-modal').style.display = 'flex';
}

function closeCreateModalDirect() {
    document.getElementById('create-modal').style.display = 'none';
}

function closeCreateModal(event) {
    if (event.target.id === 'create-modal') {
        document.getElementById('create-modal').style.display = 'none';
    }
}

function submitCreateRoom() {
    const nameInput = document.getElementById('new-room-name');
    const typeSelect = document.getElementById('new-room-type');
    const privacySelect = document.getElementById('new-room-privacy');

    const roomTitle = nameInput.value.trim() || 'Моя комната ✨';
    const roomType = typeSelect.value; 
    const isPrivate = privacySelect.value === 'private';

    const container = document.getElementById('rooms-list-container');
    const newCard = document.createElement('div');
    const detailsText = roomType === 'video' ? 'Совместный просмотр' : 'Музыкальный эфир';

    newCard.className = isPrivate ? 'room-card locked' : 'room-card';
    newCard.onclick = () => openRoom(roomType, roomTitle, detailsText, '1', currentUserName);
    
    newCard.innerHTML = `
        <div class="room-badge ${isPrivate ? 'private' : roomType}">${isPrivate ? '🔒 PRIVATE' : (roomType === 'video' ? '🎬 ВИДЕО' : '🎵 АУДИО')}</div>
        <div class="room-info">
            <div class="room-name">${escapeHtml(roomTitle)}</div>
            <div class="room-track">${isPrivate ? '📺 Приватная комната' : `🎵 ${detailsText}`}</div>
        </div>
        <div class="room-listeners">👥 1</div>
    `;

    container.prepend(newCard); 
    nameInput.value = '';
    document.getElementById('create-modal').style.display = 'none';

    openRoom(roomType, roomTitle, detailsText, '1', currentUserName);
}

function sendMessage() {
    if (isChatMuted) return;
    const input = document.getElementById('chat-input');
    const messagesContainer = document.getElementById('chat-messages');
    const text = input.value.trim();
    if (text === '') return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `
        <div><span class="author" style="color: ${currentNicknameColor};">${escapeHtml(currentUserName)}:</span> ${escapeHtml(text)}</div>
    `;
    messagesContainer.appendChild(msgDiv);
    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') sendMessage();
}

function sendVideoMessage() {
    if (isChatMuted) return;
    const input = document.getElementById('video-chat-input');
    const messagesContainer = document.getElementById('video-chat-messages');
    const text = input.value.trim();
    if (text === '') return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `
        <div><span class="author" style="color: ${currentNicknameColor};">${escapeHtml(currentUserName)}:</span> ${escapeHtml(text)}</div>
    `;
    messagesContainer.appendChild(msgDiv);
    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleVideoKeyPress(event) {
    if (event.key === 'Enter') sendVideoMessage();
}

function reportRoom() {
    alert("📨 Жалоба успешно отправлена администраторам!");
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}