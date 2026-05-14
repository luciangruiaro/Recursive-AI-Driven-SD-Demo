"""HTTP surface for the self-evolution module.

* ``GET  /api/self-evolve/health``  — availability check (config.toml exists).
* ``POST /api/self-evolve/execute`` — runs the propose-patch-apply pipeline
  and streams its events as ``application/x-ndjson``.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.schemas import SelfEvolveHealthResponse, SelfEvolveRequest
from app.self_evolve import SelfEvolveService

router = APIRouter(prefix="/api/self-evolve", tags=["self-evolve"])

logger = logging.getLogger("app.self_evolve")


@router.get("/health", response_model=SelfEvolveHealthResponse)
async def health(request: Request) -> SelfEvolveHealthResponse:
    service: SelfEvolveService = request.app.state.self_evolve_service
    return SelfEvolveHealthResponse(**service.availability().model_dump())


@router.post("/execute")
async def execute(
    payload: SelfEvolveRequest,
    request: Request,
) -> StreamingResponse:
    service: SelfEvolveService = request.app.state.self_evolve_service

    avail = service.availability()
    if not avail.available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=avail.reason or "self-evolve unavailable",
        )

    async def stream():  # noqa: ANN202
        try:
            async for event in service.execute(payload.prompt):
                yield json.dumps(event) + "\n"
        except Exception as e:  # noqa: BLE001
            logger.exception("self-evolve execute unexpected failure")
            yield json.dumps({"type": "error", "error": f"unexpected: {e}"}) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")
