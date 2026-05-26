// src/churn-simulator.js
//
// Mô phỏng Churn: Một peer tự động tham gia mạng, gửi tin nhắn ngẫu nhiên,
// rồi rời mạng sau một khoảng thời gian ngẫu nhiên.
//
// Được gọi bởi start-churn.ps1 hoặc churn-controller.js
// Biến môi trường:
//   PEER_LIFETIME_MIN  — thời gian sống tối thiểu (ms), mặc định 15000
//   PEER_LIFETIME_MAX  — thời gian sống tối đa (ms),   mặc định 40000
//   CHAT_INTERVAL      — khoảng cách giữa 2 lần gửi tin (ms), mặc định 6000
//   PEER_INDEX         — số thứ tự peer (để log dễ đọc), mặc định 0

const Peer = require('./core/Peer');
const logger = require('./config/logger');

// ─── Tham số ────────────────────────────────────────────────────────────────
const LIFETIME_MIN  = Number(process.env.PEER_LIFETIME_MIN)  || 15000; // 15s
const LIFETIME_MAX  = Number(process.env.PEER_LIFETIME_MAX)  || 40000; // 40s
const CHAT_INTERVAL = Number(process.env.CHAT_INTERVAL)      || 6000;  // 6s
const PEER_INDEX    = Number(process.env.PEER_INDEX)         || 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Danh sách tin nhắn mẫu để gửi ngẫu nhiên
const SAMPLE_MESSAGES = [
    'Xin chào mạng P2P!',
    'Peer đang hoạt động bình thường.',
    'Kiểm tra kết nối...',
    'Tin nhắn thử nghiệm từ churn simulator.',
    'Hello from churn peer!',
    'Đang mô phỏng churn...',
    'P2P network test message.',
    'Tôi sẽ rời mạng sớm thôi!',
    'Kết nối ổn định không?',
    'Gửi tin trước khi offline.',
];

// ─── Main ────────────────────────────────────────────────────────────────────
async function run() {
    const lifetime = randInt(LIFETIME_MIN, LIFETIME_MAX);
    const myId = `churn_${PEER_INDEX}_${Math.random().toString(36).substring(2, 5)}`;

    logger.info(`[Churn #${PEER_INDEX}] Peer "${myId}" khởi động — sẽ sống ${(lifetime / 1000).toFixed(1)}s`);

    const node = new Peer(myId);

    // ── Metrics cục bộ ──────────────────────────────────────────────────────
    const stats = {
        sent: 0,
        ackOk: 0,
        ackFail: 0,
        peersDiscovered: new Set(),
        joinTime: Date.now(),
    };

    // ── Lắng nghe peer-discovered để log ────────────────────────────────────
    node.on('peer-discovered', ({ peerId }) => {
        if (!stats.peersDiscovered.has(peerId)) {
            stats.peersDiscovered.add(peerId);
            logger.info(`[Churn #${PEER_INDEX}] 🔍 Phát hiện peer: ${peerId} (tổng: ${stats.peersDiscovered.size})`);
        }
    });

    node.on('peer-disconnected', (peerId) => {
        logger.warn(`[Churn #${PEER_INDEX}] ❌ Peer rời mạng: ${peerId}`);
    });

    // ── Khởi động peer ───────────────────────────────────────────────────────
    await node.start();
    logger.success(`[Churn #${PEER_INDEX}] ✅ "${myId}" đã tham gia mạng`);

    // ── Gửi tin nhắn định kỳ ────────────────────────────────────────────────
    // Chờ 3s sau khi join để có thời gian phát hiện peer và trao đổi khóa E2EE
    const WARMUP_DELAY = 3000;

    let chatTimerHandle = null;
    let chatStopped = false;

    function sendLoop() {
        if (chatStopped) return;

        const peers = Array.from(node.knownPeers);

        if (peers.length === 0) {
            // Chưa có peer nào → thử lại sau
            chatTimerHandle = setTimeout(sendLoop, CHAT_INTERVAL);
            return;
        }

        // Chọn ngẫu nhiên: gửi DM hoặc broadcast toàn mạng
        const useGlobal = Math.random() < 0.3; // 30% gửi broadcast, 70% gửi DM

        if (useGlobal) {
            const text = `[Global] ${randItem(SAMPLE_MESSAGES)}`;
            node.globalChat.broadcast(text);
            stats.sent++;
            logger.info(`[Churn #${PEER_INDEX}] 📢 Broadcast: "${text}"`);
        } else {
            const target = randItem(peers);
            const text = `[DM→${target.substring(0, 10)}] ${randItem(SAMPLE_MESSAGES)}`;
            stats.sent++;

            node.directChat.send(target, text)
                .then((ok) => {
                    if (ok) {
                        stats.ackOk++;
                        logger.success(`[Churn #${PEER_INDEX}] ✉️  DM tới ${target}: ACK nhận được`);
                    } else {
                        stats.ackFail++;
                        logger.warn(`[Churn #${PEER_INDEX}] ⚠️  DM tới ${target}: Thất bại`);
                    }
                })
                .catch(() => { stats.ackFail++; });
        }

        chatTimerHandle = setTimeout(sendLoop, CHAT_INTERVAL);
    }

    // Bắt đầu vòng gửi tin sau warmup
    chatTimerHandle = setTimeout(sendLoop, WARMUP_DELAY);

    // ── Graceful shutdown sau lifetime ──────────────────────────────────────
    setTimeout(() => {
        chatStopped = true;
        if (chatTimerHandle) clearTimeout(chatTimerHandle);

        const uptime = ((Date.now() - stats.joinTime) / 1000).toFixed(1);
        const successRate = stats.sent > 0
            ? ((stats.ackOk / stats.sent) * 100).toFixed(1)
            : 'N/A';

        logger.warn(`[Churn #${PEER_INDEX}] 🛑 "${myId}" rời mạng sau ${uptime}s`);
        logger.info(
            `[Churn #${PEER_INDEX}] 📊 Thống kê: ` +
            `Gửi=${stats.sent} | ACK_OK=${stats.ackOk} | ACK_FAIL=${stats.ackFail} | ` +
            `Tỉ lệ thành công=${successRate}% | Peers gặp=${stats.peersDiscovered.size}`
        );

        // Gửi LEAVE tới tất cả peer đang kết nối
        node.isShuttingDown = true;
        const leaveMsg = JSON.stringify({ type: 'LEAVE', from: node.id }) + '\n';
        for (const socket of node.tcpHandler.activeConnections.values()) {
            try { socket.write(leaveMsg); socket.end(); } catch (_) {}
        }

        setTimeout(() => process.exit(0), 500);
    }, lifetime);
}

run().catch((err) => {
    logger.error(`[Churn] Lỗi khởi động: ${err.message}`);
    process.exit(1);
});
