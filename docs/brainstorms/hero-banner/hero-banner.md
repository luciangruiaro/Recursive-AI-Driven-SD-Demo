# Brainstorm: Hero Banner

> "I need to add a hero banner in the repo."

A hero banner could land in three different surfaces of this project, and each one serves a different purpose. This brainstorm picks them apart, weighs them against the project's reality (a live-coding talk demo with a single chat UI and a backend-driven theme), and recommends one to commit to.

**Slug:** `hero-banner`
**Created:** 2026-05-14
**Author:** user + demo-brainstorm
**Status:** exploratory

---

## Seed

> I need to add a hero banner in the repo

The request is short and surface-agnostic. "Hero banner" is a loaded term — in the wild it means anything from a `<img>` at the top of a GitHub README, to a full-bleed marketing landing section, to an animated splash screen on first paint. This repo is a live-coding companion for a conference talk, so the framing matters a lot: a hero seen on a projector during a talk lands very differently than a hero seen on github.com.

## Project context — what already exists

**Repo shape.** Two-service workspace:

- **Backend** ([backend/](backend/)) — Python 3.11 + FastAPI. Serves `/api/config` (theme + copy) and the chat endpoint that talks to OpenAI.
- **Frontend** ([frontend/](frontend/)) — React 18 + Vite 5 + TypeScript + Tailwind v4 + Framer Motion 11. Single-page chat UI.

**Current "hero-shaped" surface.** [frontend/src/App.tsx:117-147](frontend/src/App.tsx) — a `motion.header` block:

- `<h1>` with gradient text (`config.title`)
- `<p>` subtitle (`config.subtitle`)
- Fade-in animation: `initial={{ opacity: 0, y: -12 }}`, `transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}`
- Lives inside a `max-w-2xl mx-auto` centered column. No full-bleed sections exist anywhere.

**Backend-driven theme.** [backend/config.toml:38-61](backend/config.toml) defines title, subtitle, fonts (Inter / JetBrains Mono), and a 12-color palette (`#0a0a0f` background, `#8b5cf6` primary purple, `#06b6d4` accent cyan, gray scale). The frontend pulls these via `/api/config` and applies them as CSS variables in [frontend/src/theme/ThemeProvider.tsx:14-25](frontend/src/theme/ThemeProvider.tsx). **Any hero must use `var(--color-*)` and `var(--font-*)`** — no hardcoded hex.

**Decorative background.** [frontend/src/components/Background.tsx](frontend/src/components/Background.tsx) renders two blurred gradient orbs + a faint grid, `aria-hidden`, `pointer-events-none`, `fixed inset-0 -z-10`. Any hero will sit on top of this, not replace it.

**README state.** [README.md](README.md) starts with `# Recursive AI-Driven Software Development — Demo` followed by a two-service description. No banner, no badges, no logo block.

**Assets.** Only [frontend/public/favicon.svg](frontend/public/favicon.svg) — a recursive-arrow icon with the project's purple→cyan gradient. The natural seed for any logo work.

**Hero-shaped code that already exists.** None. Grep for `Hero|Banner|Splash|Landing|Jumbotron|MastHead|Cover` returns zero matches in `frontend/src/`.

**Prior brainstorms / plans / ADRs.** None. `docs/brainstorms/`, `docs/plans/`, `docs/rfcs/`, `docs/decisions/`, `.claude/brainstorms/` — all absent. No `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `STYLE.md`, or `BRAND.md` at the repo root. This is the first design-decision artifact the project will have.

**Tech-stack reality that constrains framings.** No new UI dependencies expected (the stack is intentionally thin: React + Framer Motion + Lucide React + Tailwind). Bundle stays small. Tests colocated (`Component.test.tsx`). Easing curve `[0.22, 1, 0.36, 1]` is the in-house standard.

## Framings

### Framing A: Polish the existing header into a hero block

**Mental model:** "Hero" = upgrade the current header in place. The animated `motion.header` already exists; lift it to feel deliberate rather than utilitarian.

**Industry reference:** [Vercel's product pages](https://vercel.com) and [Linear's homepage](https://linear.app) — both lean on a tight centered hero (logo mark + gradient title + one-line subtitle + a single CTA) without taking the whole viewport. The pattern fits a `max-w-2xl` column.

**Sketch:**
- Add an SVG logo mark above the title (scaled-up recursive-arrow from the existing favicon).
- Increase title size on `sm:` and add a soft gradient glow behind the `<h1>`.
- Add a small "tagline chip" or version pill below the subtitle (e.g. "v0.2 · Live demo build").
- Refine the entrance animation — stagger logo → title → subtitle with Framer Motion variants.
- Keep everything inside `max-w-2xl`; no layout overhaul.
- Title/subtitle still pulled from `/api/config`.

**Pros:**
- Smallest risk. Zero new state. Doesn't disrupt the chat flow.
- Reuses existing animation primitives and the easing curve.
- Backend-themable preserved.

**Cons / risks:**
- Demo-visual impact is incremental — the audience may not notice during a talk.
- Doesn't address README / GitHub-front-door at all.
- Once the user types and a response renders, the hero is still just sitting there above the chat — feels static.

**Effort guess:** S.

---

### Framing B: Pre-chat splash hero that collapses on engagement

**Mental model:** "Hero" = a first-paint moment of identity. Big, centered, full-viewport on initial load; collapses into a compact header the instant the user starts typing or sends the first message.

**Industry reference:** [ChatGPT's empty-state landing](https://chatgpt.com) (model name + suggestion chips on a centered card, replaced by chat as soon as you engage). Also [Cursor's first-launch onboarding](https://cursor.com) and [Linear's empty-state hero](https://linear.app). The "ceremonial splash that decays into chrome" pattern.

**Sketch:**
- New component `frontend/src/components/HeroBanner.tsx` (with colocated test).
- On first paint: full-viewport centered block — large logo mark, oversized gradient title, subtitle, a soft hint ("Type a question to begin").
- Drive state from `useChatState()` (or whichever store backs `ChatInput`): `phase === 'idle'` shows splash, `phase === 'engaged'` collapses into the existing compact header.
- Use Framer Motion `<AnimatePresence>` + `layout` prop with the in-house easing curve so the collapse feels designed, not abrupt.
- Title/subtitle/hint all from `/api/config` so the talk can re-theme it live (consistent with [c27dde3](#) "Added real time config updates in UI" — themability is a load-bearing feature here, not a nice-to-have).
- Use the existing `favicon.svg` mark, rendered inline at a larger size, with a subtle Framer Motion idle animation (slow rotation or pulse).

**Pros:**
- Maximum talk-time impact — the audience sees a polished "intro" before the demo gets to work.
- Reinforces the repo's identity as a *demo* (the splash is the demo's opening shot).
- Works with the existing real-time config story: re-themability during the talk is a feature.
- Uses tools already in the stack (Framer Motion `AnimatePresence` + `layout`).
- The collapse → header transition is itself a small visual moment that justifies the hero.

**Cons / risks:**
- Adds one piece of state (phase / engaged). Manageable but non-zero.
- Browser refresh mid-demo resets to splash — could be a feature or a footgun depending on talk flow.
- More moving parts to test than Framing A (idle render, engaged render, transition).
- Doesn't ship the README front-door.

**Effort guess:** M.

---

### Framing C: README banner only (GitHub front door)

**Mental model:** "Hero" = the first thing a visitor sees on github.com when they open the repo. Living app stays untouched.

**Industry reference:** [shadcn/ui's README header](https://github.com/shadcn-ui/ui), [Vercel SDK](https://github.com/vercel/ai), [Next.js](https://github.com/vercel/next.js) — all open with a centered SVG banner + tagline + badge row. Treats the README as a landing page.

**Sketch:**
- Design an SVG banner (~1280×320) using the existing palette and the recursive-arrow mark. Light + dark variants via `prefers-color-scheme`.
- Store in `docs/assets/hero-banner.svg` (new directory) or `frontend/public/hero-banner.svg`.
- Embed at the top of [README.md](README.md) above the `# Recursive AI-Driven Software Development — Demo` heading.
- Optionally add a badge row (build status, license, stack icons) under the banner.
- Reuse the same asset as the repo's social-preview image (GitHub Settings → Social preview, or via `og:image` if the project later adds a marketing site).

**Pros:**
- Zero impact on the running app — no risk of breaking the demo before a talk.
- Improves GitHub presentation, which matters for viewers who arrive *after* the talk (search, link sharing, social posts).
- One-time design work; doesn't need to track app changes.
- Doubles as a social-preview asset.

**Cons / risks:**
- Zero demo-talk impact — the audience never sees the README during the talk.
- Requires graphic-design work (SVG composition), which is a different skillset than the rest of the codebase.
- Static — doesn't benefit from the real-time theme story.

**Effort guess:** S (if a designer or AI-assisted SVG is used; M if hand-crafted from scratch).

---

### Framing D: Unified brand pass — UI hero + README banner + favicon as one identity

**Mental model:** "Hero" = a brand-identity moment. Stop treating the favicon, the README, and the app header as three separate things; design them as one mark applied across all three.

**Industry reference:** [Stripe's brand system](https://stripe.com/about/brand), [Tailwind CSS's identity](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) — projects where the logo, favicon, README banner, and in-app branding are all one coherent system. The hero isn't "an element," it's "the project showing up consistently everywhere."

**Sketch:**
- Phase 1 — design pass: refine the recursive-arrow into a proper logo mark (wordmark + symbol). Outputs: `brand/logo.svg`, `brand/logo-mark.svg`, `brand/wordmark.svg`, `brand/hero-banner.svg`.
- Phase 2 — apply to UI: implement Framing B (splash hero) using the new logo mark.
- Phase 3 — apply to README: embed the banner SVG from Framing C.
- Phase 4 — update favicon to match the new mark. Possibly add `apple-touch-icon.png`, `og:image`, manifest icons.
- Optional: a `brand/README.md` with usage guidelines (which mark where, color rules, clear-space).

**Pros:**
- One design pass solves all three surfaces — talk demo, GitHub front door, browser tab.
- Coherence is the highest-quality outcome: every touchpoint reinforces every other.
- The `brand/` directory becomes a durable artifact that future contributors can pull from.

**Cons / risks:**
- Largest scope by far — likely overshoots the user's stated intent ("a hero banner") into "a brand system".
- Front-loads design work before any visual ship.
- Risk of bikeshedding on logo choices delaying the actual UI/README work.
- Hard to call "done" — brand work always has one more polish pass.

**Effort guess:** L.

## Tensions

The framings genuinely conflict on which surface to optimize for and on effort. The table makes the trade-off concrete:

| Dimension                | A: Polish header | B: Splash hero | C: README banner | D: Unified brand |
| ------------------------ | :--------------: | :------------: | :--------------: | :--------------: |
| Talk-time visual impact  | low              | **high**       | none             | high             |
| GitHub-front-door impact | none             | none           | **high**         | high             |
| New state to manage      | none             | one phase      | none             | one phase        |
| Asset / design cost      | very low         | low            | medium           | **high**         |
| Touches running UI       | yes              | yes            | no               | yes              |
| Risk to live demo        | very low         | low            | none             | low              |
| Effort                   | S                | M              | S                | L                |
| Re-themable at talk time | yes              | yes            | no               | partial          |
| Coherence across surfaces| low              | medium         | low              | **high**         |

The two dimensions that dominate: **talk-time impact** (since this repo is a talk companion) and **effort** (since the user's seed is one sentence). B wins on impact-per-effort; D wins on coherence but at a much steeper cost.

## Open questions

1. **Target surface — UI, README, or both?** Recommended default: **UI**, because this repo is a *talk demo* and the audience sees the app, not GitHub. If the priority is post-talk discoverability instead, swap to Framing C or layer it on later.

2. **Logo asset — extend the existing favicon mark, or design a new one?** Recommended default: **extend the existing mark.** The recursive-arrow already encodes the project's metaphor (recursion) and the brand colors. A new mark belongs in a Framing D pass, not here.

3. **Hero collapse behavior — should the hero stay visible after first chat message, or shrink to the existing compact header?** Recommended default: **shrink.** Lingering hero feels static once chat is active; the collapse moment itself is part of what makes the splash feel intentional.

4. **Should hero copy live in `/api/config` or be hardcoded?** Recommended default: **`/api/config`.** Real-time config updates ([c27dde3](#)) are a load-bearing feature of this demo. Hardcoding hero copy would break that promise.

## Recommended direction

**Framing B — pre-chat splash hero that collapses on engagement.**

**Why this one:** The repo's primary purpose is being shown to a live audience during a talk. Of the four framings, B is the only one whose value lands during the talk's opening moments. It rides on tooling already in the stack (Framer Motion `AnimatePresence` + `layout`, the in-house easing curve, the backend-driven theme), so it doesn't introduce new dependencies or break the "thin stack" posture. The collapse-on-engagement motion is itself a piece of the demo — a visible affordance that "this app is alive and reacts to you," which thematically rhymes with the talk's "self-evolving systems" subtitle. M-effort is the right size for a one-sentence seed: bigger than a header tweak, smaller than a brand pass.

**Why not the others:**
- **A** is the safest call but doesn't move the needle visibly during a talk — the audience won't see the difference from the back of the room.
- **C** optimizes for the wrong audience (GitHub viewers, not talk attendees). Good as a follow-up after the talk demo lands; wrong as the primary pass.
- **D** is the right destination if this project graduates from "talk demo" into "shipped product," but it front-loads design work that delays any visible ship and risks bikeshedding on logo choices that don't matter yet.

## Not exploring here

Adjacent ideas that surfaced and are explicitly out of scope for this brainstorm:

- **Marketing landing page / multi-page navigation** — out of scope; the app is intentionally a single chat UI and that's load-bearing for the demo.
- **og:image / social-preview metadata** — related to Framing C; defer to a follow-up pass after the recommended direction ships.
- **Logo redesign / full brand system (the `brand/` directory)** — Framing D territory; defer until the project's identity stabilizes.
- **Suggestion chips on empty state** (à la ChatGPT prompt suggestions) — interesting but a different feature; if added later, the splash hero is the natural surface for them.
- **Theme presets / "talk mode" toggle** in the hero (e.g., a button that flips palette during the demo) — clever, but speculative; let real-time config updates already in place do that work.
- **Animated background tied to chat state** (e.g., orbs that pulse on streaming) — out of scope; the `Background.tsx` orbs are intentionally non-interactive.

## Next step

`/demo-plan docs/brainstorms/hero-banner/hero-banner.md`

This will turn Framing B (splash hero → collapse) into phased work. Expect the plan to cover: the new `HeroBanner.tsx` component, the chat-phase state hook, the splash → header transition, theming + config wiring, tests, and any small backend changes (a `hero` block in `config.toml` if hero copy ends up distinct from title/subtitle).

Alternatives if the redirect comes:
- `/demo-plan` with explicit instruction to use Framing **A** instead (smallest-possible header polish).
- `/demo-plan` with explicit instruction to use Framing **C** instead (README banner; design pass for `docs/assets/hero-banner.svg`).
- Live with this doc for a few days and re-invoke `/demo-brainstorm docs/brainstorms/hero-banner/hero-banner.md` to add a new angle.
