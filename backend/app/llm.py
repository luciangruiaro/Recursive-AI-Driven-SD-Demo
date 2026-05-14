"""LLM client abstraction.

A thin :class:`LlmClient` protocol keeps the rest of the codebase
provider-agnostic. Today we ship an OpenAI implementation; tomorrow we can add
an Anthropic / local one without touching the routes.
"""

from __future__ import annotations

from typing import Protocol

from openai import AsyncOpenAI

from app.config import LlmConfig


class LlmClient(Protocol):
    """Minimal completion interface used by the routes."""

    async def complete(self, prompt: str) -> str: ...


class OpenAiClient:
    """OpenAI-backed :class:`LlmClient`. The SDK client is created lazily so a
    missing API key only fails on the first request, not at import time."""

    def __init__(self, api_key: str, config: LlmConfig) -> None:
        self._api_key = api_key
        self._config = config
        self._client: AsyncOpenAI | None = None

    def _ensure_client(self) -> AsyncOpenAI:
        if self._client is None:
            if not self._api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY is not set. Add it to backend/.env "
                    "(see .env.example)."
                )
            self._client = AsyncOpenAI(api_key=self._api_key)
        return self._client

    async def complete(self, prompt: str) -> str:
        client = self._ensure_client()
        response = await client.chat.completions.create(
            model=self._config.model,
            temperature=self._config.temperature,
            max_tokens=self._config.max_tokens,
            messages=[
                {"role": "system", "content": self._config.system_prompt},
                {"role": "user", "content": prompt},
            ],
        )
        choice = response.choices[0]
        return (choice.message.content or "").strip()


def create_llm_client(api_key: str, config: LlmConfig) -> LlmClient:
    provider = config.provider.lower()
    if provider == "openai":
        return OpenAiClient(api_key, config)
    raise ValueError(f"Unsupported LLM provider: {config.provider!r}")
