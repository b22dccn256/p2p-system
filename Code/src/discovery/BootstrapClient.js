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
        this.lastStatus = {
            connected: false,
            host: BOOTSTRAP_IP,
            port: BOOTSTRAP_PORT
        };
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
            this.updateStatus(true);
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
            this.peer.syncBootstrapPeers(msg.peers.map((p) => p.id));
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

        const wasConnected = this.connected;
        this.connected = false;
        this.socket = null;
        this.updateStatus(false);
        logger.warn('Bootstrap relay disconnected. Reconnecting in 3s...');

        // Khi bootstrap server mất kết nối, đóng tất cả kết nối P2P
        // để peer không thể tiếp tục chat khi server offline
        if (wasConnected) {
            this._disconnectAllPeers();
        }

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 3000);
    }

    /**
     * Đóng tất cả kết nối TCP P2P và xóa danh sách peer khi bootstrap server offline.
     * Điều này đảm bảo peer KHÔNG THỂ tiếp tục chat khi mất kết nối server.
     */
    _disconnectAllPeers() {
        logger.warn('🔌 Bootstrap server offline — đang đóng tất cả kết nối P2P...');

        // Lấy danh sách peer hiện tại trước khi xóa
        const peerIds = Array.from(this.peer.knownPeers);

        // Đóng tất cả socket TCP P2P
        for (const [peerId, socket] of this.peer.tcpHandler.activeConnections.entries()) {
            if (!socket.destroyed) {
                socket.destroy();
            }
            this.peer.tcpHandler.activeConnections.delete(peerId);
        }

        // Xóa tất cả peer khỏi danh sách và thông báo cho UI
        for (const peerId of peerIds) {
            this.peer.knownPeers.delete(peerId);
            this.peer.peerTimestamps.delete(peerId);
            this.peer.peerSources.delete(peerId);
            this.peer.groupChat.removePeerFromAllRooms(peerId);
            this.peer.messageQueue.onPeerDisconnect(peerId);
            this.peer.emit('peer-disconnected', peerId);
        }

        logger.warn(`❌ Đã ngắt kết nối ${peerIds.length} peer(s) do bootstrap server offline.`);
    }

    stop() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        if (this.socket && !this.socket.destroyed) this.socket.end();
    }

    updateStatus(connected) {
        this.lastStatus = {
            connected,
            host: BOOTSTRAP_IP,
            port: BOOTSTRAP_PORT
        };
        this.peer.emit('bootstrap-status', this.lastStatus);
    }

    getStatus() {
        return this.lastStatus;
    }
}

module.exports = BootstrapClient;
