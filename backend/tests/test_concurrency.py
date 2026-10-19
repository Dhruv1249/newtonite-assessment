"""Integration tests validating optimistic concurrency control and conflict prevention."""

import pytest
from httpx import AsyncClient

from app.models import Team


@pytest.mark.asyncio
async def test_optimistic_concurrency_conflict_detected(
    async_client: AsyncClient,
    lead_auth_headers: dict[str, str],
    platform_team: Team,
) -> None:
    """Verify that updating a work item with an outdated version counter returns HTTP 409 Conflict."""
    create_response = await async_client.post(
        "/api/v1/items",
        headers=lead_auth_headers,
        json={
            "title": "Concurrency test: database buffer pool starvation",
            "description": "Investigating high I/O wait times under synthetic concurrency loads.",
            "team_id": str(platform_team.id),
            "priority": "high",
            "category": "engineering",
        },
    )
    assert create_response.status_code == 201
    item_data = create_response.json()
    item_id = item_data["id"]
    initial_version = item_data["version"]
    assert initial_version == 1

    first_update_response = await async_client.put(
        f"/api/v1/items/{item_id}",
        headers=lead_auth_headers,
        json={
            "title": "Concurrency test: database buffer pool starvation [Updated]",
            "expected_version": initial_version,
        },
    )
    assert first_update_response.status_code == 200
    updated_data = first_update_response.json()
    assert updated_data["version"] == 2

    stale_update_response = await async_client.put(
        f"/api/v1/items/{item_id}",
        headers=lead_auth_headers,
        json={
            "title": "Stale update attempting to overwrite version 2 with version 1",
            "expected_version": initial_version,
        },
    )
    assert stale_update_response.status_code == 409
    error_detail = stale_update_response.json()["detail"]
    assert "Conflict detected" in error_detail


@pytest.mark.asyncio
async def test_concurrent_state_transition_conflict(
    async_client: AsyncClient,
    lead_auth_headers: dict[str, str],
    platform_team: Team,
) -> None:
    """Verify that attempting to transition a work item from a stale version returns HTTP 409 Conflict."""
    create_response = await async_client.post(
        "/api/v1/items",
        headers=lead_auth_headers,
        json={
            "title": "State transition race condition test",
            "description": "Testing multiple actors transitioning state simultaneously.",
            "team_id": str(platform_team.id),
            "priority": "medium",
            "category": "operational",
        },
    )
    assert create_response.status_code == 201
    item_data = create_response.json()
    item_id = item_data["id"]
    version = item_data["version"]

    first_transition = await async_client.post(
        f"/api/v1/items/{item_id}/transition",
        headers=lead_auth_headers,
        json={
            "target_status": "in_progress",
            "expected_version": version,
        },
    )
    assert first_transition.status_code == 200
    assert first_transition.json()["status"] == "in_progress"
    assert first_transition.json()["version"] == 2

    competing_transition = await async_client.post(
        f"/api/v1/items/{item_id}/transition",
        headers=lead_auth_headers,
        json={
            "target_status": "cancelled",
            "expected_version": version,
        },
    )
    assert competing_transition.status_code == 409
    assert "Conflict detected" in competing_transition.json()["detail"]
