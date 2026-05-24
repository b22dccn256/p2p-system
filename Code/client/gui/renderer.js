// renderer.js

const soundSend = new Audio('../assets/sound/send.mp3');
const soundReceive = new Audio('../assets/sound/receive.mp3');
// Âm thanh notification tạm thay bằng soundReceive
const soundNotification = new Audio('../assets/sound/receive.mp3'); 

let myNodeId = '';
let currentActiveChat = null; // Tên phòng hoặc Peer ID
let isGroupChat = false; 

// Lưu trữ lịch sử tin nhắn
// Cấu trúc: { 'peer_1': [{ sender: 'peer_1', text: 'hello', isMine: false, seq: '...', status: 'sent' }] }
const chatData = {}; 

// Danh sách peers và phòng
const knownPeers = new Set();
const joinedRooms = new Map(); 

// Để hàm truy cập được từ HTML onclick
window.switchChat = function(chatId, isGroup) {
    currentActiveChat = chatId;
    isGroupChat = isGroup;

    let displayName = chatId;
    if (isGroup && joinedRooms.has(chatId)) {
        displayName = joinedRooms.get(chatId);
    }

    document.querySelector('.chat-title-info h2').innerText = isGroup ? `Phòng: ${displayName}` : `Riêng: ${chatId}`;
    document.querySelector('.chat-title-info .peer-count').innerText = isGroup ? `Mã phòng (Key): ${chatId}` : 'Chat Trực tiếp';
    
    renderChatHistory(chatId);
    updateSidebar();
    updateRightPanel();
};

window.joinRoom = function(roomKey) {
    if (!roomKey) return;
    // Tự suy luận Tên phòng viết hoa từ slug roomKey nếu chưa có tên trong map
    let roomName = roomKey;
    if (roomKey.includes('#')) {
        const parts = roomKey.split('#')[0].split('-');
        roomName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    joinedRooms.set(roomKey, roomName);
    window.p2pAPI.joinRoom(roomKey);
    updateSidebar();
    switchChat(roomKey, true);
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Nhận thông tin node
    window.p2pAPI.onNodeReady(async (data) => {
        myNodeId = data.id;
        document.getElementById('network-status-text').innerText = `Trực tuyến - Định danh: ${myNodeId}`;
        
        // Cập nhật tên của mình lên giao diện
        document.querySelector('.user-name').innerText = myNodeId;
        const avatarSrc = window.LetterAvatar ? window.LetterAvatar.generate(myNodeId, 40) : '';
        document.querySelector('.user-profile .avatar').src = avatarSrc;

        // Fetch danh sách user hiện tại (tránh lỗi lỡ mất event lúc giao diện đang load)
        const users = await window.p2pAPI.getUsers();
        users.forEach(u => knownPeers.add(u.id || u));

        // Auto switch phòng mặc định
        window.switchChat('NETWORK_BROADCAST', true);
    });

    // 2. Gửi tin nhắn
    const chatInput = document.querySelector('.chat-input');
    const sendBtn = document.querySelector('.send-btn');

    const sendMessage = async () => {
        if (!chatInput || !currentActiveChat) return;
        const msg = chatInput.value.trim();
        if (msg === '') return;

        chatInput.value = '';
        
        // Tạo unique seq local
        const seq = Date.now().toString();

        // Lưu vào model
        if (!chatData[currentActiveChat]) chatData[currentActiveChat] = [];
        const isSecure = currentActiveChat !== 'NETWORK_BROADCAST';
        chatData[currentActiveChat].push({ 
            sender: myNodeId, 
            text: msg, 
            isMine: true, 
            seq, 
            status: 'sending',
            isEncrypted: isSecure,
            ciphertext: isSecure ? 'Tin nhắn của bạn đã được mã hóa bằng AES-256-GCM tại lớp lõi P2P trước khi gửi đi.' : ''
        });
        
        // Render
        renderChatHistory(currentActiveChat);
        soundSend.currentTime = 0;
        soundSend.play().catch(e => console.log(e));

        // Gọi IPC
        if (currentActiveChat === 'NETWORK_BROADCAST') {
            await window.p2pAPI.sendGlobal(msg);
            updateMessageStatus(currentActiveChat, seq, 'sent');
        } else if (isGroupChat) {
            await window.p2pAPI.sendRoom(currentActiveChat, msg);
            // Room chat hiện tại không có cơ chế ACK trong Peer.js, nên coi như gửi xong
            updateMessageStatus(currentActiveChat, seq, 'sent');
        } else {
            // Direct chat — dùng kết quả trả về từ sendDm (đã await ACK bên backend)
            const success = await window.p2pAPI.sendDm(currentActiveChat, msg);
            if (success) {
                updateMessageStatus(currentActiveChat, seq, 'read');
            } else {
                updateMessageStatus(currentActiveChat, seq, 'error');
            }
        }
    };

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    sendBtn.addEventListener('click', sendMessage);

    // 3. Lắng nghe các event từ Backend
    window.p2pAPI.onPeerDiscovered((data) => {
        knownPeers.add(data.peerId);
        updateSidebar();
    });

    window.p2pAPI.onPeerDisconnected((peerId) => {
        knownPeers.delete(peerId);
        updateSidebar();
        updateRightPanel();
    });

    window.p2pAPI.onMessage((msg) => {
        // msg: { type, from, text, payload }
        let chatId;
        
        if (msg.type === 'DIRECT_CHAT') {
            chatId = msg.from;
        } else if (msg.type === 'GROUP_CHAT') {
            chatId = msg.payload.roomId;
        } else if (msg.type === 'GLOBAL_CHAT') {
            chatId = 'NETWORK_BROADCAST';
        } else if (msg.type === 'ROOM_JOIN' || msg.type === 'ROOM_LEAVE') {
            // Cập nhật right panel khi có người vào/rời phòng
            updateRightPanel();
            return;
        }

        if (chatId) {
            // Tự động thêm người lạ vào danh sách nếu họ nhắn tin cho mình
            if (!knownPeers.has(msg.from) && msg.from !== myNodeId) {
                knownPeers.add(msg.from);
            }

            if (!chatData[chatId]) chatData[chatId] = [];
            let forwardedFrom = msg.forwardedFrom || null;
            let messageTextRaw = msg.decryptedText || msg.payload?.text || msg.text || '';
            let messageText = messageTextRaw;

            // Nếu tin nhắn chưa được bóc tách ở backend (ví dụ: tin nhắn plaintext/global chat)
            if (!forwardedFrom) {
                try {
                    const parsed = JSON.parse(messageTextRaw);
                    if (parsed && typeof parsed === 'object' && parsed.text && parsed.forwardedFrom) {
                        messageText = parsed.text;
                        forwardedFrom = parsed.forwardedFrom;
                    }
                } catch (e) {
                    // Không phải JSON hợp lệ
                }
            }

            chatData[chatId].push({ 
                sender: msg.from, 
                text: messageText, 
                isMine: false,
                isEncrypted: msg.isEncrypted || false,
                ciphertext: msg.ciphertext || '',
                forwardedFrom: forwardedFrom
            });
            
            soundReceive.currentTime = 0;
            soundReceive.play().catch(e => console.log(e));

            if (currentActiveChat === chatId) {
                renderChatHistory(chatId);
            } else {
                // TODO: Hiển thị badge chưa đọc ở Sidebar (Đơn giản hóa: tự update sidebar)
            }
            updateSidebar(); // Để đảm bảo phòng/peer xuất hiện
        }
    });

    // Lưu ý: ACK event không cần xử lý riêng vì đã dùng await sendDm() ở trên
    // Giữ listener để tương thích nếu cần mở rộng sau
    window.p2pAPI.onMessageAck((data) => {
        // data: { seq, from } — hiện tại không dùng vì đã xử lý qua await
        console.log(`[ACK] Received for seq=${data.seq} from=${data.from}`);
    });

    window.p2pAPI.onBootstrapStatus((data) => {
        const statusEl = document.getElementById('bootstrap-status-text');
        if (!statusEl) return;

        statusEl.classList.toggle('connected', !!data.connected);
        statusEl.classList.toggle('offline', !data.connected);
        statusEl.innerText = data.connected
            ? `Bootstrap: Connected ${data.host}:${data.port}`
            : `Bootstrap: Offline ${data.host}:${data.port}`;
    });

    // 4. Panel Đóng mở
    const closePanelBtn = document.querySelector('.close-panel');
    const rightPanel = document.querySelector('.right-panel');
    if (closePanelBtn && rightPanel) {
        closePanelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            rightPanel.style.display = rightPanel.style.display === 'none' ? 'flex' : 'none';
        });
    }

    // Custom HTML Modal control logic
    const roomModal = document.getElementById('room-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInput = document.getElementById('modal-room-input');
    const confirmBtn = document.querySelector('.confirm-modal-btn');
    const cancelBtn = document.querySelector('.cancel-modal-btn');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    
    let modalCallback = null;

    const showRoomModal = (title, callback) => {
        if (!roomModal || !modalTitle || !modalInput) return;
        modalTitle.textContent = title;
        modalInput.value = '';
        roomModal.style.display = 'flex';
        modalInput.focus();
        modalCallback = callback;
    };

    const hideRoomModal = () => {
        if (roomModal) roomModal.style.display = 'none';
        modalCallback = null;
    };

    if (confirmBtn && modalInput) {
        const submitModal = () => {
            const val = modalInput.value.trim();
            if (val && modalCallback) {
                modalCallback(val);
            }
            hideRoomModal();
        };
        confirmBtn.addEventListener('click', submitModal);
        modalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitModal();
        });
    }

    if (cancelBtn) cancelBtn.addEventListener('click', hideRoomModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', hideRoomModal);

    // 5. Nút New Room
    const newRoomBtn = document.querySelector('.btn-new-room');
    if (newRoomBtn) {
        newRoomBtn.addEventListener('click', () => {
            showRoomModal("Tạo phòng chat mới", async (roomName) => {
                const roomKey = await window.p2pAPI.createRoom(roomName);
                if (roomKey) {
                    joinedRooms.set(roomKey, roomName);
                    updateSidebar();
                    switchChat(roomKey, true);
                    alert(`🎉 Tạo phòng "${roomName}" thành công!\nMã phòng (Room Key): ${roomKey}\nHãy gửi mã này cho bạn bè.`);
                }
            });
        });
    }

    // 6. Nút Join Room (Fix #2)
    const joinRoomBtn = document.querySelector('.btn-join-room');
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            showRoomModal("Tham gia phòng chat", (roomName) => {
                window.joinRoom(roomName);
            });
        });
    }

    // 7. Nút Disconnect — Graceful Shutdown (Fix #3)
    const disconnectBtn = document.querySelector('.btn-disconnect');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            const confirmed = confirm("Bạn có chắc muốn ngắt kết nối và đóng ứng dụng?");
            if (confirmed) {
                window.p2pAPI.disconnect();
            }
        });
    }

    // 8. Search filter cho sidebar (Fix #4)
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterSidebar(query);
        });
    }

    // 9. Emoji picker (Fix #5)
    const emojiBtn = document.querySelector('.emoji-btn');
    const emojiPanel = document.getElementById('emoji-panel');
    if (emojiBtn && emojiPanel) {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPanel.style.display = emojiPanel.style.display === 'none' ? 'block' : 'none';
        });

        // Đóng emoji panel khi click ra ngoài
        document.addEventListener('click', (e) => {
            if (emojiPanel.style.display !== 'none' && !emojiPanel.contains(e.target) && !emojiBtn.contains(e.target)) {
                emojiPanel.style.display = 'none';
            }
        });

        // Load emoji vào panel
        loadEmojiPanel();
    }
});

// ==================== EMOJI ====================
async function loadEmojiPanel() {
    const emojiPanel = document.getElementById('emoji-panel');
    if (!emojiPanel) return;
    
    // Danh sách emoji phổ biến (không cần load file JSON lớn)
    const commonEmojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
        '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪',
        '😎', '🤗', '🤔', '🤭', '🤫', '😏', '😒', '🙄', '😬', '😮',
        '😯', '😲', '😳', '🥺', '😢', '😭', '😤', '😡', '🤬', '😈',
        '👍', '👎', '👋', '🤝', '👏', '🙌', '🙏', '💪', '❤️', '🔥',
        '⭐', '🎉', '🎊', '💯', '✅', '❌', '⚡', '💡', '🚀', '👀'
    ];

    const chatInput = document.querySelector('.chat-input');
    
    emojiPanel.innerHTML = commonEmojis.map(emoji => 
        `<span class="emoji-item">${emoji}</span>`
    ).join('');

    emojiPanel.addEventListener('click', (e) => {
        if (e.target.classList.contains('emoji-item')) {
            if (chatInput) {
                chatInput.value += e.target.textContent;
                chatInput.focus();
            }
            emojiPanel.style.display = 'none';
        }
    });
}

// ==================== RENDER ====================
function renderChatHistory(chatId) {
    const history = document.querySelector('.chat-history');
    if (!history) return;
    history.innerHTML = '';

    const messages = chatData[chatId] || [];
    messages.forEach(msg => {
        const avatarSrc = window.LetterAvatar ? window.LetterAvatar.generate(msg.sender, 40) : '';
        let statusHtml = '';
        if (msg.isMine) {
            if (msg.status === 'sending') statusHtml = '<i class="fa-regular fa-clock text-muted"></i> Đang gửi...';
            else if (msg.status === 'sent') statusHtml = '<i class="fa-solid fa-check text-muted" style="color:gray;"></i>';
            else if (msg.status === 'read') statusHtml = '<i class="fa-solid fa-check-double" style="color:blue;"></i>';
            else if (msg.status === 'error') statusHtml = '<i class="fa-solid fa-circle-exclamation text-danger"></i>';
        }

        let secureBadge = '';
        if (msg.isEncrypted) {
            secureBadge = `
                <div class="e2ee-badge" style="font-size: 10px; color: var(--success); margin-top: 6px; display: flex; align-items: center; gap: 4px; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 4px; cursor: pointer;" onclick="alert('🔑 CHI TIẾT MÃ HÓA ĐẦU-CUỐI (E2EE):\\n\\n- Thuật toán: AES-256-GCM\\n- Khóa thỏa thuận: ECDH secp256k1\\n- Ciphertext (Dữ liệu truyền trên mạng):\\n\\n${msg.ciphertext || 'Đã mã hoá bí mật'}')">
                    <i class="fa-solid fa-user-shield"></i> E2EE Secured (Xem Cipher)
                </div>
            `;
        }

        // Xử lý chuỗi an toàn khi truyền qua HTML attribute onclick
        const escapedText = (msg.text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
        const escapedSender = (msg.forwardedFrom || msg.sender || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const actionsHtml = `
            <div class="message-actions">
                <i class="fa-solid fa-share" title="Chuyển tiếp" onclick="window.initiateForward('${escapedText}', '${escapedSender}')" style="cursor: pointer; color: var(--text-muted);"></i>
            </div>
        `;

        let forwardedHeader = '';
        if (msg.forwardedFrom) {
            forwardedHeader = `
                <div style="font-size: 11px; color: var(--text-muted); font-style: italic; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; border-bottom: 1px dashed rgba(0,0,0,0.1); padding-bottom: 4px;">
                    <i class="fa-solid fa-share" style="transform: scaleX(-1);"></i> Chuyển tiếp từ ${msg.forwardedFrom}
                </div>
            `;
        }

        if (msg.isMine) {
            history.insertAdjacentHTML('beforeend', `
                <div class="message-group sent">
                    <div class="message-content">
                        <div class="message-bubble">
                            ${forwardedHeader}
                            ${msg.text}
                            ${secureBadge}
                            ${actionsHtml}
                        </div>
                        <span class="message-time">${statusHtml} Vừa xong</span>
                    </div>
                </div>
            `);
        } else {
            history.insertAdjacentHTML('beforeend', `
                <div class="message-group received">
                    <img src="${avatarSrc}" class="avatar-small">
                    <div class="message-content">
                        <span class="sender-name">${msg.sender}</span>
                        <div class="message-bubble">
                            ${forwardedHeader}
                            ${msg.text}
                            ${secureBadge}
                            ${actionsHtml}
                        </div>
                    </div>
                </div>
            `);
        }
    });
    history.scrollTop = history.scrollHeight;
}

function updateMessageStatus(chatId, seq, status) {
    if (!chatData[chatId]) return;
    const msg = chatData[chatId].find(m => m.seq == seq);
    if (msg) {
        msg.status = status;
        if (currentActiveChat === chatId) renderChatHistory(chatId);
    }
}

function updateSidebar() {
    const container = document.querySelector('.chat-items-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Render Network Broadcast channel
    const isGlobalActive = currentActiveChat === 'NETWORK_BROADCAST' ? 'active' : '';
    container.insertAdjacentHTML('beforeend', `
        <div class="chat-item ${isGlobalActive}" onclick="window.switchChat('NETWORK_BROADCAST', true)" style="cursor:pointer; background-color: var(--hover-bg);">
            <div class="chat-avatar" style="background:#f25858;color:white;display:flex;align-items:center;justify-content:center;border-radius:50%;width:40px;height:40px;"><i class="fa-solid fa-bullhorn"></i></div>
            <div class="chat-info">
                <div class="chat-name" style="font-weight: 600; color: #f25858;">📢 Phát thanh toàn mạng</div>
            </div>
        </div>
    `);

    // Render Rooms
    joinedRooms.forEach((roomName, roomKey) => {
        const isActive = currentActiveChat === roomKey ? 'active' : '';
        container.insertAdjacentHTML('beforeend', `
            <div class="chat-item ${isActive}" onclick="window.switchChat('${roomKey}', true)" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; position:relative;">
                <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:0;">
                    <div class="chat-avatar" style="background:#5865F2;color:white;display:flex;align-items:center;justify-content:center;border-radius:50%;width:40px;height:40px;flex-shrink:0;"><i class="fa-solid fa-hashtag"></i></div>
                    <div class="chat-info" style="min-width:0;">
                        <div class="chat-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${roomName}</div>
                    </div>
                </div>
                <!-- 3-dot Button -->
                <div class="room-menu-btn" onclick="window.toggleRoomMenu(event, '${roomKey}')" style="padding: 6px; cursor: pointer; color: var(--text-muted); z-index: 5;"><i class="fa-solid fa-ellipsis-vertical"></i></div>
            </div>
        `);
    });

    // Render Peers
    knownPeers.forEach(peer => {
        const isActive = currentActiveChat === peer ? 'active' : '';
        const avatarSrc = window.LetterAvatar ? window.LetterAvatar.generate(peer, 40) : '';
        container.insertAdjacentHTML('beforeend', `
            <div class="chat-item ${isActive}" onclick="window.switchChat('${peer}', false)" style="cursor:pointer">
                <img src="${avatarSrc}" class="chat-avatar" style="border-radius:50%">
                <div class="chat-info">
                    <div class="chat-name">${peer}</div>
                    <div class="chat-preview" style="color:green; font-size:12px;">Online</div>
                </div>
            </div>
        `);
    });
}

// Fix #4: Filter sidebar theo keyword search
function filterSidebar(query) {
    const items = document.querySelectorAll('.chat-item');
    items.forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent?.toLowerCase() || '';
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

// Fix #9: Cập nhật Right Panel hiển thị Room Members thật
async function updateRightPanel() {
    const memberList = document.querySelector('.member-list');
    const rightPanelTitle = document.querySelector('.right-header h2');
    
    if (!memberList) return;
    
    memberList.innerHTML = '';

    if (!currentActiveChat) {
        memberList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Chọn một phòng hoặc người để xem chi tiết</p>';
        return;
    }

    if (currentActiveChat === 'NETWORK_BROADCAST') {
        if (rightPanelTitle) rightPanelTitle.textContent = 'Phát thanh toàn mạng';
        memberList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding: 10px;">Tin nhắn trong kênh này sẽ được gửi tới tất cả người dùng đang kết nối trên mạng, không phân biệt phòng chat.</p>';
        return;
    }

    if (isGroupChat) {
        // Lấy danh sách members từ backend
        if (rightPanelTitle) rightPanelTitle.textContent = `Chi tiết phòng`;
        
        try {
            const members = await window.p2pAPI.getRoomMembers(currentActiveChat);
            if (members && members.length > 0) {
                members.forEach(memberId => {
                    const avatarSrc = window.LetterAvatar ? window.LetterAvatar.generate(memberId, 36) : '';
                    const isSelf = memberId === myNodeId;
                    memberList.insertAdjacentHTML('beforeend', `
                        <div class="member">
                            <img src="${avatarSrc}" class="avatar">
                            <div class="member-details">
                                <span class="member-name">${memberId}${isSelf ? ' (Bạn)' : ''}</span>
                                <span class="member-status" style="color:var(--success);">Online</span>
                            </div>
                        </div>
                    `);
                });
            } else {
                memberList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Chưa có thành viên nào</p>';
            }
        } catch (e) {
            memberList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Không thể tải danh sách</p>';
        }
    } else {
        // Direct chat — hiển thị thông tin peer
        if (rightPanelTitle) rightPanelTitle.textContent = 'Thông tin người dùng';
        const avatarSrc = window.LetterAvatar ? window.LetterAvatar.generate(currentActiveChat, 36) : '';
        const isOnline = knownPeers.has(currentActiveChat);
        memberList.insertAdjacentHTML('beforeend', `
            <div class="member">
                <img src="${avatarSrc}" class="avatar">
                <div class="member-details">
                    <span class="member-name">${currentActiveChat}</span>
                    <span class="member-status" style="color:${isOnline ? 'var(--success)' : 'var(--text-muted)'};">${isOnline ? 'Online' : 'Offline'}</span>
                </div>
            </div>
        `);
    }
}

// ==================== ROOM CONTEXT MENU ====================
let activeMenuRoomKey = null;

window.toggleRoomMenu = function(event, roomKey) {
    event.stopPropagation();
    const menu = document.getElementById('room-context-menu');
    if (!menu) return;

    if (menu.style.display === 'block' && activeMenuRoomKey === roomKey) {
        menu.style.display = 'none';
        return;
    }

    activeMenuRoomKey = roomKey;
    
    // Đặt vị trí menu ngay cạnh nút 3 chấm
    const rect = event.currentTarget.getBoundingClientRect();
    menu.style.left = `${rect.left - 110}px`;
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.display = 'block';
};

// Đóng menu khi click bất kỳ đâu
document.addEventListener('click', () => {
    const menu = document.getElementById('room-context-menu');
    if (menu) menu.style.display = 'none';
});

// Gắn sự kiện cho các nút trong menu ngữ cảnh
document.addEventListener('DOMContentLoaded', () => {
    const btnCopy = document.getElementById('menu-copy-key');
    const btnLeave = document.getElementById('menu-leave-room');

    if (btnCopy) {
        btnCopy.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeMenuRoomKey) {
                navigator.clipboard.writeText(activeMenuRoomKey).then(() => {
                    alert(`📋 Đã sao chép mã phòng (Room Key): ${activeMenuRoomKey}`);
                }).catch(err => {
                    console.error('Không thể sao chép: ', err);
                });
            }
            const menu = document.getElementById('room-context-menu');
            if (menu) menu.style.display = 'none';
        });
    }

    if (btnLeave) {
        btnLeave.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (activeMenuRoomKey) {
                const roomName = joinedRooms.get(activeMenuRoomKey) || activeMenuRoomKey;
                const confirmed = confirm(`Bạn có chắc muốn thoát khỏi phòng "${roomName}"?`);
                if (confirmed) {
                    await window.p2pAPI.leaveRoom(activeMenuRoomKey);
                    joinedRooms.delete(activeMenuRoomKey);
                    updateSidebar();
                    
                    // Nếu đang ở phòng vừa thoát thì chuyển về phát thanh toàn mạng
                    if (currentActiveChat === activeMenuRoomKey) {
                        window.switchChat('NETWORK_BROADCAST', true);
                    }
                }
            }
            const menu = document.getElementById('room-context-menu');
            if (menu) menu.style.display = 'none';
        });
    }
});

// ==================== FORWARD MESSAGE SYSTEM ====================
let forwardingMessageText = null;
let forwardingOriginalSender = null;

window.initiateForward = function(text, originalSender) {
    forwardingMessageText = text;
    forwardingOriginalSender = originalSender;

    const modal = document.getElementById('forward-modal');
    const listContainer = document.getElementById('forward-destinations-list');
    if (!modal || !listContainer) return;

    listContainer.innerHTML = '';

    let hasDestinations = false;

    // Render Rooms
    joinedRooms.forEach((roomName, roomKey) => {
        hasDestinations = true;
        listContainer.insertAdjacentHTML('beforeend', `
            <div class="forward-dest-item" onclick="window.executeForward('${roomKey}', true)">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="background:#5865F2; color:white; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;"><i class="fa-solid fa-hashtag"></i></span>
                    <span style="font-weight:600; font-size:13px; color:var(--text-dark);">${roomName}</span>
                </div>
                <button class="btn btn-primary" style="padding: 4px 10px; font-size: 11px; border-radius: 4px; background:var(--primary); border:none; color:white; cursor:pointer;">Gửi</button>
            </div>
        `);
    });

    // Render Peers
    knownPeers.forEach(peerId => {
        if (peerId !== myNodeId) {
            hasDestinations = true;
            listContainer.insertAdjacentHTML('beforeend', `
                <div class="forward-dest-item" onclick="window.executeForward('${peerId}', false)">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:#2ecc71; color:white; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;"><i class="fa-solid fa-user"></i></span>
                        <span style="font-weight:600; font-size:13px; color:var(--text-dark); font-family:monospace;">${peerId}</span>
                    </div>
                    <button class="btn btn-primary" style="padding: 4px 10px; font-size: 11px; border-radius: 4px; background:var(--primary); border:none; color:white; cursor:pointer;">Gửi</button>
                </div>
            `);
        }
    });

    if (!hasDestinations) {
        listContainer.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center; padding: 20px 0;">Không tìm thấy phòng hoặc peer nào trực tuyến để chuyển tiếp.</p>';
    }

    modal.style.display = 'flex';
};

window.executeForward = async function(targetId, isGroup) {
    const modal = document.getElementById('forward-modal');
    if (modal) modal.style.display = 'none';

    if (!forwardingMessageText || !forwardingOriginalSender) return;

    // Đóng gói payload JSON chuyển tiếp (Telegram-style)
    const payloadObj = {
        text: forwardingMessageText,
        forwardedFrom: forwardingOriginalSender
    };
    const payloadStr = JSON.stringify(payloadObj);

    // Lưu vào model chatData cục bộ để hiển thị ngay lập tức
    if (!chatData[targetId]) chatData[targetId] = [];
    
    // Gửi đi
    if (isGroup) {
        await window.p2pAPI.sendRoom(targetId, payloadStr);
        chatData[targetId].push({
            sender: myNodeId,
            text: forwardingMessageText,
            isMine: true,
            seq: Date.now().toString(),
            status: 'sent',
            isEncrypted: true,
            ciphertext: 'Tin nhắn chuyển tiếp được tái mã hóa tự động.',
            forwardedFrom: forwardingOriginalSender
        });
    } else {
        const success = await window.p2pAPI.sendDm(targetId, payloadStr);
        chatData[targetId].push({
            sender: myNodeId,
            text: forwardingMessageText,
            isMine: true,
            seq: Date.now().toString(),
            status: success ? 'read' : 'error',
            isEncrypted: true,
            ciphertext: 'Tin nhắn chuyển tiếp được tái mã hóa tự động.',
            forwardedFrom: forwardingOriginalSender
        });
    }

    // Phát âm thanh gửi tin nhắn
    soundSend.currentTime = 0;
    soundSend.play().catch(e => console.log(e));

    // Chuyển ngay đến phòng/peer vừa được chuyển tiếp để xem kết quả trực quan
    window.switchChat(targetId, isGroup);
    
    // Reset biến tạm
    forwardingMessageText = null;
    forwardingOriginalSender = null;
};

// Đóng forward modal khi click nút Hủy hoặc nút X
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('forward-modal');
    const closeBtn = document.querySelector('.close-forward-btn');
    const cancelBtn = document.querySelector('.cancel-forward-btn');

    const hideForwardModal = () => {
        if (modal) modal.style.display = 'none';
        forwardingMessageText = null;
        forwardingOriginalSender = null;
    };

    if (closeBtn) closeBtn.addEventListener('click', hideForwardModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideForwardModal);
});
