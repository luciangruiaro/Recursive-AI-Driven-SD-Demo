"""LLM call that proposes minimal TOML edits.

A tightly-scoped client: it sends the *full current* ``config.toml`` plus the
user's request, and demands a JSON object with a ``summary`` and a list of
``{path, value}`` changes. Uses OpenAI's ``response_format=json_object`` so
the output is machine-parseable.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from app.self_evolve.schemas import ChangeProposal, ConfigChange

logger = logging.getLogger("app.self_evolve")

_SYSTEM_PROMPT = """\
You are a TOML config editor for a software demo. You receive the current
contents of a config.toml file and a natural-language request describing
what should change. You output the MINIMUM set of edits needed to satisfy
the request, as a JSON object with this exact shape:

{
  "summary": "<one short sentence describing what is changing>",
  "changes": [
    {"path": "<dotted.toml.key>", "value": <new_value>}
  ]
}

Rules:
- Use dotted TOML paths to identify keys, e.g. "ui.theme.colors.primary"
  or "llm.temperature".
- The "value" type MUST match the existing type at that path. Strings stay
  strings, numbers stay numbers, booleans stay booleans, arrays stay arrays.
- Hex colors stay as quoted strings with a leading "#".
- Output ONLY the JSON object. No prose, no code fences, no commentary.
- Make the FEWEST changes that satisfy the request — do not "improve"
  unrelated values.
- If the request is ambiguous, pick the most reasonable interpretation.
- If you genuinely cannot satisfy the request from this config, return
  {"summary": "<why>", "changes": []}.
"""


class SelfEvolveLlm:
    """OpenAI-backed proposer of minimal ``config.toml`` patches."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        temperature: float = 0.2,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._temperature = temperature
        self._client: AsyncOpenAI | None = None

    def _ensure_client(self) -> AsyncOpenAI:
        if self._client is None:
            if not self._api_key:
                raise RuntimeError("OPENAI_API_KEY is not set — needed for /self.")
            self._client = AsyncOpenAI(api_key=self._api_key)
        return self._client

    async def propose(
        self,
        current_toml: str,
        user_request: str,
    ) -> ChangeProposal:
        client = self._ensure_client()
        user_message = (
            "# Current config.toml\n"
            "```toml\n"
            f"{current_toml}\n"
            "```\n\n"
            "# Request\n"
            f"{user_request}\n"
        )

        logger.info(
            "[magenta]self-evolve[/magenta] [dim]>>[/dim] %s  "
            "[dim]config=%dch  request=%dch[/dim]",
            self._model,
            len(current_toml),
            len(user_request),
        )

        response = await client.chat.completions.create(
            model=self._model,
            temperature=self._temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        data: dict[str, Any] = json.loads(raw)

        # Defensive: accept slight schema drift from the model.
        summary = str(data.get("summary", "")).strip()
        raw_changes = data.get("changes") or []
        changes = [
            ConfigChange(path=str(c["path"]), value=c["value"])
            for c in raw_changes
            if isinstance(c, dict) and "path" in c and "value" in c
        ]

        logger.info(
            "[green]self-evolve[/green] [dim]<<[/dim] %s  [dim]changes=%d[/dim]  %s",
            self._model,
            len(changes),
            summary,
        )

        return ChangeProposal(summary=summary, changes=changes)
