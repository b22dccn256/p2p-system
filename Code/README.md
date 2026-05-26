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

---

## 🌀 5. Mô phỏng Churn (Peer tham gia và rời mạng liên tục)

**Churn** là hiện tượng các peer liên tục tham gia và rời khỏi mạng P2P — đây là điều kiện thực tế nhất để kiểm tra độ ổn định của hệ thống.

Tính năng này tự động hóa toàn bộ quá trình: spawn nhiều peer cùng lúc, mỗi peer tự gửi tin nhắn ngẫu nhiên rồi tự rời mạng sau một khoảng thời gian, sau đó một peer mới được tạo ra thay thế liên tục.

---

### 🔧 Yêu cầu trước khi chạy

- Đã cài **Node.js** v18+ và chạy `npm install` trong thư mục `Code`
- Đang ở thư mục `Code` trong terminal

---

### ▶️ Cách chạy đơn giản nhất

Mở **PowerShell** tại thư mục `Code` và chạy lệnh sau:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-churn.ps1
```

Lệnh này tự động làm 2 việc:
1. Mở một cửa sổ mới chạy **Bootstrap Server** (máy chủ trung gian)
2. Chạy **Churn Controller** ngay trong terminal hiện tại — spawn 5 peer đồng thời, chạy trong 120 giây rồi tự dừng và in báo cáo

> Không cần làm gì thêm, chỉ cần ngồi quan sát log chạy.

---

### 📋 Các kịch bản test

**Test nhanh — xem kết quả trong 1 phút:**
```powershell
powershell -ExecutionPolicy Bypass -File .\start-churn.ps1 -Peers 3 -Duration 60
```

**Test mặc định — 5 peer, 2 phút:**
```powershell
powershell -ExecutionPolicy Bypass -File .\start-churn.ps1
```

**Test tải cao — 8 peer, 3 phút:**
```powershell
powershell -ExecutionPolicy Bypass -File .\start-churn.ps1 -Peers 8 -Duration 180
```

**Test churn cực nhanh — peer sống rất ngắn (10–20s), kiểm tra phát hiện disconnect:**
```powershell
powershell -ExecutionPolicy Bypass -File .\start-churn.ps1 -Peers 5 -Duration 120 -Min 10 -Max 20
```

**Nếu Bootstrap Server đã đang chạy sẵn (không muốn mở thêm cửa sổ):**
```powershell
powershell -ExecutionPolicy Bypass -File .\start-churn.ps1 -SkipServer
```

---

### 👀 Đọc hiểu output khi chạy

Khi chạy, terminal sẽ hiện log liên tục từ tất cả các peer. Dưới đây là giải thích các dòng log quan trọng:

```
[Controller] ⬆️  Spawn peer #0 (PID: 1234)     ← Peer mới vừa được tạo ra
[Churn #0] ✅ "churn_0_abc" đã tham gia mạng   ← Peer đã kết nối thành công
[Churn #0] 🔍 Phát hiện peer: churn_1_xyz       ← Peer tìm thấy người khác
[Churn #1] ✉️  DM tới churn_0_abc: ACK nhận được ← Gửi tin nhắn thành công
[Churn #2] ⚠️  DM tới churn_1_xyz: Thất bại     ← Peer kia đã offline trước khi nhận
[Churn #0] 🛑 "churn_0_abc" rời mạng sau 23.4s  ← Peer tự tắt đúng kế hoạch
[Churn #0] 📊 Gửi=3 | ACK_OK=2 | ACK_FAIL=1    ← Thống kê của peer đó
[Controller] ⬇️  Peer #0 rời mạng bình thường   ← Controller ghi nhận
[Controller] ⬆️  Spawn peer #5 (PID: 5678)      ← Peer mới được tạo bù ngay
```

Cửa sổ **Bootstrap Server** sẽ hiện số peer online tăng giảm liên tục — đó là churn đang hoạt động đúng:
```
[SUCCESS] Node registered: churn_0_abc  →  Online peers: 1
[SUCCESS] Node registered: churn_1_xyz  →  Online peers: 2
[WARN] Node disconnected: churn_0_abc   →  Online peers: 1
[SUCCESS] Node registered: churn_5_def  →  Online peers: 2
```

---

### 📊 Đọc hiểu báo cáo cuối

Sau khi hết thời gian (hoặc nhấn `Ctrl+C` để dừng sớm), Controller in báo cáo tổng kết:

```
╔══════════════════════════════════════════════════════╗
║           📊 BÁO CÁO CHURN SIMULATION               ║
╠══════════════════════════════════════════════════════╣
║  Thời gian chạy        : 120.3s                      ║
║  Tổng peer đã spawn    : 18                          ║
║  Hoàn thành bình thường: 16                          ║
║  Crash / lỗi           : 2 (11.1%)                  ║
║  Peer đồng thời        : 5                           ║
║  Lifetime range        : 15s – 40s                   ║
╚══════════════════════════════════════════════════════╝
```

| Chỉ số | Ý nghĩa | Kết quả tốt |
|---|---|---|
| Tổng peer đã spawn | Tổng số peer được tạo ra trong suốt quá trình | Càng nhiều càng thấy rõ churn |
| Hoàn thành bình thường | Peer tự tắt đúng kế hoạch, gửi LEAVE message | Tỉ lệ cao (> 80%) |
| Crash / lỗi | Peer bị tắt đột ngột hoặc lỗi | < 15% là bình thường |

> **Lưu ý:** Nếu bạn nhấn `Ctrl+C` để dừng sớm, các peer đang chạy dở sẽ bị tính vào "Crash" — đây là bình thường, không phải lỗi thực sự.

---

### ⏹️ Dừng simulation

- **Tự động:** Simulation tự dừng sau khi hết thời gian (`-Duration`) và in báo cáo
- **Thủ công:** Nhấn `Ctrl+C` trong terminal Controller → tự động dọn dẹp và in báo cáo