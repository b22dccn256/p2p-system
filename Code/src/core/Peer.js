// src/core/Peer.js
const net = require('net');
const TCPHandler = require('../network/TCPHandler');
const UDPHandler = require('../network/UDPHandler');
const logger = require('../config/logger');
const { BOOTSTRAP_IP, BOOTSTRAP_PORT } = require('../config/constants');

class Peer {
    constructor(id) {
        this.id = id;
        this.tcpPort = 0; // 0 để OS tự cấp port rảnh
        this.tcpHandler = new TCPHandler(this, this.tcpPort);
        this.udpHandler = new UDPHandler(this);
        this.knownPeers = new Set(); // Chống trùng lặp
    }

    async start() {
        // 1. Khởi chạy TCP Server (để nghe kết nối P2P)
        await this.tcpHandler.start();
        this.tcpPort = this.tcpHandler.port;

        // 2. Khởi chạy UDP Broadcast (để tìm bạn trong LAN)
        this.udpHandler.start();

        // 3. Kết nối Bootstrap Server (để tìm bạn trên WAN)
        this.connectToBootstrap();
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
            logger.discover(peerId, ip, port); // Target 5: Log "🔍 Discovered peer: xxx"

            // Tiến hành kết nối TCP P2P
            this.tcpHandler.connectToPeer(peerId, ip, port);
        }
    }
}

module.exports = Peer;