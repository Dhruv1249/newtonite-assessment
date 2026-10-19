"""Integration tests validating resource-level authorization boundaries and role permissions."""

import pytest
from httpx import AsyncClient

from app.models import Team


@pytest.mark.asyncio
async def test_resource_level_team_isolation(
    async_client: AsyncClient,
    admin_auth_headers: dict[str, str],
    engineer_auth_headers: dict[str, str],
    compliance_team: Team,
) -> None:
    """Verify that a user cannot query or view work items belonging to teams they are not a member of."""
    compliance_item_res = await async_client.post(
        "/api/v1/items",
        headers=admin_auth_headers,
        json={
            "title": "Confidential SOX audit trace review",
            "description": "Restricted compliance item intended exclusively for security auditors.",
            "team_id": str(compliance_team.id),
            "priority": "high",
            "category": "compliance",
        },
    )
    assert compliance_item_res.status_code == 201
    compliance_item_id = compliance_item_res.json()["id"]

    unauthorized_fetch = await async_client.get(
        f"/api/v1/items/{compliance_item_id}",
        headers=engineer_auth_headers,
    )
    assert unauthorized_fetch.status_code == 404

    engineer_list = await async_client.get(
        "/api/v1/items",
        headers=engineer_auth_headers,
    )
    assert engineer_list.status_code == 200
    listed_item_ids = [item["id"] for item in engineer_list.json()["items"]]
    assert compliance_item_id not in listed_item_ids


@pytest.mark.asyncio
async def test_viewer_role_write_restrictions(
    async_client: AsyncClient,
    auditor_auth_headers: dict[str, str],
    lead_auth_headers: dict[str, str],
    platform_team: Team,
) -> None:
    """Verify that users holding the Viewer role are restricted to read-only interactions."""
    create_attempt = await async_client.post(
        "/api/v1/items",
        headers=auditor_auth_headers,
        json={
            "title": "Auditor rogue modification attempt",
            "description": "Attempting to create item with read-only viewer privileges.",
            "team_id": str(platform_team.id),
            "priority": "low",
            "category": "operational",
        },
    )
    assert create_attempt.status_code == 403
    assert "Viewers cannot create work items" in create_attempt.json()["detail"]

    valid_item_res = await async_client.post(
        "/api/v1/items",
        headers=lead_auth_headers,
        json={
            "title": "Platform item for auditor read test",
            "description": "Testing that viewers can inspect but cannot mutate.",
            "team_id": str(platform_team.id),
            "priority": "low",
            "category": "operational",
        },
    )
    valid_item_id = valid_item_res.json()["id"]
    valid_version = valid_item_res.json()["version"]

    viewer_read = await async_client.get(
        f"/api/v1/items/{valid_item_id}",
        headers=auditor_auth_headers,
    )
    assert viewer_read.status_code == 200

    viewer_update_attempt = await async_client.put(
        f"/api/v1/items/{valid_item_id}",
        headers=auditor_auth_headers,
        json={
            "title": "Unauthorized title alteration by viewer",
            "expected_version": valid_version,
        },
    )
    assert viewer_update_attempt.status_code == 403
    assert "Viewers cannot modify work items" in viewer_update_attempt.json()["detail"]
