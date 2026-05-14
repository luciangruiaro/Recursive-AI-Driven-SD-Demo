"""Internal data shapes for the self-evolve package."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ConfigChange(BaseModel):
    """A single proposed TOML edit, as returned by the LLM."""

    path: str = Field(..., description="Dotted TOML key, e.g. 'ui.theme.colors.primary'")
    value: Any = Field(..., description="New value; must match the existing TOML type")


class ChangeProposal(BaseModel):
    """LLM output — a minimal patch plus a one-line summary of intent."""

    summary: str
    changes: list[ConfigChange]


class AppliedChange(BaseModel):
    """Result of applying one :class:`ConfigChange` to disk."""

    path: str
    old_value: Any
    new_value: Any


class Availability(BaseModel):
    available: bool
    reason: str | None = None
    config_path: str | None = None
