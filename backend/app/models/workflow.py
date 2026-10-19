"""Workflow definition entity.

Defines the state machine, allowed state transitions, and role guards for work items.
"""

from datetime import datetime, timezone
from typing import Any
import uuid
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Workflow(Base):
    """Workflow state machine definition model.

    Attributes:
        id: Unique identifier for the workflow.
        name: Name of the workflow template.
        description: Description of the process modeled by the workflow.
        states: List of state definitions with identifiers and display labels.
        transitions: List of permitted transitions and required role guards.
        is_default: Flag indicating if this is the default system workflow.
        created_at: Timestamp when workflow was created.
        teams: Teams that use this workflow definition.
    """

    __tablename__ = "workflows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        String(1000),
        nullable=True,
    )
    states: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
    )
    transitions: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    teams: Mapped[list["Team"]] = relationship(
        "Team",
        back_populates="workflow",
    )
