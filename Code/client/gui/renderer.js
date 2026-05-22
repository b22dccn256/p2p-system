// renderer.js

// Khởi tạo âm thanh từ thư mục assets
const soundSend = new Audio('../assets/sound/send.mp3');
const soundReceive = new Audio('../assets/sound/receive.mp3');
const soundNotification = new Audio('../assets/sound/notification.mp3');

document.addEventListener('DOMContentLoaded', () => {
    // 1. Đóng/Mở Right Panel
    const closePanelBtn = document.querySelector('.close-panel');
    const rightPanel = document.querySelector('.right-panel');

    if (closePanelBtn && rightPanel) {
        closePanelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (rightPanel.style.display === 'none') {
                rightPanel.style.display = 'flex';
            } else {
                rightPanel.style.display = 'none';
            }
        });
    }

    // 2. Gửi tin nhắn (Enter)
    const chatInput = document.querySelector('.chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && chatInput.value.trim() !== '') {
                const msg = chatInput.value.trim();
                appendSentMessage(msg);
                chatInput.value = '';
                
                // Giả lập nhận tin nhắn phản hồi sau 1 giây
                setTimeout(() => {
                    appendReceivedMessage("Capt Jack Sparrow", "Aye, " + msg + "!");
                }, 1000);
            }
        });
    }

    // 3. Nút Send Message (icon)
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (chatInput && chatInput.value.trim() !== '') {
                const msg = chatInput.value.trim();
                appendSentMessage(msg);
                chatInput.value = '';

                // Giả lập nhận tin nhắn phản hồi sau 1 giây
                setTimeout(() => {
                    appendReceivedMessage("Capt Jack Sparrow", "Aye, " + msg + "!");
                }, 1000);
            }
        });
    }

    // 4. Các tính năng "Đang phát triển"
    // Gắn sự kiện click cho các elements chưa có logic
    const dummyElements = document.querySelectorAll(`
        .nav-item, 
        .btn-primary, 
        .btn-secondary, 
        .btn-danger, 
        .icon-btn:not(.close-panel):not(.send-btn), 
        .message-actions i, 
        .link-item a,
        .profile-pic,
        .chat-item
    `);

    dummyElements.forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault(); // chặn link nếu là thẻ <a>
            // Nếu là chat-item, ta đổi class active 
            if (el.classList.contains('chat-item')) {
                document.querySelectorAll('.chat-item').forEach(c => c.classList.remove('active'));
                el.classList.add('active');
            } else {
                // Các nút khác thì thông báo
                alert("Đang phát triển chức năng này 🚀");
            }
        });
    });
});

function appendSentMessage(text) {
    const history = document.querySelector('.chat-history');
    if (!history) return;

    const messageHtml = `
        <div class="message-group sent">
            <div class="message-content">
                <div class="message-bubble">
                    ${text}
                    <div class="message-actions">
                        <i class="fa-solid fa-reply"></i>
                        <i class="fa-solid fa-pen"></i>
                        <i class="fa-solid fa-trash"></i>
                        <i class="fa-regular fa-face-smile"></i>
                    </div>
                </div>
                <span class="message-time"><i class="fa-solid fa-check text-muted"></i> Just now</span>
            </div>
        </div>
    `;

    history.insertAdjacentHTML('beforeend', messageHtml);
    history.scrollTop = history.scrollHeight;

    // Phát âm thanh gửi tin
    soundSend.currentTime = 0;
    soundSend.play().catch(e => console.log(e));

    // Phải gắn lại sự kiện cho các icon trong message mới
    const newIcons = history.lastElementChild.querySelectorAll('.message-actions i');
    newIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            alert("Đang phát triển chức năng này 🚀");
        });
    });
}

function appendReceivedMessage(senderName, text) {
    const history = document.querySelector('.chat-history');
    if (!history) return;

    // Tạo Avatar chữ cái tự động từ thư viện avatar.min.js
    const avatarSrc = window.LetterAvatar ? window.LetterAvatar.generate(senderName, 40) : '';

    const messageHtml = `
        <div class="message-group received">
            <img src="${avatarSrc}" alt="Avatar" class="avatar-small">
            <div class="message-content">
                <span class="sender-name">${senderName}</span>
                <div class="message-bubble">
                    ${text}
                    <div class="message-actions">
                        <i class="fa-solid fa-reply"></i>
                        <i class="fa-solid fa-pen"></i>
                        <i class="fa-solid fa-trash"></i>
                        <i class="fa-regular fa-face-smile"></i>
                    </div>
                </div>
                <span class="message-time">Just now <i class="fa-solid fa-check"></i></span>
            </div>
        </div>
    `;

    history.insertAdjacentHTML('beforeend', messageHtml);
    history.scrollTop = history.scrollHeight;

    // Phát âm thanh nhận tin (notification)
    soundReceive.currentTime = 0;
    soundReceive.play().catch(e => console.log(e));

    // Gắn sự kiện cho các icon
    const newIcons = history.lastElementChild.querySelectorAll('.message-actions i');
    newIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            alert("Đang phát triển chức năng này 🚀");
        });
    });
}
