"""Idempotency record entity definition.

Stores cached responses for mutating operations identified by client-supplied keys
to guarantee exactly-once execution semantics across network retries.
"""

from datetime import datetime, timezone
from typing import Any
import uuid
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class IdempotencyKey(Base):
    """Cached response record for an idempotent mutation request.

    Attributes:
        key: Client-provided unique idempotency token.
        user_id: User who issued the request.
        status_code: HTTP response status code produced on original execution.
        response_body: Serialized response payload returned to client.
        created_at: Timestamp when the request was first processed.
        expires_at: Timestamp after which the idempotency record may be pruned.
    """

    __tablename__ = "idempotency_keys"

    key: Mapped[str] = mapped_column(
        String(255),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status_code: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    response_body: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
    )
