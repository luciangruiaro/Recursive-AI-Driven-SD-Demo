"""Tests for the ``/api/config`` endpoint and the underlying TOML loader."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import get_settings


def test_config_endpoint_returns_full_theme(client: TestClient) -> None:
    response = client.get("/api/config")

    assert response.status_code == 200
    body = response.json()

    # Top-level shape
    assert {"title", "subtitle", "placeholder", "theme"} <= body.keys()

    # Theme shape
    theme = body["theme"]
    assert {"font_sans", "font_mono", "colors"} <= theme.keys()

    # Every color in the contract is a hex string
    colors = theme["colors"]
    expected_keys = {
        "background", "surface", "surface_elevated", "border",
        "text_primary", "text_secondary", "text_muted",
        "primary", "primary_hover", "accent", "success", "error",
    }
    assert expected_keys <= colors.keys()
    for key in expected_keys:
        assert colors[key].startswith("#"), f"{key} is not a hex color"


def test_settings_loader_reads_config_toml() -> None:
    settings = get_settings()

    assert settings.server.port == 8729
    assert settings.llm.provider == "openai"
    assert settings.llm.model == "gpt-4o-mini"
    assert settings.ui.title
    assert settings.ui.theme.colors.primary.startswith("#")
