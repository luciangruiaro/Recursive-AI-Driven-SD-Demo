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
