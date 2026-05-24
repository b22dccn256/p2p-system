// src/chat/GlobalChat.js
const logger = require('../config/logger');

class GlobalChat {
    constructor(peer) {
        this.peer = peer;
    }

    // Broadcast tin nhắn tới tất cả những người đang kết nối (LAN & WAN)
    broadcast(text) {
        // Kiểm tra bootstrap server trước khi gửi
        if (!this.peer.isBootstrapAlive) {
            logger.error('⛔ Không thể broadcast: Bootstrap server đang offline.');
            return false;
        }

        const message = {
            type: 'GLOBAL_CHAT',
            from: this.peer.id,
            payload: { text }
        };

        let sentCount = 0;
        this.peer.tcpHandler.activeConnections.forEach(() => sentCount++);
        this.peer.broadcastToNetwork(message);

        logger.success(`Đã broadcast tin nhắn tới ${sentCount} peer(s).`);
    }

    // Nhận tin nhắn Broadcast từ người khác
    onMessageReceived(msg) {
        logger.info(`📢 [Broadcast Toàn mạng] ${msg.from}: ${msg.payload.text}`);
    }
}

module.exports = GlobalChat;
