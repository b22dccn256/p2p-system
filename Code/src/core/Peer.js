// src/core/Peer.js
const { EventEmitter } = require('events');
const TCPHandler = require('../network/TCPHandler');
const UDPHandler = require('../network/UDPHandler');
const BootstrapClient = require('../discovery/BootstrapClient');
const DirectChat = require('../chat/DirectChat');
const GroupChat = require('../chat/GroupChat');
const GlobalChat = require('../chat/GlobalChat');
const MessageQueue = require('../chat/MessageQueue');
const logger = require('../config/logger');
const { HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT } = require('../config/constants');
const KeyExchange = require('../security/KeyExchange');
const Crypto = require('../security/Crypto');

class Peer extends EventEmitter {
    constructor(id) {
        super();
        this.id = id;
        this.tcpPort = 0; // 0 để OS tự cấp port rảnh
        this.tcpHandler = new TCPHandler(this, this.tcpPort);
        this.udpHandler = new UDPHandler(this);
        this.bootstrapClient = new BootstrapClient(this);
        this.knownPeers = new Set(); // Chống trùng lặp
        this.peerTimestamps = new Map(); // Lưu thời gian tương tác cuối cùng
        this.peerSources = new Map();
        this.frozenPeers = new Set(); // Dùng để test giả lập đứt cáp mạng
        this.isShuttingDown = false; // Cờ báo hiệu đang tắt máy
        this.seenMessageIds = new Set();
        this.keyExchange = new KeyExchange(this);
        this.crypto = Crypto;
        
        this.messageQueue = new MessageQueue(this);
        this.directChat = new DirectChat(this);
        this.groupChat = new GroupChat(this);
        this.globalChat = new GlobalChat(this);
        
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
        this.bootstrapClient.start();

        // 4. Khởi động Heartbeat
        this.startHeartbeat();
        this.startCheckStalePeers();
    }

    createMessageId() {
        return `${this.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }

    prepareOutgoingMessage(message) {
        if (!message.id) message.id = this.createMessageId();
        if (!message.from) message.from = this.id;
        return message;
    }

    sendToPeer(targetPeerId, message) {
        const outgoing = this.prepareOutgoingMessage(message);
        const socket = this.tcpHandler.activeConnections.get(targetPeerId);

        if (socket && !socket.destroyed) {
            socket.write(JSON.stringify(outgoing) + '\n');
            return true;
        }

        return this.bootstrapClient.sendToPeer(targetPeerId, outgoing);
    }

    broadcastToNetwork(message) {
        const outgoing = this.prepareOutgoingMessage(message);
        const msgStr = JSON.stringify(outgoing) + '\n';

        this.tcpHandler.activeConnections.forEach((socket) => {
            if (!socket.destroyed) socket.write(msgStr);
        });

        this.bootstrapClient.broadcast(outgoing);
    }

    handleRelayedMessage(relayFrom, msg) {
        if (!msg || msg.from === this.id) return;

        if (!this.knownPeers.has(msg.from)) {
            this.onPeerDiscovered(msg.from, null, null, 'BOOTSTRAP_RELAY');
        } else {
            this.peerSources.set(msg.from, 'BOOTSTRAP_RELAY');
            this.peerTimestamps.set(msg.from, Date.now());
        }

        this.handleIncomingMessage(msg, msg.from || relayFrom);
    }

    onPeerDiscovered(peerId, ip, port, source) {
        if (peerId === this.id) return;

        this.peerTimestamps.set(peerId, Date.now());
        if (source) this.peerSources.set(peerId, source);

        if (!this.knownPeers.has(peerId)) {
            this.knownPeers.add(peerId);
            logger.discover(peerId, ip, port); // Target 5: Log "🔍 Discovered peer: xxx"

            this.emit('peer-discovered', { peerId, ip, port, source }); // Báo lên UI

            // Tiến hành kết nối TCP P2P
            if (ip && port) this.tcpHandler.connectToPeer(peerId, ip, port);
            if (!this.keyExchange.hasKey(peerId)) {
                setTimeout(() => this.keyExchange.initiate(peerId), 300);
            }
            this.groupChat.syncRoomsToPeer(peerId);
        } else if (!this.keyExchange.hasKey(peerId)) {
            setTimeout(() => this.keyExchange.initiate(peerId), 300);
            this.groupChat.syncRoomsToPeer(peerId);
        }
    }

    syncBootstrapPeers(peerIds) {
        const onlinePeerIds = new Set(peerIds.filter((peerId) => peerId !== this.id));

        for (const peerId of onlinePeerIds) {
            this.peerTimestamps.set(peerId, Date.now());
            const source = this.peerSources.get(peerId);
            if (!source || source.startsWith('BOOTSTRAP')) {
                this.peerSources.set(peerId, 'BOOTSTRAP');
            }
        }

        for (const peerId of Array.from(this.knownPeers)) {
            const source = this.peerSources.get(peerId) || '';
            const hasDirectSocket = this.tcpHandler.activeConnections.has(peerId);
            if (source.startsWith('BOOTSTRAP') && !onlinePeerIds.has(peerId) && !hasDirectSocket) {
                this.onPeerDisconnect(peerId);
            }
        }
    }

    onConnectionEstablished(peerId) {
        // Chỉ khởi tạo trao đổi khóa nếu chưa có khóa của peer này
        if (!this.keyExchange.hasKey(peerId)) {
            this.keyExchange.initiate(peerId);
        }

        // Khi có kết nối mới, đồng bộ trạng thái phòng chat
        for (const [roomId, members] of this.groupChat.rooms.entries()) {
            if (members.has(this.id)) {
                const socket = this.tcpHandler.activeConnections.get(peerId);
                if (socket) {
                    socket.write(JSON.stringify({
                        type: 'ROOM_JOIN',
                        from: this.id,
                        payload: { roomId }
                    }) + '\n');
                }
            }
        }
    }

    // Hàm hứng tin nhắn từ TCPHandler đẩy lên
    handleIncomingMessage(msg, socketPeerId) {
        if (msg.id) {
            if (this.seenMessageIds.has(msg.id)) {
                if (msg.type === 'DIRECT_CHAT' && msg.seq !== undefined && msg.from) {
                    this.sendToPeer(msg.from, {
                        type: 'ACK',
                        from: this.id,
                        seq: msg.seq
                    });
                }
                return;
            }
            this.seenMessageIds.add(msg.id);
            if (this.seenMessageIds.size > 2000) {
                const oldest = this.seenMessageIds.values().next().value;
                this.seenMessageIds.delete(oldest);
            }
        }

        // Giả lập rớt mạng vật lý: Bơ luôn tin nhắn (kể cả PING), không thèm đọc
        if (this.frozenPeers.has(socketPeerId) || this.frozenPeers.has(msg.from)) {
            return; 
        }

        if (socketPeerId) {
            this.peerTimestamps.set(socketPeerId, Date.now()); // Cập nhật lastSeen cho mọi tin nhắn
            
            // Fix bug: Nếu người này tự kết nối tới mình (ẩn danh) mà UDP/Bootstrap chưa kịp báo
            if (!this.knownPeers.has(socketPeerId)) {
                this.knownPeers.add(socketPeerId);
                this.peerSources.set(socketPeerId, 'TCP_Handshake');
                logger.discover(socketPeerId, "TCP_Handshake", "Auto");
                this.emit('peer-discovered', { peerId: socketPeerId, source: 'TCP_Handshake' });
            }
        }

        // Báo cho UI mọi tin nhắn ngoại trừ PING/PONG/ACK/KEY_EXCHANGE nội bộ
        if (msg.type !== 'PING' && msg.type !== 'PONG' && msg.type !== 'ACK' && msg.type !== 'KEY_EXCHANGE_INIT' && msg.type !== 'KEY_EXCHANGE_RESPONSE') {
            // Tự động giải mã trước để UI tiện hiển thị (nếu có E2EE)
            if (msg.type === 'DIRECT_CHAT' || msg.type === 'GROUP_CHAT') {
                if (msg.payload && msg.payload.encrypted) {
                    try {
                        const sharedSecret = this.keyExchange.getSharedSecret(msg.from);
                        if (sharedSecret) {
                            const decryptedText = this.crypto.decrypt(msg.payload.encrypted, sharedSecret);
                            
                            // Tự bóc tách nếu tin nhắn giải mã là JSON chuyển tiếp chứa forwardedFrom
                            try {
                                const parsed = JSON.parse(decryptedText);
                                if (parsed && typeof parsed === 'object' && parsed.forwardedFrom) {
                                    msg.decryptedText = parsed.text;
                                    msg.forwardedFrom = parsed.forwardedFrom;
                                } else {
                                    msg.decryptedText = decryptedText;
                                }
                            } catch (e) {
                                msg.decryptedText = decryptedText;
                            }
                            
                            msg.isEncrypted = true;
                            msg.ciphertext = msg.payload.encrypted.content; // Đoạn text hex mã hóa để debug UI
                        }
                    } catch (err) {
                        logger.error(`[E2EE Decrypt UI Error] ${err.message}`);
                    }
                }
            }
            this.emit('message', msg);
        }

        switch (msg.type) {
            case 'KEY_EXCHANGE_INIT':
                if (msg.from && msg.payload.publicKey) {
                    this.keyExchange.computeSecret(msg.from, msg.payload.publicKey);
                    // Gửi lại public key của mình dưới dạng RESPONSE
                    this.sendToPeer(msg.from, {
                        type: 'KEY_EXCHANGE_RESPONSE',
                        from: this.id,
                        payload: { publicKey: this.keyExchange.publicKey }
                    });
                }
                break;
            case 'KEY_EXCHANGE_RESPONSE':
                if (msg.from && msg.payload.publicKey) {
                    this.keyExchange.computeSecret(msg.from, msg.payload.publicKey);
                }
                break;
            case 'DIRECT_CHAT':
                // Gửi ACK lại cho người gửi
                if (msg.seq !== undefined && msg.from) {
                    this.sendToPeer(msg.from, {
                        type: 'ACK',
                        from: this.id,
                        seq: msg.seq
                    });
                }
                this.directChat.onMessageReceived(msg);
                break;
            case 'GROUP_CHAT':
                this.groupChat.onMessageReceived(msg);
                break;
            case 'GLOBAL_CHAT':
                this.globalChat.onMessageReceived(msg);
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
                    this.messageQueue.onAck(msg.seq, msg.from);
                    this.emit('message-ack', { seq: msg.seq, from: msg.from }); // Báo cho UI để chuyển ✔️✔️
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
                const source = this.peerSources.get(peerId) || '';
                const hasDirectSocket = this.tcpHandler.activeConnections.has(peerId);
                if (source.startsWith('BOOTSTRAP') && this.bootstrapClient.connected && !hasDirectSocket) {
                    continue;
                }

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
            this.peerSources.delete(peerId);
            this.groupChat.removePeerFromAllRooms(peerId); // Cập nhật trạng thái
            this.messageQueue.onPeerDisconnect(peerId); // Báo cho Queue hủy tin chưa gửi
            
            // Xóa socket nếu còn
            const socket = this.tcpHandler.activeConnections.get(peerId);
            if (socket) {
                socket.destroy();
                this.tcpHandler.activeConnections.delete(peerId);
            }

            logger.warn(`❌ Peer rời mạng (Offline/Timeout): ${peerId}`); // Notify ra CLI
            this.emit('peer-disconnected', peerId); // Báo lên UI
        }
    }
}

module.exports = Peer;
