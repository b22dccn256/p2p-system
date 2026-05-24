// src/chat/GroupChat.js
const logger = require('../config/logger');

class GroupChat {
    constructor(peer) {
        this.peer = peer;
        // Map lưu trữ: { roomId: Set<peerId> }
        this.rooms = new Map();
    }

    // Target 3: Tạo room chat nhóm, thêm thành viên (Chính mình)
    joinRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(this.peer.id);
        logger.success(`Tham gia room: ${roomId}`);

        // Báo cho TẤT CẢ các peer đang kết nối biết mình vừa vào room này
        this._broadcastToNetwork({
            type: 'ROOM_JOIN',
            from: this.peer.id,
            payload: { roomId }
        });
    }

    // Rời khỏi room
    leaveRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || !room.has(this.peer.id)) {
            logger.error(`Bạn chưa tham gia room ${roomId}!`);
            return;
        }

        room.delete(this.peer.id);
        if (room.size === 0) this.rooms.delete(roomId);

        logger.success(`Đã rời room: ${roomId}`);

        // Báo cho mọi người biết mình đã rời
        this._broadcastToNetwork({
            type: 'ROOM_LEAVE',
            from: this.peer.id,
            payload: { roomId }
        });
    }

    // Xử lý khi một peer khác rời room
    onPeerLeftRoom(peerId, roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.delete(peerId);
            logger.warn(`👋 ${peerId} đã rời room ${roomId}`);
        }
    }

    // Xử lý khi một peer khác báo họ vừa vào room
    onPeerJoinedRoom(peerId, roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(peerId);
    }

    // Target 4: Broadcast message tới tất cả member trong room
    broadcast(roomId, text) {
        const roomMembers = this.rooms.get(roomId);
        if (!roomMembers || !roomMembers.has(this.peer.id)) {
            logger.error(`Bạn chưa tham gia room ${roomId}!`);
            return;
        }

        logger.info(`🔒 [E2EE Group Broadcast] Đang mã hóa và gửi tới các thành viên trong room ${roomId}...`);

        // Gửi tin nhắn tới những ai nằm trong danh sách room
        roomMembers.forEach((memberId) => {
            if (memberId !== this.peer.id) {
                const payload = { roomId };
                
                if (this.peer.keyExchange.hasKey(memberId)) {
                    const sharedSecret = this.peer.keyExchange.getSharedSecret(memberId);
                    payload.encrypted = this.peer.crypto.encrypt(text, sharedSecret);
                } else {
                    // Fallback sang plaintext nếu chưa kịp trao đổi khóa
                    payload.text = text;
                }

                this.peer.sendToPeer(memberId, {
                    type: 'GROUP_CHAT',
                    from: this.peer.id,
                    payload: payload
                });
            }
        });
    }

    onMessageReceived(msg) {
        const roomId = msg.payload.roomId;
        if (msg.payload.encrypted) {
            try {
                const sharedSecret = this.peer.keyExchange.getSharedSecret(msg.from);
                if (!sharedSecret) {
                    logger.error(`📢 [Room ${roomId}] Nhận được tin nhắn từ ${msg.from} nhưng chưa có khóa giải mã!`);
                    return;
                }
                const decryptedText = this.peer.crypto.decrypt(msg.payload.encrypted, sharedSecret);
                logger.info(`📢 [Room ${roomId}] [E2EE] ${msg.from}: ${decryptedText}`);
            } catch (err) {
                logger.error(`📢 [Room ${roomId}] Lỗi giải mã tin nhắn nhóm từ ${msg.from}: ${err.message}`);
            }
        } else if (msg.payload.text) {
            logger.info(`📢 [Room ${roomId}] ${msg.from}: ${msg.payload.text} (Plaintext)`);
        }
    }

    // Target 5: Xóa peer khỏi tất cả các room khi họ rời mạng
    removePeerFromAllRooms(peerId) {
        for (const [roomId, members] of this.rooms.entries()) {
            if (members.has(peerId)) {
                members.delete(peerId);
            }
        }
    }

    _broadcastToNetwork(message) {
        this.peer.broadcastToNetwork(message);
    }
}

module.exports = GroupChat;
