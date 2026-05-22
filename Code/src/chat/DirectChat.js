// src/chat/DirectChat.js
const logger = require('../config/logger');

class DirectChat {
    constructor(peer) {
        this.peer = peer;
    }

    // Target 1: Gửi tin nhắn trực tiếp giữa 2 peer (Sử dụng Message Queue)
    async send(targetPeerId, text) {
        const message = {
            type: 'DIRECT_CHAT',
            from: this.peer.id,
            payload: { text }
        };

        try {
            await this.peer.messageQueue.sendWithAck(targetPeerId, message);
            return true;
        } catch (err) {
            // Lỗi đã được xử lý log bên trong MessageQueue
            return false;
        }
    }

    // Target 2: Nhận tin nhắn và hiển thị ra console
    onMessageReceived(msg) {
        logger.info(`📩 [Direct] ${msg.from}: ${msg.payload.text}`);
    }
}

module.exports = DirectChat;