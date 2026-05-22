// src/core/Peer.js
const TCPHandler = require('../network/TCPHandler');
const UDPHandler = require('../network/UDPHandler');
const { PEER_ID, TCP_PORT, UDP_PORT, BOOTSTRAP_HOST } = require('../config/constants');

class Peer {
    constructor(id = PEER_ID) {
        this.id = id;
        this.tcpHandler = new TCPHandler(this, TCP_PORT);
        this.udpHandler = new UDPHandler(this, UDP_PORT);
        this.knownPeers = new Map();
        this.onlinePeers = new Map();
    }

    async start() {
        await this.tcpHandler.listen();
        await this.udpHandler.startBroadcast();
        await this.connectToBootstrap();
        console.log(`✅ Peer ${this.id} started`);
    }

    async connectToBootstrap() {
        // Gửi REGISTER tới bootstrap server
        // Nhận lại danh sách peer và thử kết nối TCP
    }

    onPeerDiscovered(peerInfo) {
        // Lưu peer vào knownPeers, thử kết nối TCP
    }

    send(peerId, message) {
        // Gửi message qua TCP connection đã có
    }
}

module.exports = Peer;