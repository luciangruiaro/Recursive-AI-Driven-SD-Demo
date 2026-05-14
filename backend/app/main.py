"""FastAPI application factory.

Wires configuration, CORS, logging, the shared LLM client, the Claude Code
bridge, and the config-watcher lifespan together. Kept deliberately thin —
composition lives here, behaviour lives in the supporting modules.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.claude_code import ClaudeCodeClient
from app.config import get_settings
from app.config_watcher import ConfigBus, watch_config
from app.llm import create_llm_client
from app.logger import AccessLogMiddleware, log, setup_logging
from app.routes import chat, claude_code, hello, self_evolve, ui_config
from app.self_evolve import SelfEvolveLlm, SelfEvolveService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start the config.toml file watcher; cancel cleanly on shutdown."""
    bus = ConfigBus()
    app.state.config_bus = bus

    watcher = asyncio.create_task(watch_config(bus), name="config-watcher")
    try:
        yield
    finally:
        watcher.cancel()
        try:
            await watcher
        except asyncio.CancelledError:
            pass


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.server.log_level)

    app = FastAPI(
        title="Recursive AI-Driven SD — Backend",
        version=__version__,
        docs_url="/docs",
        redoc_url=None,
        lifespan=lifespan,
    )

    # Access log first (added last so it wraps everything else: CORS, routing,
    # exception handlers).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors.allow_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.add_middleware(AccessLogMiddleware)

    # Shared, app-scoped LLM client. Injected into routes via request.app.state.
    app.state.llm_client = create_llm_client(
        api_key=settings.secrets.openai_api_key.get_secret_value(),
        config=settings.llm,
    )

    # Local Claude Code CLI bridge. Lazy — detects the binary on first call.
    app.state.claude_code_client = ClaudeCodeClient(
        target_dir=settings.secrets.claude_code_target_dir,
        config=settings.claude_code,
    )

    # Self-evolve module — same OpenAI key, dedicated low-temperature client
    # tuned for structured JSON patches against the target config.toml.
    app.state.self_evolve_service = SelfEvolveService(
        target_dir=settings.secrets.self_evolve_target_dir,
        llm=SelfEvolveLlm(
            api_key=settings.secrets.openai_api_key.get_secret_value(),
            model=settings.llm.model,
        ),
    )

    app.include_router(hello.router)
    app.include_router(chat.router)
    app.include_router(ui_config.router)
    app.include_router(claude_code.router)
    app.include_router(self_evolve.router)

    log.info(
        "[bold green]ready[/bold green]  [dim]routes=%d  model=[/dim][magenta]%s[/magenta]",
        len(app.routes),
        settings.llm.model,
    )

    return app


app = create_app()
