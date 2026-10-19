"""Workflow engine and state transition validation service.

Enforces configurable state machine definitions, permitted transitions, and role guards.
"""

from typing import Any
from fastapi import HTTPException, status

from app.models.team_member import TeamRole
from app.models.workflow import Workflow


class WorkflowEngine:
    """State machine validation engine for work item lifecycles."""

    @staticmethod
    def validate_transition(
        workflow: Workflow,
        current_status: str,
        target_status: str,
        actor_role: str,
    ) -> dict[str, Any]:
        """Validate an attempted state transition against workflow states and role guards.

        Ensures that:
        1. The target status is declared within the workflow states.
        2. A transition exists connecting current_status to target_status.
        3. The actor's role satisfies the required roles declared on the transition.

        Args:
            workflow: Configured Workflow model with JSONB states and transitions.
            current_status: Current status of the work item.
            target_status: Requested destination status.
            actor_role: Team role of the user attempting the transition.

        Returns:
            dict[str, Any]: The matched transition rule definition.

        Raises:
            HTTPException: 400 Bad Request if state or transition is invalid.
            HTTPException: 403 Forbidden if actor lacks the role required for the transition.
        """
        states = workflow.states or []
        valid_state_ids = {state.get("id") for state in states if isinstance(state, dict)}
        if target_status not in valid_state_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target status '{target_status}' is not defined in this team's workflow.",
            )

        transitions = workflow.transitions or []
        matched_transition: dict[str, Any] | None = None
        for transition in transitions:
            if not isinstance(transition, dict):
                continue
            if (
                transition.get("from") == current_status
                and transition.get("to") == target_status
            ):
                matched_transition = transition
                break

        if matched_transition is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transition from '{current_status}' to '{target_status}' is not allowed by the workflow.",
            )

        required_roles: list[str] = matched_transition.get("required_roles", [])
        if actor_role == TeamRole.ADMIN.value:
            return matched_transition

        if required_roles and actor_role not in required_roles:
            required_str = ", ".join(required_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{actor_role}' is not authorized to transition '{current_status}' to '{target_status}'. Required: {required_str}.",
            )

        return matched_transition

    @staticmethod
    def get_initial_state(workflow: Workflow) -> str:
        """Retrieve the designated initial state identifier from a workflow definition.

        Args:
            workflow: Configured Workflow model.

        Returns:
            str: Identifier of the initial state, defaulting to 'open'.
        """
        states = workflow.states or []
        for state in states:
            if isinstance(state, dict) and state.get("type") == "initial":
                return str(state.get("id", "open"))
        return "open"
