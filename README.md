lms-microservices/
├── services/                     # Chứa tất cả các service
│   ├── user-service/              # User Service (FastAPI)
│   │   ├── app/                    # Mã nguồn Python
│   │   ├── requirements.txt         # Dependencies
│   │   ├── Dockerfile               # Docker build file
│   │   └── .env.example             # Mẫu biến môi trường
│   ├── course-service/             # (sẽ tạo sau)
│   └── enrollment-service/          # (sẽ tạo sau)
├── docker-compose.yml              # Orchestrate tất cả service + DB + RabbitMQ
├── .gitignore
└── README.md                       # Mô tả dự án, hướng dẫn chạy

user-service/
├── app/
│   ├── api/                     # Các endpoint (routes)
│   │   ├── __init__.py
│   │   ├── auth.py               # Đăng ký, đăng nhập
│   │   └── users.py              # (sau này) CRUD người dùng
│   ├── core/                     # Cấu hình, bảo mật, database
│   │   ├── __init__.py
│   │   ├── config.py              # Đọc biến môi trường
│   │   ├── database.py            # Kết nối PostgreSQL (SQLAlchemy)
│   │   └── security.py            # Hash password, tạo JWT
│   ├── models/                    # SQLAlchemy models
│   │   ├── __init__.py
│   │   └── user.py
│   ├── schemas/                   # Pydantic models (request/response)
│   │   ├── __init__.py
│   │   └── user.py
│   ├── crud/                      # Business logic (tuỳ chọn, có thể gộp vào api)
│   │   ├── __init__.py
│   │   └── user.py
│   └── main.py                    # Điểm khởi chạy ứng dụng
├── requirements.txt
├── Dockerfile
└── .env.example