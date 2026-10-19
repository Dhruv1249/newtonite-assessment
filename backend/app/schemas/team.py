"""Team request and response validation schemas."""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.team_member import TeamRole
from app.schemas.auth import UserResponse


class TeamCreateRequest(BaseModel):
    """Payload for creating a new operational team.

    Attributes:
        name: Unique team name.
        description: Informational context regarding team purview.
        workflow_id: Optional ID of the workflow to bind; defaults to system default if omitted.
    """

    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    workflow_id: uuid.UUID | None = None


class TeamMemberAddRequest(BaseModel):
    """Payload for enrolling a user into a team.

    Attributes:
        user_id: User identifier to add.
        role: Assigned authorization role within team scope.
    """

    user_id: uuid.UUID
    role: TeamRole = TeamRole.MEMBER


class TeamMemberUpdateRequest(BaseModel):
    """Payload for altering a user's role in a team.

    Attributes:
        role: Updated authorization role.
    """

    role: TeamRole


class TeamMemberResponse(BaseModel):
    """Serialized representation of a team membership.

    Attributes:
        id: Unique membership identifier.
        user_id: Associated user identifier.
        team_id: Associated team identifier.
        role: Current role.
        joined_at: Membership creation timestamp.
        user: Nested profile information of member.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    team_id: uuid.UUID
    role: str
    joined_at: datetime
    user: UserResponse | None = None


class TeamResponse(BaseModel):
    """Serialized operational team entity.

    Attributes:
        id: Unique team identifier.
        name: Team name.
        description: Team description.
        workflow_id: Assigned workflow identifier.
        created_at: Creation timestamp.
        member_count: Total count of active team members.
        user_role: Current requesting user's role in this team if applicable.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    workflow_id: uuid.UUID
    created_at: datetime
    member_count: int = 0
    user_role: str | None = None
