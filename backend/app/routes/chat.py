"""Chat completion endpoint backed by an :class:`~app.llm.LlmClient`."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.config import get_settings
from app.llm import LlmClient
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    client: LlmClient = request.app.state.llm_client
    model = get_settings().llm.model
    try:
        content = await client.complete(payload.message)
    except RuntimeError as e:
        # Missing API key — configuration issue, not the user's fault.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except Exception as e:  # noqa: BLE001 — surface upstream errors as 502
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM call failed: {e}",
        ) from e
    return ChatResponse(content=content, model=model)
