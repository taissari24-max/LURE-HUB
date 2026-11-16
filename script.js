// ================= НАСТРОЙКИ СУПЕРБЕЙС И АДМИНИСТРИРОВАНИЯ =================
const OWNER_ID = 8982002623; // Твой главный цифровой ID
const ADMIN_IDS = []; // ID других модераторов

// Вставь сюда данные своего проекта из панели Supabase:
const SUPABASE_URL = "https://klwjfgbhxizejlvqyoqm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PatHI_UfqW4z56DlLRNNzw_6wr1e4uM";
// ==============================================================================

let currentUserName = "Гость";
let currentUserId = 12345;
let currentRoomName = "🌙 Комната";
let currentRoomHost = "";
let currentRoomType = "audio";
let currentNicknameColor = "#b873e8";
let currentUserAvatar = "🦇";
let currentUserStatus = "в поисках музыки под дождь 🌧️";
let sessionStartTime = Date.now();

let isPremiumUser = false;
let isBannedUser = false;  
let isChatMuted = false;  
let isModModeActive = false;

let friendsList = [];
let pendingFriendRequests = [];
let activeRooms = [];
let targetPunishUserId = null;
let targetPunishUserName = "";
let currentActiveRoomId = null;

// Состояние текущей комнаты (синхронизируется с Supabase)
let roomMembers = [];
let roomMessages = [];
let mediaQueue = [];
let currentMediaIndex = 0;
let lastRenderedVideoUrl = "";
let isVideoPlaying = true;
let videoCurrentTime = 0;

window.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.expand();
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            currentUserName = tg.initDataUnsafe.user.first_name || "Пользователь";
            currentUserId = tg.initDataUnsafe.user.id;
            
            // Автоматически берем аватарку из Telegram
            if (tg.initDataUnsafe.user.photo_url) {
                currentUserAvatar = tg.initDataUnsafe.user.photo_url;
            }
        }
    }

    checkUserBanStatus();
    loadUserProfileFromStorage();

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

    updateHeaderUI();
    document.getElementById('profile-name-input').value = currentUserName;
    document.getElementById('profile-status-input').value = currentUserStatus;
    document.getElementById('profile-id-text').textContent = `#lure_${displayId} 📋`;

    loadFriendsFromStorage();
    
    // Запуск таймера сессии в профиле
    setInterval(updateSessionTimer, 60000);

    // Polling каждые 3 секунды
    syncAllData();
    setInterval(syncAllData, 3000);
});

function loadUserProfileFromStorage() {
    const savedName = localStorage.getItem(`lure_name_${currentUserId}`);
    if (savedName) currentUserName = savedName;

    const savedStatus = localStorage.getItem(`lure_status_${currentUserId}`);
    if (savedStatus) currentUserStatus = savedStatus;
}

function saveUserProfileToStorage() {
    localStorage.setItem(`lure_name_${currentUserId}`, currentUserName);
    localStorage.setItem(`lure_status_${currentUserId}`, currentUserStatus);
}

function updateHeaderUI() {
    document.getElementById('header-user-name').textContent = currentUserName;
    const isUserOwner = isOwner(currentUserId);
    let displayId = isUserOwner ? "1" : currentUserId;
    document.getElementById('header-user-id').textContent = `ID: #lure_${displayId}`;

    const headerAva = document.getElementById('header-avatar-emoji');
    const profileAva = document.getElementById('profile-avatar-big');

    if (currentUserAvatar.startsWith('http')) {
        if (headerAva) {
            headerAva.style.backgroundImage = `url('${currentUserAvatar}')`;
            headerAva.textContent = '';
        }
        if (profileAva) {
            profileAva.style.backgroundImage = `url('${currentUserAvatar}')`;
            profileAva.textContent = '';
        }
    } else {
        if (headerAva) {
            headerAva.style.backgroundImage = 'none';
            headerAva.textContent = currentUserAvatar;
        }
        if (profileAva) {
            profileAva.style.backgroundImage = 'none';
            profileAva.textContent = currentUserAvatar;
        }
    }
}

function updateSessionTimer() {
    const minutes = Math.floor((Date.now() - sessionStartTime) / 60000);
    const hours = (minutes / 60).toFixed(1);
    const statValEl = document.querySelector('.stat-value');
    if (statValEl) statValEl.textContent = `${hours} ч`;
}

async function syncAllData() {
    await fetchRoomsFromSupabase();
    await fetchRequestsFromSupabase();
    if (currentActiveRoomId) {
        await syncActiveRoomState();
    }
}

function isOwner(userId) {
    return Number(userId) === Number(OWNER_ID);
}

function isAdmin(userId) {
    return isOwner(userId) || ADMIN_IDS.includes(Number(userId));
}

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

// ================= РАБОТА С SUPABASE =================
async function fetchRoomsFromSupabase() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms?select=*`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (!res.ok) return;
        const data = await res.json();
        const now = Date.now();
        activeRooms = data.filter(room => {
            const membersCount = Array.isArray(room.members) ? room.members.length : 0;
            if (membersCount > 0) return true;
            return (now - Number(room.created_at)) < 300000;
        });
        renderRoomsList();
    } catch (e) {}
}

async function saveRoomToSupabase(roomObj) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            body: JSON.stringify(roomObj)
        });
        if (!res.ok) {
            const errText = await res.text();
            alert(`❌ Ошибка базы данных (${res.status}): ${errText}`);
            return false;
        }
        await fetchRoomsFromSupabase();
        return true;
    } catch (e) {
        alert(`❌ Сетевая ошибка: ${e.message}`);
        return false;
    }
}

async function updateRoomInSupabase(roomId, patchObj) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${roomId}`, {
            method: 'PATCH',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify(patchObj)
        });
    } catch (e) {}
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
        await fetchRoomsFromSupabase();
    } catch (e) {}
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
        const count = Array.isArray(room.members) ? room.members.length : 1;
        const card = document.createElement('div');
        card.className = isMyRoom ? 'room-card pinned' : 'room-card';
        
        card.onclick = () => {
            if (room.is_private && !isMyRoom && !isModModeActive) {
                alert("🔒 Эта комната приватная. Нужен инвайт!");
                return;
            }
            openRoom(room.type, room.title, room.details, count, room.host, room.id);
        };

        card.innerHTML = `
            <div class="room-badge ${room.is_private ? 'private' : room.type}">${room.is_private ? '🔒 PRIVATE' : (room.type === 'video' ? '🎬 ВИДЕО' : '🎵 АУДИО')}</div>
            <div class="room-info">
                <div class="room-name">${escapeHtml(room.title)} ${isMyRoom ? '👑 (Ваша)' : ''}</div>
                <div class="room-track">Хост: ${escapeHtml(room.host)}</div>
            </div>
            <div class="room-listeners">👥 ${count}</div>
        `;
        container.appendChild(card);
    });
}

async function submitCreateRoom() {
    if (isBannedUser) return;
    
    const createBtn = document.querySelector('#create-modal .modal-action-btn');
    if (createBtn) createBtn.disabled = true;

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/rooms?host=eq.${encodeURIComponent(currentUserName)}`, {
            method: 'DELETE',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        const nameInput = document.getElementById('new-room-name');
        const typeSelect = document.getElementById('new-room-type');
        const privacySelect = document.getElementById('new-room-privacy');

        const roomTitle = nameInput.value.trim() || 'Моя комната ✨';
        const roomType = typeSelect.value; 
        const isPrivate = privacySelect.value === 'private';
        const detailsText = roomType === 'video' ? 'Совместный просмотр' : 'Музыкальный эфир';

        const initialMembers = isModModeActive ? [] : [{ id: currentUserId, name: currentUserName, avatar: currentUserAvatar, status: currentUserStatus }];

        const newRoomObj = {
            id: Date.now(),
            title: roomTitle,
            type: roomType,
            host: currentUserName,
            details: detailsText,
            is_private: isPrivate,
            created_at: Date.now(),
            members: initialMembers,
            messages: [],
            media_queue: [],
            current_index: 0,
            is_playing: true,
            video_time: 0
        };

        const saved = await saveRoomToSupabase(newRoomObj);
        if (saved) {
            nameInput.value = '';
            document.getElementById('create-modal').style.display = 'none';
            openRoom(roomType, roomTitle, detailsText, initialMembers.length, currentUserName, newRoomObj.id);
        }
    } finally {
        if (createBtn) createBtn.disabled = false;
    }
}

async function openRoom(type, roomName, details, onlineCount = '1', hostName = currentUserName, roomId = null) {
    if (isBannedUser) return;
    currentRoomName = roomName;
    currentRoomHost = hostName;
    currentRoomType = type;
    currentActiveRoomId = roomId;
    lastRenderedVideoUrl = "";

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

    if (roomId) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${roomId}&select=*`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (res.ok) {
            const rooms = await res.json();
            if (rooms.length > 0) {
                let members = Array.isArray(rooms[0].members) ? rooms[0].members : [];
                if (!isModModeActive && !members.some(m => Number(m.id) === Number(currentUserId))) {
                    members.push({ id: currentUserId, name: currentUserName, avatar: currentUserAvatar, status: currentUserStatus });
                    await updateRoomInSupabase(roomId, { members: members });
                }
            }
        }
        await syncActiveRoomState();
    }
}

// СИНХРОНИЗАЦИЯ СОСТОЯНИЯ КОМНАТЫ
async function syncActiveRoomState() {
    if (!currentActiveRoomId) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${currentActiveRoomId}&select=*`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) return;
        const rooms = await res.json();
        if (rooms.length === 0) {
            alert("🛑 Комната была закрыта хостом или удалена.");
            closeRoom(true);
            return;
        }

        const room = rooms[0];
        roomMembers = Array.isArray(room.members) ? room.members : [];
        roomMessages = Array.isArray(room.messages) ? room.messages : [];
        mediaQueue = Array.isArray(room.media_queue) ? room.media_queue : [];
        currentMediaIndex = room.current_index || 0;
        isVideoPlaying = room.is_playing !== false;
        videoCurrentTime = room.video_time || 0;

        if (!isModModeActive && !roomMembers.some(m => Number(m.id) === Number(currentUserId))) {
            alert("👢 Вы были исключены из комнаты.");
            closeRoom(true);
            return;
        }

        const badgeSelector = currentRoomType === 'video' ? '#video-room-view .online-badge' : '#room-view .online-badge';
        const badgeEl = document.querySelector(badgeSelector);
        if (badgeEl) badgeEl.textContent = `👥 ${roomMembers.length}`;

        renderSyncedChat();

        if (currentRoomType === 'video') {
            renderVideoQueueList();
            syncVideoPlayerDisplay(room);
        } else {
            renderQueueList();
            updatePlayerDisplay();
        }
    } catch (e) {}
}

function renderSyncedChat() {
    const containerId = currentRoomType === 'video' ? 'video-chat-messages' : 'chat-messages';
    const container = document.getElementById(containerId);
    if (!container) return;

    const systemMsg = currentRoomType === 'video' 
        ? `<div class="chat-msg system">🎬 Кино-эфир запущен! Обсуждайте серию в чате.</div>`
        : `<div class="chat-msg system">🌙 Эфир запущен. Общайтесь и слушайте музыку!</div>`;

    let html = systemMsg;
    roomMessages.forEach(msg => {
        const safeName = escapeHtml(msg.author);
        const safeText = escapeHtml(msg.text);
        const color = msg.color || '#b873e8';
        html += `<div class="chat-msg"><div><span class="author" style="color: ${color};" data-uid="${msg.uid}" data-uname="${safeName}" onclick="handleAuthorClick(this)">${safeName}:</span> ${safeText}</div></div>`;
    });

    if (container.innerHTML !== html) {
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }
}

function handleAuthorClick(el) {
    const uid = el.getAttribute('data-uid');
    const uname = el.getAttribute('data-uname');
    openUserProfileCard(uid, uname);
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

async function closeRoomAsHost() {
    if (currentActiveRoomId) {
        await deleteRoomFromSupabase(currentActiveRoomId);
    }
    closeRoom(true);
}

async function closeRoom(skipRemoveMember = false) {
    if (currentActiveRoomId) {
        const isHost = (currentRoomHost === currentUserName);
        if (isHost || isModModeActive) {
            await deleteRoomFromSupabase(currentActiveRoomId);
        } else if (!skipRemoveMember) {
            const updatedMembers = roomMembers.filter(m => Number(m.id) !== Number(currentUserId));
            await updateRoomInSupabase(currentActiveRoomId, { members: updatedMembers });
        }
    }
    currentActiveRoomId = null;
    lastRenderedVideoUrl = "";
    document.getElementById('room-view').classList.remove('active');
    document.getElementById('video-room-view').classList.remove('active');
    document.getElementById('menu-view').classList.add('active');
    document.getElementById('main-nav').style.display = 'flex';
    fetchRoomsFromSupabase();
}

// ================= КРАСИВАЯ МОДАЛКА УЧАСТНИКОВ (КИК + БАН) =================
function openMembersModal() {
    const container = document.getElementById('members-list-container');
    if (!container) return;

    if (roomMembers.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center;">В комнате никого нет</div>`;
    } else {
        container.innerHTML = '';
        const isHostOrAdmin = (currentRoomHost === currentUserName) || isAdmin(currentUserId);
        const isUserAdminOrOwner = isAdmin(currentUserId);

        roomMembers.forEach(m => {
            const isMe = Number(m.id) === Number(currentUserId);
            const row = document.createElement('div');
            row.className = 'modal-member-row';
            
            const avaStyle = m.avatar && m.avatar.startsWith('http') ? `background-image: url('${m.avatar}');` : '';
            const avaText = m.avatar && m.avatar.startsWith('http') ? '' : (m.avatar || '👤');

            let buttonsHtml = '';
            if (!isMe) {
                buttonsHtml += `<button class="modal-btn-action" onclick="openUserProfileCard('${m.id}', '${escapeHtml(m.name)}'); closeMembersModalDirect();">Профиль</button>`;
                
                if (isHostOrAdmin && !isOwner(m.id)) {
                    buttonsHtml += `<button class="modal-btn-kick" onclick="kickMember('${m.id}')">Кик</button>`;
                }
                
                if (isUserAdminOrOwner && !isOwner(m.id)) {
                    buttonsHtml += `<button class="modal-btn-ban" onclick="banMemberFromModal('${m.id}', '${escapeHtml(m.name)}')">Бан</button>`;
                }
            }

            row.innerHTML = `
                <div class="modal-member-info">
                    <div class="modal-member-avatar" style="${avaStyle}">${avaText}</div>
                    <span>${escapeHtml(m.name)} ${isMe ? '(Вы)' : ''}</span>
                </div>
                <div class="modal-member-actions">${buttonsHtml}</div>
            `;
            container.appendChild(row);
        });
    }
    document.getElementById('members-modal').style.display = 'flex';
}

function banMemberFromModal(targetId, targetName) {
    targetPunishUserId = targetId;
    targetPunishUserName = targetName;
    closeMembersModalDirect();
    openPunishMenu('ban');
}

async function kickMember(targetId) {
    if (!currentActiveRoomId) return;
    if (isOwner(targetId)) {
        alert("⛔ Нельзя выгнать владельца!");
        return;
    }
    const updatedMembers = roomMembers.filter(m => String(m.id) !== String(targetId));
    await updateRoomInSupabase(currentActiveRoomId, { members: updatedMembers });
    roomMembers = updatedMembers;
    openMembersModal();
}

function closeMembersModalDirect() { document.getElementById('members-modal').style.display = 'none'; }
function closeMembersModal(event) { if (event.target.id === 'members-modal') document.getElementById('members-modal').style.display = 'none'; }

// ================= ПЛЕЕР И СИНХРОНИЗАЦИЯ ВИДЕО С ХОСТОМ =================
async function addTrackToQueue() {
    const input = document.getElementById('track-input');
    const val = input.value.trim();
    if (!val || !currentActiveRoomId) return;

    const updatedQueue = [...mediaQueue, { title: val, artist: "из ссылки" }];
    input.value = '';
    await updateRoomInSupabase(currentActiveRoomId, { media_queue: updatedQueue });
    await syncActiveRoomState();
}
function handleTrackKeyPress(event) { if (event.key === 'Enter') addTrackToQueue(); }

async function nextTrack() {
    if (currentMediaIndex < mediaQueue.length - 1 && currentActiveRoomId) {
        await updateRoomInSupabase(currentActiveRoomId, { current_index: currentMediaIndex + 1 });
        await syncActiveRoomState();
    }
}
async function prevTrack() {
    if (currentMediaIndex > 0 && currentActiveRoomId) {
        await updateRoomInSupabase(currentActiveRoomId, { current_index: currentMediaIndex - 1 });
        await syncActiveRoomState();
    }
}

function updatePlayerDisplay() {
    if (mediaQueue.length === 0) return;
    const track = mediaQueue[currentMediaIndex] || mediaQueue[0];
    document.getElementById('audio-title').textContent = track.title;
}

function renderQueueList() {
    const container = document.getElementById('queue-list-container');
    if (!container) return;
    if (mediaQueue.length === 0) { container.innerHTML = `<div class="queue-item">Очередь пуста</div>`; return; }
    container.innerHTML = '';
    mediaQueue.forEach((t, idx) => {
        const item = document.createElement('div');
        item.className = idx === currentMediaIndex ? 'queue-item playing' : 'queue-item';
        item.innerHTML = `<span>${idx + 1}. ${escapeHtml(t.title)}</span> ${idx === currentMediaIndex ? '<b>(Играет)</b>' : ''}`;
        container.appendChild(item);
    });
}

async function addVideoToQueue() {
    const input = document.getElementById('video-input');
    const val = input.value.trim();
    if (!val || !currentActiveRoomId) return;

    const updatedQueue = [...mediaQueue, { title: val }];
    input.value = '';
    await updateRoomInSupabase(currentActiveRoomId, { media_queue: updatedQueue, video_time: 0, is_playing: true });
    await syncActiveRoomState();
}
function handleVideoTrackKeyPress(event) { if (event.key === 'Enter') addVideoToQueue(); }

async function nextVideo() {
    if (currentMediaIndex < mediaQueue.length - 1 && currentActiveRoomId) {
        await updateRoomInSupabase(currentActiveRoomId, { current_index: currentMediaIndex + 1, video_time: 0, is_playing: true });
        await syncActiveRoomState();
    }
}
async function prevVideo() {
    if (currentMediaIndex > 0 && currentActiveRoomId) {
        await updateRoomInSupabase(currentActiveRoomId, { current_index: currentMediaIndex - 1, video_time: 0, is_playing: true });
        await syncActiveRoomState();
    }
}

function getYouTubeEmbedUrl(url, startSec = 0, playing = true) {
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    let match = url.match(regExp);
    if (match && match[2].length === 11) {
        let startTime = Math.floor(startSec);
        return `https://www.youtube.com/embed/${match[2]}?autoplay=${playing ? 1 : 0}&start=${startTime}`;
    }
    return null;
}

async function toggleVideoPlay() {
    if (!currentActiveRoomId) return;
    const isHost = (currentRoomHost === currentUserName) || isModModeActive;
    if (!isHost) {
        alert("⚠️ Управлять воспроизведением может только хост комнаты!");
        return;
    }
    const newPlayingState = !isVideoPlaying;
    isVideoPlaying = newPlayingState;
    await updateRoomInSupabase(currentActiveRoomId, { is_playing: newPlayingState, video_time: videoCurrentTime });
    
    const playBtn = document.getElementById('video-play-btn');
    if (playBtn) playBtn.textContent = newPlayingState ? '⏸' : '▶';
}

function syncVideoPlayerDisplay(room) {
    if (mediaQueue.length === 0) return;
    const video = mediaQueue[currentMediaIndex] || mediaQueue[0];
    document.getElementById('video-room-title-text').textContent = video.title;

    const screenDiv = document.getElementById('video-screen-container');
    if (!screenDiv) return;

    const isHost = (currentRoomHost === currentUserName) || isModModeActive;

    if (isHost) {
        if (isVideoPlaying) {
            videoCurrentTime += 3; // хост инкрементирует таймкод каждую сессию опроса
        }
        // Хост отправляет таймкод в базу
        if (currentActiveRoomId) {
            updateRoomInSupabase(currentActiveRoomId, { video_time: videoCurrentTime, is_playing: isVideoPlaying });
        }
    } else {
        // Зритель синхронизирует таймкод и паузу с хостом из базы
        videoCurrentTime = room.video_time || 0;
        isVideoPlaying = room.is_playing !== false;
    }

    const playBtn = document.getElementById('video-play-btn');
    if (playBtn) playBtn.textContent = isVideoPlaying ? '⏸' : '▶';

    const embedUrl = getYouTubeEmbedUrl(video.title, videoCurrentTime, isVideoPlaying);
    
    // Перезагружаем плеер при смене видео или сильном расхождении таймкода / статуса
    const cacheKey = `${video.title}_${Math.floor(videoCurrentTime / 6)}_${isVideoPlaying}`;
    if (lastRenderedVideoUrl === cacheKey) return;
    lastRenderedVideoUrl = cacheKey;

    if (embedUrl) {
        screenDiv.innerHTML = `<iframe src="${embedUrl}" style="width:100%; height:100%; border:none; border-radius:10px;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        screenDiv.innerHTML = `<div class="video-placeholder-art">🎬</div><div style="font-size:11px; color:#b873e8; cursor:pointer;" onclick="window.open('${video.title}', '_blank')">▶ Открыть ссылку</div>`;
    }
}

function renderVideoQueueList() {
    const container = document.getElementById('video-queue-list-container');
    if (!container) return;
    if (mediaQueue.length === 0) { container.innerHTML = `<div class="queue-item">Очередь пуста</div>`; return; }
    container.innerHTML = '';
    mediaQueue.forEach((v, idx) => {
        const item = document.createElement('div');
        item.className = idx === currentMediaIndex ? 'queue-item playing' : 'queue-item';
        item.innerHTML = `<span>${idx + 1}. ${escapeHtml(v.title)}</span> ${idx === currentMediaIndex ? '<b>(Смотрим)</b>' : ''}`;
        container.appendChild(item);
    });
}

// ================= ОТПРАВКА СООБЩЕНИЙ В ЧАТ =================
async function sendMessage() {
    if (isChatMuted || !currentActiveRoomId) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text === '') return;

    if (checkAdminCommand(text)) {
        input.value = '';
        return;
    }

    input.value = '';
    const updatedMessages = [...roomMessages, {
        uid: currentUserId,
        author: currentUserName,
        color: currentNicknameColor,
        text: text
    }];
    await updateRoomInSupabase(currentActiveRoomId, { messages: updatedMessages });
    await syncActiveRoomState();
}
function handleKeyPress(event) { if (event.key === 'Enter') sendMessage(); }

async function sendVideoMessage() {
    if (isChatMuted || !currentActiveRoomId) return;
    const input = document.getElementById('video-chat-input');
    const text = input.value.trim();
    if (text === '') return;

    if (checkAdminCommand(text)) {
        input.value = '';
        return;
    }

    input.value = '';
    const updatedMessages = [...roomMessages, {
        uid: currentUserId,
        author: currentUserName,
        color: currentNicknameColor,
        text: text
    }];
    await updateRoomInSupabase(currentActiveRoomId, { messages: updatedMessages });
    await syncActiveRoomState();
}
function handleVideoKeyPress(event) { if (event.key === 'Enter') sendVideoMessage(); }

// ================= СИСТЕМА ДРУЗЕЙ И МОДЕРАЦИЯ =================
async function fetchRequestsFromSupabase() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/friend_requests?target_id=eq.${currentUserId}&select=*`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
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
    if (!val || isNaN(val)) { alert("⚠️ Введите корректный числовой ID друга!"); return; }
    if (Number(val) === Number(currentUserId)) { alert("⛔ Нельзя добавить себя!"); return; }

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/friend_requests`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ sender_id: currentUserId, sender_name: currentUserName, target_id: Number(val) })
        });
        alert("📨 Заявка в друзья отправлена!");
        input.value = '';
    } catch (e) { alert("Ошибка отправки."); }
}

function updateNotifBadge() {
    const count = pendingFriendRequests.length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'block' : 'none';
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
    alert("✨ Друг добавлен!");
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
    if (saved) { try { friendsList = JSON.parse(saved); } catch(e) { friendsList = []; } }
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
        alert("📨 Жалоба отправлена администраторам!");
    } catch (e) { alert("Ошибка при отправке жалобы."); }
}

async function reportUserProfile() {
    const reason = prompt("⚠️ Укажите причину жалобы на этого пользователя:");
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
                room_name: "Профиль пользователя",
                host_name: targetPunishUserName,
                reporter_id: currentUserId,
                reporter_name: currentUserName,
                reason: `Жалоба на пользователя: ${reason}`,
                created_at: Date.now()
            })
        });
        alert("📨 Жалоба на профиль отправлена администрации!");
    } catch (e) { alert("Ошибка при отправке жалобы."); }
}

function openPunishMenu(type) {
    if (isOwner(targetPunishUserId)) { alert("⛔ Владелец неприкосновенен!"); return; }
    document.getElementById('punish-modal-title').textContent = type === 'mute' ? `Мут для ${targetPunishUserName}` : `Бан для ${targetPunishUserName}`;
    document.getElementById('punish-modal').style.display = 'flex';
}

function applyPunishment(durationKey) {
    if (isOwner(targetPunishUserId)) { document.getElementById('punish-modal').style.display = 'none'; return; }
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
        alert(`✅ Пользователь #${targetId} разблокирован!`);
        return true;
    }
    return false;
}

function switchRoomTab(tabName) {
    const playerPane = document.getElementById('room-player-pane');
    const chatPane = document.getElementById('room-chat-pane');
    const tabs = document.querySelectorAll('.inner-tab');
    tabs.forEach(btn => btn.classList.remove('active'));
    if (tabName === 'player') {
        playerPane.classList.add('active'); chatPane.classList.remove('active'); tabs[0].classList.add('active');
    } else {
        chatPane.classList.add('active'); playerPane.classList.remove('active'); tabs[1].classList.add('active');
    }
}

function togglePlay() {
    const vinyl = document.getElementById('vinyl');
    const playBtn = document.getElementById('play-btn');
    vinyl.classList.toggle('paused');
    playBtn.textContent = vinyl.classList.contains('paused') ? '▶' : '⏸';
}

// Управление профилем
function updateProfileName(newName) {
    currentUserName = newName.trim() || 'Без имени';
    saveUserProfileToStorage();
    updateHeaderUI();
}

function updateProfileStatus(newStatus) {
    currentUserStatus = newStatus.trim();
    saveUserProfileToStorage();
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

function openUserProfileCard(userId, userName) {
    targetPunishUserId = userId;
    targetPunishUserName = userName;
    document.getElementById('other-user-name').textContent = userName;
    document.getElementById('other-user-id').textContent = `#lure_${userId} 📋`;
    document.getElementById('other-user-status').textContent = "в сети • вайб в гармонии";

    const isUserOwner = isOwner(userId);
    const otherCrown = document.getElementById('other-user-crown');
    if (isUserOwner) {
        otherCrown.style.display = 'block';
    } else {
        otherCrown.style.display = 'none';
    }
    
    const punishBox = document.getElementById('admin-punish-container');
    if (isAdmin(currentUserId) && !isOwner(userId)) {
        punishBox.style.display = 'flex';
    } else {
        punishBox.style.display = 'none';
    }
    switchMainTab('other-profile');
}

function closeNotificationsModalDirect() { document.getElementById('notifications-modal').style.display = 'none'; }
function closeNotificationsModal(event) { if (event.target.id === 'notifications-modal') document.getElementById('notifications-modal').style.display = 'none'; }

function openInviteModal() { document.getElementById('invite-modal').style.display = 'flex'; }
function closeInviteModalDirect() { document.getElementById('invite-modal').style.display = 'none'; }
function closeInviteModal(event) { if (event.target.id === 'invite-modal') document.getElementById('invite-modal').style.display = 'none'; }

function openCreateModal() { if (!isBannedUser) document.getElementById('create-modal').style.display = 'flex'; }
function closeCreateModalDirect() { document.getElementById('create-modal').style.display = 'none'; }
function closeCreateModal(event) { if (event.target.id === 'create-modal') document.getElementById('create-modal').style.display = 'none'; }

function closePunishModalDirect() { document.getElementById('punish-modal').style.display = 'none'; }
function closePunishModal(event) { if (event.target.id === 'punish-modal') document.getElementById('punish-modal').style.display = 'none'; }

function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}