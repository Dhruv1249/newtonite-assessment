"""Comments router handling discussion messages and collaborative notes on work items."""

from datetime import datetime, timezone
from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_database_session
from app.middleware.auth import get_current_user
from app.models.activity_log import ActivityLog
from app.models.comment import Comment
from app.models.user import User
from app.schemas.comment import CommentCreateRequest, CommentResponse
from app.services.event_broadcaster import event_broadcaster
from app.services.item_service import ItemService

router = APIRouter(prefix="/api/v1/items/{item_id}/comments", tags=["Comments"])


@router.get(
    "",
    response_model=list[CommentResponse],
    summary="List comments for a work item",
)
async def list_comments(
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> list[CommentResponse]:
    """Retrieve chronological discussion comments for an authorized work item.

    Args:
        item_id: Target work item identifier.
        current_user: Authenticated user.
        session: Active database session.

    Returns:
        list[CommentResponse]: Chronological comments list.
    """
    await ItemService.get_item_by_id(session, item_id, current_user)

    statement = (
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.item_id == item_id)
        .order_by(Comment.created_at.asc())
    )
    result = await session.execute(statement)
    comments = list(result.scalars().all())
    return [CommentResponse.model_validate(c) for c in comments]


@router.post(
    "",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to a work item",
)
async def add_comment(
    item_id: uuid.UUID,
    payload: CommentCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_database_session)],
) -> CommentResponse:
    """Submit a comment to a work item and record an activity log entry.

    Args:
        item_id: Target work item identifier.
        payload: Comment text content.
        current_user: Authenticated user author.
        session: Active database session.

    Returns:
        CommentResponse: Created comment record.
    """
    item = await ItemService.get_item_by_id(session, item_id, current_user)

    now = datetime.now(timezone.utc)
    comment = Comment(
        item_id=item_id,
        user_id=current_user.id,
        content=payload.content,
        created_at=now,
    )
    session.add(comment)

    log_entry = ActivityLog(
        item_id=item_id,
        user_id=current_user.id,
        action_type="comment_added",
        old_value=None,
        new_value={"snippet": payload.content[:100]},
        created_at=now,
    )
    session.add(log_entry)
    await session.commit()
    await session.refresh(comment, ["author"])

    await event_broadcaster.broadcast(
        "comment_added",
        {
            "item_id": str(item_id),
            "team_id": str(item.team_id),
            "comment_id": str(comment.id),
        },
    )
    return CommentResponse.model_validate(comment)
