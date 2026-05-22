// src/core/Peer.js
const net = require('net');
const TCPHandler = require('../network/TCPHandler');
const UDPHandler = require('../network/UDPHandler');
const DirectChat = require('../chat/DirectChat');
const GroupChat = require('../chat/GroupChat');
const MessageQueue = require('../chat/MessageQueue');
const logger = require('../config/logger');
const { BOOTSTRAP_IP, BOOTSTRAP_PORT, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT } = require('../config/constants');

class Peer {
    constructor(id) {
        this.id = id;
        this.tcpPort = 0; // 0 để OS tự cấp port rảnh
        this.tcpHandler = new TCPHandler(this, this.tcpPort);
        this.udpHandler = new UDPHandler(this);
        this.knownPeers = new Set(); // Chống trùng lặp
        this.peerTimestamps = new Map(); // Lưu thời gian tương tác cuối cùng
        this.frozenPeers = new Set(); // Dùng để test giả lập đứt cáp mạng
        this.isShuttingDown = false; // Cờ báo hiệu đang tắt máy
        
        this.messageQueue = new MessageQueue(this);
        this.directChat = new DirectChat(this);
        this.groupChat = new GroupChat(this);
        
        this.heartbeatTimer = null;
        this.staleCheckTimer = null;
    }

    async start() {
        // 1. Khởi chạy TCP Server (để nghe kết nối P2P)
        await this.tcpHandler.start();
        this.tcpPort = this.tcpHandler.port;

        // 2. Khởi chạy UDP Broadcast (để tìm bạn trong LAN)
        this.udpHandler.start();

        // 3. Kết nối Bootstrap Server (để tìm bạn trên WAN)
        this.connectToBootstrap();

        // 4. Khởi động Heartbeat
        this.startHeartbeat();
        this.startCheckStalePeers();
    }

    connectToBootstrap() {
        const client = net.connect(BOOTSTRAP_PORT, BOOTSTRAP_IP, () => {
            // Gửi REGISTER
            client.write(JSON.stringify({
                type: 'REGISTER',
                peerId: this.id,
                port: this.tcpPort
            }) + '\n');
        });

        client.on('data', (data) => {
            try {
                const msg = JSON.parse(data.toString().trim());
                if (msg.type === 'PEER_LIST') {
                    logger.info(`Received ${msg.peers.length} peers from Bootstrap`);
                    // Gọi hàm kết nối tới từng peer nhận được
                    msg.peers.forEach(p => {
                        if (p.id !== this.id) this.onPeerDiscovered(p.id, p.ip, p.port, 'BOOTSTRAP');
                    });
                }
            } catch (e) { }
            client.destroy(); // Lấy xong list thì ngắt kết nối Bootstrap
        });

        client.on('error', () => logger.warn('Bootstrap server offline. Falling back to LAN mode only.'));
    }

    onPeerDiscovered(peerId, ip, port, source) {
        if (!this.knownPeers.has(peerId)) {
            this.knownPeers.add(peerId);
            this.peerTimestamps.set(peerId, Date.now());
            logger.discover(peerId, ip, port); // Target 5: Log "🔍 Discovered peer: xxx"

            // Tiến hành kết nối TCP P2P
            this.tcpHandler.connectToPeer(peerId, ip, port);
        }
    }

    // Hàm hứng tin nhắn từ TCPHandler đẩy lên
    handleIncomingMessage(msg, socketPeerId) {
        // Giả lập rớt mạng vật lý: Bơ luôn tin nhắn (kể cả PING), không thèm đọc
        if (this.frozenPeers.has(socketPeerId) || this.frozenPeers.has(msg.from)) {
            return; 
        }

        if (socketPeerId) {
            this.peerTimestamps.set(socketPeerId, Date.now()); // Cập nhật lastSeen cho mọi tin nhắn
            
            // Fix bug: Nếu người này tự kết nối tới mình (ẩn danh) mà UDP/Bootstrap chưa kịp báo
            if (!this.knownPeers.has(socketPeerId)) {
                this.knownPeers.add(socketPeerId);
                logger.discover(socketPeerId, "TCP_Handshake", "Auto");
            }
        }

        switch (msg.type) {
            case 'DIRECT_CHAT':
                // Gửi ACK lại cho người gửi
                if (msg.seq !== undefined && msg.from) {
                    this.tcpHandler.activeConnections.get(msg.from)?.write(JSON.stringify({
                        type: 'ACK',
                        from: this.id,
                        seq: msg.seq
                    }) + '\n');
                }
                this.directChat.onMessageReceived(msg);
                break;
            case 'GROUP_CHAT':
                this.groupChat.onMessageReceived(msg);
                break;
            case 'ROOM_JOIN':
                this.groupChat.onPeerJoinedRoom(msg.from, msg.payload.roomId);
                break;
            case 'ROOM_LEAVE':
                this.groupChat.onPeerLeftRoom(msg.from, msg.payload.roomId);
                break;
            case 'PING':
                if (msg.from) {
                    this.tcpHandler.activeConnections.get(msg.from)?.write(JSON.stringify({
                        type: 'PONG',
                        from: this.id
                    }) + '\n');
                }
                break;
            case 'PONG':
                // Đã cập nhật timestamp ở đầu hàm
                break;
            case 'ACK':
                if (msg.seq !== undefined) {
                    this.messageQueue.onAck(msg.seq);
                }
                break;
            case 'LEAVE':
                if (msg.from) {
                    this.onPeerDisconnect(msg.from);
                }
                break;
        }
    }

    // Gửi PING định kỳ
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            const pingMsg = JSON.stringify({ type: 'PING', from: this.id }) + '\n';
            for (const [peerId, socket] of this.tcpHandler.activeConnections.entries()) {
                socket.write(pingMsg);
            }
        }, HEARTBEAT_INTERVAL);
    }

    // Quét peer mất kết nối định kỳ
    startCheckStalePeers() {
        this.staleCheckTimer = setInterval(() => {
            const now = Date.now();
            // Lấy danh sách để in log debug
            const peerIds = Array.from(this.peerTimestamps.keys());
            // logger.info(`[DEBUG] Đang quét nhịp tim của ${peerIds.length} người... (${peerIds.join(', ')})`);

            for (const [peerId, lastSeen] of this.peerTimestamps.entries()) {
                const idleTime = now - lastSeen;
                if (idleTime > HEARTBEAT_TIMEOUT) {
                    logger.warn(`[DEBUG] Phát hiện timeout cho ${peerId}! Idle: ${idleTime}ms`);
                    this.onPeerDisconnect(peerId);
                }
            }
        }, 5000); // Quét mỗi 5 giây
    }

    // Target 5: Xử lý khi Peer mất kết nối
    onPeerDisconnect(peerId) {
        if (this.isShuttingDown) return; // Đang tắt máy thì bỏ qua, không cần in log

        if (this.knownPeers.has(peerId)) {
            this.knownPeers.delete(peerId);
            this.peerTimestamps.delete(peerId);
            this.groupChat.removePeerFromAllRooms(peerId); // Cập nhật trạng thái
            this.messageQueue.onPeerDisconnect(peerId); // Báo cho Queue hủy tin chưa gửi
            
            // Xóa socket nếu còn
            const socket = this.tcpHandler.activeConnections.get(peerId);
            if (socket) {
                socket.destroy();
                this.tcpHandler.activeConnections.delete(peerId);
            }

            logger.warn(`❌ Peer rời mạng (Offline/Timeout): ${peerId}`); // Notify ra CLI
        }
    }
}

module.exports = Peer;