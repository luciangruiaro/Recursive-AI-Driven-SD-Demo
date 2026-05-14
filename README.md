# Recursive AI-Driven Software Development — Demo

A live-coding companion for the talk *Recursive AI-Driven Software Development:
Architecting Self-Evolving Systems*. Two services:

- **backend/** — Python 3.11 + FastAPI, managed with [`uv`](https://docs.astral.sh/uv/). Exposes a tiny REST surface and talks to OpenAI.
- **frontend/** — React 18 + Vite 5 + TypeScript, Tailwind v4. Single-page chat UI whose theme is driven entirely by the backend config.

## Prerequisites

| Tool | Version | Used by |
| --- | --- | --- |
| [uv](https://docs.astral.sh/uv/) | latest | backend |
| Python | 3.11+ | backend (managed by uv) |
| Node.js | 20+ | frontend |
| npm | 10+ | frontend |
| OpenAI API key | — | `/api/chat` only |

## Quick start

In one terminal — **backend**:

```bash
cd backend
cp .env.example .env          # paste your OPENAI_API_KEY into .env
uv sync                       # creates .venv and installs deps
uv run python -m app          # serves on http://127.0.0.1:8729
```

In another — **frontend**:

```bash
cd frontend
cp .env.example .env          # optional, defaults work
npm install
npm run dev                   # serves on http://127.0.0.1:4329
```

Open <http://127.0.0.1:4329>.

> The Vite dev server proxies `/api/*` to the backend, so you don't need to
> worry about CORS during development.

## Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/hello` | `{"message": "Hello, world!"}` |
| `GET` | `/api/health` | `{"status": "ok", "version": "..."}` |
| `GET` | `/api/config` | UI title, subtitle, fonts, full color palette |
| `POST` | `/api/chat` | `{ "message": "..." }` → `{"content": "...", "model": "..."}` |

Interactive docs at <http://127.0.0.1:8729/docs>.

## Running the tests

**Backend** (pytest):

```bash
cd backend
uv run pytest                 # all tests
uv run pytest -v              # verbose
uv run pytest --cov=app       # with coverage report
```

**Frontend** (vitest + React Testing Library):

```bash
cd frontend
npm test                      # one-shot
npm run test:watch            # watch mode
npm run test:coverage         # with v8 coverage
```

Backend tests use a `FakeLlmClient` swapped onto `app.state.llm_client`, so
they never touch the network and don't need an API key. Frontend tests stub
`fetch` directly via `vi.stubGlobal`.

## Configuration

Everything non-secret lives in [`backend/config.toml`](backend/config.toml):
ports, CORS origins, the LLM model + system prompt, and the entire UI theme
(fonts, full color palette). Edit it and reload the page — the frontend pulls
the theme from `/api/config` on startup and applies it as CSS custom
properties.

Secrets live only in `.env`:

| Variable | Where | Required for |
| --- | --- | --- |
| `OPENAI_API_KEY` | `backend/.env` | `/api/chat` |
| `VITE_PORT` | `frontend/.env` | overrides default `4329` |
| `VITE_BACKEND_URL` | `frontend/.env` | overrides proxy target |

## Project layout

```
.
├── backend/
│   ├── app/
│   │   ├── __main__.py        # `python -m app` → uvicorn w/ reload
│   │   ├── main.py            # FastAPI app factory
│   │   ├── config.py          # TOML + .env loader
│   │   ├── llm.py             # LlmClient protocol + OpenAiClient
│   │   ├── schemas.py         # Pydantic request/response models
│   │   └── routes/            # hello, chat, ui_config
│   ├── tests/                 # pytest suite
│   ├── config.toml            # non-secret app config
│   └── pyproject.toml
└── frontend/
    ├── src/
    │   ├── api/client.ts      # typed fetch wrapper
    │   ├── hooks/             # useChat, useConfig
    │   ├── theme/             # ThemeProvider (config → CSS vars)
    │   ├── components/        # Background, ChatInput, ResponseCard
    │   └── App.tsx
    ├── vite.config.ts         # port + /api proxy
    └── vitest.config.ts       # test runner config
```

## Ports

Uncommon defaults to avoid clashes with other dev servers:

| Service | Port | Override |
| --- | --- | --- |
| Backend | `8729` | `backend/config.toml` → `[server].port` |
| Frontend | `4329` | `frontend/.env` → `VITE_PORT` |
