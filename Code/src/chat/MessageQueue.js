// src/chat/MessageQueue.js
const logger = require('../config/logger');
const { MAX_RETRIES, ACK_TIMEOUT } = require('../config/constants');

class MessageQueue {
    constructor(peer) {
        this.peer = peer;
        this.pending = new Map(); // Lưu các tin nhắn đang chờ ACK: { seq: { message, target, resolve, reject, retries, timer } }
        this.seqCounter = 0;
    }

    async sendWithAck(targetPeerId, message) {
        const seq = this.seqCounter++;
        message.seq = seq;

        return new Promise((resolve, reject) => {
            this.pending.set(seq, {
                message,
                target: targetPeerId,
                resolve,
                reject,
                retries: 0,
                timer: null
            });

            this._doSend(seq);
        });
    }

    _doSend(seq) {
        const item = this.pending.get(seq);
        if (!item) return;

        if (!this.peer.sendToPeer(item.target, item.message)) {
            this.pending.delete(seq);
            item.reject(new Error(`Không thể kết nối tới ${item.target} để gửi tin nhắn.`));
            return;
        }

        // Hẹn giờ kiểm tra ACK
        item.timer = setTimeout(() => {
            if (item.retries < MAX_RETRIES) {
                item.retries++;
                logger.warn(`🔄 Đang thử gửi lại gói tin #${seq} cho ${item.target} (Lần ${item.retries}/${MAX_RETRIES})...`);
                this._doSend(seq);
            } else {
                this.pending.delete(seq);
                item.reject(new Error(`Gửi tin nhắn #${seq} thất bại sau ${MAX_RETRIES} lần thử.`));
                logger.error(`❌ Lỗi: Gửi tin nhắn #${seq} thất bại sau ${MAX_RETRIES} lần thử.`);
            }
        }, ACK_TIMEOUT);
    }

    // Được gọi khi Peer.js nhận được ACK từ mạng
    onAck(seq, fromPeerId) {
        const item = this.pending.get(seq);
        if (item && fromPeerId && item.target !== fromPeerId) return;

        if (item) {
            clearTimeout(item.timer);
            this.pending.delete(seq);
            item.resolve();
            // logger.success(`Đã nhận ACK cho gói tin #${seq}`);
        }
    }

    // Xóa toàn bộ hàng chờ nếu rớt mạng
    onPeerDisconnect(peerId) {
        for (const [seq, item] of this.pending.entries()) {
            if (item.target === peerId) {
                clearTimeout(item.timer);
                this.pending.delete(seq);
                item.reject(new Error(`Peer ${peerId} ngắt kết nối.`));
            }
        }
    }
}

module.exports = MessageQueue;
