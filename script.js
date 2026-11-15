const OWNER_ID = 0; // Твой ID если нужен
const ADMIN_IDS = []; 

let currentUserName = "Гость";
let currentUserId = 12345;
let currentRoomName = "🌙 Комната";
let currentRoomHost = "";
let currentNicknameColor = "#b873e8";
let isPremiumUser = false;
let isBannedUser = false;  

let trackQueue = [];
let currentTrackIndex = 0;
let videoQueue = [];
let currentVideoIndex = 0;

window.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.expand();
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            currentUserName = tg.initDataUnsafe.user.first_name || "Пользователь";
            currentUserId = tg.initDataUnsafe.user.id;
        }
    }

    if (localStorage.getItem('lure_agreement_accepted') === 'true') {
        const agreementView = document.getElementById('agreement-view');
        if (agreementView) agreementView.style.display = 'none';
    }

    if (localStorage.getItem('lure_is_premium') === 'true') {
        isPremiumUser = true;
        const pBox = document.getElementById('premium-box');
        const crownHeader = document.getElementById('header-crown-icon');
        const crownProfile = document.getElementById('profile-crown-icon');
        if (pBox) pBox.style.display = 'none';
        if (crownHeader) crownHeader.style.display = 'block';
        if (crownProfile) crownProfile.style.display = 'block';
    }

    const isUserOwner = (Number(currentUserId) === Number(OWNER_ID));
    let displayId = isUserOwner ? "1" : currentUserId;

    if (isUserOwner) {
        isPremiumUser = true;
        document.getElementById('header-crown-icon').style.display = 'block';
        document.getElementById('profile-crown-icon').style.display = 'block';
    }

    document.getElementById('header-user-name').textContent = currentUserName;
    document.getElementById('header-user-id').textContent = `ID: #lure_${displayId}`;
    document.getElementById('profile-name-input').value = currentUserName;
    document.getElementById('profile-id-text').textContent = `#lure_${displayId} 📋`;
});

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
}

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

function submitCreateRoom() {
    const roomTitle = document.getElementById('new-room-name').value.trim() || 'Моя комната ✨';
    const roomType = document.getElementById('new-room-type').value;
    const container = document.getElementById('rooms-list-container');
    const newCard = document.createElement('div');
    newCard.className = 'room-card';
    newCard.onclick = () => openRoom(roomType, roomTitle, 'Эфир', '1', currentUserName);
    newCard.innerHTML = `
        <div class="room-badge ${roomType}">${roomType === 'video' ? '🎬 ВИДЕО' : '🎵 АУДИО'}</div>
        <div class="room-info"><div class="room-name">${escapeHtml(roomTitle)}</div></div>
        <div class="room-listeners">👥 1</div>
    `;
    container.prepend(newCard);
    document.getElementById('new-room-name').value = '';
    document.getElementById('create-modal').style.display = 'none';
    openRoom(roomType, roomTitle, 'Эфир', '1', currentUserName);
}

function openCreateModal() { document.getElementById('create-modal').style.display = 'flex'; }
function closeCreateModalDirect() { document.getElementById('create-modal').style.display = 'none'; }
function closeCreateModal(event) { if (event.target.id === 'create-modal') document.getElementById('create-modal').style.display = 'none'; }

function sendMessage() {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages');
    if (!input.value.trim()) return;
    container.innerHTML += `<div class="chat-msg"><div><span class="author">${escapeHtml(currentUserName)}:</span> ${escapeHtml(input.value)}</div></div>`;
    input.value = '';
    container.scrollTop = container.scrollHeight;
}
function handleKeyPress(event) { if (event.key === 'Enter') sendMessage(); }

function sendVideoMessage() {
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
