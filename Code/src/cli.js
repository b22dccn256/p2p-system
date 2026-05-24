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

    // Xử lý Graceful Shutdown (Tắt ứng dụng an toàn bằng Ctrl+C)
    process.on('SIGINT', () => {
        node.isShuttingDown = true; // Báo cho hệ thống biết mình đang tắt
        logger.warn('\n🛑 Đang ngắt kết nối an toàn (Graceful Shutdown)...');
        const leaveMsg = JSON.stringify({ type: 'LEAVE', from: node.id }) + '\n';

        // Gửi tin nhắn chào tạm biệt tới tất cả bạn bè
        for (const socket of node.tcpHandler.activeConnections.values()) {
            socket.write(leaveMsg);
            socket.end(); // Gửi gói tin TCP FIN một cách lịch sự
        }

        // Đợi 500ms cho tin nhắn kịp bay đi trước khi tắt hẳn
        setTimeout(() => {
            logger.success('Đã tắt hệ thống!');
            process.exit(0);
        }, 500);
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
            else if (cmd === '/create' && parts.length >= 2) {
                // Lệnh: /create Tên phòng chat
                const roomName = parts.slice(1).join(' ');
                // Chuyển sang slug không dấu viết liền
                const slug = roomName.normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[đĐ]/g, 'd')
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-');
                
                const randomHash = Math.random().toString(36).substring(2, 6);
                const roomKey = `${slug || 'room'}#${randomHash}`;
                
                logger.success(`🎉 Đã tạo phòng "${roomName}" thành công!`);
                logger.info(`🔑 Room Key (Mã phòng) của bạn là: ${roomKey}`);
                logger.info(`👉 Hãy gửi mã này cho bạn bè để cùng tham gia nhé.`);
                
                node.groupChat.joinRoom(roomKey);
            }
            else if (cmd === '/join' && parts.length === 2) {
                // Lệnh: /join room_game#a8b2
                node.groupChat.joinRoom(parts[1]);
            }
            else if (cmd === '/room' && parts.length >= 3) {
                // Lệnh: /room room_game Chào mọi người
                const room = parts[1];
                const text = parts.slice(2).join(' ');
                node.groupChat.broadcast(room, text);
            }
            else if (cmd === '/leave' && parts.length === 2) {
                // Lệnh: /leave room_game
                node.groupChat.leaveRoom(parts[1]);
            }
            else if (cmd === '/exit') {
                // Lệnh: /exit (Tương đương Ctrl+C nhưng gõ bằng tay)
                process.emit('SIGINT');
                return;
            }
            else if (cmd === '/users') {
                // Lệnh: /users (Xem ai đang online)
                const peers = Array.from(node.knownPeers);
                if (peers.length === 0) {
                    logger.warn('Không có ai online.');
                } else {
                    logger.info(`👥 Đang online (${peers.length} người): ${peers.join(', ')}`);
                }
            }
            else if (cmd === '/keys') {
                // Lệnh: /keys (Xem danh sách khóa mật mã dùng chung E2EE)
                const keysMap = node.keyExchange.sharedSecrets;
                if (keysMap.size === 0) {
                    logger.warn('Chưa thiết lập khóa bảo mật với ai.');
                } else {
                    logger.info(`🔑 DANH SÁCH KHÓA MÃ HÓA E2EE HIỆN TẠI:`);
                    for (const [peerId, secret] of keysMap.entries()) {
                        const hash = require('crypto').createHash('sha256').update(secret).digest('hex');
                        logger.success(`   - ${peerId}: ${hash.substring(0, 32)}... [ĐÃ KÍNH HOẠT 🛡️]`);
                    }
                }
            }
            else if (cmd === '/freeze' && parts.length === 2) {
                // Lệnh: /freeze peer_123 (Test giả lập đứt cáp mạng)
                const target = parts[1];
                node.frozenPeers.add(target);
                logger.warn(`✂️ Đã cắt dây cáp mạng ảo tới ${target}. Chờ 10s xem Heartbeat...`);
            }
            else if (cmd === '/help') {
                console.log(`
╔══════════════════════════════════════════════════╗
║              📖 DANH SÁCH LỆNH                   ║
╠══════════════════════════════════════════════════╣
║  /dm <peerId> <msg>   Gửi tin nhắn riêng (E2EE)  ║
║  /create <roomName>   Tạo phòng tự sinh Room Key  ║
║  /join <roomKey>      Tham gia phòng bằng Key    ║
║  /leave <roomKey>     Rời khỏi phòng chat        ║
║  /room <roomKey> <msg> Gửi tin vào phòng (E2EE)  ║
║  /users               Xem ai đang online         ║
║  /keys                Xem khóa mã hóa E2EE       ║
║  /exit                Thoát ứng dụng             ║
║  /freeze <peerId>     [Test] Giả lập đứt mạng    ║
╚══════════════════════════════════════════════════╝
                `);
            }
            else {
                logger.warn('Lệnh không hợp lệ! Gõ /help để xem danh sách lệnh.');
            }
        } catch (err) {
            logger.error(err.message);
        }

        setTimeout(() => rl.prompt(), 100); // Tránh bị dính log
    });
}

start();