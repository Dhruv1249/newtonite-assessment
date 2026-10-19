"""Team entity definition.

Represents an organizational unit that owns work items and members.
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Team(Base):
    """Team entity representing an operational group.

    Attributes:
        id: Unique identifier for the team.
        name: Name of the operational team.
        description: Purpose or responsibility description of the team.
        workflow_id: Associated workflow definition ID.
        created_at: Timestamp when team was created.
        workflow: Relationship to the assigned workflow definition.
        members: Relationship to memberships associated with this team.
        work_items: Relationship to work items owned by this team.
    """

    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        String(1000),
        nullable=True,
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="teams",
    )
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="team",
        cascade="all, delete-orphan",
    )
    work_items: Mapped[list["WorkItem"]] = relationship(
        "WorkItem",
        back_populates="team",
        cascade="all, delete-orphan",
    )
