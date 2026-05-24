// src/chat/DirectChat.js
const logger = require('../config/logger');

class DirectChat {
    constructor(peer) {
        this.peer = peer;
    }

    // Target 1: Gửi tin nhắn trực tiếp giữa 2 peer (Sử dụng Message Queue)
    async send(targetPeerId, text) {
        // Kiểm tra bootstrap server trước khi gửi
        if (!this.peer.isBootstrapAlive) {
            logger.error('⛔ Không thể gửi tin nhắn: Bootstrap server đang offline.');
            return false;
        }

        if (!this.peer.keyExchange.hasKey(targetPeerId)) {
            logger.warn(`🛡️ Chưa có khoá E2EE với ${targetPeerId}. Đang tự động trao đổi khoá...`);
            this.peer.keyExchange.initiate(targetPeerId);
            const keyReady = await this.waitForKey(targetPeerId, 5000);
            if (!keyReady) {
                logger.error(`Không thể thiết lập khóa E2EE với ${targetPeerId}.`);
                return false;
            }
        }

        const sharedSecret = this.peer.keyExchange.getSharedSecret(targetPeerId);
        const encrypted = this.peer.crypto.encrypt(text, sharedSecret);

        // Hiển thị nội dung mã hóa chạy dưới đường truyền để debug/demo
        logger.info(`🔒 [E2EE Outgoing] Ciphertext gửi đi: ${JSON.stringify(encrypted)}`);

        const message = {
            type: 'DIRECT_CHAT',
            from: this.peer.id,
            payload: { encrypted }
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
        try {
            const sharedSecret = this.peer.keyExchange.getSharedSecret(msg.from);
            if (!sharedSecret) {
                logger.error(`📩 [Direct] Nhận được tin nhắn từ ${msg.from} nhưng chưa có khóa mã hóa!`);
                return;
            }

            // In ciphertext để chứng minh tin nhắn đi trên đường truyền bị mã hóa
            logger.info(`🔒 [E2EE Incoming] Ciphertext nhận từ socket: ${JSON.stringify(msg.payload.encrypted)}`);

            const decryptedText = this.peer.crypto.decrypt(msg.payload.encrypted, sharedSecret);
            logger.info(`📩 [Direct] [E2EE] ${msg.from}: ${decryptedText}`);
        } catch (err) {
            logger.error(`📩 [Direct] Lỗi giải mã tin nhắn từ ${msg.from}: ${err.message}`);
        }
    }

    waitForKey(targetPeerId, timeoutMs) {
        const startedAt = Date.now();

        return new Promise((resolve) => {
            const timer = setInterval(() => {
                if (this.peer.keyExchange.hasKey(targetPeerId)) {
                    clearInterval(timer);
                    resolve(true);
                    return;
                }

                if (Date.now() - startedAt >= timeoutMs) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }
}

module.exports = DirectChat;
