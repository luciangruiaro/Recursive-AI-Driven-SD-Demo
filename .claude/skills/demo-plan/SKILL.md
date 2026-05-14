---
name: demo-plan
description: Turn a raw idea (or an existing plan's phase) into a detailed, implementable Markdown plan. Two modes — greenfield (idea → roadmap) and refinement (existing phase → ship-in-one-session sub-plan). Asks clarifying questions, surfaces locked decisions, slices into phased work, integrates testing + doc-refresh, and writes a plan that any developer can pick up at any seam. Use when an idea is shaped enough to commit to phases.
argument-hint: <empty for interactive idea capture, or a free-text idea, or a path to an existing plan markdown file to refine>
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion, Agent, TodoWrite
user_invocable: true
---

# Plan a feature, refactor, or rollout

Take a raw idea or an existing phase plan and produce a Markdown
file that's detailed enough for any developer to pick up at any
seam, with testing + documentation refresh built into the plan
itself.

The skill operates in **two modes**, picked from the argument:

| Argument shape | Mode | Output location |
|---|---|---|
| _empty_ | Interactive: skill asks "what do you want to plan?" then runs greenfield mode | `<plans-dir>/<slug>/<slug>.md` |
| Free-text idea (e.g. `add channel routing for notifications`) | Greenfield: full ideation flow | `<plans-dir>/<slug>/<slug>.md` |
| Path to existing plan (`.md` in the plans dir) | Refinement: expand a phase / epic into a ship-in-one-session sub-plan | `<plans-dir>/<parent>/phases/<phase-slug>.md` (or wherever the parent points) |
| Path to a parent roadmap with multiple phases | Refinement: ask which phase, then expand that one | as above |

`<plans-dir>` is the project's plans/specs directory (commonly
`docs/plans/`, `docs/rfcs/`, or equivalent — fall back to
`docs/plans/` and confirm with the user before writing).

## Hard rules

1. **Never write the plan file before the user has approved the
   shape.** Output the locked-decisions table + section outline in
   chat first; only write to disk after explicit consent.
2. **Always brainstorm before designing.** Ask 3–7 clarifying
   questions to pin down scope, audience, success criteria, and
   constraints. A vague idea produces a vague plan.
3. **Always read the codebase before proposing files / paths.**
   Use Explore agents (parallel where useful) to find existing
   patterns to mirror, existing helpers to reuse, and existing
   conventions to honour. Don't invent new structure when the
   project already has one.
4. **Slice phases small enough to ship in one focused session.**
   For refinement mode in particular: a phase that takes more
   than ~3 days of focused work should be re-sliced. The user
   explicitly wants sub-plans they can implement "in a shot".
5. **Testing + docs are deliverables, not afterthoughts.** Every
   phase plan has an explicit test section AND a doc-update
   section (or rolls those into deliverables). No exceptions.
6. **Every plan is pickup-able at any seam.** State what's already
   done, what's locked, what dependencies must land first. The
   target reader is a developer joining the work cold.
7. **When implementation lands, write a `STATUS.md`** next to the
   parent roadmap. Header is `# Status: ✅ Done` / `🚧 In Progress`
   / `❌ Superseded`; body has a `Shipped:` date + 3–6 scope-landed
   bullets. When this skill is invoked on a plan whose
   implementation is complete, offer to write the marker.

## Plan template (the shape every output follows)

This is the canonical structure for every plan this skill writes.

```markdown
# <Feature> [— Phase N: <subtitle>]

<2-3 sentence intent>

**Parent roadmap:** [link if part of a larger plan]
**Detailed Phase X:** [link to dependency phases if any]
**Effort:** S / M / L (rough — how many focused work-days)
**Depends on:** <other phases / features that must land first>
**Blocks:** <what's waiting on this>

---

## Context

What's the current state, what gap does this close, who benefits.
Quote concrete file paths + line numbers from the codebase to
anchor the reader in reality.

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| ... | ... | ... |

(Capture every "we discussed and chose X over Y" call from the
brainstorm. This table is the single most important section —
it stops the same debates re-opening every time someone picks up
the work.)

## Deliverables

| Kind | What | Files |
|---|---|---|
| API type | ... | path/to/file |
| Backend route | ... | ... |
| Frontend hook | ... | ... |
| Test | ... | ... |
| Doc | ... | ... |

## A. <First implementation slice>

Narrative + code sketches. Sections lettered A/B/C... in the order
they should be implemented. Each section is a concrete unit of
work — a developer can stop after any letter and the tree still
compiles.

## B. <Second slice>
...

## Tests

| Test file | Cases | Why |
|---|---|---|
| ... | ... | ... |

(Or roll into the lettered sections if the test work is naturally
co-located with the implementation.)

## Documentation updates

Which docs change because of this plan, and how:
- `architecture.md` — add subsystem diagram
- user-facing docs (e.g. `docs/user/`, `docs/operator/`) — new playbook for X
- `CHANGELOG.md` — release notes per the project's bump cadence
- ...

## Verification recipe

End-to-end test sequence after the plan lands. The reviewer should
be able to copy-paste this and confirm the work shipped:

```bash
# 1. ...
# 2. ...
# 3. ...
```

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ... | ... | ... | ... |

## Out of scope

Explicit "we're NOT doing X here" list so reviewers don't push
adjacent work into this phase.

## Open implementation questions

Decisions to make at the start of the work, captured here so they
don't surprise mid-flight:

1. **...** Recommended: ...
2. **...** Recommended: ...
```

The template is opinionated and battle-tested. Don't deviate
without a reason.

## Procedure

### Phase 1 — Determine mode + capture intent

If `$ARGUMENTS` is empty, AskUserQuestion: "What do you want to
plan? Give me the rough idea (1–2 sentences) — I'll ask
clarifying questions before I commit it to a file."

If `$ARGUMENTS` is a path to an existing `.md` in the plans
directory:

- Read it.
- If it's a parent roadmap (multiple `## Phase N` sections):
  AskUserQuestion: "Which phase should I expand into a detailed
  sub-plan?"
- If it's already a phase plan: confirm we're refining further (a
  phase plan can spawn sub-plans for sub-tasks).

If `$ARGUMENTS` is free text: take it as the idea.

### Phase 2 — Brainstorm + clarify (3–7 questions)

This is where vague becomes concrete. Use AskUserQuestion to ask:

**Always-ask (greenfield)**:
- **Audience**: who benefits — end user / developer / operator /
  AI agent? Different audiences imply different deliverables.
- **Outcome**: what's the user-visible change after this lands?
  Be concrete. ("Operator can rotate SSO secrets from the UI" is
  concrete; "improve auth UX" is not.)
- **Scope sniff**: rough size — touch one file, one subsystem, or
  cross-cutting?
- **Constraints**: timeline, breaking changes allowed, performance
  requirements, security boundaries.

**Conditional**:
- If touches auth/permissions → "what permission scope + level
  gates this?"
- If touches the DB → "is this additive or does it migrate
  existing rows?"
- If touches the UI → "should this be visible to all roles or
  gated?"
- If touches third-party providers → "which providers must
  support it on day one vs. later?"

**Refinement mode** asks fewer questions (the parent plan already
locked many decisions):
- "Anything in the parent's locked-decisions table you want to
  override for this phase?"
- "Are there sub-tasks within this phase that should split into
  their own ship-in-one-session sub-plans?"

Cap at 7 total questions — more is procrastination.

### Phase 3 — Codebase research (parallel Explore agents where helpful)

Before designing, understand the surface area. Launch Explore
agents in parallel for:

- **Existing patterns to mirror** — find an analogous feature
  already in the project (e.g. if planning a new third-party
  integration, read the closest existing one end-to-end).
- **Helpers to reuse** — shared utility folders (commonly
  `lib/`, `core/`, `shared/`, `utils/`, `_base/`) often have the
  cross-cutting helpers. Don't reinvent.
- **Conventions to honour** — read the project conventions doc
  (`CLAUDE.md`, `AGENTS.md`, `README.md`, `architecture.md`,
  ADRs, `.claude/rules/`, or equivalent) for the project's
  locked decisions.

For refinement mode: ALSO read every prior phase's plan + any
shipped code from prior phases. The current phase inherits all
their locked decisions.

Capture findings into a compact "what already exists" briefing —
this becomes the **Context** section of the plan.

### Phase 4 — Synthesise the design

Decide:

1. **Locked decisions** — every "X over Y, because Z" call. This
   table is the single most important deliverable; it's the
   anti-bikeshedding guard for whoever picks up the work.
2. **Deliverables** — concrete file list with paths relative to
   repo root. Mark each as NEW / EDIT.
3. **Phases / slices** — break the work into A/B/C... ordered
   sections. Each section should be ~half a day of focused work
   for the implementer. If a section feels bigger, sub-slice it.
4. **Tests** — what to test, where the test file goes, what the
   key assertions are.
5. **Doc updates** — which existing docs change, what new docs
   land. Reference `demo-doc-audit` workflow if the doc audit is
   sufficiently large.
6. **Verification recipe** — copy-paste-able end-to-end smoke
   after the work lands.
7. **Risks & mitigations** — anything that could derail the work
   or break adjacent systems.
8. **Out of scope** — adjacent ideas that came up during the
   brainstorm but should NOT land in this plan.
9. **Open implementation questions** — last-mile decisions to
   resolve when the implementer starts. Each gets a recommended
   answer.

### Phase 5 — Validate with the user before writing

Before any file write, post a compact summary to the chat:

```
Proposed plan: <feature name>
Mode: greenfield | refinement (under parent: <parent>)
Effort: S / M / L
Locked decisions (N): ...
Phases / slices (N): A. ... | B. ... | C. ...
Deliverables: <file count> files (X new, Y edited)
```

Ask: "Ship this to `<plans-dir>/<slug>/...md`? Or want to
redirect any decision before I write?"

Make the redirect cheap — the cost of editing an outline in chat
is far smaller than re-doing a written file.

### Phase 6 — Write the plan file

Once approved, render the full plan using the template and write
to disk. File naming:

| Mode | Path |
|---|---|
| Greenfield (standalone idea) | `<plans-dir>/<feature-slug>/<feature-slug>.md` |
| Greenfield (multi-phase rollout) | `<plans-dir>/<feature-slug>/<feature-slug>.md` (parent roadmap) + `<plans-dir>/<feature-slug>/phases/phase-N-<slug>.md` (each phase, optionally written in a follow-up `demo-plan` invocation per phase) |
| Refinement | `<plans-dir>/<parent-slug>/phases/<phase-slug>.md` (replacing or alongside the existing parent's phase entry) |

Slugs: lowercase, hyphenated, no dates.
- ✓ `multi-tenant-orgs`
- ✓ `channel-routing`
- ✗ `2026-04-30-jira-fix` (no dates — they go stale)

### Phase 7 — Hand off

After writing, surface:

```
✓ Plan written to <path>
  - <N> phases / slices
  - <M> deliverables
  - <K> open questions to resolve at start of work

Next steps:
  - Review the file end-to-end (skim + spot-check the locked
    decisions table for anything you'd argue with).
  - When ready to implement: pick the first slice (A), write the
    code, run the verification recipe, commit via demo-group-and-commit.
  - To deepen any phase further, run /demo-plan <path-to-this-file>
    again — same skill, refinement mode.
```

Don't auto-implement. Don't auto-commit the plan file. The user
controls the cadence.

## Anti-patterns

- ❌ **Writing the plan before brainstorming.** A 500-line plan
  built on a misread idea is worse than a 50-line one built on the
  right premise.
- ❌ **Skipping clarifying questions because the idea "sounds
  clear".** It rarely is. Ask the cheap questions up front.
- ❌ **Inventing structure when the project already has it.** Read
  the patterns before proposing new ones.
- ❌ **Phases that take a week of focused work.** Re-slice.
- ❌ **"TODO: add tests later" sections.** Tests are a deliverable;
  if they're not in the plan they won't get written.
- ❌ **Plans without a verification recipe.** A reviewer who can't
  smoke-test the change can't approve the plan.
- ❌ **Plans without an explicit "out of scope" list.** Adjacent
  ideas creep in during implementation; the list is the rebuttal.
- ❌ **Hand-coded decisions without rationale.** Every locked
  decision needs the *because* — otherwise the next person re-opens
  the debate.
- ❌ **Auto-implementing after writing the plan.** The user
  reviews, then triggers implementation explicitly.
- ❌ **Echoing the user's idea back as the plan.** The skill is a
  thinking partner, not a stenographer.

## When to invoke

- "Plan a new feature" / "design a rollout" / "let's draft a phased
  approach for X"
- "Take this idea and turn it into a real plan"
- "Re-plan phase 4 of the <feature> roadmap — I want a more
  detailed sub-plan I can implement in a shot"
- "What's the right architectural approach for X here?"
- After `demo-doc-audit` surfaces gaps — use `demo-plan` to scope
  the doc-fill work.
- After `demo-brainstorm` lands a recommended framing — `demo-plan`
  takes it the next step into shippable phases.

## When NOT to invoke

- The user already knows exactly what to do and just needs the
  code written. Skip planning; go straight to implementation.
- The work is genuinely tiny (a typo fix, a one-file refactor).
  An overhead-of-7-questions skill is wrong for two-line changes.

## Worked example (reference)

The user invokes `/demo-plan add per-tenant audit log retention policy`.

**Phase 1**: Mode = greenfield (free text, not a path).

**Phase 2**: Asks 5 questions (audience: operators; outcome:
per-tenant retention setting in admin UI; scope sniff: audit
subsystem + UI; constraints: backwards-compat with the existing
single retention default; security boundary: per-tenant
isolation).

**Phase 3**: Explore agents read the existing audit module, the
admin UI for tenant configuration, and the current retention
sweeper to understand the per-tenant setting pattern that
already shipped for other config knobs.

**Phase 4**: Synthesises a 5-phase rollout — DB migration →
backend service expansion → admin UI → migration helper → docs.
Each phase ~1 day of focused work.

**Phase 5**: Posts the outline to chat. User accepts the shape,
flags one locked decision they'd argue with ("can we keep the
global default working as a fallback row, even after the
per-tenant override lands?"). Skill updates the locked decision
and re-asks. User approves.

**Phase 6**: Writes
`docs/plans/audit-retention-policy/audit-retention-policy.md`
(parent) + skips the per-phase files — those will be written
later by re-running `/demo-plan
docs/plans/audit-retention-policy/audit-retention-policy.md`
once the user is ready to start phase 1.

**Phase 7**: Hands off with the next-steps block. No
implementation; no commits.

## See also

- [`demo-brainstorm`](../demo-brainstorm/SKILL.md) — the upstream
  pass when an idea is still fuzzy.
- [`demo-doc-audit`](../demo-doc-audit/SKILL.md) — complementary;
  finds doc gaps that often become input to a `demo-plan`
  doc-refresh phase.
- [`demo-spec-verify`](../demo-spec-verify/SKILL.md) — verify a plan
  against the codebase after implementation lands.
- [`demo-group-and-commit`](../demo-group-and-commit/SKILL.md) — the
  natural follow-on once implementation lands.
