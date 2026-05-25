# Hướng Dẫn Test Đồ Án P2P Chat Qua Radmin VPN

Tài liệu này hướng dẫn cách kiểm thử hệ thống P2P Chat giữa nhiều máy tính khác nhau thông qua mạng ảo **Radmin VPN**. Quy trình này giúp giả lập mạng LAN qua Internet, đảm bảo các tính năng TCP/UDP thuần túy hoạt động mượt mà như khi các máy tính cắm chung một đường truyền mạng.

## 1. Yêu cầu chuẩn bị
- Tất cả các máy tính tham gia test đều phải cài đặt **Radmin VPN** (Tải tại: [radmin-vpn.com](https://www.radmin-vpn.com/)).
- Đảm bảo đã clone/copy toàn bộ thư mục đồ án về máy.
- Đã cài đặt Node.js và chạy lệnh `npm install` trong thư mục `Code` để cài đặt thư viện.

---

## 2. Thiết lập mạng Radmin VPN (Làm 1 lần)
1. **Người làm Server (Máy X):** 
   - Mở Radmin VPN, chọn `Network` -> `Create Network`.
   - Đặt tên mạng và mật khẩu tùy ý (VD: `MangDoAnP2P` / pass: `123456`).
   - Gửi Tên mạng và Mật khẩu cho các bạn khác.

2. **Các thành viên khác (Máy A, B, C...):**
   - Mở Radmin VPN, chọn `Network` -> `Join Network`.
   - Nhập Tên mạng và Mật khẩu do Máy X cung cấp để tham gia.
   - Khi kết nối thành công, tất cả các máy sẽ nhìn thấy nhau (tên máy tính hiện màu xanh lá) trên giao diện Radmin VPN.

3. **Lấy IP Radmin của Máy X (Rất Quan Trọng):**
   - Trên Máy X, nhìn cạnh tên máy của mình trên Radmin VPN sẽ có một dãy IP ảo (VD: `26.111.222.123`).
   - Copy địa chỉ IP này và gửi cho tất cả các thành viên còn lại.

---

## 3. Khởi động Hệ Thống

### Bước 3.1: Bật Bootstrap Server (Chỉ làm trên Máy X)
Bootstrap Server đóng vai trò như "danh bạ" giúp các peer lần đầu tìm thấy nhau.
1. Mở Terminal (PowerShell) trên **Máy X**.
2. Di chuyển vào thư mục Code: `cd Code`
3. Chạy lệnh bật server:
   ```powershell
   .\start-lan-server.ps1
   ```
   *(Nếu bị PowerShell chặn, dùng lệnh: `powershell -ExecutionPolicy Bypass -File .\start-lan-server.ps1`)*
4. Để nguyên cửa sổ màu đen này, không được tắt.

### Bước 3.2: Bật Ứng Dụng Chat (GUI)
**Trên Máy X (Máy chủ):**
Mở một cửa sổ PowerShell **MỚI**, trỏ IP bootstrap về localhost:
```powershell
cd Code
powershell -ExecutionPolicy Bypass -File .\start-lan-gui.ps1 -BootstrapIp 127.0.0.1
```

**Trên các máy khác (Máy A, B, C...):**
Mở PowerShell và khởi động GUI, trỏ IP bootstrap về **IP Radmin của Máy X** (đã lấy ở Bước 2.3).
```powershell
cd Code
powershell -ExecutionPolicy Bypass -File .\start-lan-gui.ps1 -BootstrapIp 26.111.222.123
```
*(Thay dãy số `26.111.222.123` bằng IP thực tế của Máy X)*

---

## 4. Quy trình Test & Kiểm tra (Checklist Bảo Vệ Đồ Án)

Để chứng minh đồ án hoạt động hoàn hảo trước mặt giáo viên, hãy thực hiện lần lượt các bước sau:

- [ ] **Kiểm tra kết nối mạng:**
  - Nhìn vào cửa sổ đen (Bootstrap Server) trên Máy X. Nó phải hiện `Online peers: 2` (hoặc 3, 4 tùy số lượng máy).
  - Góc trái giao diện Chat của tất cả các máy phải hiện chữ `Bootstrap: Connected` màu xanh lá.
  - Danh sách "Online Peers" trên GUI phải hiển thị tên của những người khác (Hiển thị chữ `TCP_Handshake` hoặc `BOOTSTRAP` bên cạnh tên).

- [ ] **Test Mã hóa đầu cuối (E2EE) & Nhắn tin:**
  - Sau khi các máy nhìn thấy nhau, **khoan nhắn tin ngay**. Hãy chờ khoảng **5-10 giây**.
  - Đây là thời gian để các máy tiến hành trao đổi khóa mã hóa ECDH ngầm.
  - Chọn một người trong danh sách để nhắn tin. Nếu nhắn thành công, terminal sẽ in ra đoạn mã hóa ciphertext (chứng minh dữ liệu được mã hóa trên đường truyền).

- [ ] **Test Tính năng nâng cao 1: File Transfer:**
  - Bấm vào nút `(+)` bên cạnh thanh chat.
  - Chọn một ảnh bất kỳ.
  - Người nhận sẽ thấy ảnh hiển thị trực tiếp trong khung chat dưới dạng Base64 qua TCP.

- [ ] **Test Tính năng nâng cao 2: Store-and-forward:**
  - Máy X, Máy A, Máy B cùng online.
  - Máy A **tắt hoàn toàn** ứng dụng chat đi.
  - Máy X nhắn tin cho Máy A. Lúc này Máy X sẽ tự động nhờ Máy B giữ hộ tin nhắn (nhìn terminal sẽ thấy log `[Store-and-Forward] Đã lưu hộ 1 tin nhắn...`).
  - Máy A bật lại ứng dụng chat. Máy B sẽ ngay lập tức "giao hàng" tin nhắn đó cho Máy A (terminal báo `Giao 1 tin nhắn gửi gắm...`).

Chúc các bạn bảo vệ đồ án thành công!
