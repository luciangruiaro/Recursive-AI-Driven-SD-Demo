"""Application configuration.

Two sources of truth, by design:

* ``config.toml`` — non-secret app configuration (server, CORS, LLM, UI theme).
  Hot-reloadable, version-controlled.
* ``.env`` — secrets only (currently just ``OPENAI_API_KEY``).

Use :func:`get_settings` everywhere; it is cached so the TOML is only read once
per process.
"""

from __future__ import annotations

import tomllib
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

CONFIG_PATH: Path = Path(__file__).resolve().parent.parent / "config.toml"
ENV_PATH: Path = Path(__file__).resolve().parent.parent / ".env"


# ─── Config sections ──────────────────────────────────────────────────────────


class ServerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 8729
    reload: bool = True
    log_level: str = "info"


class CorsConfig(BaseModel):
    allow_origins: list[str] = Field(default_factory=list)


class LlmConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 1024
    system_prompt: str = "You are a helpful assistant."


class ClaudeCodeConfig(BaseModel):
    """Non-secret defaults for the local ``claude`` CLI invocation."""

    allowed_tools: list[str] = Field(
        default_factory=lambda: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    )
    max_turns: int = 10
    timeout_seconds: int = 300
    idle_timeout_seconds: int = 120
    skip_permissions: bool = False
    system_prompt: str = ""


class ThemeColors(BaseModel):
    background: str
    surface: str
    surface_elevated: str
    border: str
    text_primary: str
    text_secondary: str
    text_muted: str
    primary: str
    primary_hover: str
    accent: str
    success: str
    error: str


class Theme(BaseModel):
    font_sans: str
    font_mono: str
    colors: ThemeColors


class UiConfig(BaseModel):
    title: str
    subtitle: str
    placeholder: str
    theme: Theme


# ─── Secrets (env-only) ───────────────────────────────────────────────────────


class Secrets(BaseSettings):
    """Environment-specific values, sourced from ``.env`` / env variables.

    Includes both true secrets (``openai_api_key``) and machine-specific paths
    (``claude_code_target_dir``) that should not live in ``config.toml``.
    """

    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    openai_api_key: SecretStr = SecretStr("")
    claude_code_target_dir: str = ""


# ─── Aggregate ────────────────────────────────────────────────────────────────


class Settings(BaseModel):
    server: ServerConfig
    cors: CorsConfig
    llm: LlmConfig
    claude_code: ClaudeCodeConfig
    ui: UiConfig
    secrets: Secrets


def _load_toml(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with path.open("rb") as f:
        return tomllib.load(f)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    raw = _load_toml(CONFIG_PATH)
    return Settings(
        server=ServerConfig(**raw.get("server", {})),
        cors=CorsConfig(**raw.get("cors", {})),
        llm=LlmConfig(**raw.get("llm", {})),
        claude_code=ClaudeCodeConfig(**raw.get("claude_code", {})),
        ui=UiConfig(**raw.get("ui", {})),
        secrets=Secrets(),
    )
