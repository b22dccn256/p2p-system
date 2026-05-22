// src/cli.js
const readline = require('readline');
const Peer = require('./core/Peer');
const logger = require('./config/logger');

async function start() {
    const myId = 'peer_' + Math.random().toString(36).substring(2, 6);
    const node = new Peer(myId);

    await node.start();
    logger.success(`🚀 Định danh của bạn là: ${myId}`);
    logger.info(`Gõ lệnh: /dm <peerId> <msg> | /join <roomId> | /room <roomId> <msg>`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });

    rl.prompt();

    rl.on('line', async (line) => {
        const parts = line.trim().split(' ');
        const cmd = parts[0];

        try {
            if (cmd === '/dm' && parts.length >= 3) {
                // Lệnh: /dm peer_123 Hello world
                const target = parts[1];
                const text = parts.slice(2).join(' ');
                const success = await node.directChat.send(target, text);
                if (success) {
                    logger.success(`Đã gửi tới ${target} thành công! (Nhận được ACK)`);
                }
            }
            else if (cmd === '/join' && parts.length === 2) {
                // Lệnh: /join room_game
                node.groupChat.joinRoom(parts[1]);
            }
            else if (cmd === '/room' && parts.length >= 3) {
                // Lệnh: /room room_game Chào mọi người
                const room = parts[1];
                const text = parts.slice(2).join(' ');
                node.groupChat.broadcast(room, text);
            }
            else {
                logger.warn('Lệnh không hợp lệ!');
            }
        } catch (err) {
            logger.error(err.message);
        }

        setTimeout(() => rl.prompt(), 100); // Tránh bị dính log
    });
}

start();