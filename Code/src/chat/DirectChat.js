// src/chat/DirectChat.js
const logger = require('../config/logger');

class DirectChat {
    constructor(peer) {
        this.peer = peer;
    }

    // Target 1: Gửi tin nhắn trực tiếp giữa 2 peer
    send(targetPeerId, text) {
        const socket = this.peer.tcpHandler.activeConnections.get(targetPeerId);

        if (!socket) {
            console.log(`[ERROR] Không thể gửi! Peer ${targetPeerId} không online hoặc chưa kết nối.`);
            // logger.error(`Không thể gửi! Peer ${targetPeerId} không online hoặc chưa kết nối.`);
            return false;
        }

        const message = {
            type: 'DIRECT_CHAT',
            from: this.peer.id,
            payload: { text }
        };

        socket.write(JSON.stringify(message) + '\n');
        return true;
    }

    // Target 2: Nhận tin nhắn và hiển thị ra console
    onMessageReceived(msg) {
        logger.info(`📩 [Direct] ${msg.from}: ${msg.payload.text}`);
    }
}

module.exports = DirectChat;