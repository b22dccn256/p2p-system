import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()  # Tải biến từ .env

class Settings(BaseSettings):
    PROJECT_NAME: str = "User Service"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/userdb")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

settings = Settings()