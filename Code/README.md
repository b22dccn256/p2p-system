# 🌐 P2P Chat & Messenger System (E2EE + Store-and-Forward)

Hệ thống Chat Ngang Hàng (P2P) phi tập trung được phát triển bằng **Node.js** và **Electron**, hỗ trợ mã hóa đầu cuối **E2EE (ECDH + AES-256-GCM)** và cơ chế gửi tin nhắn ngoại tuyến **Store-and-Forward** cực kỳ thông minh.

Tài liệu này hướng dẫn chi tiết cách chạy thử nghiệm hệ thống cho cả 2 kịch bản: **Chạy thử nghiệm đa Node trên 1 máy tính (Isolated Profiles)** và **Chạy kết nối giữa nhiều máy tính thực tế (LAN / VPN)**.

---

## 🛠️ 1. Chuẩn bị môi trường (Chung cho các máy)

Trước khi bắt đầu, hãy đảm bảo tất cả máy tính đã cài đặt **Node.js** (Khuyên dùng v18+).

Mở Terminal tại thư mục `Code` của dự án và cài đặt các gói phụ thuộc:
```powershell
npm install
```

---

## 💻 2. KỊCH BẢN 1: Kiểm thử nhanh trên CÙNG MỘT MÁY TÍNH
> [!NOTE]
> Hệ thống đã được nâng cấp cơ chế **Cô lập Profile**. Mỗi profile sẽ tự động sử dụng một thư mục Cache Electron riêng biệt (tránh hoàn toàn lỗi tranh chấp `Access is denied`) và tự lưu trữ khóa mật mã E2EE để không bị mất khi bật tắt.

Bạn có thể giả lập 3 người dùng khác nhau (NodeA, NodeB, NodeC) trò chuyện với nhau ngay trên màn hình máy tính của mình.

### Bước 1: Khởi động Bootstrap Server (Server danh bạ)
Mở một cửa sổ PowerShell mới và chạy:
```powershell
powershell -ExecutionPolicy Bypass -File .\start-lan-server.ps1
```
*(Cửa sổ này đóng vai trò máy chủ trung gian mồi, hãy để nguyên và không tắt đi).*

### Bước 2: Khởi động các Node người dùng riêng biệt
Mở tiếp 3 cửa sổ PowerShell khác và chạy lần lượt 3 lệnh sau để khởi động 3 giao diện Chat độc lập:

* **Mở Node A (Người dùng A):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\start-lan-gui.ps1 -BootstrapIp 127.0.0.1 -Profile NodeA
  ```
* **Mở Node B (Người dùng B):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\start-lan-gui.ps1 -BootstrapIp 127.0.0.1 -Profile NodeB
  ```
* **Mở Node C (Người dùng C - Làm trung gian chuyển tiếp):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\start-lan-gui.ps1 -BootstrapIp 127.0.0.1 -Profile NodeC
  ```

---

## 📶 3. KỊCH BẢN 2: Triển khai trên NHIỀU MÁY TÍNH (Mạng LAN / Radmin VPN)

Khi muốn kết nối các máy tính khác nhau (trong cùng mạng WiFi hoặc qua mạng ảo Radmin VPN):

### Máy X (Máy chủ mạng):
1. Bật Bootstrap Server:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-lan-server.ps1
   ```
2. Lấy **Địa chỉ IP mạng** của Máy X (Ví dụ trong LAN là `192.168.1.15`, hoặc IP Radmin VPN là `26.126.65.246`).
3. Mở GUI trên Máy X trỏ về chính mình:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-lan-gui.ps1 -BootstrapIp 127.0.0.1 -Profile NodeX
   ```

### Các Máy Khác (Máy A, B, C...):
Mở PowerShell tại thư mục `Code` của dự án và chạy GUI, trỏ tham số `-BootstrapIp` về **IP của Máy X**:
```powershell
powershell -ExecutionPolicy Bypass -File .\start-lan-gui.ps1 -BootstrapIp 26.126.65.246 -Profile NodeA
```
*(Thay thế `26.126.65.246` bằng IP thực tế của Máy X).*

---

## 🧪 4. Quy trình Test Đồ Án ấn tượng (Kiểm thử Store-and-Forward)

Để biểu diễn cơ chế **Gửi tin nhắn ngoại tuyến qua nút trung gian (Store-and-Forward)** kết hợp **Mã hóa E2EE**:

1. **Khởi động:** Bật cả 3 Node (NodeA, NodeB, NodeC) online. Cả 3 sẽ tự động bắt tay E2EE và lưu khóa của nhau vào tệp cấu hình profile.
2. **Node B Offline:** Tắt cửa sổ Node B đi (Node B rời mạng). Đợi 10 giây để hệ thống nhận diện Node B offline.
3. **Gửi tin nhắn:** Dùng **Node A** gửi tin nhắn riêng cho **Node B**. 
   - Vì Node B đang offline, Node A sẽ tự động gửi gói tin đã mã hóa E2EE nhờ **Node C** giữ hộ.
   - Node C sẽ log dòng chữ: `[Store-and-Forward] Đã lưu hộ tin nhắn cho peer_vhuo. Sẽ chuyển tiếp khi họ online.`
4. **Node B Online lại:** Bật lại Node B (`-Profile NodeB`).
5. **Bùm!** Node C lập tức tự động bàn giao gói tin. Node B nhận lại tin nhắn, tự động sử dụng khóa mật mã cũ đã lưu để giải mã hoàn hảo và hiển thị nội dung trực tiếp trên giao diện đồ họa (UI)!

---

## 🛡️ Khắc phục sự cố nhanh (Troubleshooting)

> [!WARNING]
> **Lỗi ExecutionPolicy trên Windows:**
> Nếu PowerShell báo lỗi script bị chặn không cho chạy (do chính sách bảo mật của Windows), hãy chắc chắn rằng bạn đã thêm tiền tố `powershell -ExecutionPolicy Bypass -File` trước đường dẫn script như hướng dẫn phía trên.