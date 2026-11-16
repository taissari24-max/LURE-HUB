// ================= НАСТРОЙКИ СУПЕРБЕЙС И АДМИНИСТРИРОВАНИЯ =================
const OWNER_ID = 8982002623; // Твой главный цифровой ID (неприкосновенен)
const ADMIN_IDS = []; // ID других модераторов (если понадобятся в будущем)

// Вставь сюда данные своего проекта из панели Supabase:
const SUPABASE_URL = "https://klwjfgbhxizejlvqyoqm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PatHI_UfqW4z56DlLRNNzw_6wr1e4uM";
// ==============================================================================

let currentUserName = "Гость";
let currentUserId = 12345;
let currentRoomName = "🌙 Комната";
let currentRoomHost = "";
let currentNicknameColor = "#b873e8";
let isPremiumUser = false;
let isBannedUser = false;  
let isChatMuted = false;  
let isModModeActive = false; // Режим щита администратора

let friendsList = [];
let pendingFriendRequests = [];
let activeRooms = [];
let targetPunishUserId = null;
let targetPunishUserName = "";
let currentActiveRoomId = null;

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

    checkUserBanStatus();

    if (localStorage.getItem('lure_agreement_accepted') === 'true') {
        const agreementView = document.getElementById('agreement-view');
        if (agreementView) agreementView.style.display = 'none';
    }

    if (localStorage.getItem('lure_is_premium') === 'true') {
        isPremiumUser = true;
        const pBox = document.getElementById('premium-box');
        const cBox = document.getElementById('color-picker-box');
        if (pBox) pBox.style.display = 'none';
        if (cBox) cBox.style.display = 'flex';
        document.getElementById('profile-crown-icon').style.display = 'block';
        document.getElementById('header-crown-icon').style.display = 'block';
    }

    const isUserOwner = isOwner(currentUserId);
    let displayId = isUserOwner ? "1" : currentUserId;

    const modBtn = document.getElementById('admin-panel-btn');
    if (isAdmin(currentUserId)) {
        if (isUserOwner) {
            isPremiumUser = true;
            document.getElementById('header-crown-icon').style.display = 'block';
            document.getElementById('profile-crown-icon').style.display = 'block';
        }
        if (modBtn) modBtn.style.display = 'flex';
    }

    document.getElementById('header-user-name').textContent = currentUserName;
    document.getElementById('header-user-id').textContent = `ID: #lure_${displayId}`;
    document.getElementById('profile-name-input').value = currentUserName;
    document.getElementById('profile-id-text').textContent = `#lure_${displayId} 📋`;

    loadFriendsFromStorage();
    
    // Polling с Supabase каждые 4 секунды
    fetchRoomsFromSupabase();
    fetchRequestsFromSupabase();
    setInterval(() => {
        fetchRoomsFromSupabase();
        fetchRequestsFromSupabase();
    }, 4000);
});

function isOwner(userId) {
    return Number(userId) === Number(OWNER_ID);
}

function isAdmin(userId) {
    return isOwner(userId) || ADMIN_IDS.includes(Number(userId));
}

// РЕЖИМ МОДЕРАТОРА (ЩИТ)
function toggleModMode() {
    if (!isAdmin(currentUserId)) {
        alert("⛔ Доступ запрещен!");
        return;
    }
    isModModeActive = !isModModeActive;
    const btn = document.getElementById('admin-panel-btn');
    if (isModModeActive) {
        btn.style.background = 'rgba(94, 255, 139, 0.2)';
        btn.style.borderColor = '#5eff8b';
        alert("🛡️ Режим модератора ВКЛЮЧЕН. Вы в невидимке.");
    } else {
        btn.style.background = 'rgba(255,50,80,0.15)';
        btn.style.borderColor = 'rgba(255,50,80,0.3)';
        alert("🛡️ Режим модератора выключен.");
    }
}

// ПРОВЕРКА БАНА
function checkUserBanStatus() {
    const banData = localStorage.getItem(`lure_ban_${currentUserId}`);
    if (banData) {
        const banTime = JSON.parse(banData);
        if (Date.now() < banTime.expires || banTime.expires === 0) {
            isBannedUser = true;
            document.getElementById('ban-screen-view').classList.add('active');
            document.getElementById('menu-view').classList.remove('active');
            document.getElementById('ban-countdown').textContent = banTime.expires === 0 ? "навсегда" : Math.ceil((banTime.expires - Date.now()) / 60000) + " мин.";
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

// ================= РАБОТА С SUPABASE ЧЕРЕЗ POLLING =================
async function fetchRoomsFromSupabase() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms?select=*`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (res.ok) {
            const data = await res.json();
            const now = Date.now();
            activeRooms = data.filter(room => (now - room.created_at) < 300000);
            renderRoomsList();
        }
    } catch (e) {
        console.error("Ошибка загрузки комнат", e);
    }
}

async function saveRoomToSupabase(roomObj) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/rooms`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify(roomObj)
        });
        fetchRoomsFromSupabase();
    } catch (e) {
        console.error("Ошибка создания комнаты", e);
    }
}

async function deleteRoomFromSupabase(roomId) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${roomId}`, {
            method: 'DELETE',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        fetchRoomsFromSupabase();
    } catch (e) {
        console.error("Ошибка удаления комнаты", e);
    }
}

function renderRoomsList() {
    const container = document.getElementById('rooms-list-container');
    if (!container) return;

    if (activeRooms.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">Нет активных комнат. Создайте первую! ✨</div>`;
        return;
    }

    container.innerHTML = '';
    activeRooms.sort((a, b) => (b.host === currentUserName ? 1 : 0) - (a.host === currentUserName ? 1 : 0));

    activeRooms.forEach(room => {
        const isMyRoom = (room.host === currentUserName);
        const card = document.createElement('div');
        card.className = isMyRoom ? 'room-card pinned' : 'room-card';
        
        card.onclick = () => {
            if (room.is_private && !isMyRoom && !isModModeActive) {
                alert("🔒 Эта комната приватная. Нужен инвайт!");
                return;
            }
            openRoom(room.type, room.title, room.details, '1', room.host, room.id);
        };

        card.innerHTML = `
            <div class="room-badge ${room.is_private ? 'private' : room.type}">${room.is_private ? '🔒 PRIVATE' : (room.type === 'video' ? '🎬 ВИДЕО' : '🎵 АУДИО')}</div>
            <div class="room-info">
                <div class="room-name">${escapeHtml(room.title)} ${isMyRoom ? '👑 (Ваша)' : ''}</div>
                <div class="room-track">Хост: ${escapeHtml(room.host)}</div>
            </div>
            <div class="room-listeners">👥 1</div>
        `;
        container.appendChild(card);
    });
}

function submitCreateRoom() {
    if (isBannedUser) return;
    
    const hasMyRoom = activeRooms.some(r => r.host === currentUserName);
    if (hasMyRoom && !isModModeActive) {
        alert("⚠️ У вас уже есть активная комната! Нельзя спамить и создавать больше одной комнаты.");
        return;
    }

    const nameInput = document.getElementById('new-room-name');
    const typeSelect = document.getElementById('new-room-type');
    const privacySelect = document.getElementById('new-room-privacy');

    const roomTitle = nameInput.value.trim() || 'Моя комната ✨';
    const roomType = typeSelect.value; 
    const isPrivate = privacySelect.value === 'private';
    const detailsText = roomType === 'video' ? 'Совместный просмотр' : 'Музыкальный эфир';

    const newRoomObj = {
        id: Date.now(),
        title: roomTitle,
        type: roomType,
        host: currentUserName,
        details: detailsText,
        is_private: isPrivate,
        created_at: Date.now()
    };

    saveRoomToSupabase(newRoomObj);
    nameInput.value = '';
    document.getElementById('create-modal').style.display = 'none';
    openRoom(roomType, roomTitle, detailsText, '1', currentUserName, newRoomObj.id);
}

function openRoom(type, roomName, details, onlineCount = '1', hostName = currentUserName, roomId = null) {
    if (isBannedUser) return;
    currentRoomName = roomName;
    currentRoomHost = hostName;
    currentActiveRoomId = roomId;

    document.getElementById('menu-view').classList.remove('active');
    document.getElementById('main-nav').style.display = 'none';

    renderHostControls(type);

    if (type === 'video') {
        document.getElementById('active-video-room-title').textContent = roomName;
        document.getElementById('video-room-view').classList.add('active');
    } else {
        document.getElementById('active-room-title').textContent = roomName;
        document.getElementById('room-view').classList.add('active');
    }
}

function renderHostControls(type) {
    const isHost = (currentRoomHost === currentUserName);
    const containerId = type === 'video' ? 'video-host-close-container' : 'host-close-room-container';
    const container = document.getElementById(containerId);

    if (isHost || isModModeActive) {
        container.innerHTML = `<button class="close-room-host-btn" onclick="closeRoomAsHost()">🛑 Закрыть комнату</button>`;
    } else {
        container.innerHTML = ``;
    }
}

function closeRoomAsHost() {
    if (currentActiveRoomId) {
        deleteRoomFromSupabase(currentActiveRoomId);
    }
    closeRoom();
}

function closeRoom() {
    document.getElementById('room-view').classList.remove('active');
    document.getElementById('video-room-view').classList.remove('active');
    document.getElementById('menu-view').classList.add('active');
    document.getElementById('main-nav').style.display = 'flex';
    fetchRoomsFromSupabase();
}

// ================= СИСТЕМА ДРУЗЕЙ И ЗАЯВОК =================
async function fetchRequestsFromSupabase() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/friend_requests?target_id=eq.${currentUserId}&select=*`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (res.ok) {
            pendingFriendRequests = await res.json();
            updateNotifBadge();
        }
    } catch (e) {}
}

async function addFriendAction() {
    const input = document.getElementById('add-friend-input');
    const val = input.value.trim().replace('#lure_', '');
    if (!val || isNaN(val)) {
        alert("⚠️ Введите корректный числовой ID друга!");
        return;
    }
    if (Number(val) === Number(currentUserId)) {
        alert("⛔ Нельзя добавить себя!");
        return;
    }

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/friend_requests`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                sender_id: currentUserId,
                sender_name: currentUserName,
                target_id: Number(val)
            })
        });
        alert("📨 Заявка в друзья успешно отправлена!");
        input.value = '';
    } catch (e) {
        alert("Ошибка отправки заявки.");
    }
}

function updateNotifBadge() {
    const count = pendingFriendRequests.length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function openNotificationsModal() {
    const container = document.getElementById('notifications-list-container');
    const sub = document.getElementById('notif-modal-text');
    if (pendingFriendRequests.length === 0) {
        sub.textContent = "Нет новых заявок";
        container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">📭 Пусто</div>`;
    } else {
        sub.textContent = "Входящие заявки:";
        container.innerHTML = '';
        pendingFriendRequests.forEach(req => {
            const row = document.createElement('div');
            row.className = 'modal-friend-row';
            row.innerHTML = `
                <span>👤 ${escapeHtml(req.sender_name)} (#lure_${req.sender_id})</span>
                <div>
                    <button class="modal-invite-action" onclick="acceptFriend(${req.sender_id}, '${escapeHtml(req.sender_name)}', ${req.id})">Принять</button>
                    <button class="modal-decline-action" onclick="declineFriend(${req.id})">Х</button>
                </div>
            `;
            container.appendChild(row);
        });
    }
    document.getElementById('notifications-modal').style.display = 'flex';
}

async function acceptFriend(senderId, senderName, reqId) {
    friendsList.push({ id: senderId, name: senderName });
    localStorage.setItem(`lure_friends_${currentUserId}`, JSON.stringify(friendsList));
    renderFriendsList();
    
    await fetch(`${SUPABASE_URL}/rest/v1/friend_requests?id=eq.${reqId}`, {
        method: 'DELETE',
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
    });
    fetchRequestsFromSupabase();
    document.getElementById('notifications-modal').style.display = 'none';
    alert("✨ Друг успешно добавлен!");
}

async function declineFriend(reqId) {
    await fetch(`${SUPABASE_URL}/rest/v1/friend_requests?id=eq.${reqId}`, {
        method: 'DELETE',
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
    });
    fetchRequestsFromSupabase();
    openNotificationsModal();
}

function loadFriendsFromStorage() {
    const saved = localStorage.getItem(`lure_friends_${currentUserId}`);
    if (saved) {
        try { friendsList = JSON.parse(saved); } catch(e) { friendsList = []; }
    }
    renderFriendsList();
}

function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    if (!container) return;

    if (friendsList.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">Список друзей пуст</div>`;
        return;
    }

    container.innerHTML = '';
    friendsList.forEach(friend => {
        const item = document.createElement('div');
        item.className = 'friend-card';
        item.innerHTML = `
            <div style="width: 32px; height: 32px; background: #3c124a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>
            <div class="room-info" style="flex: 1;">
                <div class="room-name">${escapeHtml(friend.name)}</div>
                <div class="room-track" style="color: #5eff8b;">ID: #lure_${friend.id} • В сети</div>
            </div>
            <button onclick="removeFriend('${friend.id}')" style="background: rgba(255,50,80,0.1); border: 1px solid rgba(255,50,80,0.3); color: #ff8e8e; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor:pointer;">Удалить</button>
        `;
        container.appendChild(item);
    });
}

function removeFriend(id) {
    if (confirm("🗑️ Удалить из друзей?")) {
        friendsList = friendsList.filter(f => String(f.id) !== String(id));
        localStorage.setItem(`lure_friends_${currentUserId}`, JSON.stringify(friendsList));
        renderFriendsList();
    }
}

// ================= ОТПРАВКА ЖАЛОБ В SUPABASE =================
async function reportRoom() {
    const reason = prompt("⚠️ Укажите причину жалобы на эту комнату:");
    if (!reason) return;

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                room_name: currentRoomName,
                host_name: currentRoomHost,
                reporter_id: currentUserId,
                reporter_name: currentUserName,
                reason: reason,
                created_at: Date.now()
            })
        });
        alert("📨 Жалоба успешно отправлена администраторам!");
    } catch (e) {
        alert("Ошибка при отправке жалобы.");
    }
}

// ================= МОДЕРАЦИЯ И НАКАЗАНИЯ =================
function openPunishMenu(type) {
    if (isOwner(targetPunishUserId)) {
        alert("⛔ Ошибка: Нельзя применить наказание к владельцу системы!");
        return;
    }
    document.getElementById('punish-modal-title').textContent = type === 'mute' ? `Мут для ${targetPunishUserName}` : `Бан для ${targetPunishUserName}`;
    document.getElementById('punish-modal').style.display = 'flex';
}

function applyPunishment(durationKey) {
    if (isOwner(targetPunishUserId)) {
        alert("⛔ Ошибка: Владелец системы защищен от любых наказаний!");
        document.getElementById('punish-modal').style.display = 'none';
        return;
    }

    let durationMs = 0;
    const now = Date.now();

    if (durationKey === '1h') durationMs = 3600000;
    else if (durationKey === '4h') durationMs = 14400000;
    else if (durationKey === '6h') durationMs = 21600000;
    else if (durationKey === '12h') durationMs = 43200000;
    else if (durationKey === '24h') durationMs = 86400000;
    else if (durationKey === 'forever') durationMs = 0;

    const expiresTime = durationMs === 0 ? 0 : now + durationMs;
    localStorage.setItem(`lure_ban_${targetPunishUserId}`, JSON.stringify({ expires: expiresTime }));
    
    alert(`⚖️ Пользователь #${targetPunishUserId} наказан.`);
    document.getElementById('punish-modal').style.display = 'none';
    switchMainTab('menu');
}

function checkAdminCommand(text) {
    if (isAdmin(currentUserId) && text.startsWith('/unban ')) {
        const targetId = text.replace('/unban ', '').trim();
        localStorage.removeItem(`lure_ban_${targetId}`);
        alert(`✅ Пользователь #${targetId} успешно разблокирован!`);
        return true;
    }
    return false;
}

// ================= ПЛЕЕР И ЧАТ =================
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
function handleTrackKeyPress(event) { if (event.key === 'Enter') addTrackToQueue(); }
function nextTrack() {
    if (currentTrackIndex < trackQueue.length - 1) { currentTrackIndex++; updatePlayerDisplay(); renderQueueList(); }
}
function prevTrack() {
    if (currentTrackIndex > 0) { currentTrackIndex--; updatePlayerDisplay(); renderQueueList(); }
}
function updatePlayerDisplay() {
    if (trackQueue.length === 0) return;
    const track = trackQueue[currentTrackIndex];
    document.getElementById('audio-title').textContent = track.title;
}
function renderQueueList() {
    const container = document.getElementById('queue-list-container');
    if (!container) return;
    if (trackQueue.length === 0) { container.innerHTML = `<div class="queue-item">Очередь пуста</div>`; return; }
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
    updateVideoPlayerDisplay();
}
function handleVideoTrackKeyPress(event) { if (event.key === 'Enter') addVideoToQueue(); }
function nextVideo() {
    if (currentVideoIndex < videoQueue.length - 1) { currentVideoIndex++; updateVideoPlayerDisplay(); renderVideoQueueList(); }
}
function prevVideo() {
    if (currentVideoIndex > 0) { currentVideoIndex--; updateVideoPlayerDisplay(); renderVideoQueueList(); }
}

function getYouTubeEmbedUrl(url) {
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    let match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
}

function updateVideoPlayerDisplay() {
    if (videoQueue.length === 0) return;
    const video = videoQueue[currentVideoIndex];
    document.getElementById('video-room-title-text').textContent = video.title;
    const screenDiv = document.getElementById('video-screen-container');
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
        item.innerHTML = `<span>${idx + 1}. ${escapeHtml(v.title)}</span> ${idx === currentVideoIndex ? '<b>(Смотрим)</b>' : ''}`;
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
        document.getElementById('color-picker-box').style.display = 'flex';
        document.getElementById('profile-crown-icon').style.display = 'block';
        document.getElementById('header-crown-icon').style.display = 'block';
    }
}

function updateNicknameColor(color) { currentNicknameColor = color; }

function sendMessage() {
    if (isChatMuted) return;
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages');
    const text = input.value.trim();
    if (text === '') return;

    if (checkAdminCommand(text)) {
        input.value = '';
        return;
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `<div><span class="author" style="color: ${currentNicknameColor};">${escapeHtml(currentUserName)}:</span> ${escapeHtml(text)}</div>`;
    container.appendChild(msgDiv);
    input.value = '';
    container.scrollTop = container.scrollHeight;
}
function handleKeyPress(event) { if (event.key === 'Enter') sendMessage(); }

function sendVideoMessage() {
    if (isChatMuted) return;
    const input = document.getElementById('video-chat-input');
    const container = document.getElementById('video-chat-messages');
    const text = input.value.trim();
    if (text === '') return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `<div><span class="author" style="color: ${currentNicknameColor};">${escapeHtml(currentUserName)}:</span> ${escapeHtml(text)}</div>`;
    container.appendChild(msgDiv);
    input.value = '';
    container.scrollTop = container.scrollHeight;
}
function handleVideoKeyPress(event) { if (event.key === 'Enter') sendVideoMessage(); }

function openUserProfileCard(userId, userName) {
    targetPunishUserId = userId;
    targetPunishUserName = userName;
    document.getElementById('other-user-name').textContent = userName;
    document.getElementById('other-user-id').textContent = `#lure_${userId} 📋`;
    
    const punishBox = document.getElementById('admin-punish-container');
    if (isAdmin(currentUserId) && !isOwner(userId)) {
        punishBox.style.display = 'flex';
    } else {
        punishBox.style.display = 'none';
    }
    switchMainTab('other-profile');
}

// Функции закрытия модалок (исправлены для стопроцентного срабатывания)
function closeNotificationsModalDirect() { document.getElementById('notifications-modal').style.display = 'none'; }
function closeNotificationsModal(event) { if (event.target.id === 'notifications-modal') document.getElementById('notifications-modal').style.display = 'none'; }

function closeMembersModalDirect() { document.getElementById('members-modal').style.display = 'none'; }
function closeMembersModal(event) { if (event.target.id === 'members-modal') document.getElementById('members-modal').style.display = 'none'; }

function openInviteModal() { document.getElementById('invite-modal').style.display = 'flex'; }
function closeInviteModalDirect() { document.getElementById('invite-modal').style.display = 'none'; }
function closeInviteModal(event) { if (event.target.id === 'invite-modal') document.getElementById('invite-modal').style.display = 'none'; }

function openCreateModal() {
    if (isBannedUser) return;
    document.getElementById('create-modal').style.display = 'flex';
}
function closeCreateModalDirect() { document.getElementById('create-modal').style.display = 'none'; }
function closeCreateModal(event) { if (event.target.id === 'create-modal') document.getElementById('create-modal').style.display = 'none'; }

function closePunishModalDirect() { document.getElementById('punish-modal').style.display = 'none'; }
function closePunishModal(event) { if (event.target.id === 'punish-modal') document.getElementById('punish-modal').style.display = 'none'; }

function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
