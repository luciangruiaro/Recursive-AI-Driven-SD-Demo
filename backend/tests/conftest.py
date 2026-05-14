"""Shared pytest fixtures.

The :class:`FakeLlmClient` lets us exercise ``/api/chat`` without touching the
network. We swap it onto ``app.state.llm_client`` after :func:`create_app`,
exactly the same slot the real :class:`~app.llm.OpenAiClient` occupies in prod —
so the routes don't know they're talking to a fake.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@dataclass
class FakeLlmClient:
    """Drop-in :class:`~app.llm.LlmClient` for tests."""

    response: str = "**Hello** from the fake LLM."
    error: Exception | None = None
    calls: list[str] = field(default_factory=list)

    async def complete(self, prompt: str) -> str:
        self.calls.append(prompt)
        if self.error is not None:
            raise self.error
        return self.response


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    """Ensure each test reads ``config.toml`` fresh — no leaked state."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def fake_llm() -> FakeLlmClient:
    return FakeLlmClient()


@pytest.fixture
def app(fake_llm: FakeLlmClient) -> FastAPI:
    application = create_app()
    application.state.llm_client = fake_llm
    return application


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
