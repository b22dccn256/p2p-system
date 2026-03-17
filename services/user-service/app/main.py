from fastapi import FastAPI
from .api import auth
from .core.database import engine, Base

# Tạo bảng (chỉ dùng cho development, trong production nên dùng migration)
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI(title="User Service")

@app.on_event("startup")
async def startup():
    await create_tables()

app.include_router(auth.router)

@app.get("/")
async def root():
    return {"message": "User Service is running"}