"""Activity log entity definition.

Maintains an immutable historical audit trail of all mutations and workflow transitions.
"""

from datetime import datetime, timezone
from typing import Any
import uuid
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ActivityLog(Base):
    """Immutable audit trail record for work item lifecycle events.

    Attributes:
        id: Unique identifier for the audit entry.
        item_id: Foreign key to the affected work item.
        user_id: Foreign key to the user who performed the action.
        action_type: Classification of the mutation (e.g. created, transitioned, reassigned).
        old_value: State or field values prior to the change.
        new_value: State or field values after the change.
        created_at: Exact timestamp when the action occurred.
        work_item: Relationship to the associated WorkItem.
        actor: Relationship to the user who executed the action.
    """

    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_items.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    action_type: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )
    old_value: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    new_value: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )

    work_item: Mapped["WorkItem"] = relationship(
        "WorkItem",
        back_populates="activity_logs",
    )
    actor: Mapped["User"] = relationship(
        "User",
    )
