"""Live ``config.toml`` reload.

A single :class:`ConfigBus` distributes UI config updates to every SSE
subscriber. A background task watches ``config.toml`` with ``watchfiles`` —
every change clears the ``get_settings`` cache (so the rest of the app sees
the new values) and broadcasts the fresh UI section to the bus.

Subscriber queues are bounded; slow consumers drop intermediate values rather
than block the publisher.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from watchfiles import awatch

from app.config import CONFIG_PATH, UiConfig, get_settings

logger = logging.getLogger("app.config")


class ConfigBus:
    """In-process broadcast of :class:`UiConfig` updates."""

    def __init__(self, maxsize: int = 8) -> None:
        self._subscribers: set[asyncio.Queue[UiConfig]] = set()
        self._maxsize = maxsize

    def subscribe(self) -> asyncio.Queue[UiConfig]:
        q: asyncio.Queue[UiConfig] = asyncio.Queue(maxsize=self._maxsize)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[UiConfig]) -> None:
        self._subscribers.discard(q)

    def publish(self, config: UiConfig) -> None:
        for q in list(self._subscribers):
            try:
                q.put_nowait(config)
            except asyncio.QueueFull:
                logger.warning("config subscriber full — dropping update")

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


async def watch_config(bus: ConfigBus, path: Path = CONFIG_PATH) -> None:
    """Background task — watch ``config.toml`` and broadcast UI updates.

    On every file change:
      * clear the ``get_settings`` cache;
      * reload settings;
      * if reload fails, log and keep the last good value (don't kill the task);
      * otherwise publish the new UI section to all subscribers.
    """
    logger.info(
        "[bold magenta]config[/bold magenta] watcher started  [dim]path=%s[/dim]",
        path,
    )
    try:
        async for _changes in awatch(path):
            get_settings.cache_clear()
            try:
                ui = get_settings().ui
            except Exception:
                logger.exception("failed to reload config.toml — keeping last good value")
                continue
            logger.info(
                "[bold magenta]config[/bold magenta] reloaded  [dim]subscribers=%d[/dim]",
                bus.subscriber_count,
            )
            bus.publish(ui)
    except asyncio.CancelledError:
        logger.info("config watcher stopped")
        raise
