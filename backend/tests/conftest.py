"""Pytest test configuration and fixtures for OpFlow backend integration tests."""

from collections.abc import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.database import async_database_engine, async_session_factory
from app.main import app
from app.models import Team, User, initialize_database_schema
from app.seed import seed_database
from app.services.auth_service import create_access_token


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database() -> AsyncGenerator[None, None]:
    """Ensure database schema and standard seed records exist before executing test suites."""
    await initialize_database_schema(async_database_engine)
    await seed_database()
    yield
    await async_database_engine.dispose()


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an HTTPX asynchronous client configured for in-memory ASGI dispatch."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def admin_auth_headers() -> dict[str, str]:
    """Generate bearer authentication headers for Alex Admin (admin role)."""
    async with async_session_factory() as session:
        statement = select(User).where(User.email == "admin@opflow.internal")
        user = (await session.execute(statement)).scalar_one()
        token = create_access_token(user_id=user.id)
        return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def lead_auth_headers() -> dict[str, str]:
    """Generate bearer authentication headers for Devin Lead (lead role)."""
    async with async_session_factory() as session:
        statement = select(User).where(User.email == "lead@opflow.internal")
        user = (await session.execute(statement)).scalar_one()
        token = create_access_token(user_id=user.id)
        return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def engineer_auth_headers() -> dict[str, str]:
    """Generate bearer authentication headers for Eli Engineer (member role)."""
    async with async_session_factory() as session:
        statement = select(User).where(User.email == "engineer@opflow.internal")
        user = (await session.execute(statement)).scalar_one()
        token = create_access_token(user_id=user.id)
        return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auditor_auth_headers() -> dict[str, str]:
    """Generate bearer authentication headers for Val Viewer (viewer role)."""
    async with async_session_factory() as session:
        statement = select(User).where(User.email == "auditor@opflow.internal")
        user = (await session.execute(statement)).scalar_one()
        token = create_access_token(user_id=user.id)
        return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def platform_team() -> Team:
    """Retrieve Platform Engineering team fixture."""
    async with async_session_factory() as session:
        statement = select(Team).where(Team.name == "Platform Engineering")
        return (await session.execute(statement)).scalar_one()


@pytest_asyncio.fixture
async def compliance_team() -> Team:
    """Retrieve Compliance & Security team fixture."""
    async with async_session_factory() as session:
        statement = select(Team).where(Team.name == "Compliance & Security")
        return (await session.execute(statement)).scalar_one()
