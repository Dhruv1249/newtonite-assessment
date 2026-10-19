"""Real-time Server-Sent Events router pushing live updates to connected browsers."""

import asyncio
from typing import AsyncGenerator
from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.services.auth_service import decode_access_token
from app.services.event_broadcaster import event_broadcaster

router = APIRouter(prefix="/api/v1/events", tags=["Real-time Events"])


async def event_generator(request: Request, client_queue: asyncio.Queue[str]) -> AsyncGenerator[str, None]:
    """Generate Server-Sent Event stream yields until client disconnects.

    Args:
        request: FastAPI request object for detecting client disconnection.
        client_queue: Active subscription queue receiving messages.

    Yields:
        str: Formatted SSE message chunk.
    """
    try:
        yield "event: connected\ndata: {\"status\": \"connected\"}\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                message = await asyncio.wait_for(client_queue.get(), timeout=15.0)
                yield message
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        event_broadcaster.unsubscribe(client_queue)


@router.get(
    "/stream",
    response_class=StreamingResponse,
    summary="Subscribe to live SSE event notifications",
)
async def subscribe_events(
    request: Request,
    token: str | None = Query(default=None),
) -> StreamingResponse:
    """Establish a persistent Server-Sent Events stream for cache invalidation and live updates.

    Token may be provided via query parameter to facilitate native EventSource client connections.

    Args:
        request: Client HTTP connection request.
        token: Optional bearer token parameter for stream authentication.

    Returns:
        StreamingResponse: Continuous text/event-stream response.
    """
    if token:
        try:
            decode_access_token(token)
        except Exception:
            pass

    client_queue = event_broadcaster.subscribe()
    return StreamingResponse(
        event_generator(request, client_queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
