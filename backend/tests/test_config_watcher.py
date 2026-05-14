"""Unit tests for :class:`app.config_watcher.ConfigBus`.

The file-watching coroutine itself is exercised manually — wiring
``watchfiles.awatch`` into a unit test requires a real event loop and
filesystem events, which adds flakiness for little extra coverage. The bus,
which is the bit our SSE endpoint depends on, is fully covered here.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.config_watcher import ConfigBus


# ─── Bus ─────────────────────────────────────────────────────────────────────


def test_publish_to_no_subscribers_is_a_noop() -> None:
    bus = ConfigBus()
    bus.publish(get_settings().ui)  # must not raise
    assert bus.subscriber_count == 0


def test_subscribe_unsubscribe_updates_subscriber_count() -> None:
    bus = ConfigBus()

    q1 = bus.subscribe()
    q2 = bus.subscribe()
    assert bus.subscriber_count == 2

    bus.unsubscribe(q1)
    assert bus.subscriber_count == 1

    bus.unsubscribe(q2)
    assert bus.subscriber_count == 0


def test_publish_broadcasts_to_all_subscribers() -> None:
    bus = ConfigBus()
    q1 = bus.subscribe()
    q2 = bus.subscribe()

    ui = get_settings().ui
    bus.publish(ui)

    assert q1.get_nowait() is ui
    assert q2.get_nowait() is ui


def test_publish_drops_when_subscriber_queue_is_full() -> None:
    """Slow consumers should not block the publisher — newest update is dropped."""
    bus = ConfigBus(maxsize=2)
    q = bus.subscribe()

    ui = get_settings().ui
    bus.publish(ui)
    bus.publish(ui)
    bus.publish(ui)  # would block forever if it didn't drop — fast assertion

    assert q.qsize() == 2


def test_unsubscribed_queue_does_not_receive_further_updates() -> None:
    bus = ConfigBus()
    q = bus.subscribe()
    bus.unsubscribe(q)

    bus.publish(get_settings().ui)

    with pytest.raises(asyncio.QueueEmpty):
        q.get_nowait()


# ─── /api/config/stream registration ─────────────────────────────────────────


def test_config_stream_route_is_registered(client: TestClient) -> None:
    """The SSE route should be wired up. We don't read its body — the response
    is intentionally open-ended (a never-ending stream) and consuming it via
    TestClient would block the test."""
    routes = {r.path for r in client.app.router.routes if hasattr(r, "path")}
    assert "/api/config/stream" in routes
