"""Tests for ``/api/hello`` and ``/api/health``."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import __version__


def test_hello_returns_greeting(client: TestClient) -> None:
    response = client.get("/api/hello")

    assert response.status_code == 200
    assert response.json() == {"message": "Hello, world!"}


def test_health_returns_status_and_version(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "ok", "version": __version__}


def test_unknown_path_is_404(client: TestClient) -> None:
    response = client.get("/api/nope")
    assert response.status_code == 404
