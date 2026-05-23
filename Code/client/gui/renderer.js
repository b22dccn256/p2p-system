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
const joinedRooms = new Set(['global_room']); 

// Để hàm truy cập được từ HTML onclick
window.switchChat = function(chatId, isGroup) {
    currentActiveChat = chatId;
    isGroupChat = isGroup;

    document.querySelector('.chat-title-info h2').innerText = isGroup ? `Phòng: ${chatId}` : `Riêng: ${chatId}`;
    document.querySelector('.chat-title-info .peer-count').innerText = isGroup ? 'Chat Nhóm' : 'Chat Trực tiếp';
    
    renderChatHistory(chatId);
    updateSidebar();
    updateRightPanel();
};

window.joinRoom = function(roomId) {
    if (!roomId) return;
    joinedRooms.add(roomId);
    window.p2pAPI.joinRoom(roomId);
    updateSidebar();
    switchChat(roomId, true);
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

        // Auto join phòng mặc định
        window.joinRoom('global_room');
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
        chatData[currentActiveChat].push({ sender: myNodeId, text: msg, isMine: true, seq, status: 'sending' });
        
        // Render
        renderChatHistory(currentActiveChat);
        soundSend.currentTime = 0;
        soundSend.play().catch(e => console.log(e));

        // Gọi IPC
        if (isGroupChat) {
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
            const messageText = msg.payload?.text || msg.text;
            chatData[chatId].push({ sender: msg.from, text: messageText, isMine: false });
            
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
            showRoomModal("Tạo phòng chat mới", (roomName) => {
                window.joinRoom(roomName);
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

        if (msg.isMine) {
            history.insertAdjacentHTML('beforeend', `
                <div class="message-group sent">
                    <div class="message-content">
                        <div class="message-bubble">${msg.text}</div>
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
                        <div class="message-bubble">${msg.text}</div>
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
    
    // Render Rooms
    joinedRooms.forEach(room => {
        const isActive = currentActiveChat === room ? 'active' : '';
        container.insertAdjacentHTML('beforeend', `
            <div class="chat-item ${isActive}" onclick="window.switchChat('${room}', true)" style="cursor:pointer">
                <div class="chat-avatar" style="background:#5865F2;color:white;display:flex;align-items:center;justify-content:center;border-radius:50%;width:40px;height:40px;"><i class="fa-solid fa-hashtag"></i></div>
                <div class="chat-info">
                    <div class="chat-name">${room}</div>
                </div>
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
