const Peer = require('./src/core/Peer');
const logger = require('./src/config/logger');

// Mô phỏng Churn: Các Node tham gia và rời mạng liên tục
async function runChurnSimulation() {
    logger.info("🌪️ Bắt đầu mô phỏng CHURN (Tắt/Mở Peer liên tục)...");
    
    const peers = [];
    const NUM_PEERS = 5;

    // Khởi tạo 5 peer
    for (let i = 0; i < NUM_PEERS; i++) {
        const id = `churn_node_${i}`;
        const p = new Peer(id);
        await p.start();
        peers.push({ id, instance: p, isOnline: true });
        logger.success(`[Churn] Đã tạo node: ${id}`);
    }

    // Vòng lặp ngẫu nhiên tắt / mở các peer
    setInterval(async () => {
        const targetIndex = Math.floor(Math.random() * NUM_PEERS);
        const target = peers[targetIndex];

        if (target.isOnline) {
            // Đang online -> Giả lập sập nguồn (Rời mạng)
            logger.warn(`[Churn Event] 🔴 Node ${target.id} ĐỘT NGỘT SẬP NGUỒN!`);
            
            target.instance.isShuttingDown = true;
            // Gửi gói LEAVE
            const leaveMsg = JSON.stringify({ type: 'LEAVE', from: target.id }) + '\n';
            for (const socket of target.instance.tcpHandler.activeConnections.values()) {
                if (!socket.destroyed) {
                    socket.write(leaveMsg);
                    socket.destroy();
                }
            }
            target.instance.udpHandler.stop();
            target.instance.bootstrapClient.stop();
            target.isOnline = false;
            
        } else {
            // Đang offline -> Khởi động lại (Tham gia mạng)
            logger.success(`[Churn Event] 🟢 Node ${target.id} ĐÃ KHÔI PHỤC KẾT NỐI!`);
            
            // Tạo instance mới để thay thế
            target.instance = new Peer(target.id);
            await target.instance.start();
            target.isOnline = true;
        }
        
    }, 4000); // Mỗi 4 giây có 1 node sập hoặc sống lại
}

runChurnSimulation();
