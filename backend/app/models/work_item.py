"""Work item entity definition.

Core entity representing operational tasks, incidents, investigations, or requests.
Supports optimistic concurrency control via a version counter and semantic search
via pgvector embedding vectors.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any
import uuid
from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemPriority(str, Enum):
    """Priority levels for work items.

    Attributes:
        CRITICAL: Severe operational blocker requiring immediate intervention.
        HIGH: Urgent item with substantial operational impact.
        MEDIUM: Standard operational request.
        LOW: Minor maintenance or deferred inquiry.
    """

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class WorkItem(Base):
    """Operational work item model.

    Attributes:
        id: Unique identifier for the work item.
        title: Concise summary of the operational issue.
        description: Detailed context and investigation notes.
        team_id: Owning team identifier.
        workflow_id: Optional specific workflow lifecycle override.
        created_by_id: User who authored the item.
        assignee_id: User currently responsible for the work item.
        status: Current state matching the owning team's workflow.
        priority: Urgency and impact level.
        category: Operational category classification.
        version: Monotonically increasing version for optimistic concurrency.
        embedding: Vector representation for semantic search and duplicate matching.
        ai_metadata: Structured metadata produced by asynchronous AI triage tasks.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
        team: Relationship to the owning Team.
        workflow: Relationship to the associated Workflow definition.
        creator: Relationship to the author User.
        assignee: Relationship to the assigned User.
        comments: Associated discussions and updates.
        activity_logs: Immutable historical record of mutations.
    """

    __tablename__ = "work_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    title: Mapped[str] = mapped_column(
        String(500),
        index=True,
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    workflow_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )
    priority: Mapped[str] = mapped_column(
        String(32),
        default=ItemPriority.MEDIUM.value,
        index=True,
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(64),
        default="general",
        index=True,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(3072),
        nullable=True,
    )
    ai_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="work_items",
    )
    workflow: Mapped["Workflow | None"] = relationship(
        "Workflow",
        foreign_keys=[workflow_id],
    )
    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )
    assignee: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assignee_id],
    )
    comments: Mapped[list["Comment"]] = relationship(
        "Comment",
        back_populates="work_item",
        cascade="all, delete-orphan",
        order_by="Comment.created_at",
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(
        "ActivityLog",
        back_populates="work_item",
        cascade="all, delete-orphan",
        order_by="ActivityLog.created_at",
    )
