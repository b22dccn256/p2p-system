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

    start() {
        return new Promise((resolve) => {
            this.server = net.createServer((socket) => {
                // Khi có một peer khác chủ động kết nối tới
                logger.connect(`Incoming connection from ${socket.remoteAddress}`);

                socket.on('data', (data) => {/* Ngày 2 sẽ xử lý tin nhắn ở đây */ });
                socket.on('error', () => { });
            });

            this.server.listen(this.port, () => {
                this.port = this.server.address().port; // Lấy port thực tế
                logger.info(`🔌 Peer TCP Server listening on port ${this.port}`);
                resolve();
            });
        });
    }

    // Hàm dùng để chủ động kết nối tới peer khác (Target 5)
    connectToPeer(peerId, ip, port) {
        if (this.activeConnections.has(peerId) || peerId === this.peer.id) return;

        const socket = net.connect(port, ip, () => {
            this.activeConnections.set(peerId, socket);
            logger.connect(peerId); // Target 5: Log "🔗 Connected to: yyy"
        });

        socket.on('error', () => {
            this.activeConnections.delete(peerId);
        });
    }
}

module.exports = TCPHandler;