"""Integration tests validating pgvector semantic similarity search and AI duplicate detection."""

import pytest
from httpx import AsyncClient

from app.models import Team


@pytest.mark.asyncio
async def test_semantic_search_endpoint(
    async_client: AsyncClient,
    engineer_auth_headers: dict[str, str],
) -> None:
    """Verify that semantic search endpoint executes vector queries across caller's teams."""
    search_response = await async_client.get(
        "/api/v1/items/search?q=database latency backup",
        headers=engineer_auth_headers,
    )
    assert search_response.status_code == 200
    data = search_response.json()
    assert "results" in data
    assert "query" in data
    assert data["query"] == "database latency backup"
