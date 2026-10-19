"""Work items router providing CRUD, optimistic concurrency updates, transitions, and semantic search."""

from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_database_session
from app.middleware.auth import get_current_user, get_user_team_ids
from app.middleware.idempotency import check_idempotency_key, save_idempotency_record
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.models.work_item import WorkItem
from app.schemas.activity_log import ActivityLogResponse
from app.schemas.ai import AISuggestionsResponse, SemanticSearchResponse, SemanticSearchResultItem
from app.schemas.work_item import (
    WorkItemAssignRequest,
    WorkItemCreateRequest,
    WorkItemListResponse,
    WorkItemResponse,
    WorkItemTransitionRequest,
    WorkItemUpdateRequest,
)
from app.services.ai_service import ai_service
from app.services.item_service import ItemService

router = APIRouter(prefix="/api/v1/items", tags=["Work Items"])


@router.post(
    "",
    response_model=WorkItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new work item with optional idempotency key",
)
async def create_work_item(
    payload: WorkItemCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> WorkItemResponse:
    """Create a work item.

    If an Idempotency-Key is provided, duplicate submissions return the cached outcome
    without executing duplicate creations.

    Args:
        payload: Work item creation attributes.
        current_user: Authenticated creator.
        session: Active database session.
        idempotency_key: Optional client-supplied deduplication key.

    Returns:
        WorkItemResponse: Created work item details.
    """
    if idempotency_key:
        cached = await check_idempotency_key(idempotency_key, current_user.id, session)
        if cached:
            return WorkItemResponse.model_validate(cached["response_body"])

    item = await ItemService.create_item(session, payload, current_user)
    response_model = WorkItemResponse.model_validate(item)

    if idempotency_key:
        await save_idempotency_record(
            key=idempotency_key,
            user_id=current_user.id,
            status_code=status.HTTP_201_CREATED,
            response_body=response_model.model_dump(mode="json"),
            session=session,
        )
        await session.commit()

    return response_model


@router.get(
    "",
    response_model=WorkItemListResponse,
    summary="List paginated work items filtered to caller's teams",
)
async def list_work_items(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
    team_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    priority_filter: str | None = Query(default=None, alias="priority"),
    assignee_filter: uuid.UUID | None = Query(default=None, alias="assignee_id"),
    search: str | None = Query(default=None),
    page: int = Query(default=0, ge=0),
    page_size: int = Query(default=20, ge=1, le=100),
) -> WorkItemListResponse:
    """Query paginated work items scoped strictly to authorized team memberships.

    Args:
        current_user: Authenticated user.
        session: Active database session.
        team_id: Optional team identifier filter.
        status_filter: Optional workflow state filter.
        priority_filter: Optional priority filter.
        assignee_filter: Optional assignee filter.
        search: Optional lexical search query.
        page: Zero-indexed page number.
        page_size: Page item limit.

    Returns:
        WorkItemListResponse: Paginated work item results.
    """
    items, total = await ItemService.list_items(
        session=session,
        actor=current_user,
        team_id=team_id,
        status_filter=status_filter,
        priority_filter=priority_filter,
        assignee_filter=assignee_filter,
        search_query=search,
        page=page,
        page_size=page_size,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return WorkItemListResponse(
        items=[WorkItemResponse.model_validate(item) for item in items],
        total_count=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/search",
    response_model=SemanticSearchResponse,
    summary="Semantic vector search across accessible work items",
)
async def search_items_semantic(
    q: Annotated[str, Query(min_length=2, description="Search query")],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
    limit: int = Query(default=15, ge=1, le=50),
) -> SemanticSearchResponse:
    """Execute a semantic vector search using pgvector cosine distance against work items.

    Resource authorization is strictly enforced by filtering across caller's team memberships.

    Args:
        q: Search query text.
        current_user: Authenticated user.
        session: Active database session.
        limit: Max results.

    Returns:
        SemanticSearchResponse: Ranked matching items with similarity scores.
    """
    accessible_teams = await get_user_team_ids(current_user.id, session)
    matches = await ai_service.search_similar_items(
        session=session,
        query_text=q,
        accessible_team_ids=accessible_teams,
        limit=limit,
    )

    results = [
        SemanticSearchResultItem(
            item=WorkItemResponse.model_validate(m["item"]),
            similarity_score=m["similarity_score"],
        )
        for m in matches
    ]
    return SemanticSearchResponse(
        query=q,
        total_results=len(results),
        results=results,
    )


@router.get(
    "/{item_id}",
    response_model=WorkItemResponse,
    summary="Retrieve work item details",
)
async def get_work_item(
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> WorkItemResponse:
    """Retrieve details for a single work item with resource authorization.

    Args:
        item_id: Target work item identifier.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        WorkItemResponse: Serialized work item record.
    """
    item = await ItemService.get_item_by_id(session, item_id, current_user)
    return WorkItemResponse.model_validate(item)


@router.put(
    "/{item_id}",
    response_model=WorkItemResponse,
    summary="Update work item attributes with optimistic concurrency",
)
async def update_work_item(
    item_id: uuid.UUID,
    payload: WorkItemUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> WorkItemResponse:
    """Update work item metadata validating client's expected_version against current version.

    Args:
        item_id: Target work item identifier.
        payload: Modification data with expected_version.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        WorkItemResponse: Updated work item with incremented version.
    """
    item = await ItemService.update_item(session, item_id, payload, current_user)
    return WorkItemResponse.model_validate(item)


@router.post(
    "/{item_id}/transition",
    response_model=WorkItemResponse,
    summary="Execute workflow state transition with role guards",
)
async def transition_work_item(
    item_id: uuid.UUID,
    payload: WorkItemTransitionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> WorkItemResponse:
    """Advance work item along permitted workflow transitions with optimistic concurrency and role check.

    Args:
        item_id: Target work item identifier.
        payload: Destination state and expected version.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        WorkItemResponse: Updated work item in new status.
    """
    item = await ItemService.transition_item(session, item_id, payload, current_user)
    return WorkItemResponse.model_validate(item)


@router.post(
    "/{item_id}/assign",
    response_model=WorkItemResponse,
    summary="Assign or reassign work item",
)
async def assign_work_item(
    item_id: uuid.UUID,
    payload: WorkItemAssignRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> WorkItemResponse:
    """Assign responsibility for a work item with optimistic concurrency control.

    Args:
        item_id: Target work item identifier.
        payload: New assignee identifier and expected_version.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        WorkItemResponse: Updated work item with new assignee.
    """
    item = await ItemService.assign_item(session, item_id, payload, current_user)
    return WorkItemResponse.model_validate(item)


@router.get(
    "/{item_id}/activity",
    response_model=list[ActivityLogResponse],
    summary="Retrieve immutable activity timeline for a work item",
)
async def get_item_activity(
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> list[ActivityLogResponse]:
    """Fetch chronological activity logs for the work item.

    Args:
        item_id: Target work item identifier.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        list[ActivityLogResponse]: Historical timeline of item events.
    """
    await ItemService.get_item_by_id(session, item_id, current_user)

    statement = (
        select(ActivityLog)
        .options(selectinload(ActivityLog.actor))
        .where(ActivityLog.item_id == item_id)
        .order_by(ActivityLog.created_at.asc())
    )
    result = await session.execute(statement)
    logs = list(result.scalars().all())
    return [ActivityLogResponse.model_validate(log) for log in logs]


@router.get(
    "/{item_id}/suggestions",
    response_model=AISuggestionsResponse,
    summary="Retrieve AI triage suggestions and duplicate warnings for an item",
)
async def get_item_ai_suggestions(
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> AISuggestionsResponse:
    """Retrieve AI-enriched triage insights, similar duplicate items, and recommended assignees.

    Args:
        item_id: Target work item identifier.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        AISuggestionsResponse: Structured operational insights.
    """
    item = await ItemService.get_item_by_id(session, item_id, current_user)
    if item.ai_metadata:
        return AISuggestionsResponse.model_validate(item.ai_metadata)

    metadata = await ai_service.generate_triage_and_assignment(session, item)
    await session.commit()
    return AISuggestionsResponse.model_validate(metadata)
