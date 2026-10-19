"""Integration tests validating workflow state machine transitions and role guard enforcement."""

import pytest
from httpx import AsyncClient

from app.models import Team


@pytest.mark.asyncio
async def test_workflow_transition_pathway_and_role_guards(
    async_client: AsyncClient,
    engineer_auth_headers: dict[str, str],
    lead_auth_headers: dict[str, str],
    platform_team: Team,
) -> None:
    """Validate permitted workflow progressions and verify that approval transitions are guarded by role."""
    create_response = await async_client.post(
        "/api/v1/items",
        headers=engineer_auth_headers,
        json={
            "title": "Workflow progression test item",
            "description": "Verifying role guarded approval transitions.",
            "team_id": str(platform_team.id),
            "priority": "medium",
            "category": "engineering",
        },
    )
    assert create_response.status_code == 201
    item = create_response.json()
    item_id = item["id"]
    assert item["status"] == "open"

    invalid_jump = await async_client.post(
        f"/api/v1/items/{item_id}/transition",
        headers=engineer_auth_headers,
        json={
            "target_status": "resolved",
            "expected_version": item["version"],
        },
    )
    assert invalid_jump.status_code == 400
    assert "not allowed by the workflow" in invalid_jump.json()["detail"]

    start_work = await async_client.post(
        f"/api/v1/items/{item_id}/transition",
        headers=engineer_auth_headers,
        json={
            "target_status": "in_progress",
            "expected_version": item["version"],
        },
    )
    assert start_work.status_code == 200
    v2_item = start_work.json()
    assert v2_item["status"] == "in_progress"

    submit_review = await async_client.post(
        f"/api/v1/items/{item_id}/transition",
        headers=engineer_auth_headers,
        json={
            "target_status": "in_review",
            "expected_version": v2_item["version"],
        },
    )
    assert submit_review.status_code == 200
    v3_item = submit_review.json()
    assert v3_item["status"] == "in_review"

    unauthorized_approval = await async_client.post(
        f"/api/v1/items/{item_id}/transition",
        headers=engineer_auth_headers,
        json={
            "target_status": "resolved",
            "expected_version": v3_item["version"],
        },
    )
    assert unauthorized_approval.status_code == 403
    assert "is not authorized" in unauthorized_approval.json()["detail"]

    authorized_approval = await async_client.post(
        f"/api/v1/items/{item_id}/transition",
        headers=lead_auth_headers,
        json={
            "target_status": "resolved",
            "expected_version": v3_item["version"],
        },
    )
    assert authorized_approval.status_code == 200
    v4_item = authorized_approval.json()
    assert v4_item["status"] == "resolved"
