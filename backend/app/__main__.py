"""Module entry point: ``python -m app``.

Reads server host/port from ``config.toml`` and starts uvicorn with reload.
"""

from __future__ import annotations

import uvicorn

from app.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.reload,
        log_level=settings.server.log_level,
        reload_dirs=["app"] if settings.server.reload else None,
    )


if __name__ == "__main__":
    main()
