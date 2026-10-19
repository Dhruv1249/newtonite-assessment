"""Task queue entity definition.

Provides a database-backed durable asynchronous task queue for AI enrichment and background processing.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any
import uuid
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TaskStatus(str, Enum):
    """Execution status for background queue jobs.

    Attributes:
        PENDING: Job is queued and waiting for an available worker.
        PROCESSING: Worker has claimed the task and is executing it.
        COMPLETED: Job completed successfully.
        FAILED: Job encountered an unrecoverable failure or exceeded retry limits.
    """

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskQueue(Base):
    """Asynchronous background task record.

    Attributes:
        id: Unique identifier for the queue task.
        task_type: Operation identifier indicating the target handler.
        payload: Parameters and context for task execution.
        status: Current execution lifecycle state.
        attempts: Number of times execution has been attempted.
        max_attempts: Upper limit of allowed retries before permanent failure.
        error_message: Failure diagnostics from the most recent run.
        created_at: Timestamp when task was enqueued.
        processed_at: Timestamp when task finished execution.
    """

    __tablename__ = "task_queue"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    task_type: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default=TaskStatus.PENDING.value,
        index=True,
        nullable=False,
    )
    attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    max_attempts: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
