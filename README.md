# 🌐 P2P Chat & Messenger System (Hybrid P2P)

Hệ thống Chat Ngang Hàng (Peer-to-Peer) phi tập trung được phát triển bằng **Node.js** và **Electron**, hỗ trợ mã hóa đầu cuối **E2EE (ECDH + AES-256-GCM)** và cơ chế định tuyến chịu lỗi **Store-and-Forward**.

---

## 1. Tính năng chính
* **Mã hóa đầu cuối (E2EE):** Tự động trao đổi khóa bằng thuật toán Elliptic Curve Diffie-Hellman (NIST P-256) và mã hóa gói tin bằng AES-256-GCM.
* **Khám phá mạng tự động:** Tìm kiếm các Peer trong mạng LAN thông qua UDP Broadcast và đồng bộ danh bạ WAN qua Bootstrap Server.
* **Định tuyến chịu lỗi (Store-and-Forward):** Khi một Peer mất mạng, tin nhắn sẽ được gửi nhờ vào các Peer láng giềng (Neighbors) lưu trữ tạm thời, và tự động chuyển tiếp ngay khi Peer đích trực tuyến trở lại.
* **Trò chuyện đa dạng:** Hỗ trợ Direct Chat (1-1), Group Chat (Phòng kín đa hướng) và Global Broadcast (Phát thanh toàn mạng).
* **Truyền tải tập tin:** Hỗ trợ gửi file/hình ảnh nội tuyến dạng Base64 qua luồng TCP, kế thừa toàn bộ tính năng mã hóa E2EE.

---

## 2. Kiến trúc (Architecture)
Hệ thống áp dụng mô hình **Hybrid P2P**, phân tách rõ ràng hai luồng mạng:
1. **Control Plane (Luồng Điều khiển):** Hoạt động tập trung tại Bootstrap Server. Máy chủ này chỉ làm nhiệm vụ duy nhất là "Danh bạ" (Registry), chứa IP/Port của các node. Không lưu trữ hay trung chuyển tin nhắn.
2. **Data Plane (Luồng Dữ liệu):** Hoạt động phân quyền (Pure P2P). Các thiết bị kết nối TCP Socket Point-to-Point trực tiếp với nhau. Khi Bootstrap Server sập, Data Plane vẫn duy trì hoạt động bình thường giữa các node đã kết nối, loại bỏ hoàn toàn rủi ro Single Point of Failure cục bộ.

---

## 3. Stack công nghệ
Hệ thống nói KHÔNG với các framework cồng kềnh, tối ưu hóa băng thông bằng các module lõi:
* **Core/Backend:** Node.js thuần (sử dụng module `net` cho TCP, `dgram` cho UDP, `crypto` cho Mật mã học).
* **Frontend/GUI:** Electron, Vanilla JavaScript, HTML5, CSS3.
* **Giao tiếp liên tiến trình:** IPC (Inter-Process Communication) chuẩn của Electron.
* **Tự động hóa:** PowerShell Scripts (.ps1).

---

## 4. Cấu trúc thư mục
```text
📦 Code
 ┣ 📂 client            # Giao diện ứng dụng Desktop (HTML, CSS, JS)
 ┃ ┣ 📜 index.html      # Giao diện chính của ứng dụng
 ┃ ┣ 📜 main.js         # Tiến trình chính (Main Process) của Electron
 ┃ ┗ 📜 renderer.js     # Xử lý logic giao diện người dùng
 ┣ 📂 src               # Lõi hệ thống P2P (Core Backend)
 ┃ ┣ 📂 chat            # Nghiệp vụ trò chuyện (DirectChat, GroupChat, GlobalChat)
 ┃ ┣ 📂 config          # Tham số hệ thống (constants.js, logger.js)
 ┃ ┣ 📂 core            # Đối tượng lõi (Peer.js quản lý vòng đời mạng)
 ┃ ┣ 📂 discovery       # Lớp khám phá (BootstrapClient.js kết nối Registry)
 ┃ ┣ 📂 network         # Lớp mạng (TCPHandler, UDPHandler, MessageQueue)
 ┃ ┗ 📂 security        # Lớp an toàn thông tin (Crypto.js, KeyExchange.js)
 ┣ 📂 profiles          # Thư mục sinh tự động chứa cache & khóa mật mã riêng biệt
 ┣ 📜 start-lan-gui.ps1 # Script khởi động Client (GUI)
 ┣ 📜 start-lan-server.ps1 # Script khởi động Bootstrap Server
 ┗ 📜 start-churn.ps1   # Script chạy mô phỏng mạng tự động (Churn Test)
```

---

## 5. Cài đặt
Yêu cầu hệ thống phải được cài đặt sẵn **Node.js (phiên bản v18 trở lên)**.
1. Mở Terminal / PowerShell.
2. Di chuyển vào thư mục chứa mã nguồn (`Code/`).
3. Chạy lệnh cài đặt thư viện phụ thuộc:
```powershell
npm install
```

---

## 6. Chạy hệ thống
*(Lưu ý: Thêm tiền tố `powershell -ExecutionPolicy Bypass -File` trước các lệnh nếu Windows chặn script).*

**Bước 1: Bật Máy chủ danh bạ (Bootstrap Server)**
```powershell
.\start-lan-server.ps1
```
**Bước 2: Bật Ứng dụng Client (Node A, B...)**
Mở các Terminal mới và cấp phát profile độc lập để tránh xung đột Cache:
```powershell
.\start-lan-gui.ps1 -BootstrapIp 127.0.0.1 -Profile NodeA
.\start-lan-gui.ps1 -BootstrapIp 127.0.0.1 -Profile NodeB
```
*(Thay `127.0.0.1` bằng IP thực tế của máy chủ nếu chạy trên nhiều máy tính/LAN/VPN).*

---

## 7. Sử dụng Peer GUI
Giao diện ứng dụng tuân thủ triết lý tối giản (Minimalism) với 3 khu vực:
* **Sidebar (Thanh điều hướng):** Hiển thị định danh (Peer ID) của bạn, danh sách các Peer đang trực tuyến và các Phòng Chat (Rooms).
* **Main Chat (Khu vực tương tác):** Nơi gửi văn bản, đính kèm file ảnh. Các tin nhắn E2EE sẽ có nhãn `E2EE Secured`. Bạn có thể bấm vào chữ **"Xem Cipher"** để trích xuất cấu trúc dữ liệu nhị phân AES-256-GCM thực tế đang truyền qua mạng.
* **Network Status Bar:** Nằm ở góc dưới cùng, theo dõi trạng thái kết nối tới Bootstrap Server theo thời gian thực.

---

## 8. Kịch bản demo (Store-and-Forward)
Để kiểm chứng tính năng chịu lỗi của mạng phân tán:
1. Mở 3 Node (A, B, C) cho chúng tự trao đổi khóa ECDH.
2. Tắt nóng Node B. Đợi 10s để hệ thống xác nhận Timeout.
3. Dùng Node A gửi tin nhắn cho Node B. 
4. Console của Node C sẽ hiện log: `[Store-and-Forward] Đã lưu hộ gói tin...`
5. Khởi động lại Node B. Ngay lập tức, Node C sẽ bàn giao gói tin trả về cho Node B, Node B tự động giải mã và hiển thị lên giao diện.

---

## 9. Giao thức TCP
Hệ thống không dùng HTTP. Giao tiếp mạng sử dụng Socket TCP thuần túy với chuẩn **JSON-over-TCP** chống phân mảnh bằng ký tự ngắt dòng `\n` (Newline-delimited).
Cấu trúc cơ bản của một gói tin:
```json
{
  "type": "DIRECT_CHAT",
  "from": "peer_abc",
  "to": "peer_xyz",
  "seq": 12,
  "payload": {
    "encrypted": "U2FsdGVkX1+...dữ_liệu_đã_mã_hóa_Base64",
    "iv": "..."
  }
}
```

---

## 10. Message status (Trạng thái tin nhắn)
Hệ thống đảm bảo tính toàn vẹn thông điệp thông qua cơ chế ARQ (Automatic Repeat reQuest):
* Mỗi gói tin gửi đi được gán một `seq` (Sequence Number).
* Bên nhận bóc tách thành công sẽ trả về gói tin `ACK`.
* **Retry Logic:** Nếu quá 5 giây (ACK_TIMEOUT) không nhận được ACK, `MessageQueue` sẽ tự động gửi lại tối đa 3 lần (MAX_RETRIES). Nếu vẫn thất bại, kích hoạt Store-and-Forward.

---

## 11. Kiểm thử (Churn Simulation)
Sử dụng công cụ Churn Controller đi kèm để kiểm chứng sức chịu tải và cơ chế dọn dẹp bộ nhớ của hệ thống:
```powershell
.\start-churn.ps1 -Peers 22 -Duration 120
```
Lệnh trên sẽ tự động sinh (spawn) 22 Peer ảo. Các Peer sẽ liên tục kết nối, gửi tin nhắn rác, tự động ngắt mạng đột ngột (giả lập sập nguồn) để xem hệ thống có bị Crash hay không. Kết thúc mô phỏng, bảng báo cáo phần trăm lỗi sẽ được in ra Terminal.

---

## 12. Hàm lõi của ứng dụng
Dưới đây là các hàm lõi chi phối toàn bộ vòng đời ứng dụng:
* `Peer.sendToPeer(targetId, message)`: Nỗ lực gửi gói tin trực tiếp qua TCP Socket Point-to-Point.
* `MessageQueue.sendWithAck()`: Gói bọc (Wrapper) bên ngoài hàm send, bổ sung cơ chế lưu bộ đệm, tính giờ Timeout và tự động Retry.
* `KeyExchange.computeSecret(publicKey)`: Xử lý khóa công khai của đối tác để dẫn xuất ra Shared Secret thông qua thuật toán ECDH.
* `Crypto.encrypt(text, sharedSecret)`: Hàm băm khóa bằng SHA-256 và mã hóa văn bản gốc bằng thuật toán AES-256-GCM.
* `BootstrapClient.connect()`: Quản lý luồng tín hiệu (Heartbeat) và tự động nhận diện danh bạ mạng ngay cả khi thay đổi địa chỉ IP.
