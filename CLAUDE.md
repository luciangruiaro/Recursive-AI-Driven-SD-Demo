# CLAUDE.md

Project memory for AI agents working in this repo. Keep edits in line with the
conventions below — most "weird" choices have a specific reason documented here.

## What this repo is

A live-demo companion for the talk **Recursive AI-Driven Software Development:
Architecting Self-Evolving Systems**. Two services and one self-modification
loop:

1. `backend/` — FastAPI app. Exposes three demo entry points:
   - `/api/chat`              → plain OpenAI chat (default mode)
   - `/api/claude-code/*`     → bridges to the local `claude` CLI subprocess
   - `/api/self-evolve/*`     → LLM rewrites this repo's own `config.toml`
   plus a live config stream that pushes `config.toml` edits to the UI over SSE.

2. `frontend/` — React + Vite + Tailwind v4. Single-page chat UI whose entire
   theme is driven by the backend config. Routes input on three prefixes:
   no prefix → chat, `/code` → coding agent, `/self` → self-evolving.

The talk's "recursion" payoff lives at the seam between `self_evolve` and the
config watcher: typing `/self make the theme red` writes new hex codes into
`backend/config.toml`, which the watcher pushes to the frontend via SSE,
which repaints the page live — the system is editing its own appearance.

## Stack

| Layer | Tech |
| --- | --- |
| Backend runtime | Python 3.11, FastAPI, uvicorn, managed by [`uv`](https://docs.astral.sh/uv/) |
| LLM | OpenAI (`gpt-4o-mini` by default), via `openai` async client |
| Config | TOML (`backend/config.toml`) + `.env` for secrets, parsed with `tomllib`, patched round-trip with `tomlkit` |
| File watching | `watchfiles.awatch` |
| Console | `rich` (banner + access log + LLM trace) |
| Tests | `pytest` + `pytest-cov` |
| Frontend | React 18, Vite 5, TypeScript, Tailwind v4, framer-motion, lucide-react |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight` |
| Tests | `vitest` + `@testing-library/react`, `happy-dom` |

## Run

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env          # paste OPENAI_API_KEY; CLAUDE_CODE_TARGET_DIR + SELF_EVOLVE_TARGET_DIR already point at this repo
uv sync
uv run python -m app          # http://127.0.0.1:8729

# Terminal 2 — frontend
cd frontend
cp .env.example .env          # optional
npm install
npm run dev                   # http://127.0.0.1:4329
```

## Test

```bash
cd backend  && uv run pytest
cd frontend && npm test           # one-shot
cd frontend && npm run typecheck  # tsc -b --noEmit
```

## Project layout (annotated)

```
.
├── backend/
│   ├── config.toml                  # source of truth for ports, CORS, LLM, UI theme
│   ├── .env                         # secrets + machine paths (gitignored)
│   ├── pyproject.toml
│   └── app/
│       ├── __main__.py              # `python -m app` → uvicorn w/ ProactorEventLoop on Win
│       ├── main.py                  # FastAPI factory + lifespan (boots ConfigBus + watcher)
│       ├── config.py                # TOML + .env loader, lru-cached
│       ├── config_watcher.py        # ConfigBus + watchfiles.awatch task
│       ├── logger.py                # rich-based setup + ASGI access-log middleware
│       ├── schemas.py               # Pydantic request/response models
│       ├── llm.py                   # OpenAI chat client (used by /api/chat)
│       ├── claude_code.py           # Local `claude` CLI bridge
│       ├── self_evolve/             # Standalone package (see "self_evolve" below)
│       │   ├── __init__.py
│       │   ├── schemas.py
│       │   ├── llm.py               # SelfEvolveLlm — structured JSON output
│       │   ├── patcher.py           # ConfigPatcher — tomlkit, preserves comments
│       │   └── service.py           # Orchestrator yielding ndjson events
│       └── routes/                  # FastAPI routers, one per concern
│           ├── hello.py             # /api/hello + /api/health
│           ├── chat.py              # /api/chat
│           ├── ui_config.py         # /api/config + /api/config/stream (SSE)
│           ├── claude_code.py       # /api/claude-code/{health,execute}
│           └── self_evolve.py       # /api/self-evolve/{health,execute}
│   └── tests/                       # pytest, mirrors app/ structure
├── frontend/
│   ├── package.json
│   ├── vite.config.ts               # port 4329, `/api/*` → 8729 proxy
│   ├── vitest.config.ts
│   └── src/
│       ├── App.tsx                  # parseInput("/code" | "/self" | chat) + 3-way display
│       ├── main.tsx
│       ├── index.css                # Tailwind v4 entry + @theme tokens
│       ├── types.ts                 # shared types incl. ndjson event unions
│       ├── api/client.ts            # http() + shared streamNdjson<E> helper
│       ├── hooks/
│       │   ├── useConfig.ts         # EventSource → live theme updates
│       │   ├── useChat.ts           # one-shot LLM call
│       │   ├── useClaudeCode.ts     # ndjson stream of claude CLI events
│       │   └── useSelfEvolve.ts     # ndjson stream of self-evolve events
│       ├── theme/ThemeProvider.tsx  # writes config palette to :root CSS vars
│       └── components/
│           ├── Background.tsx
│           ├── ChatInput.tsx        # auto-grow textarea + CommandHint chip
│           ├── ResponseCard.tsx     # chat markdown response
│           ├── ClaudeCodeStream.tsx # /code timeline (tool_use cards)
│           └── SelfEvolveStream.tsx # /self timeline (proposal + diff cards)
├── docs/
│   └── readme-skills.md             # Talk-companion guide for the .claude/skills/
├── .claude/skills/                  # 10 demo-* skills (brainstorm, plan, debug, …)
├── architecture.mmd                 # Mermaid system diagram (see this file)
├── README.md                        # User-facing quickstart
└── CLAUDE.md                        # ← you are here
```

## Conventions

### Config split

- **`config.toml`** holds everything non-secret: ports, CORS origins, LLM
  model + temperature + system prompt, Claude Code tool list + timeouts, full
  UI theme (fonts + 12-color palette).
- **`.env`** holds **only**:
  - `OPENAI_API_KEY` — true secret
  - `CLAUDE_CODE_TARGET_DIR` — machine-specific path (repo root for `claude`)
  - `SELF_EVOLVE_TARGET_DIR` — machine-specific path (directory containing the
    `config.toml` to be edited)
- Never put theme tokens, model names, or timeouts in `.env`. Never put API
  keys in `config.toml`.

### Routes

- One file per concern under `app/routes/`. Each module exports a single
  `router = APIRouter(...)`.
- Heavy work goes through `app.state.<thing>` set in `create_app()`, **not**
  via module-level globals. This lets tests swap fakes in (see
  `conftest.py`'s `FakeLlmClient` swap).
- Streaming endpoints return `StreamingResponse(generator(),
  media_type="application/x-ndjson")` (or `"text/event-stream"` for SSE).
  Catch exceptions inside the generator and yield a final `{"type": "error",
  …}` event rather than raising — clean client UX.

### Logging

- `app.logger` sets up a single Rich handler on the root logger and silences
  `uvicorn.access` (replaced by our `AccessLogMiddleware`).
- Log lines may use rich markup: `"[bold green]ok[/bold green]"`.
- **Do NOT** put non-ASCII glyphs (`✓ → ←`) in log strings — Windows cp1252
  breaks Rich's legacy_windows renderer in piped subprocesses. Use `"ok"`,
  `">>"`, `"<<"` instead.

### Self-evolve package

- Self-contained under `app/self_evolve/` — only depends on `app.config`
  (for the `Settings` type) and the OpenAI client. Could be lifted to its
  own `pip install`-able package later.
- The LLM call uses `response_format={"type": "json_object"}` and demands a
  `{"summary": "...", "changes": [{"path": "dotted.toml.key", "value": …}]}`
  shape. The patcher walks the dotted path against a `tomlkit` document so
  comments + formatting survive.

### Frontend conventions

- Per-feature hook owns state + abortability: `useChat`, `useClaudeCode`,
  `useSelfEvolve`. App composes them; mode-switching `.reset()`s the others.
- Theme tokens are CSS custom properties on `:root`, written by
  `ThemeProvider` from the backend config. Tailwind v4 reads them via
  `@theme` in `index.css`.
- Streams parse ndjson lines via the shared `streamNdjson<E>()` in
  `api/client.ts`. Live config uses `EventSource` against
  `/api/config/stream`.

## Gotchas — read before editing

1. **Windows + asyncio subprocess.** uvicorn's default `asyncio` setup installs
   `WindowsSelectorEventLoopPolicy`, which **cannot** spawn subprocesses
   (`claude` CLI). `app/__main__.py` pins `WindowsProactorEventLoopPolicy()`
   and passes `loop="none"` to `uvicorn.run` so uvicorn doesn't overwrite it.
   If you ever see `NotImplementedError` from `create_subprocess_exec`,
   that's the symptom.

2. **Stdout buffering on the worker subprocess.** With `reload=True` uvicorn
   spawns a worker via multiprocessing — its stdout becomes a pipe and
   Python defaults to block-buffered. `app/__main__.py` sets
   `PYTHONUNBUFFERED=1` and `app/logger.py` line-buffers + uses a
   `_FlushingRichHandler` that flushes after every emit.

3. **Lifespan + tests.** The production `lifespan` spawns the config
   watcher; `watchfiles.awatch` doesn't always cancel cleanly under
   Windows TestClient teardown. `tests/conftest.py` swaps in a
   `_quiet_lifespan` that creates the `ConfigBus` but skips the watcher
   task. New tests should not assume the watcher is running.

4. **Port choices.** Backend `8729`, frontend `4329` — uncommon to avoid
   clashes with dev servers running on `3000` / `5173` / `8000` / `8080`.
   Both overridable via `config.toml` and `frontend/.env` respectively.

5. **Auto-reload propagation isn't instant after a parent change.** The
   uvicorn reloader holds the `Config` object passed to it at startup, so
   changes to `__main__.py` itself (e.g. the `loop="none"` setting) require
   a full `Ctrl+C` + restart. Changes to anything under `backend/app/` are
   picked up by the reloader watcher.

6. **CommandHint matching.** `parseInput` uses strict prefix match
   (`/code` followed by space-or-end, same for `/self`). `"/codex"` and
   `"/selfish"` stay in chat mode. Don't loosen this without updating the
   regression tests in `App.test.tsx`.

7. **Path semantics.**
   - `CLAUDE_CODE_TARGET_DIR` is the **repo root** `claude` should `cd`
     into (whole-repo operations).
   - `SELF_EVOLVE_TARGET_DIR` is the **directory containing `config.toml`**
     (we read `<target_dir>/config.toml`).
   They sound similar but mean different things.

## When you change something, also update…

| If you change | Update |
| --- | --- |
| The `UiConfig` shape in `app/config.py` | `frontend/src/types.ts` (`Theme`, `UiConfig`) and the theme tokens in `index.css` if you added a new color slot |
| `ConfigChange` / event shapes in `app/self_evolve/schemas.py` or `service.py` | `SelfEvolveEvent` union in `frontend/src/types.ts` and the renderer in `SelfEvolveStream.tsx` |
| Anything in `config.toml` | nothing — the watcher + SSE push it live. But check `frontend/src/types.ts` matches if you added a new top-level field. |
| The CORS origin in `config.toml` | the matching `VITE_PORT` in `frontend/.env` |

## Skills (in `.claude/skills/`)

Ten `/demo-*` skills documenting the full session loop: orient → ideate →
implement → validate → commit. See [docs/readme-skills.md](docs/readme-skills.md)
for the usage map and the unified flow diagram. Skill folders themselves
were renamed from `so-*` for the talk — the `so-be` / `so-fe` / `so-gov` /
`so-data` / `so-test` strings inside `demo-code-sync` and `demo-recap` are
repo names, not skill names, and should not be rewritten.

## Architecture diagram

See [architecture.mmd](architecture.mmd) for the full system view —
frontend hooks, backend routes, external services, the config watcher, and
the self-evolution loop that closes the cycle.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Recursive-AI-Driven-SD-Demo** (841 symbols, 1423 relationships, 28 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Recursive-AI-Driven-SD-Demo/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Recursive-AI-Driven-SD-Demo/clusters` | All functional areas |
| `gitnexus://repo/Recursive-AI-Driven-SD-Demo/processes` | All execution flows |
| `gitnexus://repo/Recursive-AI-Driven-SD-Demo/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
