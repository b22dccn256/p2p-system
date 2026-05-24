const net = require('net');
const logger = require('../config/logger');
const { BOOTSTRAP_IP, BOOTSTRAP_PORT } = require('../config/constants');

class BootstrapClient {
    constructor(peer) {
        this.peer = peer;
        this.socket = null;
        this.connected = false;
        this.buffer = '';
        this.reconnectTimer = null;
    }

    start() {
        this.connect();
    }

    connect() {
        if (this.socket && !this.socket.destroyed) return;

        const socket = net.connect(BOOTSTRAP_PORT, BOOTSTRAP_IP, () => {
            this.socket = socket;
            this.connected = true;
            socket.setKeepAlive(true, 30000);
            socket.write(JSON.stringify({
                type: 'REGISTER',
                peerId: this.peer.id,
                port: this.peer.tcpPort
            }) + '\n');
            logger.success(`Connected to bootstrap relay ${BOOTSTRAP_IP}:${BOOTSTRAP_PORT}`);
        });

        socket.on('data', (chunk) => this.handleData(chunk));
        socket.on('close', () => this.scheduleReconnect());
        socket.on('error', () => this.scheduleReconnect());
    }

    handleData(chunk) {
        this.buffer += chunk.toString();
        let boundary = this.buffer.indexOf('\n');

        while (boundary !== -1) {
            const raw = this.buffer.substring(0, boundary).trim();
            this.buffer = this.buffer.substring(boundary + 1);
            boundary = this.buffer.indexOf('\n');

            if (!raw) continue;

            try {
                const msg = JSON.parse(raw);
                this.handleMessage(msg);
            } catch (e) {
                logger.warn('Invalid bootstrap message received');
            }
        }
    }

    handleMessage(msg) {
        if (msg.type === 'PEER_LIST') {
            logger.info(`Received ${msg.peers.length} peers from Bootstrap`);
            msg.peers.forEach((p) => {
                if (p.id !== this.peer.id) {
                    this.peer.onPeerDiscovered(p.id, p.ip, p.port, 'BOOTSTRAP');
                }
            });
            return;
        }

        if (msg.type === 'RELAY' && msg.message) {
            this.peer.handleRelayedMessage(msg.from, msg.message);
        }
    }

    sendToPeer(targetPeerId, message) {
        if (!this.connected || !this.socket || this.socket.destroyed) return false;

        this.socket.write(JSON.stringify({
            type: 'RELAY',
            from: this.peer.id,
            to: targetPeerId,
            message
        }) + '\n');
        return true;
    }

    broadcast(message) {
        if (!this.connected || !this.socket || this.socket.destroyed) return false;

        this.socket.write(JSON.stringify({
            type: 'RELAY_BROADCAST',
            from: this.peer.id,
            message
        }) + '\n');
        return true;
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;

        this.connected = false;
        this.socket = null;
        logger.warn('Bootstrap relay disconnected. Reconnecting in 3s...');

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 3000);
    }

    stop() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        if (this.socket && !this.socket.destroyed) this.socket.end();
    }
}

module.exports = BootstrapClient;
