"""Console logging — rich-powered handler, startup banner, request access log.

Keep the logging surface tiny: one ``setup_logging`` call wires everything,
one ``print_startup_banner`` prints the one-shot panel, and the
``access_log_middleware`` produces a single pretty line per HTTP request.

Module-specific loggers (``app.llm``, ``app.access`` …) inherit from the
root logger configured here, so we don't need a separate factory.
"""

from __future__ import annotations

import logging
import sys
import time

from rich.console import Console
from rich.logging import RichHandler
from rich.panel import Panel
from rich.text import Text

from app.config import Settings


def _reconfigure_streams() -> None:
    """Make stdio UTF-8 + line-buffered so log lines flush immediately, even
    when stdout/stderr are pipes (e.g. uvicorn's reload subprocess)."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", line_buffering=True)
            except (ValueError, AttributeError, OSError):
                pass


_reconfigure_streams()

# Rich writes to stderr (same stream uvicorn uses), so its logs land next to
# uvicorn's lifecycle messages. ``legacy_windows=False`` avoids the Win32
# console API; ``force_terminal=True`` keeps ANSI colors even when stderr is
# a pipe.
_console = Console(
    highlight=False,
    legacy_windows=False,
    force_terminal=True,
    file=sys.stderr,
)

# Loggers used elsewhere in the app
log = logging.getLogger("app")
access_log = logging.getLogger("app.access")


# ─── Setup ────────────────────────────────────────────────────────────────────


class _FlushingRichHandler(RichHandler):
    """``RichHandler`` that flushes after every record. Without this, log
    lines emitted between requests can sit in stdio buffers indefinitely
    when output is piped through subprocesses (e.g. uvicorn's reload worker
    on Windows)."""

    def emit(self, record: logging.LogRecord) -> None:
        super().emit(record)
        try:
            self.console.file.flush()
        except Exception:  # noqa: BLE001 — best-effort
            pass


def setup_logging(level: str = "info") -> None:
    """Install a Rich handler as the only handler on the root logger.

    Idempotent: safe to call from both ``__main__`` (parent process) and
    ``create_app`` (uvicorn worker on reload).
    """
    _reconfigure_streams()

    handler = _FlushingRichHandler(
        console=_console,
        show_path=False,
        show_time=True,
        omit_repeated_times=False,
        markup=True,
        rich_tracebacks=True,
        tracebacks_show_locals=False,
        log_time_format="[%H:%M:%S]",
    )
    handler.setFormatter(logging.Formatter("%(message)s"))

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # Route uvicorn's own loggers through our handler. We disable
    # ``uvicorn.access`` entirely — our middleware replaces it.
    for name in ("uvicorn", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True

    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.handlers = []
    uvicorn_access.propagate = False  # silenced; we emit our own


# ─── Startup banner ───────────────────────────────────────────────────────────


def print_startup_banner(settings: Settings) -> None:
    """One-shot panel printed before uvicorn takes traffic."""
    base = f"http://{settings.server.host}:{settings.server.port}"

    body = Text()
    body.append("Ready\n\n", style="bold green")

    rows: list[tuple[str, Text]] = [
        ("URL", Text(base, style="bold")),
        ("Docs", Text(f"{base}/docs", style="bold")),
        (
            "Model",
            Text.assemble(
                (settings.llm.model, "bold magenta"),
                (
                    f"   temp={settings.llm.temperature}  max_tokens={settings.llm.max_tokens}",
                    "dim",
                ),
            ),
        ),
        (
            "CORS",
            Text(", ".join(settings.cors.allow_origins) or "—", style="bold"),
        ),
    ]
    for label, value in rows:
        body.append(f"  {label:<7}", style="dim cyan")
        body.append_text(value)
        body.append("\n")

    panel = Panel(
        body,
        title="[bold magenta]Recursive AI-Driven SD — Backend[/bold magenta]",
        border_style="magenta",
        padding=(1, 2),
    )
    _console.print(panel)


# ─── Request access log middleware ────────────────────────────────────────────


def _format_duration(seconds: float) -> str:
    ms = seconds * 1000
    if ms < 1:
        return f"{ms:.2f}ms"
    if ms < 1000:
        return f"{ms:.1f}ms"
    return f"{seconds:.2f}s"


def _status_style(status: int) -> str:
    if status < 300:
        return "green"
    if status < 400:
        return "cyan"
    if status < 500:
        return "yellow"
    return "red"


class AccessLogMiddleware:
    """Plain ASGI middleware — one ``[INFO]`` line per HTTP request, with
    method / path / status / duration. Avoids ``BaseHTTPMiddleware``'s known
    quirks around streaming responses and exception propagation."""

    def __init__(self, app):  # noqa: ANN001 — ASGI app
        self.app = app

    async def __call__(self, scope, receive, send):  # noqa: ANN001, ANN201
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        status_holder: list[int] = [500]

        async def send_wrapper(message):  # noqa: ANN001, ANN202
            if message["type"] == "http.response.start":
                status_holder[0] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            duration = time.perf_counter() - start
            access_log.exception(
                "[bold red]%-4s[/bold red] %-22s  [bold red]EXC[/bold red]  %s",
                scope.get("method", "?"),
                scope.get("path", "?"),
                _format_duration(duration),
            )
            raise

        duration = time.perf_counter() - start
        status = status_holder[0]
        color = _status_style(status)
        access_log.info(
            "[bold cyan]%-4s[/bold cyan] %-22s -> [bold %s]%d[/bold %s]  %s",
            scope.get("method", "?"),
            scope.get("path", "?"),
            color,
            status,
            color,
            _format_duration(duration),
        )
