// bootstrap-server/server.js
const net = require('net');
const logger = require('../src/config/logger');

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

server.listen(9000, () => {
    logger.info('🚀 Bootstrap server running on TCP port 9000');
});