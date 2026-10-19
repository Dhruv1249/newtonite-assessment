"""Activity log response validation schemas."""

from datetime import datetime
from typing import Any
import uuid
from pydantic import BaseModel, ConfigDict

from app.schemas.auth import UserResponse


class ActivityLogResponse(BaseModel):
    """Serialized audit log entry.

    Attributes:
        id: Unique identifier for log entry.
        item_id: Associated work item identifier.
        user_id: Actor user identifier.
        action_type: Action classification identifier.
        old_value: Previous state or property values.
        new_value: New state or property values.
        created_at: Action execution timestamp.
        actor: Nested actor profile information.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID
    user_id: uuid.UUID
    action_type: str
    old_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None
    created_at: datetime
    actor: UserResponse | None = None
