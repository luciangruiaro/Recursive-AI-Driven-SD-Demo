"""HTTP surface for the local Claude Code CLI bridge.

* ``GET  /api/claude-code/health``  — availability check (binary + target dir).
* ``POST /api/claude-code/execute`` — runs ``claude`` and streams its
  ``stream-json`` output as ``application/x-ndjson``.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.claude_code import ClaudeCodeClient, ClaudeCodeError
from app.schemas import ClaudeCodeExecuteRequest, ClaudeCodeHealthResponse

router = APIRouter(prefix="/api/claude-code", tags=["claude-code"])

logger = logging.getLogger("app.claude_code")


@router.get("/health", response_model=ClaudeCodeHealthResponse)
async def health(request: Request) -> ClaudeCodeHealthResponse:
    client: ClaudeCodeClient = request.app.state.claude_code_client
    return ClaudeCodeHealthResponse(**asdict(client.availability()))


@router.post("/execute")
async def execute(
    payload: ClaudeCodeExecuteRequest,
    request: Request,
) -> StreamingResponse:
    client: ClaudeCodeClient = request.app.state.claude_code_client

    # Fail fast at request time if the CLI / target dir aren't usable.
    avail = client.availability()
    if not avail.available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=avail.reason or "Claude Code CLI unavailable",
        )

    async def stream():  # noqa: ANN202
        try:
            async for line in client.execute(
                prompt=payload.prompt,
                allowed_tools=payload.allowed_tools,
                max_turns=payload.max_turns,
                timeout_seconds=payload.timeout_seconds,
                idle_timeout_seconds=payload.idle_timeout_seconds,
                skip_permissions=payload.skip_permissions,
                system_prompt=payload.system_prompt,
                session_id=payload.session_id,
            ):
                yield line
        except ClaudeCodeError as e:
            yield json.dumps({"type": "error", "error": str(e)}) + "\n"
        except Exception as e:  # noqa: BLE001 — surface unexpected failures to caller
            logger.exception("claude-code execute unexpected failure")
            yield json.dumps({"type": "error", "error": f"unexpected: {e}"}) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")
