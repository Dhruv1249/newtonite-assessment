"""Authentication router handling registration, login, profile lookup, and user search."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLoginRequest, UserRegisterRequest, UserResponse
from app.services.auth_service import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


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
