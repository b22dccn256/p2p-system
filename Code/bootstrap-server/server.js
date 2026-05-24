const net = require('net');
const logger = require('../src/config/logger');
const { BOOTSTRAP_PORT, BOOTSTRAP_LISTEN_ADDR } = require('../src/config/constants');

const peers = new Map();
const peerSockets = new Map();

const server = net.createServer((socket) => {
    socket.setKeepAlive(true, 30000);

    let registeredPeerId = null;
    let buffer = '';

    socket.on('data', (data) => {
        buffer += data.toString();
        let boundary = buffer.indexOf('\n');

        while (boundary !== -1) {
            const raw = buffer.substring(0, boundary).trim();
            buffer = buffer.substring(boundary + 1);
            boundary = buffer.indexOf('\n');

            if (raw) handleMessage(raw);
        }
    });

    socket.on('close', () => {
        if (registeredPeerId && peerSockets.get(registeredPeerId) === socket) {
            peerSockets.delete(registeredPeerId);
            peers.delete(registeredPeerId);
            logger.warn(`Node disconnected: ${registeredPeerId}`);
            logger.info(`Online peers: ${peerSockets.size}`);
            broadcastPeerList(registeredPeerId);
        }
    });

    socket.on('error', (err) => logger.warn(`Client disconnected: ${err.message}`));

    function handleMessage(raw) {
        try {
            const msg = JSON.parse(raw);

            if (msg.type === 'REGISTER' && msg.peerId) {
                registeredPeerId = msg.peerId;
                peers.set(msg.peerId, {
                    ip: normalizeRemoteAddress(socket.remoteAddress),
                    port: msg.port,
                    lastSeen: Date.now()
                });
                peerSockets.set(msg.peerId, socket);

                logger.success(`Node registered: ${msg.peerId}`);
                logger.info(`Online peers: ${peerSockets.size}`);
                sendPeerList(socket);
                broadcastPeerList(msg.peerId);
                return;
            }

            if (msg.type === 'RELAY' && msg.to && msg.message) {
                relayToPeer(msg.to, {
                    type: 'RELAY',
                    from: registeredPeerId || msg.from,
                    message: msg.message
                });
                return;
            }

            if (msg.type === 'RELAY_BROADCAST' && msg.message) {
                let sentCount = 0;
                for (const [peerId, peerSocket] of peerSockets.entries()) {
                    if (peerId === registeredPeerId || peerSocket.destroyed) continue;
                    peerSocket.write(JSON.stringify({
                        type: 'RELAY',
                        from: registeredPeerId || msg.from,
                        message: msg.message
                    }) + '\n');
                    sentCount++;
                }
                logger.info(`Relayed broadcast from ${registeredPeerId || msg.from} to ${sentCount} peer(s)`);
            }
        } catch (e) {
            logger.error('Invalid message format received');
        }
    }
});

function normalizeRemoteAddress(address) {
    if (!address) return address;
    if (address.startsWith('::ffff:')) return address.substring(7);
    return address;
}

function sendPeerList(socket) {
    const peerList = Array.from(peers.entries()).map(([id, info]) => ({ id, ...info }));
    socket.write(JSON.stringify({ type: 'PEER_LIST', peers: peerList }) + '\n');
}

function broadcastPeerList(exceptPeerId) {
    const payload = JSON.stringify({
        type: 'PEER_LIST',
        peers: Array.from(peers.entries()).map(([id, info]) => ({ id, ...info }))
    }) + '\n';

    for (const [peerId, socket] of peerSockets.entries()) {
        if (peerId === exceptPeerId || socket.destroyed) continue;
        socket.write(payload);
    }
}

function relayToPeer(peerId, payload) {
    const socket = peerSockets.get(peerId);
    if (!socket || socket.destroyed) {
        logger.warn(`Relay target offline: ${peerId}`);
        return false;
    }

    socket.write(JSON.stringify(payload) + '\n');
    return true;
}

const PORT = process.env.PORT || BOOTSTRAP_PORT || 9000;
const LISTEN_ADDR = process.env.LISTEN_ADDR || BOOTSTRAP_LISTEN_ADDR || '::';

server.listen(PORT, LISTEN_ADDR, () => {
    logger.info(`Bootstrap server running on ${LISTEN_ADDR}:${PORT}`);
});
