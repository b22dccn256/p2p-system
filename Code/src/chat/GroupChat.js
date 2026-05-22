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

        const message = {
            type: 'GROUP_CHAT',
            from: this.peer.id,
            payload: { roomId, text }
        };

        // Gửi tin nhắn tới những ai nằm trong danh sách room
        roomMembers.forEach((memberId) => {
            if (memberId !== this.peer.id) {
                const socket = this.peer.tcpHandler.activeConnections.get(memberId);
                if (socket) {
                    socket.write(JSON.stringify(message) + '\n');
                }
            }
        });
    }

    onMessageReceived(msg) {
        logger.info(`📢 [Room ${msg.payload.roomId}] ${msg.from}: ${msg.payload.text}`);
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
        const msgStr = JSON.stringify(message) + '\n';
        this.peer.tcpHandler.activeConnections.forEach((socket) => {
            socket.write(msgStr);
        });
    }
}

module.exports = GroupChat;