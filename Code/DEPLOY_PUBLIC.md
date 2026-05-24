# Triển khai Bootstrap Server cho người dùng ngoài

Mục tiêu: Cho phép peers trên Internet (WAN) đăng ký và nhận `PEER_LIST` từ bootstrap server.

1) Chạy server trên VPS/public host

- SSH vào VPS, clone repo hoặc copy folder `bootstrap-server`.
- Cài Node.js và pm2 (hoặc dùng systemd):

```bash
# Ubuntu example
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2

# trên VPS
git clone <repo-url> p2p-system
cd p2p-system/Code/bootstrap-server
npm install
# chạy
PORT=9000 LISTEN_ADDR=0.0.0.0 pm2 start server.js --name bootstrap-server
pm2 save
```

2) Mở port trên firewall / cloud provider

- Mở TCP port 9000 (hoặc port bạn chọn) trên firewall/VPC/security group.

3) Cập nhật client để kết nối tới server public

- Trên máy client (hoặc trong build), đặt `BOOTSTRAP_IP` thành IP công khai hoặc domain của VPS.
- Ví dụ chạy peer local để test:

```bash
# tại thư mục repo root
# đặt biến môi trường để client dùng
export BOOTSTRAP_IP=your.public.ip.or.domain
export BOOTSTRAP_PORT=9000
node src/index.js # hoặc chạy CLI mà repo có
```

4) Lưu ý an ninh (tối thiểu)

- Hiện bootstrap-server chỉ nhận/tra về danh sách peers (không relay tin nhắn). Nếu để public, bất kỳ ai biết IP/port đều có thể đăng ký.
- Để hạn chế truy cập: thêm token đơn giản trong REGISTER payload và validate tại server, hoặc giới hạn kết nối bằng firewall.
- Để vượt NAT cho P2P, cân nhắc tích hợp STUN/TURN hoặc relay khi cần.

5) Kiểm thử

- Từ máy ngoài mạng LAN, kiểm tra kết nối TCP: `telnet your.public.ip 9000` (hoặc `nc -vz your.public.ip 9000`).
- Chạy 2+ peer với `BOOTSTRAP_IP` trỏ tới public IP và kiểm tra chúng nhận `PEER_LIST` và kết nối P2P.

---

Nếu muốn tôi có thể:
- Thêm token auth đơn giản vào `bootstrap-server` và `Peer.connectToBootstrap()`.
- Tạo `systemd` unit file thay vì hướng dẫn `pm2`.
- Viết script deploy tự động (ssh + pm2)."