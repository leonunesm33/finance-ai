from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def task_session():
    """Sessão para tasks Celery, com engine descartável.

    Cada task roda em um event loop novo (asyncio.run); conexões do pool
    global ficam presas ao loop anterior e quebram com "attached to a
    different loop". Aqui o engine vive só durante a task.
    """
    task_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(task_engine, expire_on_commit=False)
    try:
        async with factory() as session:
            yield session
    finally:
        await task_engine.dispose()


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


async def check_db_connection() -> bool:
    from sqlalchemy import text

    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return True
