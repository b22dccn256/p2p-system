import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def test():
    print("DATABASE_URL =", settings.DATABASE_URL)
    engine = create_async_engine(settings.DATABASE_URL)
    try:
        async with engine.connect() as conn:
            print("Kết nối thành công!")
    except Exception as e:
        print("Lỗi kết nối:", e)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test())