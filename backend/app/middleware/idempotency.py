"""Idempotency enforcement utilities.

Prevents duplicate execution of mutating operations caused by user double-submits
or client network retries by checking and recording client-provided idempotency keys.
"""

from datetime import datetime, timedelta, timezone
import json
from typing import Any
import uuid
from fastapi import HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idempotency_key import IdempotencyKey


async def check_idempotency_key(
    key: str | None,
    user_id: uuid.UUID,
    session: AsyncSession,
) -> dict[str, Any] | None:
    """Inspect whether a non-expired cached response exists for the supplied idempotency key.

    Args:
        key: Client-provided idempotency key header value.
        user_id: Authenticated user identifier.
        session: Active database session.

    Returns:
        dict[str, Any] | None: Cached status_code and response_body if present and valid.
    """
    if not key:
        return None

    statement = select(IdempotencyKey).where(
        IdempotencyKey.key == key,
        IdempotencyKey.user_id == user_id,
    )
    result = await session.execute(statement)
    record = result.scalar_one_or_none()
    if record is None:
        return None

    if record.expires_at < datetime.now(timezone.utc):
        await session.delete(record)
        await session.flush()
        return None

    return {
        "status_code": record.status_code,
        "response_body": record.response_body,
    }


async def save_idempotency_record(
    key: str | None,
    user_id: uuid.UUID,
    status_code: int,
    response_body: dict[str, Any],
    session: AsyncSession,
    ttl_hours: int = 24,
) -> None:
    """Store the outcome of a successfully processed mutating operation under its idempotency key.

    Args:
        key: Client-provided idempotency key string.
        user_id: Authenticated user identifier.
        status_code: HTTP response status code.
        response_body: Serialized JSON payload returned to client.
        session: Active database session.
        ttl_hours: Validity duration before expiration.
    """
    if not key:
        return

    now = datetime.now(timezone.utc)
    record = IdempotencyKey(
        key=key,
        user_id=user_id,
        status_code=status_code,
        response_body=response_body,
        created_at=now,
        expires_at=now + timedelta(hours=ttl_hours),
    )
    session.add(record)
    await session.flush()
