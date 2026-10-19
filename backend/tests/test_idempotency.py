"""Integration tests validating idempotency key deduplication semantics."""

import uuid
import pytest
from httpx import AsyncClient

from app.models import Team


@pytest.mark.asyncio
async def test_idempotent_work_item_creation(
    async_client: AsyncClient,
    lead_auth_headers: dict[str, str],
    platform_team: Team,
) -> None:
    """Verify that repeating a creation request with the same Idempotency-Key returns the cached response."""
    idempotency_token = f"idem-key-{uuid.uuid4()}"
    request_headers = {
        **lead_auth_headers,
        "Idempotency-Key": idempotency_token,
    }
    payload = {
        "title": "Idempotent payment reconciliation job",
        "description": "Triggering one-off batch reconciliation for settled chargebacks.",
        "team_id": str(platform_team.id),
        "priority": "low",
        "category": "operational",
    }

    first_response = await async_client.post(
        "/api/v1/items",
        headers=request_headers,
        json=payload,
    )
    assert first_response.status_code == 201
    first_data = first_response.json()
    created_id = first_data["id"]

    second_response = await async_client.post(
        "/api/v1/items",
        headers=request_headers,
        json=payload,
    )
    assert second_response.status_code == 201
    second_data = second_response.json()

    assert second_data["id"] == created_id
    assert second_data["title"] == first_data["title"]
    assert second_data["version"] == first_data["version"]
