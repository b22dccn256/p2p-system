// src/network/UDPHandler.js
const dgram = require('dgram');
const { UDP_PORT, BROADCAST_IP, DISCOVERY_INTERVAL } = require('../config/constants');
const logger = require('../config/logger');

class UDPHandler {
    constructor(peer) {
        this.peer = peer;
        this.socket = dgram.createSocket('udp4');
    }

    start() {
        // Kích hoạt chế độ Broadcast của UDP
        this.socket.bind(UDP_PORT, () => {
            this.socket.setBroadcast(true);
            logger.info(`📡 UDP Broadcast listening on port ${UDP_PORT}`);
        });

        // Lắng nghe tiếng "hét" từ các node khác trong LAN (Target 3)
        this.socket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'DISCOVERY' && data.peerId !== this.peer.id) {
                    // Báo cho Peer Core biết vừa tìm thấy ai đó
                    this.peer.onPeerDiscovered(data.peerId, rinfo.address, data.tcpPort, 'LAN');
                }
            } catch (e) { }
        });

        // Định kỳ "hét" lên mạng LAN sự tồn tại của mình
        setInterval(() => {
            const message = JSON.stringify({
                type: 'DISCOVERY',
                peerId: this.peer.id,
                tcpPort: this.peer.tcpPort
            });
            this.socket.send(message, 0, message.length, UDP_PORT, BROADCAST_IP);
        }, DISCOVERY_INTERVAL);
    }
}

module.exports = UDPHandler;