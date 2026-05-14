"""Hello-world and health-check endpoints.

* ``GET /api/hello``  — friendly greeting, used by the frontend smoke test.
* ``GET /api/health`` — liveness probe with build/version info.
"""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.schemas import HealthResponse, HelloResponse

router = APIRouter(prefix="/api", tags=["hello"])


@router.get("/hello", response_model=HelloResponse)
async def hello() -> HelloResponse:
    return HelloResponse(message="Hello, world!")


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version=__version__)
