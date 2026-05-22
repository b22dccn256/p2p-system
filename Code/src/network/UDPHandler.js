// src/network/UDPHandler.js (Peer Discovery)
const dgram = require('dgram');
const { BROADCAST_IP, DISCOVERY_INTERVAL } = require('../config/constants');

class UDPHandler {
    constructor(peer, port) {
        this.peer = peer;
        this.socket = dgram.createSocket('udp4');
        this.port = port;
    }

    async startBroadcast() {
        // 1. Bind socket để nhận broadcast từ peer khác
        this.socket.on('message', (msg, rinfo) => {
            const data = JSON.parse(msg.toString());
            if (data.type === 'DISCOVERY_ANNOUNCE') {
                this.peer.onPeerDiscovered(data.peerInfo);
            }
        });
        await new Promise(resolve => this.socket.bind(this.port, resolve));

        // 2. Định kỳ broadcast thông tin của chính mình
        setInterval(() => this.broadcastSelf(), DISCOVERY_INTERVAL);
    }

    broadcastSelf() {
        const message = JSON.stringify({
            type: 'DISCOVERY_ANNOUNCE',
            peerInfo: {
                id: this.peer.id,
                ip: this.getLocalIP(),
                port: this.peer.tcpHandler.port
            }
        });
        this.socket.send(message, 0, message.length, this.port, BROADCAST_IP);
    }

    getLocalIP() {
        // Lấy IP local (bỏ qua 127.0.0.1)
        const interfaces = require('os').networkInterfaces();
        for (const iface of Object.values(interfaces)) {
            for (const config of iface) {
                if (config.family === 'IPv4' && !config.internal) {
                    return config.address;
                }
            }
        }
        return '127.0.0.1';
    }
}

module.exports = UDPHandler;