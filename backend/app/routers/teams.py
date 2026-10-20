"""Teams router handling team administration, membership enrollment, and role management."""

from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_database_session
from app.middleware.auth import check_role_permission, get_current_user, verify_team_membership
from app.models.team import Team
from app.models.team_member import TeamMember, TeamRole
from app.models.user import User
from app.models.workflow import Workflow
from app.schemas.team import (
    TeamCreateRequest,
    TeamMemberAddRequest,
    TeamMemberResponse,
    TeamMemberUpdateRequest,
    TeamResponse,
    TeamUpdateRequest,
)

router = APIRouter(prefix="/api/v1/teams", tags=["Teams"])


@router.post(
    "",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new operational team",
)
async def create_team(
    payload: TeamCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> TeamResponse:
    """Create a new team. The creator is automatically enrolled as team admin.

    Args:
        payload: Team creation data.
        current_user: Creator user model.
        session: Active database session.

    Returns:
        TeamResponse: Serialized team instance.

    Raises:
        HTTPException: 400 Bad Request if workflow is missing or name collision occurs.
    """
    check_name = select(Team).where(Team.name == payload.name)
    existing_team = (await session.execute(check_name)).scalar_one_or_none()
    if existing_team is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A team with this name already exists.",
        )

    workflow_id = payload.workflow_id
    if workflow_id is None:
        default_wf_statement = select(Workflow.id).where(Workflow.is_default == True).limit(1)
        workflow_id = (await session.execute(default_wf_statement)).scalar_one_or_none()
        if workflow_id is None:
            first_wf_statement = select(Workflow.id).limit(1)
            workflow_id = (await session.execute(first_wf_statement)).scalar_one_or_none()
            if workflow_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No workflow definition found. Create a workflow first.",
                )

    new_team = Team(
        name=payload.name,
        description=payload.description,
        workflow_id=workflow_id,
    )
    session.add(new_team)
    await session.flush()

    membership = TeamMember(
        user_id=current_user.id,
        team_id=new_team.id,
        role=TeamRole.ADMIN.value,
    )
    session.add(membership)
    await session.commit()
    await session.refresh(new_team)

    return TeamResponse(
        id=new_team.id,
        name=new_team.name,
        description=new_team.description,
        workflow_id=new_team.workflow_id,
        created_at=new_team.created_at,
        member_count=1,
        user_role=TeamRole.ADMIN.value,
    )


@router.get(
    "",
    response_model=list[TeamResponse],
    summary="List all teams accessible to the current user",
)
async def list_teams(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> list[TeamResponse]:
    """Retrieve teams where caller has membership with role annotations.

    Args:
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        list[TeamResponse]: List of enrolled teams.
    """
    statement = (
        select(Team, TeamMember.role)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(TeamMember.user_id == current_user.id)
        .order_by(Team.name.asc())
    )
    result = await session.execute(statement)

    team_responses: list[TeamResponse] = []
    for team, role in result:
        count_stmt = select(func.count(TeamMember.id)).where(TeamMember.team_id == team.id)
        member_count = (await session.execute(count_stmt)).scalar_one()
        team_responses.append(
            TeamResponse(
                id=team.id,
                name=team.name,
                description=team.description,
                workflow_id=team.workflow_id,
                created_at=team.created_at,
                member_count=member_count,
                user_role=role,
            )
        )
    return team_responses


@router.get(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Retrieve team details",
)
async def get_team(
    team_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> TeamResponse:
    """Retrieve details for a single team ensuring user membership.

    Args:
        team_id: Target team identifier.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        TeamResponse: Team record.
    """
    role = await verify_team_membership(current_user.id, team_id, session)
    statement = select(Team).where(Team.id == team_id)
    team = (await session.execute(statement)).scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found.")

    count_stmt = select(func.count(TeamMember.id)).where(TeamMember.team_id == team.id)
    member_count = (await session.execute(count_stmt)).scalar_one()

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        workflow_id=team.workflow_id,
        created_at=team.created_at,
        member_count=member_count,
        user_role=role,
    )


@router.put(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Update operational team details or workflow binding (Admin required)",
)
async def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> TeamResponse:
    """Update team properties including name, description, or assigned workflow state machine.

    Requires team Admin role.

    Args:
        team_id: Target team identifier.
        payload: Modified attributes.
        current_user: Authenticated caller.
        session: Active database session.

    Returns:
        TeamResponse: Updated team instance.

    Raises:
        HTTPException: 403 Forbidden if caller is not an Admin.
        HTTPException: 404 Not Found if team or workflow does not exist.
    """
    caller_role = await verify_team_membership(current_user.id, team_id, session)
    if caller_role != TeamRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team administrators can update team configuration.",
        )

    statement = select(Team).where(Team.id == team_id)
    team = (await session.execute(statement)).scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found.")

    if payload.name is not None:
        team.name = payload.name
    if payload.description is not None:
        team.description = payload.description
    if payload.workflow_id is not None:
        wf_statement = select(Workflow).where(Workflow.id == payload.workflow_id)
        wf = (await session.execute(wf_statement)).scalar_one_or_none()
        if wf is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced workflow definition not found.",
            )
        team.workflow_id = payload.workflow_id

    await session.commit()
    await session.refresh(team)

    count_stmt = select(func.count(TeamMember.id)).where(TeamMember.team_id == team.id)
    member_count = (await session.execute(count_stmt)).scalar_one()

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        workflow_id=team.workflow_id,
        created_at=team.created_at,
        member_count=member_count,
        user_role=caller_role,
    )


@router.get(
    "/{team_id}/members",
    response_model=list[TeamMemberResponse],
    summary="List members and roles of a team",
)
async def list_team_members(
    team_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> list[TeamMemberResponse]:
    """Retrieve member roster and assigned roles for a team.

    Args:
        team_id: Target team identifier.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        list[TeamMemberResponse]: Member roster.
    """
    await verify_team_membership(current_user.id, team_id, session)

    statement = (
        select(TeamMember)
        .options(selectinload(TeamMember.user))
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.joined_at.asc())
    )
    result = await session.execute(statement)
    members = list(result.scalars().all())
    return [TeamMemberResponse.model_validate(m) for m in members]


@router.post(
    "/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a user to a team (Admin required)",
)
async def add_team_member(
    team_id: uuid.UUID,
    payload: TeamMemberAddRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> TeamMemberResponse:
    """Enroll a user into a team. Requires team Admin role.

    Args:
        team_id: Target team identifier.
        payload: User ID and role assignment.
        current_user: Authenticated caller.
        session: Active database session.

    Returns:
        TeamMemberResponse: Created membership entity.

    Raises:
        HTTPException: 403 Forbidden if caller is not an Admin.
        HTTPException: 409 Conflict if user is already enrolled.
    """
    role = await verify_team_membership(current_user.id, team_id, session)
    if role != TeamRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team administrators can enroll new members.",
        )

    check_existing = select(TeamMember).where(
        TeamMember.team_id == team_id,
        TeamMember.user_id == payload.user_id,
    )
    existing = (await session.execute(check_existing)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this team.",
        )

    membership = TeamMember(
        user_id=payload.user_id,
        team_id=team_id,
        role=payload.role.value,
    )
    session.add(membership)
    await session.commit()
    await session.refresh(membership, ["user"])
    return TeamMemberResponse.model_validate(membership)


@router.put(
    "/{team_id}/members/{target_user_id}",
    response_model=TeamMemberResponse,
    summary="Update a team member's role (Admin required)",
)
async def update_team_member_role(
    team_id: uuid.UUID,
    target_user_id: uuid.UUID,
    payload: TeamMemberUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> TeamMemberResponse:
    """Modify the authorization role of a team member. Requires Admin role.

    Args:
        team_id: Target team identifier.
        target_user_id: Member to update.
        payload: New role specification.
        current_user: Authenticated caller.
        session: Active database session.

    Returns:
        TeamMemberResponse: Updated membership.
    """
    caller_role = await verify_team_membership(current_user.id, team_id, session)
    if caller_role != TeamRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team administrators can modify member roles.",
        )

    statement = (
        select(TeamMember)
        .options(selectinload(TeamMember.user))
        .where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == target_user_id,
        )
    )
    membership = (await session.execute(statement)).scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership record not found.",
        )

    membership.role = payload.role.value
    await session.commit()
    await session.refresh(membership)
    return TeamMemberResponse.model_validate(membership)


@router.delete(
    "/{team_id}/members/{target_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from a team (Admin required)",
)
async def remove_team_member(
    team_id: uuid.UUID,
    target_user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> None:
    """Remove a user from team membership. Requires Admin role.

    Args:
        team_id: Target team identifier.
        target_user_id: User to remove.
        current_user: Authenticated caller.
        session: Active database session.
    """
    caller_role = await verify_team_membership(current_user.id, team_id, session)
    if caller_role != TeamRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team administrators can remove members.",
        )

    statement = select(TeamMember).where(
        TeamMember.team_id == team_id,
        TeamMember.user_id == target_user_id,
    )
    membership = (await session.execute(statement)).scalar_one_or_none()
    if membership:
        await session.delete(membership)
        await session.commit()
