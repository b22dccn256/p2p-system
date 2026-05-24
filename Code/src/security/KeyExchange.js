// src/security/KeyExchange.js
const crypto = require('crypto');
const logger = require('../config/logger');

class KeyExchange {
    constructor(peer) {
        this.peer = peer;
        // Sử dụng đường cong secp256k1 chuẩn công nghiệp
        this.ecdh = crypto.createECDH('secp256k1');
        this.ecdh.generateKeys();
        this.publicKey = this.ecdh.getPublicKey('hex');
        
        // Lưu trữ shared secret với từng peer: Map { peerId -> Buffer }
        this.sharedSecrets = new Map();
        // Lưu trữ public key của các peer khác: Map { peerId -> string }
        this.peerPublicKeys = new Map();
    }

    // Bắt đầu quá trình trao đổi khoá chủ động (Gửi KEY_EXCHANGE_INIT)
    initiate(targetPeerId) {
        const socket = this.peer.tcpHandler.activeConnections.get(targetPeerId);
        if (!socket) return;

        // logger.info(`🔑 Đang khởi tạo trao đổi khóa ECDH với ${targetPeerId}...`);
        socket.write(JSON.stringify({
            type: 'KEY_EXCHANGE_INIT',
            from: this.peer.id,
            payload: { publicKey: this.publicKey }
        }) + '\n');
    }

    // Tính toán khoá bí mật chung (Shared Secret) từ public key của đối phương
    computeSecret(targetPeerId, otherPublicKeyHex) {
        try {
            const secret = this.ecdh.computeSecret(otherPublicKeyHex, 'hex');
            this.sharedSecrets.set(targetPeerId, secret);
            this.peerPublicKeys.set(targetPeerId, otherPublicKeyHex);
            
            const shortKey = crypto.createHash('sha256').update(secret).digest('hex').substring(0, 16);
            logger.success(`🔑 Đã thiết lập khóa mã hóa E2EE với ${targetPeerId} (SHA256: ${shortKey}...)`);
            return secret;
        } catch (e) {
            logger.error(`Lỗi khi tính toán khóa bí mật chung với ${targetPeerId}: ${e.message}`);
            return null;
        }
    }

    getSharedSecret(targetPeerId) {
        return this.sharedSecrets.get(targetPeerId);
    }

    hasKey(targetPeerId) {
        return this.sharedSecrets.has(targetPeerId);
    }
}

module.exports = KeyExchange;
