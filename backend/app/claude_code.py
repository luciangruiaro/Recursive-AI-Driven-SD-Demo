"""Claude Code CLI bridge.

Wraps the locally-installed ``claude`` CLI as an async, streaming client. The
backend talks to Claude Code as a subprocess in the configured ``target_dir``
and streams ``--output-format stream-json`` lines back to the caller.

Design notes:

* **Lazy detection.** :meth:`ClaudeCodeClient.availability` does a one-time
  ``shutil.which("claude")`` lookup. If the CLI is missing or the target dir
  doesn't exist, callers see a structured result — the server keeps running
  and the route surface returns 503 gracefully.
* **No nested-session lockout.** We strip the ``CLAUDECODE`` env var before
  spawning, so the subprocess doesn't refuse to start when this backend is
  itself running under a parent ``claude`` session.
* **Two-level timeouts.** Idle timeout (silence between stdout writes) and
  total timeout, both configurable per call.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import shutil
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

from app.config import ClaudeCodeConfig

logger = logging.getLogger("app.claude_code")


@dataclass(frozen=True)
class Availability:
    """Structured result of :meth:`ClaudeCodeClient.availability`."""

    available: bool
    reason: str | None
    binary_path: str | None
    target_dir: str | None


class ClaudeCodeError(RuntimeError):
    """Raised when the CLI is unavailable or fails to start."""


class ClaudeCodeClient:
    """Async wrapper around the local ``claude`` CLI."""

    def __init__(self, target_dir: str, config: ClaudeCodeConfig) -> None:
        self._target_dir = (target_dir or "").strip()
        self._config = config
        self._binary: Path | None = None
        self._binary_detected = False

    # ─── Detection / availability ─────────────────────────────────────────────

    @property
    def binary_path(self) -> Path | None:
        if not self._binary_detected:
            found = shutil.which("claude")
            self._binary = Path(found) if found else None
            self._binary_detected = True
        return self._binary

    @property
    def target_dir(self) -> Path | None:
        return Path(self._target_dir) if self._target_dir else None

    def availability(self) -> Availability:
        binary = self.binary_path
        target = self.target_dir
        target_str = str(target) if target else None

        if binary is None:
            return Availability(
                available=False,
                reason="claude CLI not found on PATH",
                binary_path=None,
                target_dir=target_str,
            )
        if target is None:
            return Availability(
                available=False,
                reason="CLAUDE_CODE_TARGET_DIR is not set (see .env)",
                binary_path=str(binary),
                target_dir=None,
            )
        if not target.is_dir():
            return Availability(
                available=False,
                reason=f"target directory does not exist: {target}",
                binary_path=str(binary),
                target_dir=target_str,
            )
        return Availability(
            available=True,
            reason=None,
            binary_path=str(binary),
            target_dir=target_str,
        )

    # ─── Command assembly ─────────────────────────────────────────────────────

    def _build_command(
        self,
        binary: Path,
        prompt: str,
        *,
        allowed_tools: list[str],
        max_turns: int,
        skip_permissions: bool,
        system_prompt: str,
        session_id: str,
    ) -> list[str]:
        cmd: list[str] = [
            str(binary),
            "-p", prompt,
            "--output-format", "stream-json",
            "--verbose",
        ]
        if allowed_tools:
            cmd += ["--allowedTools", ",".join(allowed_tools)]
        if max_turns:
            cmd += ["--max-turns", str(max_turns)]
        if session_id:
            cmd += ["--resume", session_id]
        if system_prompt:
            cmd += ["--append-system-prompt", system_prompt]
        if skip_permissions:
            cmd.append("--dangerously-skip-permissions")
        return cmd

    # ─── Execution ────────────────────────────────────────────────────────────

    async def execute(  # noqa: C901, PLR0912 — stream loop is intentionally explicit
        self,
        prompt: str,
        *,
        allowed_tools: list[str] | None = None,
        max_turns: int | None = None,
        timeout_seconds: int | None = None,
        idle_timeout_seconds: int | None = None,
        skip_permissions: bool | None = None,
        system_prompt: str | None = None,
        session_id: str = "",
    ) -> AsyncIterator[str]:
        """Stream ndjson lines from the ``claude`` CLI.

        Raises :class:`ClaudeCodeError` synchronously if the CLI is unavailable
        or fails to spawn. Errors that occur mid-stream (e.g. timeouts) are
        emitted as ``{"type": "error", ...}`` ndjson lines, then the iterator
        ends cleanly.
        """
        avail = self.availability()
        if not avail.available:
            raise ClaudeCodeError(avail.reason or "claude CLI unavailable")

        binary = self.binary_path
        target = self.target_dir
        assert binary is not None and target is not None  # availability() guarantees

        # Resolve per-call overrides against config defaults.
        tools = allowed_tools if allowed_tools is not None else list(self._config.allowed_tools)
        turns = max_turns if max_turns is not None else self._config.max_turns
        total = timeout_seconds if timeout_seconds is not None else self._config.timeout_seconds
        idle = idle_timeout_seconds if idle_timeout_seconds is not None else self._config.idle_timeout_seconds
        skip = skip_permissions if skip_permissions is not None else self._config.skip_permissions
        sysp = system_prompt if system_prompt is not None else self._config.system_prompt

        cmd = self._build_command(
            binary, prompt,
            allowed_tools=tools, max_turns=turns,
            skip_permissions=skip, system_prompt=sysp,
            session_id=session_id,
        )

        # Strip CLAUDECODE so nested invocations are allowed.
        clean_env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

        logger.info(
            "[magenta]claude[/magenta] [dim]>>[/dim] cwd=%s  max_turns=%d  timeout=%ds",
            str(target), turns, total,
        )

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(target),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.DEVNULL,
                env=clean_env,
            )
        except FileNotFoundError as e:
            raise ClaudeCodeError(f"failed to start claude CLI: {e}") from e
        except NotImplementedError as e:
            # Hit when the current asyncio loop policy doesn't support
            # subprocesses — typically Windows + WindowsSelectorEventLoopPolicy.
            raise ClaudeCodeError(
                "this asyncio event loop does not support subprocesses "
                "(on Windows, launch the server with loop=\"none\" so "
                "ProactorEventLoop is used — see app/__main__.py)",
            ) from e

        logger.info("[dim]claude pid=%d[/dim]", proc.pid)

        async def _drain_stderr() -> None:
            assert proc.stderr is not None
            while True:
                line = await proc.stderr.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").rstrip()
                if text:
                    logger.warning("[yellow]claude stderr[/yellow] %s", text)

        stderr_task = asyncio.create_task(_drain_stderr())

        start = time.monotonic()
        last_activity = start
        killed = False

        try:
            assert proc.stdout is not None
            while True:
                now = time.monotonic()
                idle_for = now - last_activity
                elapsed = now - start

                if idle_for >= idle:
                    logger.warning("claude idle timeout (%.0fs)", idle_for)
                    proc.kill()
                    killed = True
                    yield json.dumps({
                        "type": "error",
                        "error": f"Idle timeout after {int(idle_for)}s",
                    }) + "\n"
                    break

                if elapsed >= total:
                    logger.warning("claude total timeout (%.0fs)", elapsed)
                    proc.kill()
                    killed = True
                    yield json.dumps({
                        "type": "error",
                        "error": f"Total timeout after {int(elapsed)}s",
                    }) + "\n"
                    break

                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=1.0)
                except TimeoutError:
                    continue

                if not line:
                    break  # EOF

                last_activity = time.monotonic()
                text = line.decode("utf-8", errors="replace").rstrip()
                if text:
                    yield text + "\n"
        finally:
            if not killed and proc.returncode is None:
                try:
                    await asyncio.wait_for(proc.wait(), timeout=10)
                except TimeoutError:
                    proc.kill()
                    await proc.wait()

            stderr_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await stderr_task

            duration = time.monotonic() - start
            logger.info(
                "[green]claude[/green] [dim]<<[/dim] pid=%d  exit=%s  %.1fs",
                proc.pid, proc.returncode, duration,
            )
