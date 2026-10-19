"""Comment entity definition.

Represents collaborative discussions and notes attached to a work item.
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Comment(Base):
    """User comment attached to a work item.

    Attributes:
        id: Unique identifier for the comment.
        item_id: Foreign key to the parent work item.
        user_id: Foreign key to the author user.
        content: Textual content of the comment.
        created_at: Creation timestamp.
        work_item: Relationship to parent WorkItem.
        author: Relationship to author User.
    """

    __tablename__ = "comments"

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
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    work_item: Mapped["WorkItem"] = relationship(
        "WorkItem",
        back_populates="comments",
    )
    author: Mapped["User"] = relationship(
        "User",
    )
