// src/config/constants.js
module.exports = {
    // Có thể override qua biến môi trường `BOOTSTRAP_IP` khi client cần kết nối tới server public
    BOOTSTRAP_IP: process.env.BOOTSTRAP_IP || '127.0.0.1', // Đổi thành IP/LAN/public host khi triển khai
    BOOTSTRAP_PORT: Number(process.env.BOOTSTRAP_PORT) || 9000,
    // Địa chỉ lắng nghe của bootstrap-server (dùng khi chạy server trực tiếp từ repo)
    BOOTSTRAP_LISTEN_ADDR: process.env.BOOTSTRAP_LISTEN_ADDR || process.env.LISTEN_ADDR || '::',

    UDP_PORT: 9001,            // Port dùng chung cho tất cả peer để broadcast UDP
    BROADCAST_IP: '255.255.255.255',
    DISCOVERY_INTERVAL: 3000,   // Cứ 3 giây hét lên LAN 1 lần
    HEARTBEAT_INTERVAL: 3000,   // Cứ 3s gửi PING 1 lần
    HEARTBEAT_TIMEOUT: 10000,   // Quá 10s không có tín hiệu thì ngắt kết nối
    MAX_RETRIES: 3,             // Số lần thử gửi lại tối đa
    ACK_TIMEOUT: 5000           // Thời gian chờ ACK (5 giây)
};
