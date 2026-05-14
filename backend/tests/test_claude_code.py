"""Tests for the Claude Code CLI bridge — client availability + route surface.

We don't spawn a real ``claude`` subprocess here. The unit tests stub
``shutil.which`` and the target directory to exercise every branch of the
availability matrix, then verify the route translates the result correctly.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.claude_code import Availability, ClaudeCodeClient, ClaudeCodeError
from app.config import ClaudeCodeConfig


def _client(target_dir: str = "", **overrides: object) -> ClaudeCodeClient:
    config = ClaudeCodeConfig(**overrides)  # type: ignore[arg-type]
    return ClaudeCodeClient(target_dir=target_dir, config=config)


# ─── Unit: availability matrix ────────────────────────────────────────────────


def test_availability_when_binary_missing(tmp_path: Path) -> None:
    with patch("app.claude_code.shutil.which", return_value=None):
        result = _client(str(tmp_path)).availability()

    assert result.available is False
    assert result.binary_path is None
    assert result.reason is not None
    assert "not found" in result.reason.lower()


def test_availability_when_target_dir_unset() -> None:
    fake_binary = str(Path("C:/fake/claude.exe"))  # OS-normalized
    with patch("app.claude_code.shutil.which", return_value=fake_binary):
        result = _client("").availability()

    assert result.available is False
    assert result.binary_path == fake_binary
    assert result.target_dir is None
    assert result.reason is not None
    assert "target_dir" in result.reason.lower() or "not set" in result.reason.lower()


def test_availability_when_target_dir_missing(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"
    with patch("app.claude_code.shutil.which", return_value="C:/fake/claude.exe"):
        result = _client(str(missing)).availability()

    assert result.available is False
    assert result.target_dir == str(missing)
    assert result.reason is not None
    assert "does not exist" in result.reason.lower()


def test_availability_when_all_good(tmp_path: Path) -> None:
    fake_binary = str(Path("C:/fake/claude.exe"))
    with patch("app.claude_code.shutil.which", return_value=fake_binary):
        result = _client(str(tmp_path)).availability()

    assert result == Availability(
        available=True,
        reason=None,
        binary_path=fake_binary,
        target_dir=str(tmp_path),
    )


def test_binary_path_is_cached(tmp_path: Path) -> None:
    """``shutil.which`` should only be called once per client instance."""
    with patch("app.claude_code.shutil.which", return_value="C:/fake/claude.exe") as which:
        c = _client(str(tmp_path))
        c.availability()
        c.availability()
        c.availability()

    assert which.call_count == 1


# ─── Unit: execute() raises when unavailable ──────────────────────────────────


def test_execute_raises_when_unavailable(tmp_path: Path) -> None:
    """We don't pull in pytest-asyncio; ``asyncio.run`` is enough for one test."""
    import asyncio

    async def runner() -> None:
        with patch("app.claude_code.shutil.which", return_value=None):
            c = _client(str(tmp_path))
            with pytest.raises(ClaudeCodeError, match="not found"):
                async for _ in c.execute("hello"):
                    pass

    asyncio.run(runner())


# ─── Integration: HTTP routes ─────────────────────────────────────────────────


def test_health_route_returns_structured_payload(client: TestClient) -> None:
    response = client.get("/api/claude-code/health")
    assert response.status_code == 200

    body = response.json()
    assert {"available", "reason", "binary_path", "target_dir"} <= body.keys()
    assert isinstance(body["available"], bool)


def test_execute_route_returns_503_when_unavailable(client: TestClient) -> None:
    with patch("app.claude_code.shutil.which", return_value=None):
        response = client.post(
            "/api/claude-code/execute",
            json={"prompt": "hello"},
        )

    assert response.status_code == 503
    assert "claude" in response.json()["detail"].lower()


def test_execute_route_validates_empty_prompt(client: TestClient) -> None:
    response = client.post("/api/claude-code/execute", json={"prompt": ""})
    assert response.status_code == 422


def test_execute_route_validates_max_turns_bounds(client: TestClient) -> None:
    response = client.post(
        "/api/claude-code/execute",
        json={"prompt": "hi", "max_turns": 999},  # > 200 limit
    )
    assert response.status_code == 422
