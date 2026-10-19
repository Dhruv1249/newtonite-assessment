"""Comment request and response validation schemas."""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserResponse


class CommentCreateRequest(BaseModel):
    """Payload for submitting a comment on a work item.

    Attributes:
        content: Comment body text.
    """

    content: str = Field(min_length=1)


class CommentResponse(BaseModel):
    """Serialized comment representation.

    Attributes:
        id: Unique comment identifier.
        item_id: Associated work item identifier.
        user_id: Author user identifier.
        content: Text content of comment.
        created_at: Submission timestamp.
        author: Nested author user profile.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: datetime
    author: UserResponse | None = None
