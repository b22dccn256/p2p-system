# TÀI LIỆU KIẾN TRÚC VÀ TỔNG QUAN DỰ ÁN (PROJECT KNOWLEDGE BASE)

> **Mục đích của tài liệu này:** Cung cấp bức tranh toàn cảnh, kiến trúc hệ thống và quy ước của dự án `P2P Chat System` dành cho lập trình viên mới tham gia hoặc các trợ lý AI (LLM) hỗ trợ viết code. Bất kỳ ai đọc tài liệu này đều có thể ngay lập tức nắm bắt được hệ thống hoạt động như thế nào.

---

## 1. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)

- **Tên dự án:** P2P Chat System (Hệ thống Chat Ngang Hàng).
- **Mục tiêu:** Xây dựng một ứng dụng chat phi tập trung không phụ thuộc hoàn toàn vào máy chủ trung tâm. Các máy tính (Peers) tự tìm thấy nhau và gửi tin nhắn trực tiếp cho nhau.
- **Ngôn ngữ & Nền tảng:** JavaScript (Node.js thuần tủy).
- **Phạm vi (Scope):** Đây là dự án phục vụ Đồ án môn học (Hệ thống phân tán / Lập trình mạng). Do đó, dự án **không** sử dụng các framework P2P có sẵn (như libp2p, hyperswarm) mà **tự xây dựng (build from scratch)** dựa trên giao thức TCP và UDP socket mặc định của Node.js.

---

## 2. KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

Hệ thống bao gồm 2 thành phần vật lý:
1. **Bootstrap Server (Máy chủ mồi):** Một server siêu nhẹ chạy trên Internet. Chức năng duy nhất là lưu trữ "danh bạ" (Registry). Máy nào bật lên cũng phải báo cáo IP cho server này để nhận về danh sách IP của những người khác.
2. **Peer (Nút mạng/Client):** Là phần mềm chạy trên máy người dùng. Mỗi Peer đóng hai vai trò đồng thời:
   - **Là Server:** Mở cổng TCP lắng nghe tin nhắn đến từ người khác.
   - **Là Client:** Tạo kết nối TCP đến IP của người khác để gửi tin.

### 2.1. Cơ chế tìm kiếm (Peer Discovery)
Sử dụng mô hình **Hybrid Discovery (Kết hợp kép)**:
- **UDP Broadcast (Local Network):** Dùng module `dgram`. Peer định kỳ "hét" lên bằng sóng Broadcast vào mạng LAN. Các máy dùng chung mạng WiFi sẽ nhận ra nhau ngay lập tức mà không cần Internet.
- **Bootstrap Server (WAN / Internet):** Dùng module `net`. Peer kết nối tới IP tĩnh của Server mồi để báo danh và nhận về IP của các Peer ở xa (khác mạng).

### 2.2. Cơ chế truyền tin (Messaging)
- Tất cả tin nhắn (Chat, Ping, Join Room) đều được gửi qua **TCP Socket** (module `net`) để đảm bảo không mất gói tin.
- **Protocol (Giao thức):** Dữ liệu truyền đi là JSON.
- **Đóng gói (Framing):** Đề phòng lỗi TCP Stream Fragmentation (các gói tin dính vào nhau hoặc bị cắt nửa), tất cả tin nhắn đều phải được đóng gói theo chuẩn **Length-Prefix** (4 byte đầu tiên chứa độ dài của cục dữ liệu, phần sau là chuỗi JSON).

---

## 3. CẤU TRÚC THƯ MỤC (DIRECTORY STRUCTURE)

Dự án áp dụng mô hình **Clean Architecture**:

```text
p2p-system/Code/
├── package.json                 
├── PROJECT_KNOWLEDGE.md         # Tài liệu bạn đang đọc
├── bootstrap-server/            # Mã nguồn máy chủ mồi
│   └── server.js                
├── client/                      # Giao diện người dùng
│   └── cli.js                   # Giao diện dòng lệnh (CLI)
└── src/                         # Core Logic của Peer
    ├── config/                  
    │   └── constants.js         # Lưu hằng số (PORT, HOST, TIMEOUT)
    ├── core/                    
    │   ├── Peer.js              # Class trung tâm, khởi tạo và điều phối các module khác
    │   └── Protocol.js          # Định nghĩa cấu trúc JSON và hàm encode/decode Length-Prefix
    ├── network/                 
    │   ├── TCPHandler.js        # Quản lý Socket TCP (Lắng nghe & Kết nối)
    │   └── UDPHandler.js        # Quản lý Socket UDP (Broadcast)
    ├── chat/                    
    │   ├── DirectChat.js        # Logic xử lý tin nhắn cá nhân 1-1
    │   ├── GroupChat.js         # Logic xử lý phòng chat và broadcast nhóm
    │   └── MessageQueue.js      # Hàng đợi tin nhắn + Logic Retry (thử lại) khi gửi lỗi
    └── utils/                   
        └── logger.js            # Hàm in log có màu và thời gian để dễ debug
```

---

## 4. QUY ƯỚC CẤU TRÚC DỮ LIỆU (DATA STRUCTURES)

### 4.1. Giao thức Tin nhắn (Message Protocol)
Mọi object tin nhắn trước khi gửi qua TCP phải có format sau:
```javascript
{
  "type": "CHAT",           // Có thể là: REGISTER, DISCOVERY, CHAT, PING, PONG, ACK
  "from": "peer_abc123",    // ID của người gửi
  "to": "peer_xyz789",      // ID của người nhận (null nếu chat nhóm)
  "roomId": "room_001",     // (Tuỳ chọn) ID của phòng chat
  "payload": {              // Nội dung tuỳ biến
      "text": "Xin chào!"
  },
  "timestamp": 1716345678,  // Thời gian tạo
  "seq": 1                  // Số thứ tự gói tin (dùng để xác nhận ACK và Retry)
}
```

---

## 5. QUY TRÌNH LUỒNG LOGIC (WORKFLOW LOGIC)

### 5.1. Khi Peer khởi động (Startup Flow)
1. Chạy file `client/cli.js`. Sinh ra một `peerId` ngẫu nhiên.
2. Khởi tạo `Peer` class.
3. `Peer` gọi `UDPHandler` mở cổng 5001, bắt đầu phát sóng Broadcast.
4. `Peer` gọi `TCPHandler` mở cổng 5000, bắt đầu lắng nghe kết nối đến.
5. `Peer` kết nối TCP tới `Bootstrap Server` (port 9000), gửi tin nhắn `type: "REGISTER"`.
6. Nhận lại danh sách IP từ Bootstrap, lưu vào bộ nhớ cục bộ `knownPeers`.

### 5.2. Khi gửi một tin nhắn (Messaging Flow)
1. Người dùng gõ "Hello" gửi cho "peer_B".
2. `DirectChat` tạo object Message. Đẩy vào `MessageQueue`.
3. `MessageQueue` gắn số `seq = 1`, đưa cho `TCPHandler`.
4. `TCPHandler` kiểm tra xem đã có socket nào nối tới "peer_B" chưa. Nếu chưa thì mở kết nối mới.
5. `TCPHandler` dùng `Protocol.encode()` chuyển object thành Buffer (có độ dài 4 byte ở đầu) rồi `.write()` qua socket.
6. Máy B nhận được. `TCPHandler` của máy B dùng `Protocol.decode()` bóc tách dữ liệu, vứt sang cho `DirectChat` của máy B. Máy B in ra màn hình.
7. Máy B gửi lại một tin nhắn `type: "ACK", seq: 1`. 
8. Máy A nhận được ACK, `MessageQueue` xóa gói tin khỏi hàng chờ. Hoàn tất!

---

## 6. LỘ TRÌNH TRIỂN KHAI (ROADMAP)
- **Ngày 1:** Dựng `bootstrap-server` và các module `Peer.js`, `UDPHandler.js`, `constants.js`. Chạy thử để 2 máy tính tự thấy được IP của nhau.
- **Ngày 2:** Viết `Protocol.js`, `TCPHandler.js`. Hoàn thiện luồng kết nối TCP và gửi tin nhắn chữ. Xây dựng `DirectChat` và `GroupChat`.
- **Ngày 3:** Viết `MessageQueue.js` (Retry/ACK) và hệ thống PING/PONG để phát hiện rớt mạng. Hoàn thiện CLI interface ở `client/cli.js`.

---
*Lưu ý cho AI/LLM: Khi nhận được yêu cầu viết code từ người dùng cho dự án này, luôn tuân thủ Clean Architecture đã vạch ra, KHÔNG viết gộp các tính năng vào một file.*
