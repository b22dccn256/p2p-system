// bootstrap-server/server.js
const net = require('net');
const logger = require('../src/config/logger');
const { BOOTSTRAP_PORT, BOOTSTRAP_LISTEN_ADDR } = require('../src/config/constants');

const peers = new Map(); // Lưu trữ: { peerId: { ip, port, lastSeen } }

const server = net.createServer((socket) => {
    socket.on('data', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Target 1: Nhận REGISTER
            if (msg.type === 'REGISTER') {
                peers.set(msg.peerId, {
                    ip: socket.remoteAddress.replace(/^.*:/, ''), // Xử lý IPv6 to IPv4
                    port: msg.port,
                    lastSeen: Date.now()
                });

                logger.success(`Node registered: ${msg.peerId}`);

                // Target 1 & 4: Trả về peer list
                const peerList = Array.from(peers.entries()).map(([id, info]) => ({ id, ...info }));
                socket.write(JSON.stringify({ type: 'PEER_LIST', peers: peerList }) + '\n');
            }
        } catch (e) {
            logger.error('Invalid message format received');
        }
    });

    socket.on('error', (err) => logger.warn(`Client disconnected: ${err.message}`));
});

const PORT = process.env.PORT || BOOTSTRAP_PORT || 9000;
const LISTEN_ADDR = process.env.LISTEN_ADDR || BOOTSTRAP_LISTEN_ADDR || '0.0.0.0';

server.listen(PORT, LISTEN_ADDR, () => {
    logger.info(`🚀 Bootstrap server running on ${LISTEN_ADDR}:${PORT}`);
});