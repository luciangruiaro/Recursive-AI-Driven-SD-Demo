"""Module entry point: ``python -m app``.

Reads server host/port from ``config.toml`` and starts uvicorn with reload.
"""

from __future__ import annotations

import asyncio
import os
import sys

import uvicorn

from app.config import get_settings
from app.logger import print_startup_banner, setup_logging

# Tell the uvicorn reload worker (spawned as a new Python interpreter) to keep
# stdout/stderr unbuffered. Without this, per-request log lines sit in the
# subprocess's pipe buffer indefinitely instead of streaming to the console.
os.environ.setdefault("PYTHONUNBUFFERED", "1")

# Windows: uvicorn's default ``asyncio`` loop setup installs
# ``WindowsSelectorEventLoopPolicy``, which does NOT support
# ``asyncio.create_subprocess_exec`` — required by ``app.claude_code``. Pin
# Proactor here (no-op if already set) so the policy is correct even before
# uvicorn picks it up. We also pass ``loop="none"`` to ``uvicorn.run`` below
# so uvicorn doesn't overwrite this with Selector.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


def main() -> None:
    settings = get_settings()
    setup_logging(settings.server.log_level)
    print_startup_banner(settings)

    uvicorn.run(
        "app.main:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.reload,
        log_level=settings.server.log_level,
        reload_dirs=["app"] if settings.server.reload else None,
        access_log=False,  # replaced by our access_log_middleware
        loop="none",       # keep ProactorEventLoop on Windows for subprocess support
    )


if __name__ == "__main__":
    main()
