// src/config/constants.js
module.exports = {
    BOOTSTRAP_IP: '127.0.0.1', // Đổi thành IP LAN của máy chạy bootstrap nếu test nhiều máy
    BOOTSTRAP_PORT: 9000,
    UDP_PORT: 9001,            // Port dùng chung cho tất cả peer để broadcast UDP
    BROADCAST_IP: '255.255.255.255',
    DISCOVERY_INTERVAL: 3000   // Cứ 3 giây hét lên LAN 1 lần
};