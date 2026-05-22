// src/network/TCPHandler.js
const net = require('net');
const logger = require('../config/logger');

class TCPHandler {
    constructor(peer, port) {
        this.peer = peer;
        this.port = port; // Random port do hệ điều hành cấp
        this.server = null;
        this.activeConnections = new Map(); // Lưu các socket P2P
    }

    // 1. Cập nhật hàm start()
    start() {
        return new Promise((resolve) => {
            this.server = net.createServer((socket) => {
                logger.connect(`Incoming connection from ${socket.remoteAddress}`);
                // Khi mới nhận kết nối, ta chưa biết ID của người gọi, gán tạm là null
                this._setupSocketEvents(socket, null);
            });

            this.server.listen(this.port, () => {
                this.port = this.server.address().port;
                logger.info(`🔌 Peer TCP Server listening on port ${this.port}`);
                resolve();
            });
        });
    }

    // 2. Cập nhật hàm connectToPeer()
    connectToPeer(peerId, ip, port) {
        if (this.activeConnections.has(peerId) || peerId === this.peer.id) return;

        const socket = net.connect(port, ip, () => {
            this.activeConnections.set(peerId, socket);
            logger.connect(peerId);
            // QUAN TRỌNG: Gắn tai nghe cho socket đi
            this._setupSocketEvents(socket, peerId);
        });

        socket.on('error', () => {
            this.activeConnections.delete(peerId);
        });
    }

    // 3. Cập nhật hàm _setupSocketEvents()
    _setupSocketEvents(socket, initialPeerId) {
        let buffer = '';
        let currentPeerId = initialPeerId;

        socket.on('data', (chunk) => {
            buffer += chunk.toString();
            let boundary = buffer.indexOf('\n');

            while (boundary !== -1) {
                const msgStr = buffer.substring(0, boundary);
                buffer = buffer.substring(boundary + 1);
                boundary = buffer.indexOf('\n');

                try {
                    const msg = JSON.parse(msgStr);

                    // TÍNH NĂNG MỚI: Handshake ẩn (Học ID từ tin nhắn)
                    // Nếu Node B nhận được tin nhắn từ A mà chưa biết A là ai, nó sẽ tự động lưu lại
                    if (!currentPeerId && msg.from) {
                        currentPeerId = msg.from;
                        this.activeConnections.set(currentPeerId, socket);
                        // logger.info(`Đã ánh xạ kết nối ẩn danh thành: ${currentPeerId}`);
                    }

                    this.peer.handleIncomingMessage(msg, currentPeerId);
                } catch (e) {
                    // Bỏ qua nếu parse JSON lỗi
                }
            }
        });

        socket.on('close', () => {
            if (currentPeerId) {
                this.activeConnections.delete(currentPeerId);
                this.peer.onPeerDisconnect(currentPeerId);
            }
        });

        socket.on('error', () => {
            if (currentPeerId) {
                this.activeConnections.delete(currentPeerId);
            }
        });
    }
    // Cập nhật lại hàm net.createServer và connectToPeer của Ngày 1 để gọi _setupSocketEvents
    // Ví dụ:
    // this.server = net.createServer((socket) => {
    //     this._setupSocketEvents(socket, "unknown_yet"); // Sẽ cập nhật ID sau khi nhận tin nhắn đầu
    // });
}


module.exports = TCPHandler;