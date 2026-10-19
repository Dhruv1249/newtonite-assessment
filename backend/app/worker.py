"""Background task processor and resilient queue worker.

Processes asynchronous enrichment tasks such as vector embedding generation,
duplicate item detection, and AI triage with automatic retries and stuck-task reclamation.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.task_queue import TaskQueue, TaskStatus
from app.models.work_item import WorkItem
from app.services.ai_service import ai_service
from app.services.event_broadcaster import event_broadcaster


async def enqueue_background_task(
    session: AsyncSession,
    task_type: str,
    payload: dict[str, Any],
) -> TaskQueue:
    """Enqueue a new persistent asynchronous task into the database queue.

    Args:
        session: Active database session.
        task_type: Task classification identifier.
        payload: Task arguments dictionary.

    Returns:
        TaskQueue: Created task record.
    """
    task = TaskQueue(
        task_type=task_type,
        payload=payload,
        status=TaskStatus.PENDING.value,
        attempts=0,
        max_attempts=3,
    )
    session.add(task)
    await session.flush()
    return task


async def process_single_task(task_id: uuid.UUID) -> bool:
    """Execute a single queued task with failure handling and status updates.

    Args:
        task_id: Identifier of the task record to process.

    Returns:
        bool: True if completed successfully, False otherwise.
    """
    async with async_session_factory() as session:
        statement = select(TaskQueue).where(TaskQueue.id == task_id).with_for_update()
        result = await session.execute(statement)
        task = result.scalar_one_or_none()
        if task is None or task.status == TaskStatus.COMPLETED.value:
            return False

        task.status = TaskStatus.PROCESSING.value
        task.attempts += 1
        await session.commit()

        try:
            if task.task_type == "generate_embedding_and_triage":
                item_id_str = task.payload.get("work_item_id")
                if item_id_str:
                    item_uuid = uuid.UUID(item_id_str)
                    item_statement = select(WorkItem).where(WorkItem.id == item_uuid)
                    item_result = await session.execute(item_statement)
                    item = item_result.scalar_one_or_none()
                    if item:
                        metadata = await ai_service.generate_triage_and_assignment(
                            session=session,
                            item=item,
                        )
                        await session.commit()
                        await event_broadcaster.broadcast(
                            "item_enriched",
                            {
                                "item_id": str(item.id),
                                "team_id": str(item.team_id),
                                "ai_metadata": metadata,
                            },
                        )

            task.status = TaskStatus.COMPLETED.value
            task.processed_at = datetime.now(timezone.utc)
            task.error_message = None
            await session.commit()
            return True

        except Exception as exc:
            await session.rollback()
            async with async_session_factory() as retry_session:
                retry_statement = select(TaskQueue).where(TaskQueue.id == task_id)
                retry_result = await retry_session.execute(retry_statement)
                retry_task = retry_result.scalar_one_or_none()
                if retry_task:
                    retry_task.error_message = str(exc)
                    if retry_task.attempts >= retry_task.max_attempts:
                        retry_task.status = TaskStatus.FAILED.value
                    else:
                        retry_task.status = TaskStatus.PENDING.value
                    retry_task.processed_at = datetime.now(timezone.utc)
                    await retry_session.commit()
            return False


async def process_pending_tasks(batch_size: int = 5) -> int:
    """Fetch and process a batch of pending or stale queued tasks.

    Automatically reclaims tasks stuck in processing for longer than five minutes.

    Args:
        batch_size: Maximum number of tasks to pull per cycle.

    Returns:
        int: Count of successfully completed tasks in this invocation.
    """
    processed_count = 0
    stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=5)

    async with async_session_factory() as session:
        reclaim_statement = (
            update(TaskQueue)
            .where(
                TaskQueue.status == TaskStatus.PROCESSING.value,
                TaskQueue.created_at < stale_threshold,
            )
            .values(status=TaskStatus.PENDING.value)
        )
        await session.execute(reclaim_statement)
        await session.commit()

        pull_statement = (
            select(TaskQueue.id)
            .where(TaskQueue.status == TaskStatus.PENDING.value)
            .order_by(TaskQueue.created_at)
            .limit(batch_size)
        )
        result = await session.execute(pull_statement)
        task_ids = list(result.scalars().all())

    for task_id in task_ids:
        success = await process_single_task(task_id)
        if success:
            processed_count += 1

    return processed_count
