// ================= НАСТРОЙКИ СУПЕРБЕЙС И АДМИНИСТРИРОВАНИЯ =================
const OWNER_ID = 8982002623; // Твой главный цифровой ID
const ADMIN_IDS = []; 

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

let roomMembers = [];
let roomMessages = [];
let mediaQueue = [];
let currentMediaIndex = 0;
let isVideoPlaying = true;
let videoCurrentTime = 0;

let ytPlayer = null;
let isApiReady = false;

window.onYouTubeIframeAPIReady = function() {
    isApiReady = true;
};

window.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.expand();
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            currentUserName = tg.initDataUnsafe.user.first_name || "Пользователь";
            currentUserId = tg.initDataUnsafe.user.id;
            
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

function updateProfileName(newName) {
    currentUserName = newName.trim() || 'Без имени';
    saveUserProfileToStorage();
    updateHeaderUI();
}

function updateProfileStatus(newStatus) {
    currentUserStatus = newStatus.trim();
    saveUserProfileToStorage();
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

async function syncAllData() {
    await fetchRoomsFromSupabase();
    await fetchRequestsFromSupabase();
    await fetchFriendsFromSupabase();
    if (currentActiveRoomId) {
        await syncActiveRoomState();
        // Хост пингует комнату, показывая, что он в сети
        if (currentRoomHost === currentUserName) {
            await updateRoomInSupabase(currentActiveRoomId, { last_ping: Date.now() });
        }
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

        // Автоудаление комнат, если хост вышел из приложения (нет пинга > 30 сек)
        for (const room of data) {
            const lastPing = room.last_ping || room.created_at;
            const membersCount = Array.isArray(room.members) ? room.members.length : 0;
            if (membersCount === 0 || (now - lastPing > 30000)) {
                await deleteRoomFromSupabase(room.id);
            }
        }

        activeRooms = data.filter(room => room.members && room.members.length > 0);
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
        if (!res.ok) return false;
        await fetchRoomsFromSupabase();
        return true;
    } catch (e) {
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
            last_ping: Date.now(),
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
            syncVideoPlayerWithApi(room);
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
        // Передаем полную информацию о пользователе при клике в чате
        html += `<div class="chat-msg"><div><span class="author" style="color: ${color};" onclick="openUserProfileCard('${msg.uid}', '${safeName}', '${encodeURIComponent(msg.avatar || '👤')}', '${encodeURIComponent(msg.status || '')}')">${safeName}:</span> ${safeText}</div></div>`;
    });

    if (container.innerHTML !== html) {
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
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

async function closeRoomAsHost() {
    if (currentActiveRoomId) {
        await deleteRoomFromSupabase(currentActiveRoomId);
    }
    closeRoom(true);
}

async function closeRoom(skipRemoveMember = false) {
    if (ytPlayer && typeof ytPlayer.destroy === 'function') {
        try { ytPlayer.destroy(); } catch(e) {}
        ytPlayer = null;
    }

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
    document.getElementById('room-view').classList.remove('active');
    document.getElementById('video-room-view').classList.remove('active');
    document.getElementById('menu-view').classList.add('active');
    document.getElementById('main-nav').style.display = 'flex';
    fetchRoomsFromSupabase();
}

// ================= МОДАЛКА УЧАСТНИКОВ (КНОПКА КИК ДЛЯ ХОСТА) =================
function openMembersModal() {
    const container = document.getElementById('members-list-container');
    if (!container) return;

    if (roomMembers.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center;">В комнате никого нет</div>`;
    } else {
        container.innerHTML = '';
        const isHost = (currentRoomHost === currentUserName) || isModModeActive;
        const isUserAdminOrOwner = isAdmin(currentUserId);

        roomMembers.forEach(m => {
            const isMe = Number(m.id) === Number(currentUserId);
            const row = document.createElement('div');
            row.className = 'modal-member-row';
            
            const avaStyle = m.avatar && m.avatar.startsWith('http') ? `background-image: url('${m.avatar}');` : '';
            const avaText = m.avatar && m.avatar.startsWith('http') ? '' : (m.avatar || '👤');

            let buttonsHtml = '';
            // Кнопка профиля передает актуальные данные участника
            buttonsHtml += `<button class="modal-btn-action" onclick="openUserProfileCard('${m.id}', '${escapeHtml(m.name)}', '${encodeURIComponent(m.avatar || '👤')}', '${encodeURIComponent(m.status || '')}'); closeMembersModalDirect();">Профиль</button>`;
            
            if (!isMe) {
                // У хоста или админа всегда есть кнопка кика (не работает только на владельце)
                if ((isHost || isUserAdminOrOwner) && !isOwner(m.id)) {
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

// ================= СИСТЕМА ДРУЗЕЙ И УВЕДОМЛЕНИЙ =================
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

async function fetchFriendsFromSupabase() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/friends?or=(user_id.eq.${currentUserId},friend_id.eq.${currentUserId})&select=*`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (res.ok) {
            const data = await res.json();
            let map = new Map();
            data.forEach(f => {
                const isMeUser = Number(f.user_id) === Number(currentUserId);
                const friendId = isMeUser ? f.friend_id : f.user_id;
                const friendName = isMeUser ? f.friend_name : f.user_name;
                map.set(friendId, { id: friendId, name: friendName });
            });
            friendsList = Array.from(map.values());
            renderFriendsList();
        }
    } catch(e) {}
}

async function addFriendAction() {
    const input = document.getElementById('add-friend-input');
    const val = input.value.trim().replace('#lure_', '');
    let targetDigitalId = Number(val);
    if (val === "1") targetDigitalId = Number(OWNER_ID);

    if (!targetDigitalId || isNaN(targetDigitalId)) { alert("⚠️ Введите корректный ID друга!"); return; }
    if (targetDigitalId === Number(currentUserId)) { alert("⛔ Нельзя добавить себя!"); return; }

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/friend_requests`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ sender_id: currentUserId, sender_name: currentUserName, target_id: targetDigitalId })
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
            const card = document.createElement('div');
            card.className = 'notification-card';
            card.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">👥 Заявка в друзья</span>
                </div>
                <div class="notification-sub">${escapeHtml(req.sender_name)} хочет дружить (#lure_${req.sender_id === Number(OWNER_ID) ? 1 : req.sender_id})</div>
                <div class="notification-actions">
                    <button class="notif-btn-accept" onclick="acceptFriend(${req.sender_id}, '${escapeHtml(req.sender_name)}', ${req.id})">Принять</button>
                    <button class="notif-btn-decline" onclick="declineFriend(${req.id})">✕</button>
                </div>
            `;
            container.appendChild(card);
        });
    }
    document.getElementById('notifications-modal').style.display = 'flex';
}

async function acceptFriend(senderId, senderName, reqId) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/friends`, {
            method: 'POST',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                user_id: currentUserId,
                friend_id: senderId,
                friend_name: senderName,
                user_name: currentUserName
            })
        });
    } catch(e) {}

    await fetch(`${SUPABASE_URL}/rest/v1/friend_requests?id=eq.${reqId}`, {
        method: 'DELETE',
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
    });

    fetchRequestsFromSupabase();
    fetchFriendsFromSupabase();
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
    fetchFriendsFromSupabase();
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
        const displayId = Number(friend.id) === Number(OWNER_ID) ? "1" : friend.id;
        
        item.onclick = () => {
            openUserProfileCard(friend.id, friend.name);
        };

        item.innerHTML = `
            <div style="width: 32px; height: 32px; background: #3c124a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>
            <div class="room-info" style="flex: 1;">
                <div class="room-name">${escapeHtml(friend.name)}</div>
                <div class="room-track">ID: #lure_${displayId}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

// ================= АУДИО И ВИДЕО ПЛЕЕРЫ =================
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

function extractYouTubeId(url) {
    if (!url) return null;
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    let match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function addVideoToQueue() {
    const input = document.getElementById('video-input');
    const val = input.value.trim();
    if (!val || !currentActiveRoomId) return;

    const updatedQueue = [...mediaQueue, { title: val }];
    input.value = '';
    await updateRoomInSupabase(currentActiveRoomId, { media_queue: updatedQueue, current_index: mediaQueue.length, video_time: 0, is_playing: true });
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

async function toggleVideoPlay() {
    const isHost = (currentRoomHost === currentUserName) || isModModeActive;
    if (!isHost) {
        alert("⚠️ Управлять воспроизведением может только хост комнаты!");
        return;
    }
    if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;

    const state = ytPlayer.getPlayerState();
    let newPlaying = (state !== 1); 
    let currentTime = 0;
    try { currentTime = ytPlayer.getCurrentTime() || 0; } catch(e) {}

    if (newPlaying) ytPlayer.playVideo();
    else ytPlayer.pauseVideo();

    if (currentActiveRoomId) {
        await updateRoomInSupabase(currentActiveRoomId, { is_playing: newPlaying, video_time: currentTime });
    }
}

function syncVideoPlayerWithApi(room) {
    if (mediaQueue.length === 0) {
        document.getElementById('video-room-title-text').textContent = "Видео не выбрано";
        return;
    }

    const video = mediaQueue[currentMediaIndex] || mediaQueue[0];
    document.getElementById('video-room-title-text').textContent = video.title;

    const videoId = extractYouTubeId(video.title);
    const isHost = (currentRoomHost === currentUserName) || isModModeActive;

    document.getElementById('video-control-status').textContent = isHost ? "Управляете вы (Хост)" : `Хост: ${currentRoomHost}`;

    const playBtn = document.getElementById('video-play-btn');
    if (playBtn) playBtn.textContent = room.is_playing ? '⏸' : '▶';

    if (!videoId) {
        document.getElementById('youtube-player-box').innerHTML = `<div style="font-size:11px; color:#b873e8; cursor:pointer; text-align:center; padding:20px;" onclick="window.open('${escapeHtml(video.title)}', '_blank')">▶ Открыть ссылку в браузере</div>`;
        return;
    }

    if (isApiReady) {
        if (!ytPlayer) {
            const container = document.getElementById('youtube-player-box');
            container.innerHTML = '<div id="actual-yt-iframe"></div>';

            ytPlayer = new YT.Player('actual-yt-iframe', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 'autoplay': 1, 'controls': isHost ? 1 : 0, 'modestbranding': 1 },
                events: {
                    'onReady': (event) => {
                        if (!isHost) event.target.mute();
                        event.target.seekTo(room.video_time || 0, true);
                        if (room.is_playing) event.target.playVideo();
                        else event.target.pauseVideo();
                    }
                }
            });
        } else {
            try {
                const currentUrl = ytPlayer.getVideoUrl ? ytPlayer.getVideoUrl() : '';
                if (!currentUrl.includes(videoId)) {
                    ytPlayer.loadVideoById({ videoId: videoId, startSeconds: room.video_time || 0 });
                } else {
                    if (!isHost) {
                        const localTime = ytPlayer.getCurrentTime() || 0;
                        const targetTime = room.video_time || 0;
                        if (Math.abs(localTime - targetTime) > 2.0) {
                            ytPlayer.seekTo(targetTime, true);
                        }
                        const state = ytPlayer.getPlayerState();
                        if (room.is_playing && state !== 1) ytPlayer.playVideo();
                        else if (!room.is_playing && state === 1) ytPlayer.pauseVideo();
                    } else {
                        const hostTime = ytPlayer.getCurrentTime() || 0;
                        const state = ytPlayer.getPlayerState();
                        const isPlayingNow = (state === 1 || state === 3);
                        if (currentActiveRoomId) {
                            updateRoomInSupabase(currentActiveRoomId, { video_time: hostTime, is_playing: isPlayingNow });
                        }
                    }
                }
            } catch(e) {}
        }
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

// ================= ЧАТ И ЖАЛОБЫ =================
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
        avatar: currentUserAvatar,
        status: currentUserStatus,
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
        avatar: currentUserAvatar,
        status: currentUserStatus,
        text: text
    }];
    await updateRoomInSupabase(currentActiveRoomId, { messages: updatedMessages });
    await syncActiveRoomState();
}
function handleVideoKeyPress(event) { if (event.key === 'Enter') sendVideoMessage(); }

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

function openUserProfileCard(userId, userName, encodedAvatar = '', encodedStatus = '') {
    targetPunishUserId = userId;
    targetPunishUserName = userName;
    document.getElementById('other-user-name').textContent = userName;
    
    const displayId = Number(userId) === Number(OWNER_ID) ? "1" : userId;
    document.getElementById('other-user-id').textContent = `#lure_${displayId} 📋`;
    
    // Декодируем переданный статус и аватарку или берем из localStorage
    let decodedStatus = encodedStatus ? decodeURIComponent(encodedStatus) : (localStorage.getItem(`lure_status_${userId}`) || "");
    let decodedAvatar = encodedAvatar ? decodeURIComponent(encodedAvatar) : "🦇";

    document.getElementById('other-user-status').textContent = decodedStatus || "не указан";

    const avaContainer = document.getElementById('other-user-ava');
    if (decodedAvatar.startsWith('http')) {
        avaContainer.style.backgroundImage = `url('${decodedAvatar}')`;
        avaContainer.textContent = '';
    } else {
        avaContainer.style.backgroundImage = 'none';
        avaContainer.textContent = decodedAvatar;
    }

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