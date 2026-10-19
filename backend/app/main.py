"""OpFlow API application entrypoint.

Assembles routers, CORS middleware, lifespan events, and health diagnostics.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import async_database_engine
from app.models import initialize_database_schema
from app.routers.auth import router as auth_router
from app.routers.comments import router as comments_router
from app.routers.dashboard import router as dashboard_router
from app.routers.events import router as events_router
from app.routers.items import router as items_router
from app.routers.teams import router as teams_router
from app.routers.workflows import router as workflows_router
from app.worker import process_pending_tasks


async def background_queue_runner() -> None:
    """Continuously poll and execute queued background tasks with periodic sleep intervals."""
    while True:
        try:
            await process_pending_tasks(batch_size=5)
        except Exception:
            pass
        await asyncio.sleep(4)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycle tasks.

    Args:
        app: FastAPI application instance.

    Yields:
        None: When application is active and serving traffic.
    """
    await initialize_database_schema(async_database_engine)
    worker_task = asyncio.create_task(background_queue_runner())
    try:
        yield
    finally:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
        await async_database_engine.dispose()


app = FastAPI(
    title="OpFlow API",
    description="Operational work management and intelligence platform.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(items_router)
app.include_router(teams_router)
app.include_router(workflows_router)
app.include_router(comments_router)
app.include_router(dashboard_router)
app.include_router(events_router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Service health inspection endpoint.

    Returns:
        dict[str, str]: Service readiness indicator.
    """
    return {"status": "healthy", "service": "opflow-backend"}
