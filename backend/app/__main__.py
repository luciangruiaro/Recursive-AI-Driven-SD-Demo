"""Module entry point: ``python -m app``.

Reads server host/port from ``config.toml`` and starts uvicorn with reload.
"""

from __future__ import annotations

import os

import uvicorn

from app.config import get_settings
from app.logger import print_startup_banner, setup_logging

# Tell the uvicorn reload worker (spawned as a new Python interpreter) to keep
# stdout/stderr unbuffered. Without this, per-request log lines sit in the
# subprocess's pipe buffer indefinitely instead of streaming to the console.
os.environ.setdefault("PYTHONUNBUFFERED", "1")


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
    )


if __name__ == "__main__":
    main()
