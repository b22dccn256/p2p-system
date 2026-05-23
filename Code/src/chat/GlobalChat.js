// src/chat/GlobalChat.js
const logger = require('../config/logger');

class GlobalChat {
    constructor(peer) {
        this.peer = peer;
    }

    // Broadcast tin nhắn tới tất cả những người đang kết nối (LAN & WAN)
    broadcast(text) {
        const message = {
            type: 'GLOBAL_CHAT',
            from: this.peer.id,
            payload: { text }
        };

        const msgStr = JSON.stringify(message) + '\n';
        
        let sentCount = 0;
        this.peer.tcpHandler.activeConnections.forEach((socket) => {
            socket.write(msgStr);
            sentCount++;
        });

        logger.success(`Đã broadcast tin nhắn tới ${sentCount} peer(s).`);
    }

    // Nhận tin nhắn Broadcast từ người khác
    onMessageReceived(msg) {
        logger.info(`📢 [Broadcast Toàn mạng] ${msg.from}: ${msg.payload.text}`);
    }
}

module.exports = GlobalChat;
