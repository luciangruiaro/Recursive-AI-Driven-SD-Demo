# Hero Banner — Phase A: Backend `[ui.hero]` schema

Land a new `[ui.hero]` block in `config.toml`, its Pydantic model in
`app/config.py`, and a contract test in `tests/test_config.py`. After
this phase, `/api/config` returns hero copy alongside the existing
title/subtitle/theme — the frontend can be built on a stable contract,
and `/self` can edit hero keys via dotted paths the moment they exist
in the TOML.

**Parent roadmap:** [hero-banner.md](../hero-banner.md) — see § A for the slice this expands.
**Effort:** S (~45 min, one focused sitting)
**Depends on:** —
**Blocks:** Phase B (frontend types extend `UiConfig.hero`) and every
phase after it.

---

## Context

Parent plan § A described the work but left two things underspecified
that this sub-plan resolves on the ground:

1. **Schema style.** The parent said "Pydantic / dataclass — double-check
   on read." Confirmed: [backend/app/config.py:62-87](../../../../backend/app/config.py)
   uses `pydantic.BaseModel` (`ThemeColors`, `Theme`, `UiConfig` all
   subclass it). All three have **no field defaults** — every value is
   required from TOML. `HeroConfig` mirrors that pattern.

2. **`get_settings()` unpacking.** The parent said the nested
   construction "needs an explicit line." That's wrong. Current code is:

   ```python
   ui=UiConfig(**raw.get("ui", {})),
   ```

   This passes `theme={"font_sans": ..., "colors": {...}}` as a dict
   kwarg and Pydantic v2 auto-coerces it into the `Theme` BaseModel.
   Adding `hero: HeroConfig` to `UiConfig` works the same way — no
   change to [backend/app/config.py:132-141](../../../../backend/app/config.py)
   needed. Verified by re-reading the loader end-to-end.

Other ground-truth checks against the parent plan:

- `[ui]` block sits at [backend/config.toml:39-42](../../../../backend/config.toml)
  with `title`, `subtitle`, `placeholder` — three top-level keys. The
  `[ui.theme]` subtable starts at line 44. Clean insertion point for
  `[ui.hero]` is **between line 42 and line 44**, before `[ui.theme]`.
- Existing test [backend/tests/test_config.py:10-32](../../../../backend/tests/test_config.py)
  uses subset assertions (`{"title", "subtitle", "placeholder",
  "theme"} <= body.keys()`), so adding `hero` to the response will
  **not** break it. No existing test needs amending; we add a sibling.
- The conftest autouse fixture [`_clear_settings_cache`](../../../../backend/tests/conftest.py)
  (line 50–55) clears the `lru_cache` between every test. Live config
  reads are safe.
- The SSE watcher [backend/app/config_watcher.py](../../../../backend/app/config_watcher.py)
  re-parses the whole TOML on file change and broadcasts the fresh
  `UiConfig`. No watcher change needed — the new block flows through
  automatically.
- Self-evolve patcher [backend/app/self_evolve/patcher.py](../../../../backend/app/self_evolve/patcher.py)
  walks **existing** dotted paths. The TOML block (slice A.1) seeds
  real non-empty values so `/self change the hero headline to …` works
  out of the box.

## Locked decisions (inherited + phase-specific)

| Decision | Choice | Rationale |
|---|---|---|
| Schema framework | `pydantic.BaseModel` (no defaults; values required from TOML) | Mirrors `ThemeColors` / `Theme` / `UiConfig` exactly. Strict-by-default is what we want — missing keys should be a startup error, not a silent fallback. |
| Insertion point in `config.toml` | Between line 42 (after `placeholder`) and line 44 (before `[ui.theme]`) | Keeps the `[ui]` "copy-shaped keys" grouped together; `[ui.theme]` stays separate as the visual-tokens block. |
| Insertion point in `config.py` | New `HeroConfig` class between line 80 (end of `Theme`) and line 83 (start of `UiConfig`); `hero: HeroConfig` line added to `UiConfig` between `placeholder` and `theme` | Reads top-to-bottom in the same order as the TOML file. |
| `get_settings()` change | **None** — Pydantic v2 auto-coerces nested dict kwargs into nested BaseModels | The existing `theme: Theme` field proves it works. Adding an explicit `hero=HeroConfig(**raw["ui"].get("hero", {}))` line would be redundant. |
| Hero copy keys (parent-locked) | `eyebrow`, `headline`, `subtitle`, `hint` | Per parent § A.1; chosen distinct from `ui.title` / `ui.subtitle` so the demo can show divergence. |
| Initial values (parent-locked) | Real non-empty strings | Self-evolve patcher requires existing paths to patch. |
| `HeroConfig` required vs. optional in `UiConfig` (parent-locked) | Required | Backend always serves it; optionality pushes `??` fallbacks across the frontend. |
| Test approach | Add **one** new test function `test_config_endpoint_includes_hero_block`; do not amend the existing two | Sibling test mirrors the existing style and keeps a clean diff in `test_config.py`. |
| What `test_settings_loader_reads_config_toml` asserts about hero | **No change** to that test — it's the "smoke" loader test, not the contract test | Avoid coupling the smoke test to every contract field; the new sibling test owns the contract assertion. |

## Deliverables

| Kind | What | File | Mode |
|---|---|---|---|
| TOML block | `[ui.hero]` with 4 string keys | [backend/config.toml](../../../../backend/config.toml) | EDIT |
| Pydantic model | `HeroConfig(BaseModel)` + `UiConfig.hero: HeroConfig` | [backend/app/config.py](../../../../backend/app/config.py) | EDIT |
| Contract test | `test_config_endpoint_includes_hero_block` | [backend/tests/test_config.py](../../../../backend/tests/test_config.py) | EDIT |

No new files. No frontend changes. No `.env` change. No watcher change.
No route change.

---

## A.1 — Add the `[ui.hero]` block to `config.toml`

**File:** [backend/config.toml](../../../../backend/config.toml)
**Insert between line 42 and line 44.**

After the line `placeholder = "Ask anything…"` (line 42), add a blank
line and the following block:

```toml
[ui.hero]
eyebrow  = "Live demo build"
headline = "Recursive AI-driven software development"
subtitle = "Architecting self-evolving systems."
hint     = "Type a question to begin — or `/code` for coding, `/self` to evolve the app."
```

Then a blank line, then the existing `[ui.theme]` subtable continues
at what becomes line ~50.

Notes:
- TOML cares about the subtable order: `[ui.hero]` and `[ui.theme]` are
  both subtables of `[ui]`, so they must come **after** the bare
  `title` / `subtitle` / `placeholder` keys of `[ui]` (otherwise those
  keys would belong to the last subtable above them). Verified by
  current ordering — we're just slotting in a sibling subtable.
- Key alignment uses spaces (`eyebrow  = "..."`) to match the visual
  rhythm of `[ui.theme.colors]` (lines 48–60) where colors are
  similarly aligned. Aesthetic, not required.

## A.2 — Add `HeroConfig` + `UiConfig.hero` to `app/config.py`

**File:** [backend/app/config.py](../../../../backend/app/config.py)

### A.2.1 — Add the model class

Between line 80 (closing brace of `Theme`) and line 83 (start of
`UiConfig`), insert a new class. The diff:

```python
 class Theme(BaseModel):
     font_sans: str
     font_mono: str
     colors: ThemeColors


+class HeroConfig(BaseModel):
+    eyebrow: str
+    headline: str
+    subtitle: str
+    hint: str
+
+
 class UiConfig(BaseModel):
     title: str
     subtitle: str
     placeholder: str
+    hero: HeroConfig
     theme: Theme
```

Two changes: a new `HeroConfig` class, and one new field on `UiConfig`
between `placeholder` and `theme`. Field order matches the TOML order
(`[ui.hero]` comes before `[ui.theme]`), purely for readability — both
fields are required, Pydantic doesn't care about declaration order.

### A.2.2 — Leave `get_settings()` untouched

Lines 131–141 stay exactly as they are:

```python
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
```

`raw["ui"]` after the TOML edit will be a dict like:
```python
{
    "title": "...", "subtitle": "...", "placeholder": "...",
    "hero":  {"eyebrow": "...", "headline": "...", "subtitle": "...", "hint": "..."},
    "theme": {"font_sans": "...", "font_mono": "...", "colors": {...}},
}
```

`UiConfig(**raw["ui"])` passes `hero={...}` and `theme={...}` as
nested-dict kwargs. Pydantic v2 auto-coerces them into `HeroConfig`
and `Theme` instances respectively. The current `theme: Theme` field
already proves this works — no explicit construction call needed.

### A.2.3 — Failure-mode sanity check (no code change, just a thought)

What happens if `config.toml` is edited (or a fork comes in) **without**
the `[ui.hero]` block? Pydantic raises a `ValidationError` at the
`get_settings()` call — startup fails fast. That's the desired
behavior: fail loud at boot, not silently at first SSE push. Matches
how the existing required fields (title, subtitle, every theme color)
already behave.

## A.3 — Add the contract test

**File:** [backend/tests/test_config.py](../../../../backend/tests/test_config.py)

Add a new test function below `test_settings_loader_reads_config_toml`
(end of file, line 43+):

```python
def test_config_endpoint_includes_hero_block(client: TestClient) -> None:
    response = client.get("/api/config")

    assert response.status_code == 200
    body = response.json()

    # Hero block is exposed at the top level of UiConfig
    assert "hero" in body
    hero = body["hero"]

    # Contract keys
    expected = {"eyebrow", "headline", "subtitle", "hint"}
    assert expected <= hero.keys()

    # Each value is a non-empty string (self-evolve needs real paths)
    for key in expected:
        assert isinstance(hero[key], str) and hero[key].strip(), (
            f"hero.{key} must be a non-empty string for self-evolve "
            "to be able to patch it"
        )
```

Why this shape:
- Subset assertion `expected <= hero.keys()` mirrors the existing
  `expected_keys <= colors.keys()` style — additive-friendly.
- Non-empty assertion guards the locked decision "Initialize hero
  with real values, not blanks" (parent plan + self-evolve patcher
  constraint). If a future commit blanks a value, the test catches it.
- The comment explicitly references self-evolve so the next reader
  understands the *why* of the non-empty check — anti-bikeshedding.

What this test does **not** do (deliberate):
- Doesn't assert specific copy strings (e.g., `assert hero["headline"]
  == "Recursive AI-driven..."`). Demo copy will be edited live during
  rehearsal/talk; pinning the string would create needless test churn.
- Doesn't assert key-count equality (`hero.keys() == expected`). If a
  future phase adds `cta_label` or similar, the test stays green
  without a touch-up.

## A.4 — Verify

Run from `backend/`:

```powershell
# 1. Run the new test (and confirm existing two still pass)
uv run pytest tests/test_config.py -v

# Expected:
#   tests/test_config.py::test_config_endpoint_returns_full_theme PASSED
#   tests/test_config.py::test_settings_loader_reads_config_toml PASSED
#   tests/test_config.py::test_config_endpoint_includes_hero_block PASSED

# 2. Boot the backend and curl the endpoint
uv run python -m app
# In another terminal:
curl http://127.0.0.1:8729/api/config | python -m json.tool
# Expected output should include a top-level "hero" object with all 4 keys.

# 3. Sanity: full test suite, in case the new field tripped a snapshot somewhere
uv run pytest
```

Then stop the backend (Ctrl+C).

### Manual self-evolve smoke (optional but worthwhile)

If the dev stack is up, this is the moment to verify the closing-loop
promise (parent plan's whole reason for `[ui.hero]` existing as a
config-driven block):

```powershell
# With backend + frontend both running (frontend not strictly required
# for this check — the SSE push goes through regardless), use the
# /api/self-evolve/execute endpoint to patch ui.hero.headline.
# Pick your favorite curl/HTTPie incantation; for example:

curl -X POST http://127.0.0.1:8729/api/self-evolve/execute `
  -H "Content-Type: application/json" `
  -d '{\"prompt\": \"change the hero headline to Demo time\"}'
```

Expected: server log shows a successful patch on `ui.hero.headline`
and no `PatchError: path not found`. Then revert by running the same
endpoint with `"change the hero headline back to Recursive AI-driven
software development"`, or just edit `config.toml` directly.

If this fails with `PatchError`, the most likely cause is that the new
section landed in `config.toml` but the backend wasn't restarted (or
the watcher missed it). Restart and retry.

## A.5 — Commit

Once verification passes, group the three edits into a single commit
via `/demo-group-and-commit` (or `git add` + `git commit` directly if
preferred):

- Suggested commit message:
  ```
  feat(config): add [ui.hero] block to config.toml + schema
  
  Adds eyebrow / headline / subtitle / hint keys served at /api/config
  alongside the existing title / subtitle / theme. Required prerequisite
  for the splash-hero frontend (parent plan: docs/plans/hero-banner/).
  Self-evolve can now patch ui.hero.* dotted paths.
  ```

No CHANGELOG update — this repo doesn't keep one (`Glob CHANGELOG*`
returns nothing). If that changes later, add a one-line entry here.

## Tests

(All test work is rolled into § A.3. Re-stated here for the matrix.)

| Test file | Cases | Why |
|---|---|---|
| [backend/tests/test_config.py](../../../../backend/tests/test_config.py) | `test_config_endpoint_includes_hero_block` (new) — endpoint exposes a `hero` object with 4 non-empty string keys | Locks the contract Phase B's frontend types will depend on; non-empty check guards the self-evolve compatibility requirement. |
| same | Existing two tests (`returns_full_theme`, `reads_config_toml`) — re-run for regression | Subset assertions mean they should still pass; verify, don't change. |

## Documentation updates

This phase is small enough that the parent plan's § F (doc refresh) is
where doc work lands at the *end* of the whole hero-banner rollout. For
Phase A specifically:

- **No** `CLAUDE.md` update yet — that line addition belongs at the end
  of the rollout (after the frontend lands), not now.
- **No** README update — no user-visible change yet.
- **No** architecture.mmd update — no new component yet.
- The **commit message** is the durable doc artifact for this phase.

This is deliberate: shipping doc updates for backend-only changes that
have no visible effect produces stale docs by the time Phase B lands.

## Verification recipe

(Identical to § A.4 — kept here as the canonical "did this phase
ship?" checklist for a reviewer.)

```powershell
cd backend
uv run pytest tests/test_config.py -v   # 3 passes
uv run pytest                            # full suite green
uv run python -m app                     # boots without ValidationError
curl http://127.0.0.1:8729/api/config | python -m json.tool   # hero block present
```

Optional bonus (closes the recursion loop):
```powershell
curl -X POST http://127.0.0.1:8729/api/self-evolve/execute `
  -H "Content-Type: application/json" `
  -d '{\"prompt\": \"change the hero headline to Demo time\"}'
# Expect: 200 OK, no PatchError, config.toml ui.hero.headline updated.
```

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `[ui.hero]` block is added but placed **after** `[ui.theme]` — TOML parses it but the subtable order makes the file harder to read | low | nit | Insert between line 42 and line 44 per § A.1, before `[ui.theme]`. The position is explicit in the locked-decisions table. |
| Pydantic raises `ValidationError` at boot because someone edits `config.toml` and drops a hero key | low | startup fails | Desired behavior — fail loud, not silent. Same posture as every other required field. The error message points at the missing key. |
| `test_config_endpoint_includes_hero_block` is flaky because `_clear_settings_cache` doesn't run for some reason | very low | red CI | The autouse fixture in [conftest.py:50-55](../../../../backend/tests/conftest.py) covers this and is shared across the suite. If a future change disables the autouse, this test fails first — a useful canary. |
| `model_dump_json()` on `UiConfig` doesn't include the `hero` field for some Pydantic edge case | very low | frontend can't read it | Pydantic v2 serializes all required fields by default. The contract test exercises the full round-trip (`/api/config` → JSON → assert), so this risk is covered by § A.3. |
| Self-evolve LLM doesn't propose `ui.hero.*` paths because it doesn't see them | low | the closing-loop demo doesn't fire on first try | The LLM sees the full current TOML in its prompt; after the block lands, it discovers the keys naturally. § A.4's optional curl test verifies this end-to-end before the talk. |

## Out of scope

Adjacent items that come to mind but explicitly do **not** belong in
Phase A:

- **Frontend changes** — Phase B's job. Don't touch `frontend/src/types.ts`
  in this phase; let the contract land first.
- **Watcher / SSE changes** — already automatic; no edits to
  `config_watcher.py` or `routes/ui_config.py`.
- **`.env.example` additions** — no hero secrets exist.
- **Additional hero keys** (e.g., `cta_label`, `version_pill`) — wait
  until the frontend has a place to render them.
- **Renaming `ui.title` / `ui.subtitle`** to live inside `[ui.hero]` —
  parent plan deliberately kept them distinct so the talk can demo
  divergence. Don't merge them here.
- **Localization (i18n)** of hero strings — out of scope for the whole
  hero-banner rollout, never mind Phase A.

## Open implementation questions

Last-mile decisions. Recommended answers in each:

1. **Field declaration order in `UiConfig` — put `hero` before or after `theme`?**
   Recommended: **before `theme`**, mirroring the TOML order
   (`[ui.hero]` is inserted before `[ui.theme]`). Pydantic doesn't
   care; readers do.

2. **Should the test assert key-count equality (`hero.keys() == expected`) or subset (`expected <= hero.keys()`)?**
   Recommended: **subset.** Matches the existing pattern in
   `test_config_endpoint_returns_full_theme` and stays additive-friendly.

3. **Should the test pin specific copy strings (e.g., `assert "Recursive" in hero["headline"]`)?**
   Recommended: **no.** Demo copy will be edited live in `/self`
   sessions; pinning creates test churn for zero contract value.

4. **Should we run `/api/self-evolve/execute` as part of the verification recipe (§ A.4)?**
   Recommended: **optional.** It's worth doing once to confirm the
   closing-loop fires, but it shouldn't be a CI gate — it touches the
   LLM and a real file. Mark it explicitly as "optional bonus" so the
   reviewer doesn't think CI should run it.
