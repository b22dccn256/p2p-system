// src/security/KeyExchange.js
const crypto = require('crypto');
const logger = require('../config/logger');

class KeyExchange {
    constructor(peer, options = {}) {
        this.peer = peer;
        // Khởi tạo ECDH với đường cong tương thích cao (ưu tiên prime256v1 được hỗ trợ 100% trên cả Node và Electron)
        const supportedCurves = crypto.getCurves();
        let curveName = 'prime256v1';
        if (!supportedCurves.includes(curveName)) {
            if (supportedCurves.includes('secp256k1')) {
                curveName = 'secp256k1';
            } else {
                curveName = supportedCurves[0] || 'prime256v1';
            }
        }
        
        this.ecdh = crypto.createECDH(curveName);
        if (options.privateKey) {
            try {
                this.ecdh.setPrivateKey(options.privateKey, 'hex');
                this.publicKey = this.ecdh.getPublicKey('hex');
            } catch (err) {
                logger.error(`[E2EE] Lỗi nạp khóa E2EE riêng tư: ${err.message}. Đang sinh khóa mới.`);
                this.ecdh.generateKeys();
                this.publicKey = this.ecdh.getPublicKey('hex');
            }
        } else {
            this.ecdh.generateKeys();
            this.publicKey = this.ecdh.getPublicKey('hex');
        }
        
        // Lưu trữ shared secret với từng peer: Map { peerId -> Buffer }
        this.sharedSecrets = new Map();
        // Lưu trữ public key của các peer khác: Map { peerId -> string }
        this.peerPublicKeys = new Map();

        // Tải trước các public key đã lưu từ profile để tự động tính toán shared secrets
        if (options.peerPublicKeys) {
            for (const [peerId, pubKeyHex] of Object.entries(options.peerPublicKeys)) {
                this.computeSecret(peerId, pubKeyHex);
            }
        }
    }

    getPrivateKey() {
        return this.ecdh.getPrivateKey('hex');
    }

    // Bắt đầu quá trình trao đổi khoá chủ động (Gửi KEY_EXCHANGE_INIT)
    initiate(targetPeerId) {
        logger.info(`🔑 [E2EE] Bắt đầu gửi KEY_EXCHANGE_INIT tới ${targetPeerId}...`);
        this.peer.sendToPeer(targetPeerId, {
            type: 'KEY_EXCHANGE_INIT',
            from: this.peer.id,
            payload: { publicKey: this.publicKey }
        });
    }

    // Tính toán khoá bí mật chung (Shared Secret) từ public key của đối phương
    computeSecret(targetPeerId, otherPublicKeyHex) {
        try {
            const secret = this.ecdh.computeSecret(otherPublicKeyHex, 'hex');
            this.sharedSecrets.set(targetPeerId, secret);
            this.peerPublicKeys.set(targetPeerId, otherPublicKeyHex);
            
            const shortKey = crypto.createHash('sha256').update(secret).digest('hex').substring(0, 16);
            logger.success(`🔑 Đã thiết lập khóa mã hóa E2EE với ${targetPeerId} (SHA256: ${shortKey}...)`);
            this.peer.emit('e2ee-established', { peerId: targetPeerId, publicKey: otherPublicKeyHex });
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
