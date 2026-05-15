# Hero Banner — Splash-on-Idle, Collapse-on-Engagement

A pre-chat splash hero owns the viewport on first paint; the instant the
user engages (chat / `/code` / `/self`), it collapses into the existing
compact header. The whole thing rides on the backend-driven theme, so
typing `/self change the hero headline to "X"` repaints the hero live —
which is the talk's recursion payoff in miniature.

**Parent brainstorm:** [docs/brainstorms/hero-banner/hero-banner.md](../../brainstorms/hero-banner/hero-banner.md)
**Effort:** M (~1 focused day, 6 slices of ≤ ~2h each)
**Depends on:** —
**Blocks:** any future README banner pass (Framing C) or full brand pass (Framing D); both can layer on top.

---

## Context

This repo is a live-demo companion for a conference talk on
self-evolving systems. The frontend is a single-page React chat UI; the
backend is a FastAPI app that serves `/api/config` + an SSE
`/api/config/stream` that pushes `config.toml` changes to the browser as
they happen. The talk's payoff — `/self` mode rewriting the project's
own theme on stage — only lands if there's something visually striking
*to* repaint.

What exists today, at the surface area this plan touches:

- [frontend/src/App.tsx:122-147](../../../frontend/src/App.tsx) renders a
  small `motion.header` (gradient `<h1>` + subtitle, fade-in `[0.22, 1,
  0.36, 1]` easing) inside the `max-w-2xl` column. It's the only
  hero-shaped surface and it's never noticed from the back of the room
  during a talk.
- Three mode hooks ([useChat](../../../frontend/src/hooks/useChat.ts),
  [useClaudeCode](../../../frontend/src/hooks/useClaudeCode.ts),
  [useSelfEvolve](../../../frontend/src/hooks/useSelfEvolve.ts)) each
  expose a `status` field (`"idle" | "loading" | …`). The union
  `chat.status !== "idle" || cc.status !== "idle" || se.status !==
  "idle"` is the cleanest "user has engaged" signal — no new state, no
  changes to `ChatInput`.
- Theme is fully CSS-var driven (`--color-*` / `--font-*` written by
  [ThemeProvider](../../../frontend/src/theme/ThemeProvider.tsx) from
  `/api/config`). Any hero must use these vars; no hardcoded hex.
- [Background.tsx](../../../frontend/src/components/Background.tsx) is
  `fixed inset-0 -z-10`. Hero sits on top.
- [favicon.svg](../../../frontend/public/favicon.svg) is a 32×32
  recursive-arrow with the project's purple→cyan gradient. It's the
  natural seed for an in-app `<LogoMark>` component.
- Animation idiom across [ChatInput](../../../frontend/src/components/ChatInput.tsx),
  [ResponseCard](../../../frontend/src/components/ResponseCard.tsx),
  [ClaudeCodeStream](../../../frontend/src/components/ClaudeCodeStream.tsx),
  [SelfEvolveStream](../../../frontend/src/components/SelfEvolveStream.tsx)
  is consistent: `motion.*` wrappers, easing `[0.22, 1, 0.36, 1]`,
  durations 300–500ms, `AnimatePresence mode="wait" initial={false}` for
  exclusive states. The hero should mirror it.
- Backend config: [backend/config.toml:38-61](../../../backend/config.toml)
  has `[ui]` (title / subtitle / placeholder) and `[ui.theme]` (fonts +
  12-color palette). A `[ui.hero]` subtable slots in cleanly.
- Self-evolve patcher
  ([backend/app/self_evolve/patcher.py:88-113](../../../backend/app/self_evolve/patcher.py))
  uses `tomlkit` to walk **existing** dotted paths. New keys must
  already exist in `config.toml` for `/self` to edit them — which is why
  the plan initializes `[ui.hero]` with real values, not blanks.

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framing | **B** — splash hero collapses on engagement | Brainstorm winner: only framing whose value lands during a live talk; M-effort fits the one-sentence seed. |
| Logo source | Extend the existing recursive-arrow favicon mark into a reusable `<LogoMark>` React component | Mark already encodes recursion + brand colors; a new mark belongs in a Framing D pass, not here. |
| Collapse trigger | First engagement in *any* mode: `chat.status \|\| cc.status \|\| se.status !== "idle"` | The three mode hooks already expose the signal — no new state, no `ChatInput` change. |
| Collapse target | Hero shrinks into the existing compact header (same visual shape as today's `motion.header`) | Lingering hero feels static once chat is active; the collapse moment is itself part of the demo. |
| Hero copy source | New `[ui.hero]` block in `config.toml`, served through the existing `/api/config` contract | Live re-theming is load-bearing here (the `/self` recursion payoff). Hardcoding copy would break that promise. |
| Hero copy keys | `eyebrow`, `headline`, `subtitle`, `hint` | Distinct from `title` / `subtitle` so the talk can demo "hero says X, chat header says Y" if it wants — and so existing tests pinned to `ui.title` don't shift. |
| Initial values | Real non-empty strings (e.g., `headline = "Recursive AI-driven software development"`) | The self-evolve patcher only walks existing paths; blank values would still parse but seed the demo poorly. |
| Animation | Reuse the in-house easing curve `[0.22, 1, 0.36, 1]`; durations 300–500ms; Framer Motion `AnimatePresence mode="wait" initial={false}` for the splash↔compact swap | Mirrors every other animated surface in the codebase. |
| Z-stack | Hero at `z-10` (above `Background.tsx`'s `-z-10`, in the same paint layer as the rest of the `<main>` content) | No modals or overlays exist; no need to climb higher. |
| Layering of the morph | Two render variants inside one `<HeroBanner>` (splash / compact), swapped under `AnimatePresence`; **not** a Framer `layout` morph between separate elements | `layout` between two different DOM trees fights with text reflow inside `<h1>`; an exclusive swap is simpler to test and looks identical at the easing curves used. |
| New dependencies | None | The stack is intentionally thin (React, Framer Motion, Lucide React, Tailwind v4). Adding a logo-animation library would violate the project posture. |
| State location | `phase` is derived in `App.tsx` from the three hooks' `status` fields; passed as a prop to `<HeroBanner>` | Avoids a new store / context. The derivation is one boolean. |
| `enabled` toggle | Not exposed | Splash is always on for fresh sessions; the demo's value is in the collapse motion, not in suppressing it. A backend kill-switch is over-engineering. |
| Refresh-to-replay | Replaying the splash mid-talk requires a page reload | Acceptable for the demo cadence; a "back to splash" button is out of scope (see § Out of scope). |
| Test scope | Render-variant tests (splash vs. compact) + config-pipe-through; **no animation assertions** | Matches every other component test in `frontend/src/components/`; animations are verified by eye at demo time per `CLAUDE.md`. |

## Deliverables

| Kind | What | Files |
|---|---|---|
| Backend config | `[ui.hero]` block with `eyebrow` / `headline` / `subtitle` / `hint` | EDIT [backend/config.toml](../../../backend/config.toml) |
| Backend schema | `HeroConfig` dataclass + `UiConfig.hero` field | EDIT [backend/app/config.py](../../../backend/app/config.py) |
| Backend test | Assert `/api/config` exposes the hero block | EDIT [backend/tests/test_config.py](../../../backend/tests/test_config.py) |
| Frontend type | `HeroConfig` interface + `UiConfig.hero` | EDIT [frontend/src/types.ts](../../../frontend/src/types.ts) |
| Frontend component | Reusable inline logo mark | NEW [frontend/src/components/LogoMark.tsx](../../../frontend/src/components/LogoMark.tsx) |
| Frontend component | The splash + compact hero | NEW [frontend/src/components/HeroBanner.tsx](../../../frontend/src/components/HeroBanner.tsx) |
| Frontend test | Render-variant + config-piping tests | NEW [frontend/src/components/HeroBanner.test.tsx](../../../frontend/src/components/HeroBanner.test.tsx) |
| Frontend wiring | Derive `phase`, render `<HeroBanner>`, retire the inline `motion.header` | EDIT [frontend/src/App.tsx](../../../frontend/src/App.tsx) |
| Doc | One-line addition under "Config split" — note that hero copy lives in `[ui.hero]` | EDIT [CLAUDE.md](../../../CLAUDE.md) |
| Doc | Optional one-sentence mention in the "Frontend" row of "What this repo is" | EDIT [README.md](../../../README.md) |
| Diagram | Add `HeroBanner` node if architecture diagram distinguishes components (skip if it's coarser than that) | EDIT [architecture.mmd](../../../architecture.mmd) |
| Status marker | `# Status: ✅ Done` + shipped-date + scope bullets, written *after* implementation lands | NEW `docs/plans/hero-banner/STATUS.md` |

---

## A. Backend `[ui.hero]` schema + initial copy

**Files:** [backend/config.toml](../../../backend/config.toml),
[backend/app/config.py](../../../backend/app/config.py),
[backend/tests/test_config.py](../../../backend/tests/test_config.py)

**Stop-after state:** backend boots, `/api/config` returns `{… "hero":
{"eyebrow": …, "headline": …, "subtitle": …, "hint": …}}`. Frontend is
untouched and unaffected (the new field is purely additive).

### A.1 Add the block to `config.toml`

After line 42 (immediately after `placeholder = "Ask anything…"`), and
before the `[ui.theme]` block, insert:

```toml
[ui.hero]
eyebrow = "Live demo build"
headline = "Recursive AI-driven software development"
subtitle = "Architecting self-evolving systems."
hint = "Type a question to begin — or `/code` for coding, `/self` to evolve the app."
```

`headline` intentionally echoes the current `ui.title` so the splash
feels rooted in the same identity; `subtitle` echoes `ui.subtitle` for
the same reason. They're **separate keys** so the talk can divergence
them on stage via `/self` without disturbing the compact header's copy
(which still flows from `ui.title` / `ui.subtitle` — see § D for the
rationale).

### A.2 Extend the Pydantic / dataclass schema

In [backend/app/config.py](../../../backend/app/config.py), add a
`HeroConfig` dataclass mirroring the existing `ThemeColors` /
`UiConfig` style. Place it directly above `UiConfig`:

```python
@dataclass(frozen=True)
class HeroConfig:
    eyebrow: str
    headline: str
    subtitle: str
    hint: str
```

Extend `UiConfig` with `hero: HeroConfig`. Update the
`get_settings()` unpacking — `**raw.get("ui", {})` already passes the
`hero` subtable through, but the nested `HeroConfig(**…)` construction
needs an explicit line. Mirror how `Theme` is built in the same
function.

If the project uses Pydantic `BaseModel` rather than dataclasses (the
research briefing showed dataclasses, but double-check on read), use
the matching idiom; the shape is the same either way.

### A.3 Test

In [backend/tests/test_config.py](../../../backend/tests/test_config.py),
extend `test_config_endpoint_returns_full_theme` (or add a sibling
`test_config_endpoint_includes_hero_block`) that asserts:

```python
def test_config_endpoint_includes_hero_block(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    hero = response.json()["hero"]
    assert set(hero.keys()) == {"eyebrow", "headline", "subtitle", "hint"}
    for value in hero.values():
        assert isinstance(value, str) and value  # non-empty
```

Run: `cd backend && uv run pytest tests/test_config.py -v`.

## B. Frontend types + `LogoMark` extraction

**Files:** [frontend/src/types.ts](../../../frontend/src/types.ts),
[frontend/src/components/LogoMark.tsx](../../../frontend/src/components/LogoMark.tsx)

**Stop-after state:** Types match the new backend contract.
`LogoMark` renders the recursive-arrow at any size; nothing imports it
yet.

### B.1 Extend `UiConfig`

```ts
export interface HeroConfig {
  eyebrow: string;
  headline: string;
  subtitle: string;
  hint: string;
}

export interface UiConfig {
  title: string;
  subtitle: string;
  placeholder: string;
  theme: Theme;
  hero: HeroConfig;
}
```

Make `hero` **required** (not optional) — backend always provides it
and the optionality would just push a `?? defaults` everywhere in the
component.

### B.2 Extract `LogoMark.tsx`

The current
[favicon.svg](../../../frontend/public/favicon.svg) is hardcoded with
literal hex (`#0a0a0f`, `#8b5cf6`, `#06b6d4`). Inside the app we want
the same shape but driven by CSS vars so it re-tints when the theme
changes:

```tsx
import { motion, type HTMLMotionProps } from "framer-motion";

export interface LogoMarkProps extends Omit<HTMLMotionProps<"svg">, "viewBox"> {
  size?: number;       // px — drives width + height
  spinning?: boolean;  // splash mode → slow idle rotation
}

export function LogoMark({ size = 32, spinning = false, ...rest }: LogoMarkProps) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Recursive demo logo"
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={spinning ? { duration: 18, ease: "linear", repeat: Infinity } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      <defs>
        <linearGradient id="logo-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="var(--color-background)" />
      <path
        d="M9 9h9a5 5 0 0 1 0 10h-4l8 7H17l-7-7H9z"
        fill="url(#logo-mark-gradient)"
      />
    </motion.svg>
  );
}
```

Notes:
- `id="logo-mark-gradient"` is a single global ID. If `LogoMark` is
  rendered twice on the page (splash + something else later), the
  second instance reuses the same gradient definition — that's
  intentional and inexpensive. If multiple instances coexist with
  *different* gradients later, switch to a `useId()`-based unique ID.
- Idle rotation is **slow** (18s per turn) so it reads as "alive" but
  not "spinner". The brainstorm called this out as a feel-good touch;
  if it distracts during the talk, remove the `spinning` prop in a
  follow-up — no other component depends on the rotation.
- The static `public/favicon.svg` stays as-is; this component is purely
  the in-app variant.

## C. `HeroBanner.tsx` component

**Files:** [frontend/src/components/HeroBanner.tsx](../../../frontend/src/components/HeroBanner.tsx)

**Stop-after state:** Component renders; storybook-style smoke in isolation
works; nothing in `App.tsx` imports it yet.

### C.1 Component shape

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { LogoMark } from "@/components/LogoMark";
import type { HeroConfig } from "@/types";

export type HeroPhase = "splash" | "compact";

export interface HeroBannerProps {
  phase: HeroPhase;
  copy: HeroConfig;
  compactTitle: string;       // pulled from ui.title for compact mode
  compactSubtitle: string;    // pulled from ui.subtitle
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function HeroBanner({ phase, copy, compactTitle, compactSubtitle }: HeroBannerProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {phase === "splash" ? (
        <motion.section
          key="splash"
          aria-label="Demo splash"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col items-center justify-center gap-6 py-16 text-center sm:py-24"
        >
          <LogoMark size={96} spinning />
          {copy.eyebrow ? (
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
              {copy.eyebrow}
            </span>
          ) : null}
          <h1 className="bg-gradient-to-br from-[color:var(--color-primary)] to-[color:var(--color-accent)] bg-clip-text text-4xl font-semibold text-transparent sm:text-5xl">
            {copy.headline}
          </h1>
          <p className="max-w-xl text-base text-[color:var(--color-text-secondary)] sm:text-lg">
            {copy.subtitle}
          </p>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            {copy.hint}
          </p>
        </motion.section>
      ) : (
        <motion.header
          key="compact"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="text-center"
        >
          <div className="mb-4 flex justify-center">
            <LogoMark size={32} />
          </div>
          <h1 className="bg-gradient-to-br from-[color:var(--color-primary)] to-[color:var(--color-accent)] bg-clip-text text-2xl font-semibold text-transparent sm:text-3xl">
            {compactTitle}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
            {compactSubtitle}
          </p>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
```

Why this shape:
- One `<h1>` per render variant; never both at once (because of
  `AnimatePresence mode="wait"`). The compact `<h1>` carries the
  page's accessible title for the rest of the session.
- `aria-label="Demo splash"` on the splash `<section>` gives a11y
  trees a stable landmark even before chat content arrives.
- All colors / fonts come through CSS vars; no Tailwind palette
  classes (`text-purple-500` etc.) — they'd bypass the theme.
- `bg-gradient-to-br … bg-clip-text text-transparent` mirrors the
  existing gradient `<h1>` in
  [App.tsx:130-138](../../../frontend/src/App.tsx) so the compact
  render is visually continuous with what shipped before.

### C.2 Visual checkpoint

After this slice (still pre-wiring), open `HeroBanner` in isolation
(e.g., a throwaway `App.tsx` swap or a Vitest screen-render in
`HeroBanner.test.tsx`) and eyeball both phases at the dev server.
Document any easing / spacing tweaks in the file's commit message —
the locked-decisions table doesn't move.

## D. Wire `<HeroBanner>` into `App.tsx`

**Files:** [frontend/src/App.tsx](../../../frontend/src/App.tsx)

**Stop-after state:** Splash renders on first load; first chat /
`/code` / `/self` engagement collapses it to the compact header. The
inline `motion.header` is gone (replaced by the compact render of
`<HeroBanner>`).

### D.1 Derive `phase`

Near the top of the component body, after the three hook calls:

```tsx
const phase: HeroPhase =
  chat.status === "idle" && cc.status === "idle" && se.status === "idle"
    ? "splash"
    : "compact";
```

Edge case: after the user submits and then `.reset()`s (e.g., clears
input, switches modes), all three statuses go back to `"idle"`. Do
**not** flip back to splash in that case — once collapsed, stay
collapsed for the session. Track this with a `useRef<boolean>` "has
ever engaged" or a `useState` that latches to `true`:

```tsx
const [hasEngaged, setHasEngaged] = useState(false);
useEffect(() => {
  if (!hasEngaged && (chat.status !== "idle" || cc.status !== "idle" || se.status !== "idle")) {
    setHasEngaged(true);
  }
}, [chat.status, cc.status, se.status, hasEngaged]);

const phase: HeroPhase = hasEngaged ? "compact" : "splash";
```

Yes, the latch adds one piece of state (the locked-decisions table
warned about exactly this). It's worth it: without it, the hero would
re-expand whenever the user clears the page mid-session — confusing
mid-talk.

### D.2 Replace the inline `motion.header`

Delete lines 122–147 of `App.tsx` (the entire `motion.header` block).
Insert in its place:

```tsx
<HeroBanner
  phase={phase}
  copy={config.hero}
  compactTitle={config.title}
  compactSubtitle={config.subtitle}
/>
```

Keep the `<Background />`, `<ChatInput>`, `<ResponseCard>` / stream
components, and the `<main>` wrapper exactly as they are. The splash
naturally expands the `<main>` column on idle (because the splash
section is taller than the compact header) — that's the desired feel.

### D.3 `max-w-2xl` consideration

Today's `motion.header` lives inside the `max-w-2xl` column. The
splash variant of `HeroBanner` overflows that aesthetically — it wants
to feel wider. Choice: keep `max-w-2xl` (everything stays in the
column, splash just feels tall) **for this plan**, and revisit
`max-w-4xl` on splash only in a follow-up if the demo feels cramped.
Going wider would require restructuring the `<main>` flex / grid
layout, which is out of scope here.

## E. Tests

**Files:** [frontend/src/components/HeroBanner.test.tsx](../../../frontend/src/components/HeroBanner.test.tsx),
[backend/tests/test_config.py](../../../backend/tests/test_config.py),
existing [App.test.tsx](../../../frontend/src/App.test.tsx) regression
sanity check.

| Test file | Cases | Why |
|---|---|---|
| `frontend/src/components/HeroBanner.test.tsx` (NEW) | (1) splash renders eyebrow/headline/subtitle/hint from `copy`; (2) compact renders `compactTitle` + `compactSubtitle`; (3) splash and compact are mutually exclusive (no two `<h1>`s); (4) logo `aria-label` is present in both phases | Lock down what each phase shows; protects against accidental copy drift if the `HeroConfig` shape changes. |
| `backend/tests/test_config.py` (EDIT) | `test_config_endpoint_includes_hero_block` — see § A.3 | Locks the contract the frontend depends on. |
| `frontend/src/App.test.tsx` (READ-ONLY VERIFY) | Run existing tests; none should break. The prefix-matching regressions on `/codex` / `/selfish` (see [CLAUDE.md Gotcha 6](../../../CLAUDE.md)) are unaffected because parsing didn't change. | Catch regressions in mode-switching that the visual change might mask. |

What's *not* tested:
- Animation timing / easing — by convention, animation correctness is
  verified by eye at the dev server (per `CLAUDE.md`'s
  "type-checking verifies code correctness, not feature correctness").
- The latch (`hasEngaged`) timing — gets exercised end-to-end by the
  verification recipe.

### Test file skeleton (HeroBanner.test.tsx)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroBanner } from "@/components/HeroBanner";
import type { HeroConfig } from "@/types";

const COPY: HeroConfig = {
  eyebrow: "Live demo build",
  headline: "Recursive AI-driven software development",
  subtitle: "Architecting self-evolving systems.",
  hint: "Type a question to begin.",
};

describe("<HeroBanner />", () => {
  it("renders all hero copy on splash phase", () => {
    render(
      <HeroBanner phase="splash" copy={COPY} compactTitle="Ignored" compactSubtitle="Ignored" />
    );
    expect(screen.getByText(COPY.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(COPY.headline);
    expect(screen.getByText(COPY.subtitle)).toBeInTheDocument();
    expect(screen.getByText(COPY.hint)).toBeInTheDocument();
  });

  it("renders compact title / subtitle on compact phase", () => {
    render(
      <HeroBanner
        phase="compact"
        copy={COPY}
        compactTitle="Recursive AI-Driven SD"
        compactSubtitle="Talk demo"
      />
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Recursive AI-Driven SD");
    expect(screen.getByText("Talk demo")).toBeInTheDocument();
    expect(screen.queryByText(COPY.eyebrow)).not.toBeInTheDocument();
  });

  it("exposes a single H1 in either phase", () => {
    const { rerender } = render(
      <HeroBanner phase="splash" copy={COPY} compactTitle="X" compactSubtitle="Y" />
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    rerender(
      <HeroBanner phase="compact" copy={COPY} compactTitle="X" compactSubtitle="Y" />
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders an accessible logo in both phases", () => {
    const { rerender } = render(
      <HeroBanner phase="splash" copy={COPY} compactTitle="X" compactSubtitle="Y" />
    );
    expect(screen.getByRole("img", { name: /recursive demo logo/i })).toBeInTheDocument();
    rerender(
      <HeroBanner phase="compact" copy={COPY} compactTitle="X" compactSubtitle="Y" />
    );
    expect(screen.getByRole("img", { name: /recursive demo logo/i })).toBeInTheDocument();
  });
});
```

## F. Documentation refresh + ship verification

**Files:** [CLAUDE.md](../../../CLAUDE.md), [README.md](../../../README.md),
[architecture.mmd](../../../architecture.mmd),
`docs/plans/hero-banner/STATUS.md` (new).

### F.1 `CLAUDE.md` — Config split section

Append one line under "Config split" → `config.toml holds…`:

> Hero copy (eyebrow, headline, subtitle, hint) lives under
> `[ui.hero]` and is hot-reloaded through the existing
> `/api/config/stream` SSE channel. Self-evolve can edit it via
> dotted paths (`ui.hero.headline`, etc.).

### F.2 `README.md` — Frontend description (optional, small)

If the "Frontend" line in the project intro lists what the UI shows,
amend it to mention the splash hero. Keep the addition under 12
words.

### F.3 `architecture.mmd` — diagram node

The diagram lists frontend components today
(`Background`, `ChatInput`, `ResponseCard`, `ClaudeCodeStream`,
`SelfEvolveStream`). Add a `HeroBanner` node parallel to those, with
an arrow from `useConfig` (the SSE-driven hook) into it — that's the
most architecturally interesting edge because it's what closes the
`/self` → hero recursion loop.

If the diagram is coarser than that (e.g., it just says "Frontend
SPA"), skip this update.

### F.4 Status marker

After all phases ship and verification passes, write
`docs/plans/hero-banner/STATUS.md`:

```markdown
# Status: ✅ Done

Shipped: 2026-MM-DD

- [ui.hero] block live in config.toml, served via /api/config + SSE
- HeroBanner.tsx + LogoMark.tsx components landed in frontend/src/components/
- App.tsx derives phase from chat/cc/se status; latches on first engagement
- HeroBanner.test.tsx + test_config.py extensions passing
- CLAUDE.md "Config split" updated to mention [ui.hero]
- /self change the hero headline confirmed working live
```

## Tests

(Rolled into § E above — see that section for the full matrix.)

## Verification recipe

End-to-end after the plan lands:

```bash
# 1. Backend tests
cd backend && uv run pytest tests/test_config.py -v

# 2. Frontend tests + typecheck
cd ../frontend
npm test
npm run typecheck

# 3. Start the stack
# Terminal A
cd ../backend && uv run python -m app
# Terminal B
cd ../frontend && npm run dev

# 4. Manual smoke (browser at http://127.0.0.1:4329)
#    a. Hard refresh — splash hero fills the column with logo, eyebrow,
#       large gradient headline, subtitle, hint. Logo rotates slowly.
#    b. Type "hello" + Enter — splash collapses; compact header (small
#       logo + smaller gradient title + subtitle) sits above the chat
#       response.
#    c. Hard refresh — splash returns. Type "/code list files" — splash
#       collapses the same way.
#    d. Hard refresh again. Type "/self change the hero headline to
#       'Demo' " — confirm headline live-repaints in the splash without
#       a page refresh. Then engage chat to collapse.

# 5. Tail backend logs to confirm a single SSE config push fires when
#    /self lands the patch on ui.hero.headline. No NotImplementedError,
#    no "path not found" from the patcher.
```

If any step fails, debug before declaring the phase done; do not patch
over a broken step with a `// TODO` (per
[CLAUDE.md](../../../CLAUDE.md)'s "no half-finished implementations").

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `_set_dotted()` rejects `ui.hero.*` because the key didn't pre-exist | low | demo crashes mid-talk | § A.1 initializes the block with non-empty values; the patcher then walks the existing path fine. |
| `AnimatePresence mode="wait"` with `initial={false}` mounts the wrong variant on first paint | medium | splash invisible on cold load | Keep `initial={false}` only on the parent `AnimatePresence`; each `motion.section` / `motion.header` has its own `initial` so the splash animates in on cold load. Tested by the "renders all hero copy on splash phase" RTL case. |
| Live `/self` edit to `ui.hero.headline` while the page is on the *compact* render does nothing visible | medium | confusing demo moment | The compact render binds to `config.title` / `config.subtitle` (deliberate, see § D.2). Hero-only edits are visible only when the splash is showing — call this out in the talk script. If undesired, point the compact render at `config.hero.headline` / `config.hero.subtitle` instead (one-line change in `App.tsx`); the locked-decisions table still holds either way. |
| Splash hero hides the chat input on small viewports | low | unable to demo on a small laptop screen | Keep `py-16 sm:py-24` (compact on `<640px`); test on the talk laptop's actual resolution before the rehearsal. |
| Slow logo rotation distracts from the talk content | low | low | Trivially removable — drop `spinning` prop in `App.tsx`'s usage. No downstream changes. |
| `useEffect` latch for `hasEngaged` races with hook resets on mode-switch | low | hero re-expands unexpectedly | Latch is one-way (`true` only); a reset never trips the effect's condition. Covered by manual smoke step 4(c). |
| Existing `App.test.tsx` regressions (`/codex`, `/selfish` prefix matching) break because of the rewrite | low | red CI | The rewrite only replaces the `motion.header` block; `handleSubmit` / `parseInput` are untouched. Run `npm test` after § D to confirm. |

## Out of scope

Adjacent ideas that came up during the brainstorm but should NOT land
in this plan:

- **README banner SVG** (Framing C) — a future pass, after this ships.
- **Logo redesign / `brand/` directory / wordmark** (Framing D) — defer until the project's identity stabilizes.
- **Suggestion chips on the splash** (à la ChatGPT) — interesting follow-up; the splash is the natural surface.
- **`og:image` / social preview** — pairs with Framing C, not B.
- **"Back to splash" affordance** — refresh is the answer; a button is over-engineering.
- **Theme-preset / "talk mode" toggle in the hero** — `/self` already does this.
- **Animated background reacting to chat state** — `Background.tsx` stays non-interactive.
- **Splash hero as a route (`/hero`)** — single-page app; routes would balloon scope.

## Open implementation questions

Decisions to confirm at the start of the work, with recommendations:

1. **Compact render copy source: `ui.title` / `ui.subtitle`, or `ui.hero.headline` / `ui.hero.subtitle`?**
   Recommended: **`ui.title` / `ui.subtitle`** (current behavior). Keeps two
   editable surfaces (hero vs. chat-page header) so the demo can show
   them diverging. The risk row above describes the trade-off.

2. **Should `HeroConfig` be required or optional in `UiConfig`?**
   Recommended: **required.** Backend always serves it after § A; optional
   would push `??` fallbacks across the frontend for no gain.

3. **Logo: inline component (`LogoMark.tsx`) or `<img src="/favicon.svg" />`?**
   Recommended: **inline component.** CSS-var gradient stops only work
   in inline SVG; an `<img>` tag would freeze the brand colors to the
   `favicon.svg` literals and break the `/self` re-theming story.

4. **Splash phase styling: keep inside `max-w-2xl`, or widen?**
   Recommended: **keep `max-w-2xl` for this plan.** Wider hero is a feel
   tweak; revisit in a follow-up if the talk rehearsal calls for it.

5. **Logo idle rotation duration?**
   Recommended: **18s linear infinite.** Slow enough to read as "alive,"
   too slow to read as "loading." Adjust to taste during § C.2.

6. **Are there other surfaces (e.g., a future operator dashboard) that
   would benefit from `LogoMark`?**
   Recommended: **assume no for now.** `LogoMark` lives in
   `frontend/src/components/` (not in a `shared/` folder) until a
   second consumer materializes — premature abstraction otherwise.
