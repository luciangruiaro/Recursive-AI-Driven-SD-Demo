---
name: demo-debug
description: Take a vague problem description (a deep issue that's hard to articulate) and produce a comprehensive root-cause + fix plan that doesn't break adjacent systems. Investigates implementation AND documentation, ranks hypotheses, gathers evidence (file paths, log lines, test results), assumes industry-best-practice when the answer is obvious, lists adjacent risks, and ships a non-breaking fix plan with a verification recipe. Doesn't auto-implement — produces the plan; user implements. Use when something is wrong but the cause isn't obvious.
argument-hint: <empty for interactive symptom capture, or a free-text symptom description, or a path to an existing debug session to continue>
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion, Agent, TodoWrite, WebSearch, WebFetch
user_invocable: true
---

# Debug — root-cause investigation + non-breaking fix plan

Take a fuzzy problem report — "X feels off", "Y sometimes
doesn't work", "we restarted three times last week and don't
know why" — and produce a Markdown document that:

- captures the symptom + reproduction steps,
- ranks hypotheses by likelihood,
- gathers evidence to confirm or rule each one out (file paths,
  log lines, test results, git history),
- locks the root cause,
- proposes a fix plan that respects adjacent systems
  (non-breaking, idempotent, observable) — folding in industry
  best-practice assumptions when obvious,
- ships a verification recipe so the user knows the fix
  actually worked.

This skill investigates and plans. It does **not** auto-
implement. The user picks the cadence — they apply the fix
directly, or run `/demo-plan` if the fix grew into a structural
change worth phasing.

## Modes / argument shapes

| Argument shape | Mode | Output location |
|---|---|---|
| _empty_ | Interactive: skill asks "what's the symptom?" then runs greenfield mode | `<debug-dir>/<slug>/<slug>.md` |
| Free-text symptom | Greenfield: full investigation flow | `<debug-dir>/<slug>/<slug>.md` |
| Path to existing debug session | Refinement: extend the existing investigation with a new hypothesis or a fresh evidence pass | append `## Update <YYYY-MM-DD>` section |

`<debug-dir>` is the project's debug-session directory (commonly
`docs/debug/`, `docs/incidents/`, or equivalent — fall back to
`docs/debug/` and confirm with the user before writing).

Slug: lowercase, hyphenated, problem-shaped not date-shaped.
✓ `tasks-stuck-after-restart` ✓ `sse-reconnect-storm`
✗ `2026-05-07-prod-bug`.

## Hard rules

1. **Investigate before fixing.** Never propose a patch without
   evidence-anchored root cause. "It's probably the cache" with
   no proof is a guess; "I read `cache.py:124` and traced the
   call site to a missing invalidation in `routes/agents.py:312`"
   is a root cause.
2. **Multiple hypotheses, ranked.** Don't tunnel-vision on the
   first plausible cause. Three is a floor. Ruling out the
   wrong ones is half the deliverable — the team learns what
   *isn't* the problem.
3. **Evidence cites files + lines + (where possible) commit
   hashes.** `git log -- <file>` and `git blame -L` are your
   friends. Symptom timing matters: if the user says "started
   last Tuesday", check what landed Monday.
4. **Industry best-practice assumptions are allowed when
   obvious.** If the bug is a missing idempotency guard on a
   distributed task, the fix assumes idempotency; you don't
   need to ask "should we be idempotent?". Make the assumption
   explicit in the doc so the user can dissent if they want.
5. **Adjacent-risk list is mandatory.** Every fix plan ends
   with a "what could this fix break?" section listing the
   call sites + tests + behaviours that need re-verification
   before the fix ships. Blast-radius analysis prevents
   "fixed one thing, broke three".
6. **Verification recipe is mandatory.** How does the user
   confirm the fix landed cleanly? A copy-pasteable smoke
   sequence (curl + db query + log-grep) plus the assertion
   that tells them "yes, fixed".
7. **Triviality short-circuit.** If the bug is a typo or a
   single-line condition flip, don't produce a 500-line debug
   doc — say so. The skill's output is "this is a 30-second
   fix; here it is" + a one-line verification.
8. **Escalate to /demo-plan when the fix is structural.** If
   investigation reveals the root cause needs a refactor that
   spans 5+ files or 1+ days, hand off to /demo-plan rather than
   inflating the debug doc. Capture the root cause + handoff
   note; don't write phases here.
9. **Documentation is part of the surface.** When code does X
   but docs say Y, that's a symptom — the bug might be in either
   place. Always check both.
10. **Refinement mode is append-only.** When invoked on an
    existing debug session, add a new `## Update <YYYY-MM-DD>`
    block. Don't rewrite earlier hypotheses — the rule-out
    history is durable evidence.

## Output template

```markdown
# Debug: <Symptom one-liner>

<2-3 sentence intent. What's broken, who reported it, and what
operational impact does it have.>

**Slug:** `<slug>`
**Created:** <YYYY-MM-DD>
**Severity:** P0 (prod down) | P1 (significant degradation) | P2 (annoyance) | P3 (cosmetic)
**Status:** investigating | root-cause-locked | fix-plan-ready | applied | superseded

---

## Symptom

> Verbatim user description. Don't reword.

**Observed:** what the user sees (UI message, log line, test
failure, performance signature).

**Expected:** what should happen instead.

**First seen:** when the symptom started (best-effort — "after
the v1.4.2 deploy", "since last Tuesday", "always").

**Reproduction:** if known, the steps. If not known, "no
reliable repro" — note it.

## Hypotheses

Ranked from most-to-least likely BEFORE evidence-gathering.
Each is a falsifiable claim.

| # | Hypothesis | Likelihood (pre-evidence) |
|---|---|---|
| H1 | <claim> | high |
| H2 | <claim> | medium |
| H3 | <claim> | low |
| H4 | <claim> | very low |

## Investigation log

For each hypothesis, the evidence that confirmed or ruled it out.
Cite file paths + line numbers + log excerpts + git history.

### H1: <claim> — <CONFIRMED | RULED OUT | INCONCLUSIVE>

**Method:** what was checked (read X, grep Y, run Z).

**Evidence:**
- `<file>:<line>` — <what it shows>
- log excerpt: `...`
- test: `<test command>` — pass/fail/output

**Verdict:** ruled out because / confirmed because / still
inconclusive — note what would resolve it.

(Repeat for H2, H3, ...)

## Root cause

The single hypothesis that survived. Stated precisely:

> When [condition], [code path] does [wrong thing] because
> [reason]. Fixed by [direction].

Cite the smoking-gun evidence — the specific file:line that owns
the bug.

If the root cause is a documentation drift (docs say X, code
does Y), state which is correct + which needs updating.

## Industry-practice assumptions

Best-practice patterns the fix relies on. Each is an explicit
assumption the user can dissent from before the fix ships.

- **Idempotency** — duplicate calls are no-ops because <reason>.
- **Locking** — concurrent claims use SKIP LOCKED (or
  equivalent) because <reason>.
- **Observable failure** — the failure surfaces in the audit log
  + trace, not just an exception.
- **Backwards-compat** — old clients keep working because
  <reason>.

## Fix plan

Describe the change. Be specific — files, function signatures,
config knobs. No code blocks longer than ~30 lines; this is
a plan, not a patch.

**Files touched:**
- `<file>` — <what changes>
- `<file>` — <what changes>

**Config changes (if any):**
- `<config-key>` — <new default>

**Migration (if any):**
- Schema or data migration shape; idempotent.

**Testing additions:**
- New test files / cases that prove the fix and protect against
  regression.

## Adjacent risks (what NOT to break)

What this fix could break elsewhere. Each gets a check.

| Risk | Likelihood | Mitigation / how to verify |
|---|---|---|
| <call site X also depends on the changed behaviour> | medium | run the relevant test file; smoke-test path Y |
| <UI Z reads the same data; might surface inconsistency> | low | manual visual check on /Z |
| ... | ... | ... |

## Verification recipe

Copy-pasteable. After the fix lands, run this sequence + check
the assertions:

```bash
# 1. Run the targeted regression tests:
<test-runner> <path-to-test>

# 2. Manual smoke (if applicable):
curl -X POST http://localhost:<port>/<endpoint> ...
# Expect: <specific response shape>

# 3. Audit / log check:
<db-client> -c "SELECT ... FROM audit_log WHERE ..."
# Expect: <specific row>

# 4. Adjacency smoke (each item in the Adjacent-risks table):
...
```

## Out of scope

What this debug session deliberately does NOT cover:
- <adjacent issue surfaced during investigation; deferred>

## Hand-off

What the user does next:

- **If trivial fix (≤ 30 LOC, single file):** apply directly,
  run the verification recipe, ship. No demo-plan needed.
- **If structural (multi-file, ≥ 1 day):** run
  `/demo-plan <debug-dir>/<slug>/<slug>.md` to phase
  the fix.
- **If documentation drift only:** update the doc; verification
  is a re-read.
- **If fix is uncertain:** spike the change in a worktree first
  (`Agent isolation: worktree`), run the verification recipe,
  then commit.
```

## Procedure

### Phase 1 — Determine mode + capture symptom

If args is empty, AskUserQuestion: "What's the symptom?
Describe it however roughly — log line, error message, vague
'feels slow' is fine. I'll dig in."

If args is a path inside the debug-session directory: read it,
treat as refinement, ask "what new evidence or hypothesis are we
adding?".

Otherwise: take args as the symptom description.

### Phase 2 — Clarify (3–5 questions)

Use AskUserQuestion to pin down what's vague:

- **Severity / impact.** Is prod down? How many users
  affected? Drives whether this is a rush job or a deep dive.
- **First seen.** When did it start? ("Since last Tuesday" →
  check Monday's deploy.)
- **Reproduction.** Reliable, intermittent, or one-shot?
  Affects what we can test against.
- **Recent context.** What changed recently — config, deploy,
  data volume, third-party API?
- **What's been tried.** Don't redo eliminations the user
  already ran.

Conditional follow-ups based on the symptom shape:
- Performance regression → ask for the latency numbers + when.
- Data inconsistency → ask for one concrete example row.
- Crash / exception → ask for the stack trace.
- "Sometimes" → ask for the percentage / pattern.

Cap at 5 — debugging is action-heavy; spend the rest of the
session on evidence.

### Phase 3 — Hypothesis generation

Generate 3-5 falsifiable hypotheses, ranked by pre-evidence
likelihood. Use:

- **Recent git history** — `git log --since="last Tuesday" -- <area>`
  to find candidate landing-points for the bug.
- **Blame on the suspect lines** — `git blame -L <range> <file>`.
- **Open issues / TODOs** — `grep -r "TODO\|FIXME\|XXX"
  <suspected-area>`.
- **Existing test coverage** — what's tested vs. what isn't.
  Untested code paths often hide the bug.
- **Architectural pressure points** — boundaries between
  subsystems, async edges, distributed-state hand-offs, cache
  layers, retry loops, error-handling fall-throughs.
- **Documentation drift** — does the doc + code agree? If not,
  one is the bug.

Rank by likelihood: code that changed recently in the affected
area is high; code that's been stable for months is lower.

### Phase 4 — Evidence gathering (parallel Explore agents + Bash)

For each hypothesis, gather evidence. Use up to 3 Explore
agents in parallel for breadth, plus direct tool calls for
focused checks:

- **Read the suspect files end-to-end** — Explore agent OR
  direct Read.
- **Grep for call sites** — `Grep "<symbol>" -A 5 -B 5`.
- **Run the targeted tests** — invoke the project's test runner
  on the relevant test path.
- **Check the logs** — log query / `docker compose logs ... |
  grep ...`.
- **Diff against the working state** — `git log --oneline -20 <area>`.
- **Web search for known patterns** — when the symptom matches a
  classic distributed-systems anti-pattern, name it (thundering
  herd, lost wakeup, race condition, accidental quadratic, etc.)
  and confirm via WebSearch + WebFetch on canonical sources.

Update the investigation log with what each pass confirmed or
ruled out.

### Phase 5 — Lock the root cause

Once one hypothesis survives all the evidence:
- State the cause precisely (when X then Y because Z).
- Cite the smoking-gun line (`<file>:<line>`).
- Note any documentation drift implied by the cause.

If multiple hypotheses survive, the root cause is a composite —
state it as such, and note that the fix plan must address each
contributing factor.

If no hypothesis survives, escalate: surface the dead-end log
in chat + ask for fresh user input. Don't fabricate.

### Phase 6 — Compose the fix plan

For the locked root cause, propose a fix that:
- changes the smallest reasonable set of files,
- adds tests that would have caught the bug,
- folds in obvious industry-best-practice assumptions
  (idempotency, locking, observability) as explicit assumptions
  the user can dissent from,
- lists the adjacent risks + how to verify each,
- ships a copy-pasteable verification recipe.

If the fix balloons past ~5 files or ~1 day, **stop the debug
doc and hand off to /demo-plan**. Capture the root cause +
recommend phases; let demo-plan do the slicing.

### Phase 7 — Validate with the user before writing

Post a compact summary to chat:

```
Debug session: <slug>
Severity: <P0/P1/P2/P3>
Hypotheses checked: <N>  (ruled out: <list>; confirmed: <root cause>)
Root cause: <one-sentence>
Fix shape: <files-touched count>, <effort guess>
Adjacent risks: <N>
Output: <debug-dir>/<slug>/<slug>.md
```

Ask: "Ship this debug doc? Or want to redirect investigation
before I write?"

### Phase 8 — Write the debug file

On approval, render and write. File naming:

| Mode | Path |
|---|---|
| Greenfield | `<debug-dir>/<slug>/<slug>.md` |
| Refinement | append `## Update <YYYY-MM-DD>` to the existing file |

If the fix plan was structural enough to escalate to demo-plan,
the doc still lands — but the "Hand-off" section points at the
plan.

### Phase 9 — Hand off

After writing, surface:

```
✓ Debug session written to <path>
  - Hypotheses: <N> checked, <root-cause> confirmed
  - Severity: <P0/P1/P2/P3>
  - Fix: <one-line summary>
  - Adjacent risks: <N> (mitigation in the doc)
  - Verification: copy-paste section in the doc

Next step: <apply directly | /demo-plan <path> | spike-first>
```

Don't auto-apply the fix. The user picks the cadence.

## Anti-patterns

- ❌ **Patching a symptom without root cause.** "Try restarting
  the service" is not a fix plan.
- ❌ **Single-hypothesis investigation.** Even when you're sure,
  list two more and rule them out — half the value is the
  ruling-out.
- ❌ **Evidence by handwave.** Every hypothesis needs concrete
  evidence: file:line, log excerpt, test result, git hash.
- ❌ **Skipping the adjacent-risks section.** A fix without a
  blast-radius analysis is the seed of the next bug.
- ❌ **Skipping the verification recipe.** The user must know,
  beyond "the test now passes", that the system is healthy.
- ❌ **Inflating a typo into a debug doc.** Triviality
  short-circuit: tell the user it's 30 seconds of fix and skip
  the document.
- ❌ **Inflating a structural refactor into a debug doc.**
  Escalate to /demo-plan; the debug doc captures the root cause,
  the plan captures the phases.
- ❌ **Ignoring documentation drift.** Code says X, doc says Y
  — one of them is the bug. Investigate both.
- ❌ **Auto-applying the fix.** Hand off; let the user decide
  whether to apply directly or phase via /demo-plan.
- ❌ **Rewriting earlier hypotheses on a refinement pass.**
  Append `## Update <date>` blocks; preserve the rule-out
  history.

## When to invoke

- "Something's wrong with X but I can't quite describe it."
- "Y sometimes fails and we don't know why."
- "We had three production restarts last week — no clear pattern."
- "Tests pass locally but fail in CI."
- "The audit log shows weird ordering of <event A> and <event B>."
- "Performance dropped after deploy v1.4.2."
- "Behaviour matches docs in dev but not in staging."

## When NOT to invoke

- The bug is obvious (typo, missed import, syntax error). Just
  fix it directly.
- The user knows the root cause + just needs the fix coded. Run
  `/demo-plan` if the fix is structural, or implement directly if
  small.
- The work is a refactor with no observable bug. Use
  `/demo-refactor-module`.
- The investigation requires running the agent against
  production data the user hasn't approved access to.
- The "issue" is actually a feature request. Use
  `/demo-brainstorm` then `/demo-plan`.

## Worked example

User invokes `/demo-debug background tasks sometimes stay in 'claimed' status forever after the worker restarts`.

**Phase 1**: Greenfield, free-text.

**Phase 2**: 4 questions — severity (P2; user-visible but
recoverable via manual cleanup), first seen (since the last
worker rollout), reproduction (kill the worker mid-task; row
stays in 'claimed'), what's been tried (manual UPDATE in the DB
client works).

**Phase 3**: 4 hypotheses ranked:
- H1 (high): stale-detection background task isn't flipping
  expired claims — recent change to the cadence?
- H2 (medium): `claimed_until` is set with TZ-naive timestamps;
  comparison against tz-aware NOW() always returns false.
- H3 (low): worker's SIGTERM handler does POST `/shutdown`
  but the route doesn't release claims.
- H4 (very low): DB clock skew vs. app clock.

**Phase 4**: Evidence gathering.
- H1 ruled out: the background task runs every 10s and the SQL
  query reads correctly.
- **H2 confirmed**: the claim-setting code uses tz-naive
  timestamps; the DB driver returns the column as tz-aware on
  read; the comparison `claimed_until < NOW()` in the
  background task's SELECT is `naive < aware` → always False on
  the DB. Smoking gun: `git blame` shows the line landed in
  the recent rollout.
- H3 + H4 ruled out: route correctly releases claims on
  /shutdown; no clock skew in monitoring.

**Phase 5**: Root cause locked. Documentation drift: the
project's coding conventions say "always use tz-aware
datetimes" — confirmed; the bug is a missed-rule.

**Phase 6**: Fix plan. One-line change to the claim-setting
function. Industry-practice assumption: tz-aware timestamps
everywhere (matches existing project standards). Adjacent
risks: every site that compares `claimed_until` — list of 5
spots in the scheduler + claim service + tests. Verification
recipe: regression test for stale-claim detection + a manual
reproduction smoke.

**Phase 7**: Posts summary; user approves.

**Phase 8**: Writes
`docs/debug/tasks-stuck-after-restart/tasks-stuck-after-restart.md`.

**Phase 9**: Hand-off recommends "apply directly + run
verification" — the fix is 1 LOC + 2 test cases. No demo-plan
needed.

## See also

- [`demo-plan`](../demo-plan/SKILL.md) — escalation path when the
  fix grows past ~5 files / ~1 day.
- [`demo-spec-verify`](../demo-spec-verify/SKILL.md) — when the
  symptom is "spec says X but code does Y", verify which side
  is wrong.
- [`demo-doc-audit`](../demo-doc-audit/SKILL.md) — when the bug
  turns out to be doc drift, this is the systematic doc-fix
  path.
- [`demo-group-and-commit`](../demo-group-and-commit/SKILL.md) —
  the natural follow-on once the fix lands.
