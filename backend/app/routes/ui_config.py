"""UI configuration endpoint — exposes the ``[ui]`` section of ``config.toml``."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import UiConfig, get_settings

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config", response_model=UiConfig)
async def get_ui_config() -> UiConfig:
    return get_settings().ui
