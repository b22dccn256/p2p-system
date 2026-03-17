# 1. Chọn base image nhẹ, chính thức của Python
FROM python:3.10-slim

# 2. Đặt thư mục làm việc trong container
WORKDIR /app

# 3. Copy file requirements trước (tận dụng cache của Docker)
COPY requirements.txt .

# 4. Cài đặt dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy toàn bộ mã nguồn vào container
COPY ./app ./app

# 6. Expose port 8000 (FastAPI mặc định)
EXPOSE 8000

# 7. Lệnh chạy ứng dụng
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]