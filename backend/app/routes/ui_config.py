"""UI configuration endpoints.

* ``GET /api/config``        — one-shot snapshot of the ``[ui]`` section.
* ``GET /api/config/stream`` — Server-Sent Events stream that pushes the UI
  config on connect and re-pushes it whenever ``config.toml`` changes.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.config import UiConfig, get_settings
from app.config_watcher import ConfigBus

router = APIRouter(prefix="/api", tags=["config"])

logger = logging.getLogger("app.config")


@router.get("/config", response_model=UiConfig)
async def get_ui_config() -> UiConfig:
    return get_settings().ui


@router.get("/config/stream")
async def stream_ui_config(request: Request) -> StreamingResponse:
    """SSE stream of UI config updates.

    Emits one event on connect (the current config) and one event per change
    to ``config.toml`` thereafter. A 15-second keepalive comment is sent
    between updates so intermediate proxies don't drop the connection.
    """
    bus: ConfigBus = request.app.state.config_bus
    queue = bus.subscribe()

    async def events() -> AsyncIterator[str]:
        try:
            # Initial snapshot.
            yield f"data: {get_settings().ui.model_dump_json()}\n\n"

            while True:
                try:
                    ui = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {ui.model_dump_json()}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive — a comment line is ignored by the client.
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            raise
        finally:
            bus.unsubscribe(queue)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable buffering in reverse proxies
        },
    )
