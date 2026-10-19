"""Dashboard router providing aggregated operational statistics across accessible teams."""

from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.middleware.auth import get_current_user, get_user_team_ids
from app.models.user import User
from app.models.work_item import ItemPriority, WorkItem
from app.schemas.ai import DashboardStatsResponse

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    summary="Retrieve aggregated operational statistics for current user's teams",
)
async def get_dashboard_statistics(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> DashboardStatsResponse:
    """Compute operational metrics across all teams where caller maintains membership.

    Args:
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        DashboardStatsResponse: Aggregated KPI counts and breakdowns.
    """
    team_ids = await get_user_team_ids(current_user.id, session)
    if not team_ids:
        return DashboardStatsResponse(
            total_active_items=0,
            critical_items_count=0,
            unassigned_items_count=0,
            in_review_items_count=0,
            items_by_priority={},
            items_by_status={},
        )

    base_filter = WorkItem.team_id.in_(team_ids)
    terminal_statuses = ["resolved", "closed", "cancelled"]

    active_count_stmt = select(func.count(WorkItem.id)).where(
        base_filter,
        WorkItem.status.not_in(terminal_statuses),
    )
    total_active = (await session.execute(active_count_stmt)).scalar_one()

    critical_count_stmt = select(func.count(WorkItem.id)).where(
        base_filter,
        WorkItem.status.not_in(terminal_statuses),
        WorkItem.priority == ItemPriority.CRITICAL.value,
    )
    critical_count = (await session.execute(critical_count_stmt)).scalar_one()

    unassigned_count_stmt = select(func.count(WorkItem.id)).where(
        base_filter,
        WorkItem.status.not_in(terminal_statuses),
        WorkItem.assignee_id.is_(None),
    )
    unassigned_count = (await session.execute(unassigned_count_stmt)).scalar_one()

    in_review_stmt = select(func.count(WorkItem.id)).where(
        base_filter,
        WorkItem.status == "in_review",
    )
    in_review_count = (await session.execute(in_review_stmt)).scalar_one()

    priority_stmt = (
        select(WorkItem.priority, func.count(WorkItem.id))
        .where(base_filter, WorkItem.status.not_in(terminal_statuses))
        .group_by(WorkItem.priority)
    )
    priority_rows = (await session.execute(priority_stmt)).all()
    priority_map = {row[0]: row[1] for row in priority_rows}

    status_stmt = (
        select(WorkItem.status, func.count(WorkItem.id))
        .where(base_filter)
        .group_by(WorkItem.status)
    )
    status_rows = (await session.execute(status_stmt)).all()
    status_map = {row[0]: row[1] for row in status_rows}

    return DashboardStatsResponse(
        total_active_items=total_active,
        critical_items_count=critical_count,
        unassigned_items_count=unassigned_count,
        in_review_items_count=in_review_count,
        items_by_priority=priority_map,
        items_by_status=status_map,
    )
