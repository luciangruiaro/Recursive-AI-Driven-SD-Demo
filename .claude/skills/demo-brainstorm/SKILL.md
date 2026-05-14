---
name: demo-brainstorm
description: Take a raw idea (any size — one sentence to multi-paragraph) and produce a comprehensive exploration document. Cross-references the project's existing docs and code, asks clarifying questions, surfaces multiple framings + industry references, captures risks + open questions, and lands ONE recommended forward path with a "what to invoke next" suggestion (often /demo-plan, sometimes a prototype). Exploratory, not prescriptive — demo-plan is what turns the chosen direction into actionable phases. Use when an idea is still fuzzy and you want options before committing.
argument-hint: <empty for interactive idea capture, or a free-text idea, or a path to an existing brainstorm to refine/extend>
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion, Agent, TodoWrite, WebSearch, WebFetch
user_invocable: true
---

# Brainstorm an idea — exploratory pass

Take an idea — however small or ambitious — and produce a Markdown
exploration that cross-checks the project's existing docs and
code, surfaces multiple framings, calls out industry references,
and lands a recommended forward path the user can refine or feed
into another skill.

The output is **exploratory, not prescriptive**. demo-plan is the
skill that turns the chosen direction into shippable phases;
demo-brainstorm is the upstream pass that picks the direction
worth committing to.

## Modes / argument shapes

| Argument shape | Mode | Output location |
|---|---|---|
| _empty_ | Interactive: skill asks "what do you want to brainstorm?" then runs greenfield mode | `<brainstorms-dir>/<slug>/<slug>.md` |
| Free-text idea (e.g. `add live collaboration to the SPA`) | Greenfield: full ideation flow | `<brainstorms-dir>/<slug>/<slug>.md` |
| Path to existing brainstorm (`.md` in the brainstorms dir) | Refinement: re-open + extend with new questions / discoveries | append a `## Update <date>` section to the same file |

`<brainstorms-dir>` is the project's brainstorm/exploration
directory (commonly `docs/brainstorms/`, `docs/explorations/`,
`docs/rfcs/`, or equivalent — fall back to `docs/brainstorms/` if
nothing exists yet, and confirm with the user before writing).

Slugs: lowercase, hyphenated, no dates. ✓ `multi-tenant-routing`
✗ `2026-04-30-routing-thoughts`.

## Hard rules

1. **Never write the brainstorm file before the user has approved
   the shape.** Output the framings + recommended-direction
   summary in chat first; only write to disk after explicit
   consent.
2. **Always brainstorm BEFORE narrowing.** Multiple framings are
   the deliverable. Three is a floor; five is a comfortable
   ceiling. A single-framing brainstorm is demo-plan in disguise
   — redirect the user to /demo-plan if their idea is already
   pinned.
3. **Cross-check the project before riffing.** Use Explore agents
   (parallel where useful) to find: existing docs that cover the
   topic; existing code that already partially solves it; prior
   plans / brainstorms that touched it; locked decisions
   captured in any project conventions doc (`CLAUDE.md`,
   `AGENTS.md`, `README.md`, `architecture.md`, `.claude/rules/`,
   ADRs — whichever the project uses). Cite file paths + line
   numbers — never handwave.
4. **Industry references are part of the deliverable.** If a
   framing maps to a well-trodden pattern (event sourcing, CQRS,
   actor model, sagas, etc.), name it. If a SaaS reference
   exists (GitHub PATs, Stripe Connect, Google Workspace
   account-chooser, etc.), cite it. WebSearch + WebFetch are
   allowed and encouraged when the LLM's training data is stale
   on a fast-moving area.
5. **Surface tensions, don't paper over them.** When two
   framings genuinely conflict (e.g. "centralised vs federated"),
   show the trade-off as a table; don't pick prematurely.
6. **One recommended direction at the end.** After exploring
   N framings, the doc lands a single "given the project's
   constraints + the user's intent + industry practice, this is
   the path most likely to ship cleanly" recommendation. Label
   the others "viable but deprioritised" with the trade-off
   explicitly stated.
7. **Always end with a hand-off.** The doc's final section says
   "next step: invoke /demo-plan against this brainstorm" OR
   "next step: build a 1-day spike for framing #2" OR similar.
   The user shouldn't have to guess what to do after reading.
8. **Out-of-scope is part of the doc.** Adjacent ideas surfaced
   during the brainstorm get a "Not exploring here" list so
   they're captured but explicitly deferred.
9. **Refinement mode is append-only.** When invoked on an
   existing brainstorm, add a new `## Update <YYYY-MM-DD>` block
   at the bottom — never rewrite earlier framings. History is
   the durable record of how thinking evolved.

## Output template

The shape every brainstorm follows. Don't deviate without a
reason.

```markdown
# Brainstorm: <Idea>

<2-3 sentence intent — quote the user's seed idea verbatim, then
a one-line gloss on what it means in project-context terms.>

**Slug:** `<slug>`
**Created:** <YYYY-MM-DD>
**Author:** <skill-invocation context — e.g. "user + demo-brainstorm">
**Status:** exploratory | refined | superseded

---

## Seed

> The user's input verbatim, including any caveats or tone they
> brought. Don't reword.

## Project context — what already exists

What the codebase + docs already say about this area. Cite:
- Existing implementation: `<file>:<line>` references
- Existing docs: project conventions doc, READMEs, ADRs
- Locked decisions in any rule files / decision records
- Prior plans / brainstorms that touch the same surface
- Modules, components, services that touch the same area

If something is missing entirely, say so explicitly: "No
existing surface covers <X>."

## Framings

For each framing (3-5 ideal):

### Framing A: <name>

**Mental model:** what worldview drives this framing. One
sentence.

**Industry reference:** where this has been done before (named
SaaS / OSS pattern / RFC / book chapter). One link or citation.

**Sketch:** 4-8 bullet points showing how the project would change
if this framing won. Concrete.

**Pros:** what this gets us.

**Cons / risks:** what could go wrong; what gets harder.

**Effort guess:** S / M / L / XL — order-of-magnitude only.

(Repeat for each framing.)

## Tensions

When two or more framings genuinely conflict, capture the
trade-off as a table:

| Dimension | Framing A | Framing B | Framing C |
|---|---|---|---|
| Latency | low | high | medium |
| Operational cost | high | low | medium |
| Locked-decision risk | high | medium | low |
| ... | ... | ... | ... |

## Open questions

Things this brainstorm couldn't answer; the user should resolve
before demo-plan converts a framing into phases. Each gets a
recommended-default in case the user wants to defer.

1. **<question>** — Recommended default: <answer>.

## Recommended direction

After weighing the framings against the project's locked
decisions, the user's tone, and industry practice: **Framing X**.

**Why this one:** 2-3 sentences explaining the call.

**Why not the others:** one sentence each. Don't reduce them to
strawmen — name the real reason they didn't win.

## Not exploring here

Adjacent ideas that surfaced during the brainstorm and explicitly
do NOT need exploring in this pass:

- **<idea>** — out of scope because <reason>.

## Next step

What the user should invoke next:

- `/demo-plan <brainstorms-dir>/<slug>/<slug>.md` —
  turn the recommended framing into phased work. *(Most common.)*
- "Build a 1-day spike for Framing Y first" — when an unknown
  needs a quick prototype before committing.
- Manual refinement — when the user wants to live with the doc
  for a few days and let it season.
```

## Procedure

### Phase 1 — Determine mode + capture intent

If args is empty, AskUserQuestion: "What do you want to
brainstorm? Give me the rough idea — a sentence or a paragraph.
The bigger the idea the more useful this skill is, but small
ideas work too."

If args is a path inside the brainstorms directory: read it,
treat as refinement mode, ask "what new angle do you want to
explore?".

Otherwise: take args as the seed idea.

### Phase 2 — Brainstorm + clarify (3–7 questions)

Use AskUserQuestion to pin down what's vague. Default questions:

- **Audience.** Who benefits — end user / developer / operator
  / a future module? Different audiences pull the framings in
  different directions.
- **Scope sniff.** Does this touch one subsystem or
  cross-cutting? Single feature or framework-level shift?
- **Constraints / locked-decisions to honour.** Anything in the
  project's conventions doc or ADRs the user wants to push
  against, or anything that must stay invariant?
- **Time horizon.** Ship-this-quarter vs. north-star vision
  framings need different shapes.
- **Why now.** What surfaced this idea today? (The answer
  often reveals the un-named real constraint.)

Conditional follow-ups:
- If the idea is technical — ask which existing pattern feels
  closest.
- If it's UX — ask what the "after" demo would look like.
- If it's architectural — ask whether the user wants to evaluate
  3 existing precedents or generate 3 fresh framings.

Cap at 7 total. More is procrastination.

### Phase 3 — Codebase + history research (parallel Explore agents)

Launch up to 3 Explore agents in parallel:

- **Existing surface** — find every code path, doc, and prior
  plan that touches this area. Returns a "what already exists"
  briefing.
- **Locked decisions in scope** — read the project conventions
  doc + any rule/ADR files for any rule that constrains the
  framings.
- **Prior brainstorms / plans** — search the brainstorms and
  plans directories (commonly `docs/brainstorms/`, `docs/plans/`,
  `docs/rfcs/`, or equivalent) for related history.

For ideas where industry practice matters (event sourcing,
streaming, multi-tenancy, agent protocols, etc.), supplement with
WebSearch + WebFetch — the LLM's training is often stale on
fast-moving SaaS patterns.

### Phase 4 — Synthesise framings + recommendation

Decide:

1. **3-5 framings** — distinct mental models, each with a real
   industry reference (or the explicit "no precedent; novel
   ground" callout).
2. **Tensions** — if any two framings genuinely conflict, capture
   the trade-off table.
3. **Open questions** — what the brainstorm can't answer; each
   gets a recommended default.
4. **One recommended direction** — the framing most likely to
   ship cleanly given the project's constraints + the user's
   intent.
5. **Hand-off** — what skill (or manual step) comes next.

### Phase 5 — Validate with the user before writing

Post a compact summary to chat:

```
Proposed brainstorm: <slug>
Mode: greenfield | refinement
Framings (N): A. ... | B. ... | C. ...
Recommended: <framing-name> + reason in one sentence
Open questions: <count>
Output: <brainstorms-dir>/<slug>/<slug>.md
```

Ask: "Ship this? Or want to redirect a framing / add a new one
before I write?"

The cost of editing an outline in chat is far smaller than
editing a written file — make the redirect cheap.

### Phase 6 — Write the brainstorm file

On approval, render the full doc using the template and write
to disk. File naming:

| Mode | Path |
|---|---|
| Greenfield | `<brainstorms-dir>/<slug>/<slug>.md` |
| Refinement | append a `## Update <YYYY-MM-DD>` section to the existing file |

If a sibling `STATUS.md` would help (the brainstorm has a clear
"superseded by /plans/X" outcome), write that too.

### Phase 7 — Hand off

After writing, surface:

```
✓ Brainstorm written to <path>
  - <N> framings explored
  - Recommended: <framing-name>
  - <K> open questions to resolve
  - Suggested next step: /demo-plan <path>   (or other)

The brainstorm is exploratory. It's safe to live with for a
few days before committing — re-invoke /demo-brainstorm <path>
to add a new angle, or /demo-plan <path> when ready to phase.
```

Don't auto-invoke the next skill. The user picks the cadence.

## Anti-patterns

- ❌ **Single-framing brainstorm.** If you can only see one
  way to do this, the user already has a plan; redirect them to
  /demo-plan.
- ❌ **Reducing every framing to a strawman so one wins.** Name
  the real reason each lost. "Costs more than expected" is a
  reason; "is bad" is not.
- ❌ **Skipping project research because the idea "sounds clear".**
  The codebase always has prior art that shapes which framings
  are realistic.
- ❌ **Pretending to know the answer to every open question.**
  Some questions are genuinely open; capture them with
  recommended defaults and let the user choose.
- ❌ **Writing the file before showing the outline.** The user's
  redirect is far cheaper at outline stage.
- ❌ **Output that overlaps demo-plan.** Brainstorm is "what could
  this be?"; demo-plan is "how do we ship this specific shape?".
  Keep the boundary clean — no phase tables, no slice letters,
  no verification recipe.
- ❌ **Auto-invoking the next skill.** Hand off; let the user
  pace.

## When to invoke

- "I'm not sure what we want here yet — let me throw an idea and
  you brainstorm it."
- "Take this fuzzy idea and tell me three good framings before I
  pick one."
- "Cross-check this against the project and see if anything
  obvious blocks it."
- "I want to know what industry practice looks like for X before
  we commit to a plan."
- After /demo-doc-audit surfaces a gap: brainstorm before planning
  if the gap is broad / unclear in shape.

## When NOT to invoke

- The user already knows the framing they want. Run /demo-plan.
- The work is genuinely tiny (a typo, a one-line refactor). Just
  do it.
- The user is debugging a real production issue. Run /demo-debug.
- The output of the brainstorm would be < 100 words. That's a
  chat reply, not a document.

## Worked example

User invokes `/demo-brainstorm should we add real-time notifications
when a long-running job completes`.

**Phase 1**: Greenfield, free-text.

**Phase 2**: Asks 5 questions — audience (end users + admins),
scope sniff (job runner + frontend), constraints (existing job
runner is polled, no message broker yet), time horizon (this
quarter), why now (users complaining about manual refresh).

**Phase 3**: Three Explore agents in parallel:
- Existing surface: job runner module, the polling endpoint, the
  frontend page that displays job state.
- Locked decisions: the project ADRs note "no new infra
  dependencies without sign-off"; existing tech is stateless HTTP.
- Prior brainstorms: none on notifications.

**Phase 4**: Three framings:
- A. Server-Sent Events stream from the existing API. Industry
  ref: GitHub Actions logs.
- B. WebSocket gateway as a new service. Industry ref: Slack
  message events.
- C. Email + in-app toast on next page load (no realtime).
  Industry ref: GitHub PR notifications.

Tensions table: ops complexity vs UX immediacy vs infra ADR cost.

Recommended: **A** — SSE rides on the existing HTTP stack;
zero new infra, ships in days, fits the ADR.

**Phase 5**: Posts the outline. User accepts but adds a question
"what about jobs that span more than 5 minutes — does the SSE
connection need keep-alive tuning?". Skill adds it as Open
Question #4.

**Phase 6**: Writes
`docs/brainstorms/realtime-job-notifications/realtime-job-notifications.md`.

**Phase 7**: Hands off. Suggests `/demo-plan
docs/brainstorms/realtime-job-notifications/realtime-job-notifications.md`
when the user is ready to phase the work.

## See also

- [`demo-plan`](../demo-plan/SKILL.md) — the natural follow-on once
  a framing is picked.
- [`demo-doc-audit`](../demo-doc-audit/SKILL.md) — complementary;
  doc-audit gaps often become brainstorm seeds.
- [`demo-spec-verify`](../demo-spec-verify/SKILL.md) — verify a
  brainstorm's recommended framing against current code before
  demo-plan turns it into phases.
