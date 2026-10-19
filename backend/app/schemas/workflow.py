"""Workflow definition request and response validation schemas."""

from datetime import datetime
from typing import Any
import uuid
from pydantic import BaseModel, ConfigDict, Field


class WorkflowStateDefinition(BaseModel):
    """Specification of an individual state in a workflow lifecycle.

    Attributes:
        id: Unique machine identifier for the state (e.g. open, in_progress).
        label: Human readable title for the state.
        type: Classification of the state (initial, active, or terminal).
    """

    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=128)
    type: str = Field(default="active")


class WorkflowTransitionDefinition(BaseModel):
    """Specification of a permitted state transition and its role guards.

    Attributes:
        from_state: Source state identifier.
        to_state: Destination state identifier.
        required_roles: Team roles permitted to execute this transition.
    """

    from_state: str = Field(min_length=1, max_length=64)
    to_state: str = Field(min_length=1, max_length=64)
    required_roles: list[str] = Field(default_factory=list)


class WorkflowCreateRequest(BaseModel):
    """Payload for creating a new workflow definition.

    Attributes:
        name: Unique workflow identifier name.
        description: Informational context for this workflow.
        states: List of state definitions.
        transitions: List of allowed transitions with role guards.
        is_default: Whether this workflow serves as the default template.
    """

    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    states: list[WorkflowStateDefinition]
    transitions: list[WorkflowTransitionDefinition]
    is_default: bool = False


class WorkflowUpdateRequest(BaseModel):
    """Payload for updating an existing workflow definition.

    Attributes:
        name: Optional updated name.
        description: Optional updated description.
        states: Optional updated state definitions.
        transitions: Optional updated transitions with role guards.
    """

    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    states: list[WorkflowStateDefinition] | None = None
    transitions: list[WorkflowTransitionDefinition] | None = None


class WorkflowResponse(BaseModel):
    """Serialized representation of a workflow definition.

    Attributes:
        id: Unique workflow identifier.
        name: Name of the workflow.
        description: Description of the workflow.
        states: Array of state definitions.
        transitions: Array of transitions and role guards.
        is_default: Default template indicator.
        created_at: Creation timestamp.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    states: list[dict[str, Any]]
    transitions: list[dict[str, Any]]
    is_default: bool
    created_at: datetime
