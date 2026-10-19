"""Database models package initialization.

Exports all SQLAlchemy entity models and schema initialization utilities.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.database import Base
from app.models.activity_log import ActivityLog
from app.models.comment import Comment
from app.models.idempotency_key import IdempotencyKey
from app.models.task_queue import TaskQueue, TaskStatus
from app.models.team import Team
from app.models.team_member import TeamMember, TeamRole
from app.models.user import User
from app.models.work_item import ItemPriority, WorkItem
from app.models.workflow import Workflow

__all__ = [
    "ActivityLog",
    "Base",
    "Comment",
    "IdempotencyKey",
    "ItemPriority",
    "TaskQueue",
    "TaskStatus",
    "Team",
    "TeamMember",
    "TeamRole",
    "User",
    "WorkItem",
    "Workflow",
    "initialize_database_schema",
]


async def initialize_database_schema(engine: AsyncEngine) -> None:
    """Create pgvector extension and all database tables defined in the metadata.

    Args:
        engine: Asynchronous SQLAlchemy engine connected to target PostgreSQL database.
    """
    async with engine.begin() as connection:
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await connection.run_sync(Base.metadata.create_all)
