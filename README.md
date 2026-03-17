# User Service - LMS Microservices

Đây là một vi dịch vụ (microservice) đảm nhiệm chức năng quản lý người dùng và xác thực (Authentication/Authorization) cho hệ thống Learning Management System (LMS).

## 🚀 Công nghệ sử dụng

- **Framework:** [FastAPI](https://fastapi.tiangolo.com/)
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy (Async) với driver `asyncpg`
- **Validation:** Pydantic
- **Security:** JWT (JSON Web Tokens) bằng `python-jose` & Hashing mật khẩu bằng `bcrypt`
- **Server:** Uvicorn

## 📂 Cấu trúc thư mục

```text
user-service/
├── app/
│   ├── api/          # Các API endpoint (routes)
│   ├── core/         # Cấu hình lõi (Database, Security, Config)
│   ├── models/       # Định nghĩa các bảng Database (SQLAlchemy)
│   ├── schemas/      # Định nghĩa kiểu dữ liệu Request/Response (Pydantic)
│   └── main.py       # Điểm khởi chạy của ứng dụng FastAPI
├── .env.example      # File mẫu cấu hình biến môi trường
├── requirements.txt  # Danh sách các thư viện Python cần thiết
├── test_db.py        # Script kiểm thử kết nối cơ sở dữ liệu
└── Dockerfile        # (Dự kiến) Cấu hình Docker để build image
```

## ⚙️ Hướng dẫn cài đặt và chạy cục bộ (Local Development)

### 1. Yêu cầu hệ thống
- Python 3.10 trở lên
- PostgreSQL (có thể cài trực tiếp bằng pgAdmin 4 hoặc chạy qua Docker Compose)

### 2. Thiết lập môi trường ảo (Virtual Environment)

Mở terminal tại thư mục `user-service` và chạy:

```bash
# Tạo môi trường ảo
python -m venv venv

# Kích hoạt môi trường ảo (Windows)
venv\Scripts\activate

# Kích hoạt môi trường ảo (macOS/Linux)
source venv/bin/activate
```

### 3. Cài đặt các thư viện (Dependencies)

```bash
pip install -r requirements.txt
```

### 4. Cấu hình Biến môi trường

Tạo một file có tên là `.env` từ file `.env.example`:

```env
PROJECT_NAME="User Service"
DATABASE_URL=postgresql+asyncpg://postgres:mat_khau_cua_ban@localhost:5432/users
SECRET_KEY=chuoi_ky_tu_bi_mat_de_tao_jwt
```
*Lưu ý: Bạn cần tạo sẵn một database có tên tương ứng (ví dụ: `users`) trong PostgreSQL.*

### 5. Kiểm thử kết nối Database

Chạy script sau để kiểm tra xem ứng dụng đã kết nối được với PostgreSQL chưa:

```bash
python test_db.py
```
Nếu in ra `Kết nối thành công!`, bạn có thể chuyển sang bước tiếp theo.

### 6. Khởi chạy Server

```bash
uvicorn app.main:app --reload
```

Server sẽ chạy tại địa chỉ: `http://localhost:8000`

## 📖 API Documentation

FastAPI tự động sinh tài liệu API chuẩn OpenAPI. Bạn có thể truy cập để test trực tiếp tại:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## 🔐 Các Endpoints hiện có

- `POST /auth/register`: Đăng ký tài khoản người dùng mới.
- `POST /auth/login`: Đăng nhập lấy `access_token` (JWT Bearer Token).
