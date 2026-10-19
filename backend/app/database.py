"""Database connectivity and session lifecycle management.

Configures the asynchronous SQLAlchemy engine, session maker, and base declarative class.
"""

from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """Base class for all declarative database models."""

    pass


async_database_engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=20,
    max_overflow=10,
)

async_session_factory = async_sessionmaker(
    bind=async_database_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an asynchronous database session for request scopes.

    Yields:
        AsyncSession: Active asynchronous database session.
    """
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
