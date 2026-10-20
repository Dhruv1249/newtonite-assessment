"""Authentication router handling registration, login, profile lookup, and user search."""

from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.middleware.auth import get_current_user
from app.models.activity_log import ActivityLog
from app.models.comment import Comment
from app.models.team_member import TeamMember, TeamRole
from app.models.user import User
from app.models.work_item import WorkItem
from app.schemas.auth import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
)
from app.services.auth_service import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


async def check_is_admin(user: User, session: AsyncSession) -> bool:
    """Verify whether a user possesses administrative privileges across the platform.

    Args:
        user: The authenticated user to inspect.
        session: Active asynchronous database session.

    Returns:
        bool: True if user is platform administrator or team admin.
    """
    if user.email == "admin@opflow.internal":
        return True
    statement = (
        select(TeamMember.id)
        .where(
            TeamMember.user_id == user.id,
            TeamMember.role == TeamRole.ADMIN.value,
        )
        .limit(1)
    )
    result = await session.execute(statement)
    return result.scalar_one_or_none() is not None


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register_user(
    payload: UserRegisterRequest,
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> User:
    """Register a new user account with email and password.

    Args:
        payload: User registration details.
        session: Active asynchronous database session.

    Returns:
        User: Created user profile.

    Raises:
        HTTPException: 409 Conflict if email is already taken.
    """
    check_statement = select(User).where(User.email == payload.email)
    existing_user = (await session.execute(check_statement)).scalar_one_or_none()
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    new_user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive an access token",
)
async def login_user(
    payload: UserLoginRequest,
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> TokenResponse:
    """Authenticate with email and password to receive a signed JWT bearer token.

    Args:
        payload: Login credentials.
        session: Active asynchronous database session.

    Returns:
        TokenResponse: Access token payload.

    Raises:
        HTTPException: 401 Unauthorized for invalid credentials.
    """
    statement = select(User).where(User.email == payload.email)
    user = (await session.execute(statement)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user_id=user.id)
    return TokenResponse(access_token=token)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve current user profile",
)
async def get_current_user_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Retrieve profile data for the authenticated caller.

    Args:
        current_user: Authenticated user model.

    Returns:
        User: Profile record.
    """
    return current_user


@router.get(
    "/users/search",
    response_model=list[UserResponse],
    summary="Search users by name or email prefix",
)
async def search_users(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
    q: str = Query(min_length=1, max_length=100),
) -> list[UserResponse]:
    """Search registered users by display name or email prefix for team enrollment.

    Args:
        current_user: Authenticated caller.
        session: Active database session.
        q: Partial name or email search term.

    Returns:
        list[UserResponse]: Matching user profiles, capped at twenty results.
    """
    term = f"%{q.lower()}%"
    statement = (
        select(User)
        .where(
            User.email.ilike(term) | User.display_name.ilike(term)
        )
        .order_by(User.display_name.asc())
        .limit(20)
    )
    result = await session.execute(statement)
    users = list(result.scalars().all())
    return [UserResponse.model_validate(u) for u in users]


@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="List all registered platform users",
)
async def list_all_users(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> list[UserResponse]:
    """Retrieve all user accounts registered across the operational platform.

    Args:
        current_user: Authenticated caller.
        session: Active database session.

    Returns:
        list[UserResponse]: All registered users ordered by display name.
    """
    statement = select(User).order_by(User.display_name.asc()).limit(100)
    result = await session.execute(statement)
    users = list(result.scalars().all())
    return [UserResponse.model_validate(u) for u in users]


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account (Admin / Team management)",
)
async def create_user_record(
    payload: UserRegisterRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> UserResponse:
    """Create a new user account directly from the user administration interface.

    Args:
        payload: User registration credentials.
        current_user: Authenticated caller.
        session: Active database session.

    Returns:
        UserResponse: Created user profile.

    Raises:
        HTTPException: 409 Conflict if email is already taken.
    """
    check_statement = select(User).where(User.email == payload.email)
    existing_user = (await session.execute(check_statement)).scalar_one_or_none()
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    new_user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return UserResponse.model_validate(new_user)


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Update an existing user profile (Admin required)",
)
async def update_user_record(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> UserResponse:
    """Modify user credentials, email, or display name with administrative authorization.

    Args:
        user_id: Target user identifier to update.
        payload: Updatable profile attributes.
        current_user: Authenticated caller performing administrative action.
        session: Active asynchronous database session.

    Returns:
        UserResponse: Serialized updated user profile.

    Raises:
        HTTPException: 403 Forbidden if caller lacks administrative privileges.
        HTTPException: 404 Not Found if designated user does not exist.
        HTTPException: 409 Conflict if updated email is already registered.
    """
    is_admin = await check_is_admin(current_user, session)
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform administrators can modify user accounts.",
        )

    statement = select(User).where(User.id == user_id)
    target_user = (await session.execute(statement)).scalar_one_or_none()
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    if payload.email is not None and payload.email != target_user.email:
        email_check = select(User).where(User.email == payload.email)
        existing = (await session.execute(email_check)).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists.",
            )
        target_user.email = payload.email

    if payload.display_name is not None:
        target_user.display_name = payload.display_name

    if payload.password is not None:
        target_user.password_hash = hash_password(payload.password)

    await session.commit()
    await session.refresh(target_user)
    return UserResponse.model_validate(target_user)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a user account and reassign authored entities (Admin required)",
)
async def delete_user_record(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> dict[str, str | bool]:
    """Remove user account from platform, safely reassigning dependent historical entities.

    Reassigns authored work items, comments, and audit logs to the active administrator
    and clears assignee references before deleting the user record.

    Args:
        user_id: Target user identifier to remove.
        current_user: Authenticated administrator performing deletion.
        session: Active asynchronous database session.

    Returns:
        dict[str, str | bool]: Confirmation status and deletion message.

    Raises:
        HTTPException: 400 Bad Request if administrator attempts self-deletion.
        HTTPException: 403 Forbidden if caller lacks administrative privileges.
        HTTPException: 404 Not Found if target user does not exist.
    """
    is_admin = await check_is_admin(current_user, session)
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform administrators can delete user accounts.",
        )

    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own active user account.",
        )

    statement = select(User).where(User.id == user_id)
    target_user = (await session.execute(statement)).scalar_one_or_none()
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    await session.execute(
        update(WorkItem)
        .where(WorkItem.created_by_id == user_id)
        .values(created_by_id=current_user.id)
    )
    await session.execute(
        update(WorkItem)
        .where(WorkItem.assignee_id == user_id)
        .values(assignee_id=None)
    )
    await session.execute(
        update(Comment)
        .where(Comment.user_id == user_id)
        .values(user_id=current_user.id)
    )
    await session.execute(
        update(ActivityLog)
        .where(ActivityLog.user_id == user_id)
        .values(user_id=current_user.id)
    )

    await session.delete(target_user)
    await session.commit()

    return {
        "success": True,
        "message": f"User account {target_user.display_name} deleted successfully.",
    }
