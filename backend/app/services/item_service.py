"""Work item domain operations and concurrency management service.

Implements optimistic concurrency control with conflict detection, resource-level
authorization checks, immutable audit trail generation, and real-time broadcast triggers.
"""

from datetime import datetime, timezone
from typing import Any
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.middleware.auth import check_role_permission, get_user_team_ids, verify_team_membership
from app.models.activity_log import ActivityLog
from app.models.team import Team
from app.models.team_member import TeamRole
from app.models.user import User
from app.models.work_item import ItemPriority, WorkItem
from app.models.workflow import Workflow
from app.schemas.work_item import (
    WorkItemAssignRequest,
    WorkItemCreateRequest,
    WorkItemTransitionRequest,
    WorkItemUpdateRequest,
)
from app.services.event_broadcaster import event_broadcaster
from app.services.workflow_engine import WorkflowEngine
from app.worker import enqueue_background_task


class ItemService:
    """Core domain service for work item lifecycle operations."""

    @staticmethod
    async def create_item(
        session: AsyncSession,
        payload: WorkItemCreateRequest,
        actor: User,
    ) -> WorkItem:
        """Create a new work item with role verification, audit logging, and background AI triage.

        Args:
            session: Active database session.
            payload: Validated work item creation parameters.
            actor: User performing creation.

        Returns:
            WorkItem: Persisted work item instance.

        Raises:
            HTTPException: 403 Forbidden if user lacks membership or is merely a viewer.
            HTTPException: 404 Not Found if designated team or workflow is missing.
        """
        actor_role = await verify_team_membership(actor.id, payload.team_id, session)
        if actor_role == TeamRole.VIEWER.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Viewers cannot create work items in this team.",
            )

        team_statement = (
            select(Team)
            .options(selectinload(Team.workflow))
            .where(Team.id == payload.team_id)
        )
        team_result = await session.execute(team_statement)
        team = team_result.scalar_one_or_none()
        if team is None or team.workflow is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owning team or associated workflow not found.",
            )

        initial_status = WorkflowEngine.get_initial_state(team.workflow)

        if payload.assignee_id is not None:
            await verify_team_membership(payload.assignee_id, payload.team_id, session)

        now = datetime.now(timezone.utc)
        item = WorkItem(
            title=payload.title,
            description=payload.description,
            team_id=payload.team_id,
            created_by_id=actor.id,
            assignee_id=payload.assignee_id,
            status=initial_status,
            priority=payload.priority.value,
            category=payload.category,
            version=1,
            created_at=now,
            updated_at=now,
        )
        session.add(item)
        await session.flush()

        log_entry = ActivityLog(
            item_id=item.id,
            user_id=actor.id,
            action_type="created",
            old_value=None,
            new_value={
                "title": item.title,
                "status": item.status,
                "priority": item.priority,
                "category": item.category,
            },
            created_at=now,
        )
        session.add(log_entry)

        await enqueue_background_task(
            session=session,
            task_type="generate_embedding_and_triage",
            payload={"work_item_id": str(item.id)},
        )

        await session.commit()
        await session.refresh(item, ["team", "creator", "assignee"])

        await event_broadcaster.broadcast(
            "item_created",
            {
                "item_id": str(item.id),
                "team_id": str(item.team_id),
                "title": item.title,
                "status": item.status,
            },
        )
        return item

    @staticmethod
    async def get_item_by_id(
        session: AsyncSession,
        item_id: uuid.UUID,
        actor: User,
    ) -> WorkItem:
        """Fetch a single work item enforcing resource-level authorization.

        Args:
            session: Active database session.
            item_id: Target work item identifier.
            actor: Authenticated user requesting access.

        Returns:
            WorkItem: Found work item model.

        Raises:
            HTTPException: 404 Not Found if item does not exist or caller lacks access.
        """
        statement = (
            select(WorkItem)
            .options(
                selectinload(WorkItem.team),
                selectinload(WorkItem.creator),
                selectinload(WorkItem.assignee),
            )
            .where(WorkItem.id == item_id)
        )
        result = await session.execute(statement)
        item = result.scalar_one_or_none()
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Work item not found.",
            )

        accessible_team_ids = await get_user_team_ids(actor.id, session)
        if item.team_id not in accessible_team_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Work item not found.",
            )

        return item

    @staticmethod
    async def list_items(
        session: AsyncSession,
        actor: User,
        team_id: uuid.UUID | None = None,
        status_filter: str | None = None,
        priority_filter: str | None = None,
        assignee_filter: uuid.UUID | None = None,
        search_query: str | None = None,
        page: int = 0,
        page_size: int = 20,
    ) -> tuple[list[WorkItem], int]:
        """Query paginated work items filtered strictly to caller's team memberships.

        Args:
            session: Active database session.
            actor: Requesting user.
            team_id: Optional specific team filter.
            status_filter: Optional workflow status filter.
            priority_filter: Optional priority filter.
            assignee_filter: Optional assigned user filter.
            search_query: Optional lexical substring search.
            page: Zero-indexed page offset.
            page_size: Count of items to return.

        Returns:
            tuple[list[WorkItem], int]: Matching items and total count.
        """
        accessible_teams = await get_user_team_ids(actor.id, session)
        if not accessible_teams:
            return [], 0

        conditions = [WorkItem.team_id.in_(accessible_teams)]
        if team_id is not None:
            if team_id not in accessible_teams:
                return [], 0
            conditions.append(WorkItem.team_id == team_id)

        if status_filter:
            conditions.append(WorkItem.status == status_filter)
        if priority_filter:
            conditions.append(WorkItem.priority == priority_filter)
        if assignee_filter is not None:
            conditions.append(WorkItem.assignee_id == assignee_filter)
        if search_query:
            query_pattern = f"%{search_query.strip()}%"
            conditions.append(
                WorkItem.title.ilike(query_pattern)
                | WorkItem.description.ilike(query_pattern)
            )

        count_statement = select(func.count(WorkItem.id)).where(*conditions)
        total_count = (await session.execute(count_statement)).scalar_one()

        statement = (
            select(WorkItem)
            .options(
                selectinload(WorkItem.team),
                selectinload(WorkItem.creator),
                selectinload(WorkItem.assignee),
            )
            .where(*conditions)
            .order_by(WorkItem.created_at.desc())
            .offset(page * page_size)
            .limit(page_size)
        )
        result = await session.execute(statement)
        items = list(result.scalars().all())
        return items, total_count

    @staticmethod
    async def update_item(
        session: AsyncSession,
        item_id: uuid.UUID,
        payload: WorkItemUpdateRequest,
        actor: User,
    ) -> WorkItem:
        """Update work item metadata with optimistic concurrency conflict detection.

        Args:
            session: Active database session.
            item_id: Target work item identifier.
            payload: Update values along with client expected_version.
            actor: User performing update.

        Returns:
            WorkItem: Updated work item with incremented version counter.

        Raises:
            HTTPException: 409 Conflict if expected_version does not match current version.
            HTTPException: 403 Forbidden if user lacks sufficient privileges.
            HTTPException: 404 Not Found if item does not exist.
        """
        item = await ItemService.get_item_by_id(session, item_id, actor)
        actor_role = await verify_team_membership(actor.id, item.team_id, session)

        if actor_role == TeamRole.VIEWER.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Viewers cannot modify work items.",
            )

        if actor_role == TeamRole.MEMBER.value:
            if item.assignee_id != actor.id and item.created_by_id != actor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Members may only update items they authored or are assigned to.",
                )

        if item.version != payload.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Conflict detected: Work item was modified by another user. "
                    f"Current version is {item.version}, but client submitted {payload.expected_version}."
                ),
            )

        old_snapshot = {
            "title": item.title,
            "description": item.description,
            "priority": item.priority,
            "category": item.category,
        }

        update_values: dict[str, Any] = {
            "version": item.version + 1,
            "updated_at": datetime.now(timezone.utc),
        }
        if payload.title is not None:
            update_values["title"] = payload.title
        if payload.description is not None:
            update_values["description"] = payload.description
        if payload.priority is not None:
            update_values["priority"] = payload.priority.value
        if payload.category is not None:
            update_values["category"] = payload.category

        update_statement = (
            update(WorkItem)
            .where(
                WorkItem.id == item_id,
                WorkItem.version == payload.expected_version,
            )
            .values(**update_values)
        )
        result = await session.execute(update_statement)
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Concurrent modification conflict: item was modified by another transaction.",
            )

        log_entry = ActivityLog(
            item_id=item.id,
            user_id=actor.id,
            action_type="updated",
            old_value=old_snapshot,
            new_value={k: v for k, v in update_values.items() if k in old_snapshot},
            created_at=datetime.now(timezone.utc),
        )
        session.add(log_entry)

        if payload.title or payload.description:
            await enqueue_background_task(
                session=session,
                task_type="generate_embedding_and_triage",
                payload={"work_item_id": str(item.id)},
            )

        await session.commit()
        await session.refresh(item, ["team", "creator", "assignee"])

        await event_broadcaster.broadcast(
            "item_updated",
            {
                "item_id": str(item.id),
                "team_id": str(item.team_id),
                "version": item.version,
            },
        )
        return item

    @staticmethod
    async def transition_item(
        session: AsyncSession,
        item_id: uuid.UUID,
        payload: WorkItemTransitionRequest,
        actor: User,
    ) -> WorkItem:
        """Validate and execute a workflow transition with role guards and optimistic concurrency.

        Args:
            session: Active database session.
            item_id: Work item to transition.
            payload: Target status and expected version.
            actor: User executing transition.

        Returns:
            WorkItem: Updated work item in new status.

        Raises:
            HTTPException: 409 Conflict on version mismatch.
            HTTPException: 403 Forbidden if user role is not authorized for this transition.
            HTTPException: 400 Bad Request if transition is invalid in workflow.
        """
        item = await ItemService.get_item_by_id(session, item_id, actor)
        actor_role = await verify_team_membership(actor.id, item.team_id, session)

        if item.version != payload.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Conflict detected: Item status was changed concurrently. "
                    f"Current version is {item.version}, client expected {payload.expected_version}."
                ),
            )

        team_statement = (
            select(Team)
            .options(selectinload(Team.workflow))
            .where(Team.id == item.team_id)
        )
        team_result = await session.execute(team_statement)
        team = team_result.scalar_one_or_none()
        if team is None or team.workflow is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow definition not found for owning team.",
            )

        WorkflowEngine.validate_transition(
            workflow=team.workflow,
            current_status=item.status,
            target_status=payload.target_status,
            actor_role=actor_role,
        )

        old_status = item.status
        new_version = item.version + 1
        now = datetime.now(timezone.utc)

        update_statement = (
            update(WorkItem)
            .where(
                WorkItem.id == item_id,
                WorkItem.version == payload.expected_version,
            )
            .values(
                status=payload.target_status,
                version=new_version,
                updated_at=now,
            )
        )
        result = await session.execute(update_statement)
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Concurrent modification detected during state transition.",
            )

        log_entry = ActivityLog(
            item_id=item.id,
            user_id=actor.id,
            action_type="status_transition",
            old_value={"status": old_status},
            new_value={"status": payload.target_status},
            created_at=now,
        )
        session.add(log_entry)
        await session.commit()
        await session.refresh(item, ["team", "creator", "assignee"])

        await event_broadcaster.broadcast(
            "item_transitioned",
            {
                "item_id": str(item.id),
                "team_id": str(item.team_id),
                "old_status": old_status,
                "new_status": payload.target_status,
                "version": item.version,
            },
        )
        return item

    @staticmethod
    async def assign_item(
        session: AsyncSession,
        item_id: uuid.UUID,
        payload: WorkItemAssignRequest,
        actor: User,
    ) -> WorkItem:
        """Assign or reassign a work item with optimistic concurrency control.

        Args:
            session: Active database session.
            item_id: Target work item identifier.
            payload: New assignee ID (or None) and expected_version.
            actor: User executing the assignment.

        Returns:
            WorkItem: Updated work item with new assignee.

        Raises:
            HTTPException: 409 Conflict on version collision.
            HTTPException: 403 Forbidden if user lacks assignment permission.
        """
        item = await ItemService.get_item_by_id(session, item_id, actor)
        actor_role = await verify_team_membership(actor.id, item.team_id, session)

        can_assign = check_role_permission(actor_role, TeamRole.LEAD)
        is_self_claim = payload.assignee_id == actor.id and item.assignee_id is None
        if not can_assign and not is_self_claim:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Team Leads or Admins may assign work items. Members may only claim unassigned items.",
            )

        if payload.assignee_id is not None:
            await verify_team_membership(payload.assignee_id, item.team_id, session)

        if item.version != payload.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Conflict: Item was reassigned or updated. "
                    f"Current version is {item.version}, client expected {payload.expected_version}."
                ),
            )

        old_assignee_id = str(item.assignee_id) if item.assignee_id else None
        new_version = item.version + 1
        now = datetime.now(timezone.utc)

        update_statement = (
            update(WorkItem)
            .where(
                WorkItem.id == item_id,
                WorkItem.version == payload.expected_version,
            )
            .values(
                assignee_id=payload.assignee_id,
                version=new_version,
                updated_at=now,
            )
        )
        result = await session.execute(update_statement)
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Concurrent modification detected during assignment.",
            )

        log_entry = ActivityLog(
            item_id=item.id,
            user_id=actor.id,
            action_type="reassigned",
            old_value={"assignee_id": old_assignee_id},
            new_value={"assignee_id": str(payload.assignee_id) if payload.assignee_id else None},
            created_at=now,
        )
        session.add(log_entry)
        await session.commit()
        await session.refresh(item, ["team", "creator", "assignee"])

        await event_broadcaster.broadcast(
            "item_assigned",
            {
                "item_id": str(item.id),
                "team_id": str(item.team_id),
                "assignee_id": str(item.assignee_id) if item.assignee_id else None,
                "version": item.version,
            },
        )
        return item
