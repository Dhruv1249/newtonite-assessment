"""Server-Sent Events broadcaster service.

Maintains in-memory subscriber channels to push real-time invalidation notifications
to active client connections.
"""

import asyncio
import json
from typing import Any
from fastapi.responses import StreamingResponse


class EventBroadcaster:
    """Pub-sub broadcast manager for Server-Sent Events."""

    def __init__(self) -> None:
        """Initialize broadcaster with an empty subscriber queue registry."""
        self._subscribers: set[asyncio.Queue[str]] = set()

    def subscribe(self) -> asyncio.Queue[str]:
        """Register a new SSE client subscriber queue.

        Returns:
            asyncio.Queue[str]: Active queue receiving formatted SSE messages.
        """
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[str]) -> None:
        """Remove a disconnected subscriber queue.

        Args:
            queue: The subscriber queue to disconnect.
        """
        self._subscribers.discard(queue)

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        """Broadcast an event payload to all active subscribers.

        Args:
            event_type: Name of the event (e.g. item_updated, item_created).
            data: Structured event payload dictionary.
        """
        message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        dead_subscribers: list[asyncio.Queue[str]] = []
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                dead_subscribers.append(queue)
        for dead_queue in dead_subscribers:
            self.unsubscribe(dead_queue)


event_broadcaster = EventBroadcaster()
