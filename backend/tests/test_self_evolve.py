"""Tests for the self-evolve package and its HTTP surface.

We don't call OpenAI in tests. The LLM is replaced by a tiny fake that returns
a pre-canned :class:`ChangeProposal`, and tests drive the rest of the
pipeline against a temporary TOML file.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from textwrap import dedent
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.self_evolve import (
    ChangeProposal,
    ConfigChange,
    ConfigPatcher,
    PatchError,
    SelfEvolveService,
)
from app.self_evolve.schemas import Availability


# ─── Helpers ──────────────────────────────────────────────────────────────────


SAMPLE_TOML = dedent("""\
    # ─── Server ───────────────────────────────────────────────────────────────
    [server]
    host = "127.0.0.1"
    port = 8729

    [ui.theme.colors]
    # The most important color in the whole demo:
    background = "#0a0a0f"
    primary    = "#8b5cf6"
""")


class FakeProposeLlm:
    """LLM stand-in — returns a pre-built proposal on ``propose(...)``."""

    def __init__(self, proposal: ChangeProposal | None = None, error: Exception | None = None):
        self.proposal = proposal or ChangeProposal(summary="(none)", changes=[])
        self.error = error
        self.calls: list[tuple[str, str]] = []

    async def propose(self, current_toml: str, user_request: str) -> ChangeProposal:
        self.calls.append((current_toml, user_request))
        if self.error is not None:
            raise self.error
        return self.proposal


@pytest.fixture
def toml_path(tmp_path: Path) -> Path:
    path = tmp_path / "config.toml"
    path.write_text(SAMPLE_TOML, encoding="utf-8")
    return path


def _run(coro):
    return asyncio.run(coro)


# ─── ConfigPatcher ────────────────────────────────────────────────────────────


def test_patcher_applies_a_simple_change(toml_path: Path) -> None:
    patcher = ConfigPatcher(toml_path)

    applied = patcher.apply([
        ConfigChange(path="ui.theme.colors.background", value="#ff0000"),
    ])

    assert len(applied) == 1
    assert applied[0].path == "ui.theme.colors.background"
    assert applied[0].old_value == "#0a0a0f"
    assert applied[0].new_value == "#ff0000"

    new_text = toml_path.read_text(encoding="utf-8")
    assert 'background = "#ff0000"' in new_text


def test_patcher_preserves_comments_and_layout(toml_path: Path) -> None:
    patcher = ConfigPatcher(toml_path)
    patcher.apply([ConfigChange(path="ui.theme.colors.primary", value="#10b981")])

    new_text = toml_path.read_text(encoding="utf-8")
    # Original divider comment survives.
    assert "─── Server ───" in new_text
    # The neighboring comment on `background` is still there.
    assert "# The most important color in the whole demo:" in new_text


def test_patcher_applies_multiple_changes(toml_path: Path) -> None:
    patcher = ConfigPatcher(toml_path)

    applied = patcher.apply([
        ConfigChange(path="ui.theme.colors.background", value="#000000"),
        ConfigChange(path="server.port", value=9000),
    ])

    assert len(applied) == 2
    new_text = toml_path.read_text(encoding="utf-8")
    assert 'background = "#000000"' in new_text
    assert "port = 9000" in new_text


def test_patcher_rejects_unknown_path(toml_path: Path) -> None:
    patcher = ConfigPatcher(toml_path)

    with pytest.raises(PatchError, match="path not found"):
        patcher.apply([ConfigChange(path="ui.theme.colors.nope", value="#ff0000")])


def test_patcher_errors_when_file_missing(tmp_path: Path) -> None:
    patcher = ConfigPatcher(tmp_path / "missing.toml")
    with pytest.raises(PatchError, match="not found"):
        patcher.read_text()


# ─── SelfEvolveService ────────────────────────────────────────────────────────


def test_service_availability_when_target_dir_unset() -> None:
    svc = SelfEvolveService(target_dir="", llm=FakeProposeLlm())  # type: ignore[arg-type]
    result = svc.availability()
    assert result == Availability(
        available=False,
        reason="SELF_EVOLVE_TARGET_DIR is not set (see .env)",
        config_path=None,
    )


def test_service_availability_when_config_missing(tmp_path: Path) -> None:
    svc = SelfEvolveService(target_dir=str(tmp_path), llm=FakeProposeLlm())  # type: ignore[arg-type]
    result = svc.availability()
    assert result.available is False
    assert result.reason is not None
    assert "not found" in result.reason.lower()


def test_service_availability_when_all_good(toml_path: Path) -> None:
    svc = SelfEvolveService(target_dir=str(toml_path.parent), llm=FakeProposeLlm())  # type: ignore[arg-type]
    result = svc.availability()
    assert result.available is True
    assert result.config_path == str(toml_path)


def test_service_execute_happy_path(toml_path: Path) -> None:
    fake = FakeProposeLlm(
        proposal=ChangeProposal(
            summary="switch background to red",
            changes=[ConfigChange(path="ui.theme.colors.background", value="#ff0000")],
        ),
    )
    svc = SelfEvolveService(target_dir=str(toml_path.parent), llm=fake)  # type: ignore[arg-type]

    async def collect() -> list[dict]:
        return [e async for e in svc.execute("make it red")]

    events = _run(collect())
    types = [e["type"] for e in events]

    assert types == ["step", "step", "proposal", "step", "applied", "done"]

    # The patch landed on disk
    assert 'background = "#ff0000"' in toml_path.read_text(encoding="utf-8")

    # The LLM saw the original config + the request
    assert len(fake.calls) == 1
    sent_toml, sent_request = fake.calls[0]
    assert "background" in sent_toml
    assert sent_request == "make it red"


def test_service_execute_no_changes_proposed(toml_path: Path) -> None:
    fake = FakeProposeLlm(
        proposal=ChangeProposal(summary="nothing to do", changes=[]),
    )
    svc = SelfEvolveService(target_dir=str(toml_path.parent), llm=fake)  # type: ignore[arg-type]

    async def collect() -> list[dict]:
        return [e async for e in svc.execute("...")]

    events = _run(collect())
    types = [e["type"] for e in events]

    # Should stop after the empty proposal — never reach apply/applied.
    assert types == ["step", "step", "proposal", "done"]
    assert events[-1]["applied"] == []


def test_service_execute_yields_error_when_unavailable() -> None:
    svc = SelfEvolveService(target_dir="", llm=FakeProposeLlm())  # type: ignore[arg-type]

    async def collect() -> list[dict]:
        return [e async for e in svc.execute("...")]

    events = _run(collect())
    assert len(events) == 1
    assert events[0]["type"] == "error"


def test_service_execute_handles_llm_failure(toml_path: Path) -> None:
    fake = FakeProposeLlm(error=RuntimeError("api down"))
    svc = SelfEvolveService(target_dir=str(toml_path.parent), llm=fake)  # type: ignore[arg-type]

    async def collect() -> list[dict]:
        return [e async for e in svc.execute("...")]

    events = _run(collect())
    types = [e["type"] for e in events]

    # We make it past read_config, then the LLM call fails -> error event.
    assert "error" in types
    assert any("api down" in str(e.get("error", "")) for e in events)


# ─── HTTP routes ──────────────────────────────────────────────────────────────


def test_health_route_returns_structured_payload(client: TestClient) -> None:
    response = client.get("/api/self-evolve/health")
    assert response.status_code == 200

    body = response.json()
    assert {"available", "reason", "config_path"} <= body.keys()
    assert isinstance(body["available"], bool)


def test_execute_route_returns_503_when_unavailable(client: TestClient) -> None:
    # Force unavailability via the live service held on app.state.
    svc: SelfEvolveService = client.app.state.self_evolve_service
    with patch.object(
        svc,
        "availability",
        return_value=Availability(
            available=False,
            reason="SELF_EVOLVE_TARGET_DIR is not set (see .env)",
        ),
    ):
        response = client.post("/api/self-evolve/execute", json={"prompt": "hi"})

    assert response.status_code == 503
    assert "set" in response.json()["detail"].lower()


def test_execute_route_validates_empty_prompt(client: TestClient) -> None:
    response = client.post("/api/self-evolve/execute", json={"prompt": ""})
    assert response.status_code == 422


def test_execute_route_streams_ndjson(client: TestClient, toml_path: Path) -> None:
    """End-to-end via the route: swap in a fake LLM that proposes one change,
    point the service at a temp config.toml, hit /execute, and parse the
    streamed ndjson back."""
    svc: SelfEvolveService = client.app.state.self_evolve_service
    fake = FakeProposeLlm(
        proposal=ChangeProposal(
            summary="green primary",
            changes=[ConfigChange(path="ui.theme.colors.primary", value="#10b981")],
        ),
    )
    with patch.object(svc, "_llm", fake), patch.object(svc, "_target_dir", str(toml_path.parent)):
        response = client.post(
            "/api/self-evolve/execute",
            json={"prompt": "make primary green"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")

    events = [json.loads(line) for line in response.text.splitlines() if line.strip()]
    types = [e["type"] for e in events]
    assert types == ["step", "step", "proposal", "step", "applied", "done"]
    assert 'primary    = "#10b981"' in toml_path.read_text(encoding="utf-8") \
        or 'primary = "#10b981"' in toml_path.read_text(encoding="utf-8")
