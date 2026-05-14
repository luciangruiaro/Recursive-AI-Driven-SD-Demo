"""Tests for ``/api/chat`` — happy path, validation, and failure modes.

The real OpenAI client is replaced by :class:`FakeLlmClient` via fixtures, so
these tests never touch the network and have no API-key dependency.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import FakeLlmClient


def test_chat_returns_llm_response(client: TestClient, fake_llm: FakeLlmClient) -> None:
    fake_llm.response = "## Recursion\n\nA function that calls itself."

    response = client.post("/api/chat", json={"message": "Explain recursion"})

    assert response.status_code == 200
    body = response.json()
    assert body["content"] == fake_llm.response
    assert body["model"] == "gpt-4o-mini"

    # Verify the LLM was actually called with the user's prompt
    assert fake_llm.calls == ["Explain recursion"]


def test_chat_rejects_empty_message(client: TestClient, fake_llm: FakeLlmClient) -> None:
    response = client.post("/api/chat", json={"message": ""})

    # pydantic min_length=1 validation
    assert response.status_code == 422
    assert fake_llm.calls == []


def test_chat_rejects_missing_field(client: TestClient) -> None:
    response = client.post("/api/chat", json={})
    assert response.status_code == 422


def test_chat_returns_503_when_api_key_missing(
    client: TestClient,
    fake_llm: FakeLlmClient,
) -> None:
    fake_llm.error = RuntimeError("OPENAI_API_KEY is not set")

    response = client.post("/api/chat", json={"message": "hi"})

    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_chat_returns_502_on_upstream_failure(
    client: TestClient,
    fake_llm: FakeLlmClient,
) -> None:
    fake_llm.error = ValueError("rate limited")

    response = client.post("/api/chat", json={"message": "hi"})

    assert response.status_code == 502
    assert "rate limited" in response.json()["detail"]


def test_chat_rejects_oversized_message(client: TestClient) -> None:
    response = client.post("/api/chat", json={"message": "x" * 8001})
    assert response.status_code == 422
