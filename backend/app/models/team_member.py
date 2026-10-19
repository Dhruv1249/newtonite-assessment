"""Team membership and role mapping entity.

Binds users to teams with specific roles that govern authorization.
"""

from datetime import datetime, timezone
from enum import Enum
import uuid
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TeamRole(str, Enum):
    """Permitted team-scoped roles for authorization enforcement.

    Attributes:
        ADMIN: Full control over team, settings, members, workflows, and items.
        LEAD: Can manage items, assign work, approve transitions, and review.
        MEMBER: Can create items, edit assigned items, and submit for review.
        VIEWER: Read-only access to team work items, comments, and history.
    """

    ADMIN = "admin"
    LEAD = "lead"
    MEMBER = "member"
    VIEWER = "viewer"


class TeamMember(Base):
    """User membership within a specific team along with their assigned role.

    Attributes:
        id: Unique identifier for the membership record.
        user_id: Foreign key to the user.
        team_id: Foreign key to the team.
        role: Assigned authorization role within the team scope.
        joined_at: Timestamp when membership was established.
        user: Relationship to the User entity.
        team: Relationship to the Team entity.
    """

    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint("user_id", "team_id", name="uq_user_team"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(32),
        default=TeamRole.MEMBER.value,
        nullable=False,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="team_memberships",
    )
    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="members",
    )
