"""Work item request and response validation schemas."""

from datetime import datetime
from typing import Any
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.work_item import ItemPriority
from app.schemas.auth import UserResponse


class WorkItemCreateRequest(BaseModel):
    """Payload for creating a new operational work item.

    Attributes:
        title: Clear summary of the operational requirement.
        description: Comprehensive details, logs, or context.
        team_id: Owning team identifier.
        priority: Priority level.
        category: Operational category classification.
        assignee_id: Optional initial assignee identifier.
    """

    title: str = Field(min_length=3, max_length=500)
    description: str = Field(min_length=5)
    team_id: uuid.UUID
    priority: ItemPriority = ItemPriority.MEDIUM
    category: str = Field(default="general", max_length=64)
    assignee_id: uuid.UUID | None = None


class WorkItemUpdateRequest(BaseModel):
    """Payload for updating work item properties with optimistic concurrency control.

    Attributes:
        expected_version: Version counter expected by client for conflict detection.
        title: Optional updated title.
        description: Optional updated description.
        priority: Optional updated priority level.
        category: Optional updated category.
    """

    expected_version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=3, max_length=500)
    description: str | None = Field(default=None, min_length=5)
    priority: ItemPriority | None = None
    category: str | None = Field(default=None, max_length=64)


class WorkItemTransitionRequest(BaseModel):
    """Payload for executing a workflow state transition with optimistic concurrency.

    Attributes:
        target_status: Desired destination state in the workflow.
        expected_version: Last-known version for conflict prevention.
    """

    target_status: str = Field(min_length=1, max_length=64)
    expected_version: int = Field(ge=1)


class WorkItemAssignRequest(BaseModel):
    """Payload for reassigning a work item with optimistic concurrency.

    Attributes:
        assignee_id: Target user identifier or None to unassign.
        expected_version: Last-known version for conflict prevention.
    """

    assignee_id: uuid.UUID | None = None
    expected_version: int = Field(ge=1)


class WorkItemResponse(BaseModel):
    """Detailed serialized work item representation.

    Attributes:
        id: Unique work item identifier.
        title: Item title.
        description: Item description.
        team_id: Identifier of owning team.
        team_name: Display name of owning team.
        created_by_id: Author user identifier.
        assignee_id: Current assignee identifier.
        status: Current workflow status.
        priority: Current priority level.
        category: Category classification.
        version: Monotonic version integer for optimistic concurrency.
        ai_metadata: Enrichment data from background AI processing.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
        creator: Nested user profile of the creator.
        assignee: Nested user profile of the assignee if assigned.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    team_id: uuid.UUID
    team_name: str | None = None
    created_by_id: uuid.UUID
    assignee_id: uuid.UUID | None = None
    status: str
    priority: str
    category: str
    version: int
    ai_metadata: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
    creator: UserResponse | None = None
    assignee: UserResponse | None = None


class WorkItemListResponse(BaseModel):
    """Paginated collection of work items.

    Attributes:
        items: List of serialized work items.
        total_count: Total items matching query filters.
        page: Zero-indexed current page number.
        page_size: Number of items per page.
        total_pages: Total number of available pages.
    """

    items: list[WorkItemResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
