"""Integration tests for administrator user management and workflow item overrides."""

import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_user_lifecycle(
    async_client: AsyncClient,
    admin_auth_headers: dict[str, str],
    engineer_auth_headers: dict[str, str],
) -> None:
    """Verify administrator user update, authorization checks, and deletion lifecycle.

    Args:
        async_client: Asynchronous test HTTP client.
        admin_auth_headers: Authorization headers for administrator persona.
        engineer_auth_headers: Authorization headers for standard engineer persona.
    """
    create_payload = {
        "email": f"temp_user_{uuid.uuid4().hex[:8]}@opflow.internal",
        "password": "password123",
        "display_name": "Temporary Test User",
    }
    create_response = await async_client.post(
        "/api/v1/auth/users",
        json=create_payload,
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201
    created_user = create_response.json()
    user_id = created_user["id"]

    forbidden_update = await async_client.put(
        f"/api/v1/auth/users/{user_id}",
        json={"display_name": "Unauthorized Attempt"},
        headers=engineer_auth_headers,
    )
    assert forbidden_update.status_code == 403

    updated_name = "Updated Test User"
    success_update = await async_client.put(
        f"/api/v1/auth/users/{user_id}",
        json={"display_name": updated_name},
        headers=admin_auth_headers,
    )
    assert success_update.status_code == 200
    assert success_update.json()["display_name"] == updated_name

    delete_response = await async_client.delete(
        f"/api/v1/auth/users/{user_id}",
        headers=admin_auth_headers,
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["success"] is True

    me_response = await async_client.get(
        "/api/v1/auth/me",
        headers=admin_auth_headers,
    )
    admin_id = me_response.json()["id"]
    self_delete_response = await async_client.delete(
        f"/api/v1/auth/users/{admin_id}",
        headers=admin_auth_headers,
    )
    assert self_delete_response.status_code == 400


@pytest.mark.asyncio
async def test_work_item_creation_with_workflow_override(
    async_client: AsyncClient,
    admin_auth_headers: dict[str, str],
    engineer_auth_headers: dict[str, str],
) -> None:
    """Verify work item creation with a custom workflow template override.

    Args:
        async_client: Asynchronous test HTTP client.
        admin_auth_headers: Authorization headers for administrator persona.
        engineer_auth_headers: Authorization headers for engineer persona.
    """
    teams_response = await async_client.get(
        "/api/v1/teams",
        headers=engineer_auth_headers,
    )
    assert teams_response.status_code == 200
    teams = teams_response.json()
    assert len(teams) > 0
    target_team = teams[0]

    custom_workflow_payload = {
        "name": f"Fast-Track Workflow {uuid.uuid4().hex[:6]}",
        "description": "Streamlined operational workflow for urgent requests.",
        "states": [
            {"id": "triage", "label": "Triage", "type": "initial"},
            {"id": "in_flight", "label": "In Flight", "type": "active"},
            {"id": "completed", "label": "Completed", "type": "terminal"},
        ],
        "transitions": [
            {"from_state": "triage", "to_state": "in_flight", "required_roles": ["member", "lead", "admin"]},
            {"from_state": "in_flight", "to_state": "completed", "required_roles": ["member", "lead", "admin"]},
        ],
    }
    wf_response = await async_client.post(
        "/api/v1/workflows",
        json=custom_workflow_payload,
        headers=admin_auth_headers,
    )
    assert wf_response.status_code == 201
    custom_wf = wf_response.json()
    custom_wf_id = custom_wf["id"]

    item_payload = {
        "title": "Incident with custom workflow specification",
        "description": "Operational task utilizing the designated custom workflow override.",
        "team_id": target_team["id"],
        "priority": "high",
        "category": "incident",
        "workflow_id": custom_wf_id,
    }
    create_item_response = await async_client.post(
        "/api/v1/items",
        json=item_payload,
        headers=engineer_auth_headers,
    )
    assert create_item_response.status_code == 201
    created_item = create_item_response.json()
    assert created_item["workflow_id"] == custom_wf_id
    assert created_item["status"] == "triage"
