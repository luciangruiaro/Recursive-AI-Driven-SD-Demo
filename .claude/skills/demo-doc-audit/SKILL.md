---
name: demo-doc-audit
description: Audit and update documentation across the project. Inventories every doc file, verifies claims against current code, finds gaps for recent feature work, then updates source-of-truth docs and writes new user-facing + developer-facing reference where missing. Defaults to whole-project; accepts a scope argument. Use when docs feel stale or after major changes.
argument-hint: <empty for whole-project, or a path/topic to scope to e.g. "auth/" or "the new caching layer">
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent, TodoWrite
user_invocable: true
---

# Documentation Audit & Update

Systematically audit every doc file in the project against the
current codebase, surface gaps, and land the fix as a sliceable
plan.

The skill produces a sequence of small, scope-bounded edits — never a
single mega-rewrite. Each workstream is independently shippable so
the user can pause, review, or redirect at any seam.

## Hard rules

1. **Don't rewrite — patch and add.** Existing source-of-truth docs
   (the project's conventions doc, `architecture.md`, ADRs, rule
   files) get targeted edits. New deep-dives go in fresh files
   under the project's user-facing docs directory or
   developer-facing docs directory. Architecture rewrites are
   out of scope.
2. **Verify every claim before writing it.** When the audit says
   "auth subsystem is undocumented", read the actual auth code
   and cite *current* shapes — counts, regex patterns, function
   names, error codes — never guesswork.
3. **One workstream → one commit cluster.** The plan groups changes
   into A (source-of-truth) → B (user-facing) → C (developer-
   facing) → D (stale README triage) → E (governance). Land them
   in order so later workstreams reference the corrected source
   of truth.
4. **Triage stale READMEs, don't rewrite them.** If a 60+-day-old
   README has outright-wrong content (broken paths, missing files,
   stale class names), fix only the wrong parts. Full refresh goes
   in the changelog as deferred work.
5. **No AI/human attribution in commits or docs.** Same policy as
   the rest of the project.
6. **Out of scope by default.** Don't touch:
   - Snapshot / repo-analysis directories (not living docs)
   - Runtime data files (`*.db`, log dumps)
   - Operator-tunable config files (these are config, not docs)
   - Per-component knowledge files that are content rather than
     documentation

## Scope resolution

Determine what to audit based on `$ARGUMENTS`:

- **Empty / no args**: whole-project audit.
- **A directory path** (e.g. `auth/`, `service/scheduler/`): focus
  the audit on docs that describe code under that path.
- **A topic phrase** (e.g. "the new caching layer", "the recent
  multi-tenancy work"): scope to docs that should mention this
  concern but might not.
- **`--source-of-truth-only`**: skip workstreams B–E; just patch
  the project's conventions doc, `architecture.md`, and any rule
  files.
- **`--no-write`**: produce the audit report without making any
  edits. Useful for an initial scan before committing time.

## Procedure

### Phase 1 — Audit (parallel exploration)

Launch up to 3 Explore agents in parallel. Each gets a self-
contained brief; agents don't share state.

**Agent A — inventory:** find every doc file in scope. Group by
location (top-level entry points / `.claude/` rules + skills /
plans / module READMEs / `docs/` / inline source comments / other).
For each: path, one-line purpose, audience (user / developer /
operator / AI agent), approximate length, last-touched date
(`git log -1 --format=%cs`), recent activity (last 90 days
yes/no). Flag files unchanged in 60+ days that cover fast-moving
areas.

**Agent B — claim verification:** read every authoritative doc
(the project's conventions doc, `architecture.md`, rule files,
key READMEs). For each claim — file paths, function names,
conventions, listed slash commands, module counts, role names —
verify against the codebase. Output a table: `Doc → Specific
claim → Verdict (still true / stale / silent / wrong) → Severity
(HIGH / MEDIUM / LOW)`.

**Agent C — gap analysis:** for each major recent feature (the
phase plans in the plans directory, recently-added modules),
check whether any user-facing or developer-facing doc covers it.
Surface absences. End with a one-paragraph summary: "If I were a
brand-new user and a brand-new developer, what would I be missing
the most?"

For scoped audits (a path or topic), narrow each agent's brief
proportionally — don't ask Agent B to read every rule file when
the scope is one subsystem.

### Phase 2 — Plan

Synthesise the three reports into a 5-workstream plan. Each
workstream has a goal, a file list, an estimated commit count, and
an explicit out-of-scope.

| Workstream | Concern | Typical files |
|---|---|---|
| A — Source-of-truth | Patch the docs new contributors read first | conventions doc, `architecture.md`, rule files, ADRs |
| B — User-facing playbooks | What an end user / admin needs to operate the system | new files under the user-facing docs directory (commonly `docs/user/`, `docs/operator/`, `docs/admin/`) |
| C — Developer reference | Internals docs for subsystem extension | new files under the developer-facing docs directory (commonly `docs/dev/`, `docs/contributors/`) |
| D — Stale README triage | Fix outright-wrong content in old READMEs; defer rewrites | module READMEs, protocol docs, third-party-integration docs |
| E — Governance | Index + changelog + contributor checklist so the next phase doesn't re-create the same gap | `docs/README.md`, `docs/changelog.md`, `CONTRIBUTING.md` |

Lock the decisions that bind the plan: where new user-facing docs
live, where new developer-facing docs live, what's out of scope,
what doc tone (user-first vs developer-API style). Capture them in
a "Locked decisions" section so the user can object before any
file is written.

If the user invoked the skill with `--no-write`, stop here and
present the plan as the output.

### Phase 3 — Source-of-truth corrections (Workstream A)

The highest-leverage workstream. Do this first; later workstreams
build on the corrected source-of-truth.

**The project's conventions doc** (`CLAUDE.md`, `AGENTS.md`,
`README.md`, or equivalent) — the file every contributor reads
first. Fix the classes of drift surfaced by Agent B:
- Decision-tree gaps (new module types, new top-level concerns
  not in the table).
- Wrong layout — add subtrees for new modules; remove ones that
  moved.
- Convention drift — soften prescriptions the code doesn't follow,
  or commit to enforcing them with a lint rule.
- Cross-link to the user-facing and developer-facing docs
  directories so subsequent workstreams have a place to point.

**`architecture.md`** — the system-level reference. Add:
- Any subsystem that landed silently (auth, rate limiter, cache,
  scheduler — whatever the audit surfaced).
- ASCII diagram lane for the new flow (request → gate → handler).
- Layout block update.

**Rule files** (`.claude/rules/*.mdc`, ADRs, or equivalent) —
patch existing rule files for drift; add new rule files for new
concerns. Keep each rule under ~150 lines; one concern per file.

Verify after each edit: `grep -nE "<key terms>" <file>` returns
the new sections. Read the file end-to-end as a "new contributor".

### Phase 4 — User-facing playbook set (Workstream B)

Audience: someone setting the system up on a fresh deployment, or
an end user trying to do a common task.

Write each file with concrete, actionable procedures:
- Per-feature "where to find / configure X" walkthroughs.
- Action-code catalogues with what each row means.
- Permission-scope reference tables.
- Deployment hardening checklists (TLS, secrets, DB, rate limits).

Anchor every claim to a file path or function name, so the doc
ages by drifting from a *grepable* reality — not from a hand-wave.

Cross-link from existing user-facing docs (e.g. `docs/runbook.md`
gets a pointer block at the top: "for SSO admin, audit
interpretation, role assignment — see <user-facing-docs-dir>/").

### Phase 5 — Developer reference set (Workstream C)

Audience: a developer extending the project — adding a new
provider, a new module, a new backend.

Each file follows the same shape:
- File layout block (the directory tree of the subsystem, with
  one-line purpose per file).
- Lifecycle / call-graph walkthrough.
- "How to add a new X" cookbook.
- Anti-patterns.
- "Where this runs" table (concern → implementation file).
- Tests table (concern → test file).

Cap individual files at ~400 lines. A 1000-line behemoth is a code
smell — split.

### Phase 6 — Stale README triage (Workstream D)

For each module README unchanged in 60+ days:
1. Read it end-to-end.
2. Verify file paths, function names, class names against the
   current code.
3. Fix outright-wrong content (broken imports, removed classes,
   typos like split-line method definitions).
4. Add a real list of "Active modules / providers / etc." at the
   top so readers don't trust illustrative bullet lists below.
5. Don't rewrite the rest. Track full-refresh as deferred work in
   `docs/changelog.md`.

### Phase 7 — Governance (Workstream E)

Three changes that prevent the next round of features from re-
creating the same gap:
- **`docs/README.md`** — top-level docs index organised by audience.
  Every link must resolve.
- **`docs/changelog.md`** — add per-feature release notes for the
  shipped surface (typically the phase plans that just landed).
- **`CONTRIBUTING.md`** — append a "doc-update checklist when
  shipping a feature" naming which doc to touch for each kind of
  change.

### Phase 8 — Verification

Run the verification checks the audit recommended:
- `grep -nE "<key term>"` for every new convention — should match.
- File-path resolution: every relative link from the user-facing
  docs, the developer-facing docs, and `docs/README.md` resolves
  to a real file.
- Cross-doc links: user-facing docs reference real files in the
  app; dev docs reference real files under their stated subsystem.
- Read each new file end-to-end as a new contributor: does it
  answer real questions without prior context?

### Phase 9 — Commit

Hand off to `demo-group-and-commit` (or `git` directly if the user
prefers). Recommended grouping: 7 commits — one per workstream,
plus an extra split when a workstream legitimately covers two
concerns:

1. `docs: sync conventions doc with the post-<feature> codebase` (A1)
2. `docs: add <subsystem> section to architecture.md` (A2)
3. `docs: refresh rule files and add <new-rule>` (A3)
4. `docs: add user-facing playbooks for <feature>` (B)
5. `docs: add developer reference docs for <subsystems>` (C)
6. `docs: triage stale module + protocol READMEs` (D)
7. `docs: docs governance — index, <feature> changelog, contributor checklist` (E)

Local-environment files (config toggles, runtime DBs) stay
unstaged.

## Output format

When the skill produces a plan (Phase 2), use this shape:

```markdown
# Documentation audit plan — <scope>

## Audit headline
| Severity | Finding |
|---|---|
| HIGH | ... |
| MEDIUM | ... |

## Locked decisions
| Decision | Choice | Rationale |
|---|---|---|

## Workstream A — source-of-truth corrections
...

## Workstream B — user-facing playbooks
...

(... C, D, E ...)

## Out of scope
- ...

## Verification recipe
- ...
```

When the skill writes files (Phases 3–7), surface the diff between
each commit as plain text — file paths + one-line summary per
change — so the user can object before the next workstream lands.

## Anti-patterns

- ❌ Trusting your training-data memory of the codebase instead of
  re-grepping. The project evolves; the docs you write must match
  *now*.
- ❌ Writing a 1000-line "auth subsystem" deep-dive. Cap at ~400;
  push provider-specific detail back to the phase plans.
- ❌ Adding a new doc without a cross-link from somewhere existing.
  An orphaned file is worse than no file.
- ❌ Rewriting `architecture.md` from scratch. Patch in place.
- ❌ Documenting features that don't exist yet. Cite the commit /
  PR or skip the section.
- ❌ Bundling all five workstreams into one mega-PR. Land A first,
  let the user redirect, then continue.
- ❌ Using emojis or AI/human attribution trailers.

## When to invoke

- After a phase / feature ships and the docs haven't caught up
  (the skill detects this via "60+ days unchanged" + "module
  exists in code, not in any doc").
- Quarterly maintenance even when nothing dramatic happened — drift
  accrues.
- Before onboarding new contributors — they're the canary for stale
  docs.
- Before an external review (security audit, compliance review,
  customer-facing demo) — auditors will read your docs first.

## Worked example (reference)

A whole-project audit after a major feature shipped produced:

**Audit headline:** 88% of architectural claims still accurate; 5
HIGH-severity gaps (slash-command confusion in the conventions
doc, auth subsystem absent from top-level docs, no user-facing
docs for recent phases, undocumented rate limiter, stale module
READMEs).

**Plan:** 5 workstreams totalling ~20 files (~5 patches + 11 new
files + a few cross-links) → 7 atomic commits.

**Output:** user-facing docs directory with 6 playbooks,
developer-facing docs directory with 5 references,
source-of-truth files synced, stale READMEs triaged, docs index +
per-phase changelog + contributor checklist landed.

The skill encodes this same workflow generically — the
5-workstream template fits any "documentation has drifted from a
recently-shipped feature" situation.
