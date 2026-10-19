"""Authentication and authorization middleware dependencies.

Enforces bearer token validation and team-scoped authorization checks.
"""

from typing import Annotated
import uuid
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models.team_member import TeamMember, TeamRole
from app.models.user import User
from app.services.auth_service import decode_access_token

security_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security_bearer)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> User:
    """Extract and validate the authenticated user from the HTTP Bearer token.

    Args:
        credentials: Bearer credentials extracted from Authorization header.
        session: Active asynchronous database session.

    Returns:
        User: Database model representing the authenticated caller.

    Raises:
        HTTPException: 401 Unauthorized if token is missing, expired, or user not found.
    """
    token_str = credentials.credentials
    try:
        payload = decode_access_token(token_str)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token lacks a subject claim.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_uuid = uuid.UUID(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    statement = select(User).where(User.id == user_uuid)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_user_team_ids(
    user_id: uuid.UUID,
    session: AsyncSession,
) -> list[uuid.UUID]:
    """Retrieve all team identifiers where the specified user maintains active membership.

    Args:
        user_id: Unique user identifier.
        session: Active asynchronous database session.

    Returns:
        list[uuid.UUID]: List of team identifiers available to the user.
    """
    statement = select(TeamMember.team_id).where(TeamMember.user_id == user_id)
    result = await session.execute(statement)
    return list(result.scalars().all())


async def verify_team_membership(
    user_id: uuid.UUID,
    team_id: uuid.UUID,
    session: AsyncSession,
) -> str:
    """Verify that a user is an enrolled member of the designated team and return their role.

    Args:
        user_id: Unique user identifier.
        team_id: Unique team identifier.
        session: Active asynchronous database session.

    Returns:
        str: Team role value string (e.g. admin, lead, member, viewer).

    Raises:
        HTTPException: 403 Forbidden if the user is not a member of the team.
    """
    statement = select(TeamMember.role).where(
        TeamMember.user_id == user_id,
        TeamMember.team_id == team_id,
    )
    result = await session.execute(statement)
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you are not a member of this team.",
        )
    return role


def check_role_permission(
    user_role: str,
    required_role: TeamRole,
) -> bool:
    """Check whether a user's role satisfies the required hierarchical permission level.

    Role hierarchy: admin > lead > member > viewer.

    Args:
        user_role: The role currently assigned to the user.
        required_role: The minimum required role.

    Returns:
        bool: True if authorized, False otherwise.
    """
    hierarchy = {
        TeamRole.VIEWER.value: 1,
        TeamRole.MEMBER.value: 2,
        TeamRole.LEAD.value: 3,
        TeamRole.ADMIN.value: 4,
    }
    user_level = hierarchy.get(user_role, 0)
    required_level = hierarchy.get(required_role.value, 99)
    return user_level >= required_level
