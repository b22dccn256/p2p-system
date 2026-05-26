// src/churn-controller.js
//
// Churn Controller — Điều phối toàn bộ quá trình mô phỏng churn:
//   1. Spawn N peer processes song song
//   2. Khi một peer chết (process exit), spawn peer mới thay thế
//   3. Thu thập và in báo cáo tổng hợp khi kết thúc
//
// Cách chạy:
//   node src/churn-controller.js [options]
//
// Options (biến môi trường hoặc CLI args):
//   --peers   N     Số peer chạy đồng thời (mặc định: 5)
//   --duration S    Tổng thời gian chạy simulation tính bằng giây (mặc định: 120)
//   --min     S     Thời gian sống tối thiểu mỗi peer (giây, mặc định: 15)
//   --max     S     Thời gian sống tối đa mỗi peer (giây, mặc định: 40)
//   --chat    S     Khoảng cách giữa 2 lần gửi tin (giây, mặc định: 6)

const { spawn } = require('child_process');
const path = require('path');
const chalk = require('chalk');

// ─── Parse CLI args ──────────────────────────────────────────────────────────
function getArg(name, defaultVal) {
    const idx = process.argv.indexOf(`--${name}`);
    if (idx !== -1 && process.argv[idx + 1]) {
        return Number(process.argv[idx + 1]);
    }
    return defaultVal;
}

const CONFIG = {
    CONCURRENT_PEERS:  getArg('peers',    5),    // Số peer chạy đồng thời
    TOTAL_DURATION_S:  getArg('duration', 120),  // Tổng thời gian simulation (giây)
    LIFETIME_MIN_S:    getArg('min',      15),   // Thời gian sống tối thiểu (giây)
    LIFETIME_MAX_S:    getArg('max',      40),   // Thời gian sống tối đa (giây)
    CHAT_INTERVAL_S:   getArg('chat',     6),    // Khoảng cách gửi tin (giây)
    SPAWN_DELAY_MS:    1500,                     // Delay giữa các lần spawn (ms) — tránh flood bootstrap
};

// ─── Metrics tổng hợp ────────────────────────────────────────────────────────
const globalStats = {
    totalSpawned:   0,
    totalCompleted: 0,
    totalCrashed:   0,
    startTime:      Date.now(),
};

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
    info:    (m) => console.log(chalk.blue(`[Controller] ${m}`)),
    success: (m) => console.log(chalk.green(`[Controller] ${m}`)),
    warn:    (m) => console.log(chalk.yellow(`[Controller] ${m}`)),
    error:   (m) => console.log(chalk.red(`[Controller] ${m}`)),
    header:  (m) => console.log(chalk.bold.cyan(m)),
};

// ─── Spawn một peer process ──────────────────────────────────────────────────
let peerIndexCounter = 0;
let isShuttingDown = false;
const activeProcesses = new Set();

function spawnPeer() {
    if (isShuttingDown) return;

    const idx = peerIndexCounter++;
    const env = {
        ...process.env,
        PEER_LIFETIME_MIN:  String(CONFIG.LIFETIME_MIN_S  * 1000),
        PEER_LIFETIME_MAX:  String(CONFIG.LIFETIME_MAX_S  * 1000),
        CHAT_INTERVAL:      String(CONFIG.CHAT_INTERVAL_S * 1000),
        PEER_INDEX:         String(idx),
    };

    const simulatorPath = path.join(__dirname, 'churn-simulator.js');
    const child = spawn(process.execPath, [simulatorPath], {
        env,
        stdio: 'inherit', // In thẳng ra terminal của controller
    });

    globalStats.totalSpawned++;
    activeProcesses.add(child);
    log.info(`⬆️  Spawn peer #${idx} (PID: ${child.pid}) — tổng đã spawn: ${globalStats.totalSpawned}`);

    child.on('exit', (code) => {
        activeProcesses.delete(child);

        if (code === 0 || code === null) {
            globalStats.totalCompleted++;
            log.success(`⬇️  Peer #${idx} rời mạng bình thường (tổng hoàn thành: ${globalStats.totalCompleted})`);
        } else {
            globalStats.totalCrashed++;
            log.warn(`💥 Peer #${idx} crash với code=${code} (tổng crash: ${globalStats.totalCrashed})`);
        }

        // Spawn peer mới thay thế ngay sau khi peer cũ chết
        if (!isShuttingDown) {
            setTimeout(spawnPeer, CONFIG.SPAWN_DELAY_MS);
        }
    });

    child.on('error', (err) => {
        log.error(`Không thể spawn peer #${idx}: ${err.message}`);
        activeProcesses.delete(child);
    });
}

// ─── In báo cáo tổng kết ─────────────────────────────────────────────────────
function printFinalReport() {
    const elapsed = ((Date.now() - globalStats.startTime) / 1000).toFixed(1);
    const crashRate = globalStats.totalSpawned > 0
        ? ((globalStats.totalCrashed / globalStats.totalSpawned) * 100).toFixed(1)
        : '0.0';

    console.log('');
    log.header('╔══════════════════════════════════════════════════════╗');
    log.header('║           📊 BÁO CÁO CHURN SIMULATION               ║');
    log.header('╠══════════════════════════════════════════════════════╣');
    log.header(`║  Thời gian chạy      : ${elapsed}s`.padEnd(55) + '║');
    log.header(`║  Tổng peer đã spawn  : ${globalStats.totalSpawned}`.padEnd(55) + '║');
    log.header(`║  Hoàn thành bình thường: ${globalStats.totalCompleted}`.padEnd(55) + '║');
    log.header(`║  Crash / lỗi         : ${globalStats.totalCrashed} (${crashRate}%)`.padEnd(55) + '║');
    log.header(`║  Peer đồng thời      : ${CONFIG.CONCURRENT_PEERS}`.padEnd(55) + '║');
    log.header(`║  Lifetime range      : ${CONFIG.LIFETIME_MIN_S}s – ${CONFIG.LIFETIME_MAX_S}s`.padEnd(55) + '║');
    log.header('╚══════════════════════════════════════════════════════╝');
    console.log('');
}

// ─── Graceful shutdown toàn bộ ───────────────────────────────────────────────
function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.warn(`\n🛑 Đang dừng simulation — chờ ${activeProcesses.size} peer(s) tắt...`);

    // Kill tất cả child processes còn sống
    for (const child of activeProcesses) {
        try { child.kill('SIGTERM'); } catch (_) {}
    }

    // Đợi tối đa 3s rồi in báo cáo
    setTimeout(() => {
        printFinalReport();
        process.exit(0);
    }, 3000);
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
    console.log('');
    log.header('╔══════════════════════════════════════════════════════╗');
    log.header('║         🌀 CHURN SIMULATOR — CONTROLLER              ║');
    log.header('╠══════════════════════════════════════════════════════╣');
    log.header(`║  Peer đồng thời  : ${CONFIG.CONCURRENT_PEERS}`.padEnd(55) + '║');
    log.header(`║  Tổng thời gian  : ${CONFIG.TOTAL_DURATION_S}s`.padEnd(55) + '║');
    log.header(`║  Lifetime        : ${CONFIG.LIFETIME_MIN_S}s – ${CONFIG.LIFETIME_MAX_S}s / peer`.padEnd(55) + '║');
    log.header(`║  Chat interval   : mỗi ${CONFIG.CHAT_INTERVAL_S}s / peer`.padEnd(55) + '║');
    log.header(`║  Spawn delay     : ${CONFIG.SPAWN_DELAY_MS}ms giữa các peer`.padEnd(55) + '║');
    log.header('╚══════════════════════════════════════════════════════╝');
    console.log('');

    log.info('Đảm bảo Bootstrap Server đang chạy trước khi tiếp tục...');
    log.info(`Bắt đầu spawn ${CONFIG.CONCURRENT_PEERS} peer đồng thời...\n`);

    // Spawn N peer ban đầu, mỗi cái cách nhau SPAWN_DELAY_MS để tránh flood
    for (let i = 0; i < CONFIG.CONCURRENT_PEERS; i++) {
        setTimeout(spawnPeer, i * CONFIG.SPAWN_DELAY_MS);
    }

    // Dừng simulation sau TOTAL_DURATION_S giây
    setTimeout(() => {
        log.warn(`\n⏰ Hết thời gian simulation (${CONFIG.TOTAL_DURATION_S}s). Đang dừng...`);
        shutdown();
    }, CONFIG.TOTAL_DURATION_S * 1000);

    // Bắt Ctrl+C
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main();
