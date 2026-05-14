"""High-level orchestrator — read config, ask the LLM, patch, stream events.

Each call to :meth:`SelfEvolveService.execute` yields a short sequence of
ndjson events the frontend renders as a timeline:

* ``{"type": "step", "name": "read_config", ...}``
* ``{"type": "step", "name": "call_llm", ...}``
* ``{"type": "proposal", "summary": "...", "changes": [...]}``
* ``{"type": "step", "name": "apply", ...}``
* ``{"type": "applied", "changes": [...]}``
* ``{"type": "done", ...}``  or  ``{"type": "error", ...}``

The generator never raises — failures become structured ``error`` events so
the SSE/ndjson stream stays clean for the client.
"""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from app.self_evolve.llm import SelfEvolveLlm
from app.self_evolve.patcher import ConfigPatcher, PatchError
from app.self_evolve.schemas import Availability

logger = logging.getLogger("app.self_evolve")


class SelfEvolveService:
    """Glue between the LLM, the patcher, and the target directory."""

    CONFIG_FILENAME = "config.toml"

    def __init__(self, target_dir: str, llm: SelfEvolveLlm) -> None:
        self._target_dir = (target_dir or "").strip()
        self._llm = llm

    @property
    def config_path(self) -> Path | None:
        """``<target_dir>/config.toml`` — i.e. the file we read and patch."""
        if not self._target_dir:
            return None
        return Path(self._target_dir) / self.CONFIG_FILENAME

    def availability(self) -> Availability:
        path = self.config_path
        if path is None:
            return Availability(
                available=False,
                reason="SELF_EVOLVE_TARGET_DIR is not set (see .env)",
                config_path=None,
            )
        if not path.is_file():
            return Availability(
                available=False,
                reason=f"config.toml not found at {path}",
                config_path=str(path),
            )
        return Availability(available=True, reason=None, config_path=str(path))

    async def execute(self, user_request: str) -> AsyncIterator[dict[str, Any]]:
        """Async generator of structured events. Never raises."""
        start = time.monotonic()

        avail = self.availability()
        if not avail.available:
            yield {"type": "error", "error": avail.reason or "unavailable"}
            return

        path = self.config_path
        assert path is not None
        patcher = ConfigPatcher(path)

        # 1. Read config
        try:
            current = patcher.read_text()
        except PatchError as e:
            yield {"type": "error", "error": str(e)}
            return
        yield {
            "type": "step",
            "name": "read_config",
            "ok": True,
            "path": str(path),
            "size": len(current),
        }

        # 2. Ask the LLM
        try:
            proposal = await self._llm.propose(current, user_request)
        except Exception as e:  # noqa: BLE001
            logger.exception("self-evolve LLM call failed")
            yield {"type": "error", "error": f"LLM call failed: {e}"}
            return
        yield {
            "type": "step",
            "name": "call_llm",
            "ok": True,
            "summary": proposal.summary,
            "count": len(proposal.changes),
        }
        yield {
            "type": "proposal",
            "summary": proposal.summary,
            "changes": [c.model_dump() for c in proposal.changes],
        }

        if not proposal.changes:
            yield {
                "type": "done",
                "applied": [],
                "duration_ms": int((time.monotonic() - start) * 1000),
                "note": "no changes proposed",
            }
            return

        # 3. Apply
        try:
            applied = patcher.apply(proposal.changes)
        except PatchError as e:
            yield {"type": "error", "error": str(e)}
            return
        yield {"type": "step", "name": "apply", "ok": True, "count": len(applied)}
        yield {"type": "applied", "changes": [a.model_dump() for a in applied]}

        yield {
            "type": "done",
            "applied": [a.model_dump() for a in applied],
            "duration_ms": int((time.monotonic() - start) * 1000),
        }
