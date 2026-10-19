"""Workflows router handling state machine creation, updates, and schema inspection."""

from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.workflow import Workflow
from app.schemas.workflow import (
    WorkflowCreateRequest,
    WorkflowResponse,
    WorkflowUpdateRequest,
)

router = APIRouter(prefix="/api/v1/workflows", tags=["Workflows"])


@router.get(
    "",
    response_model=list[WorkflowResponse],
    summary="List available workflow templates",
)
async def list_workflows(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> list[WorkflowResponse]:
    """Retrieve all defined workflow templates.

    Args:
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        list[WorkflowResponse]: All available workflows.
    """
    statement = select(Workflow).order_by(Workflow.name.asc())
    result = await session.execute(statement)
    workflows = list(result.scalars().all())
    return [WorkflowResponse.model_validate(wf) for wf in workflows]


@router.post(
    "",
    response_model=WorkflowResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom workflow template",
)
async def create_workflow(
    payload: WorkflowCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> WorkflowResponse:
    """Create a new workflow definition with custom states, transitions, and role guards.

    Args:
        payload: Workflow state and transition definition.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        WorkflowResponse: Created workflow instance.

    Raises:
        HTTPException: 400 Bad Request if workflow name already exists.
    """
    check_name = select(Workflow).where(Workflow.name == payload.name)
    existing = (await session.execute(check_name)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A workflow with this name already exists.",
        )

    new_wf = Workflow(
        name=payload.name,
        description=payload.description,
        states=[s.model_dump() for s in payload.states],
        transitions=[t.model_dump() for t in payload.transitions],
        is_default=payload.is_default,
    )
    session.add(new_wf)
    await session.commit()
    await session.refresh(new_wf)
    return WorkflowResponse.model_validate(new_wf)


@router.get(
    "/{workflow_id}",
    response_model=WorkflowResponse,
    summary="Get workflow definition by ID",
)
async def get_workflow(
    workflow_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> WorkflowResponse:
    """Fetch workflow definition by identifier.

    Args:
        workflow_id: Target workflow identifier.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        WorkflowResponse: Workflow specification.
    """
    statement = select(Workflow).where(Workflow.id == workflow_id)
    wf = (await session.execute(statement)).scalar_one_or_none()
    if wf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")
    return WorkflowResponse.model_validate(wf)


@router.put(
    "/{workflow_id}",
    response_model=WorkflowResponse,
    summary="Update an existing workflow definition",
)
async def update_workflow(
    workflow_id: uuid.UUID,
    payload: WorkflowUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> WorkflowResponse:
    """Update workflow states, transitions, or descriptive metadata.

    Args:
        workflow_id: Target workflow identifier.
        payload: Modified attributes.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        WorkflowResponse: Updated workflow entity.
    """
    statement = select(Workflow).where(Workflow.id == workflow_id)
    wf = (await session.execute(statement)).scalar_one_or_none()
    if wf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    if payload.name is not None:
        wf.name = payload.name
    if payload.description is not None:
        wf.description = payload.description
    if payload.states is not None:
        wf.states = [s.model_dump() for s in payload.states]
    if payload.transitions is not None:
        wf.transitions = [t.model_dump() for t in payload.transitions]

    await session.commit()
    await session.refresh(wf)
    return WorkflowResponse.model_validate(wf)
