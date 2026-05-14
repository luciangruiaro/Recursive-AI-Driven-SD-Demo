"""Request and response schemas exposed by the API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class ChatResponse(BaseModel):
    content: str
    model: str


class HelloResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str
    version: str


# ─── Claude Code CLI bridge ───────────────────────────────────────────────────


class ClaudeCodeHealthResponse(BaseModel):
    available: bool
    reason: str | None = None
    binary_path: str | None = None
    target_dir: str | None = None


class ClaudeCodeExecuteRequest(BaseModel):
    """Per-call overrides on top of the defaults in ``config.toml``.

    Leave a field as ``None`` to use the configured default.
    """

    prompt: str = Field(..., min_length=1, max_length=64000)
    allowed_tools: list[str] | None = None
    max_turns: int | None = Field(default=None, ge=1, le=200)
    timeout_seconds: int | None = Field(default=None, ge=10, le=3600)
    idle_timeout_seconds: int | None = Field(default=None, ge=5, le=3600)
    skip_permissions: bool | None = None
    system_prompt: str | None = None
    session_id: str = ""
