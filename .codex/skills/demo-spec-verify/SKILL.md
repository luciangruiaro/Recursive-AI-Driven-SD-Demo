---
name: demo-spec-verify
description: Verify a plan / PRD / audit / free-form requirement against the codebase — atomic claims, fixed verdict set (✅/⚠️/❌/⏸️), focused real-gaps list. Better-than-spec is not a gap. Use when you need to confirm what's actually implemented vs what a doc claims.
argument-hint: <path-to-plan-dir-or-md-or-free-form-text>
allowed-tools: Read, Glob, Grep, Bash, Agent
user_invocable: true
---

# Spec Verify

Check whether a plan, PRD, audit doc, or free-form requirement is
realized in the code. Output is a verdict table per claim plus a
focused list of real gaps — predictable shape, evidence-anchored,
scope-bounded.

> **Better-than-spec is not a gap.** If the implementation refined
> or exceeded what the spec described, the verdict is IMPLEMENTED.
> The skill exists to surface *missings*, not divergences.

## Scope resolution

Resolve what to verify from the args:

- **Path to a markdown file** (e.g. a plan, PRD, audit, or design
  doc): read it as the spec.
- **Path to a plan directory**: read the parent roadmap
  (`<dir>/<dir>.md`) plus any `phases/*.md` sub-plans. Skip
  `STATUS.md` and `README.md`.
- **Free-form text** (e.g. `"We should have a /admin/users/{id}/
  deactivate endpoint that ..."`): treat the text as a single-
  source spec.
- **Empty / no args**: ask the user what to verify (path or text).

## Context loading

Before extracting claims, read these once:

1. The project's conventions doc (`CLAUDE.md`, `AGENTS.md`,
   `README.md`, or equivalent) — repo conventions, key locations.
2. Any project rule files (`.claude/rules/`, ADRs, or equivalent)
   that pin layout / module structure.
3. The spec itself.
4. If the spec links to other docs (e.g. phase sub-plans), follow
   one level only — don't recurse indefinitely.

## Verification workflow

### Step 1 — Extract atomic claims

Break the spec into a flat list of discrete, verifiable claims.

A claim must be **atomic + checkable**:
- Good: `<TypeName>` exception exists in `<file>`
- Good: caller catches `<TypeName>` in `<function>` and surfaces
  the text
- Bad: "better error handling" — too vague
- Bad: "Phase 1: recursion + acceptance handshake" — too coarse,
  decompose into the underlying acceptance criteria

Skip these sections of the spec:
- Vision / motivation prose.
- Out-of-scope / deferred sections (track separately under DEFERRED).
- Open questions / discussion points.
- Internal cross-references between phases.

### Step 2 — Map each claim to code

For each claim, locate the responsible file / symbol / behavior:
- `Grep` for literal symbol names + signature fragments.
- `Glob` when you only know the file shape.
- A code-graph tool (e.g. `gitnexus_query` / `gitnexus_context`)
  when the claim names a behavior rather than a literal symbol.
- `Read` just enough of the target file to verify the claim.

Run lookups in parallel when claims are independent.

### Step 3 — Verdict per claim

Exactly one verdict per claim — no hybrids:

| Verdict | Meaning |
|---|---|
| ✅ **IMPLEMENTED** | The claim is realized — exactly as spec'd OR more capably. **Better-than-spec is not a gap.** |
| ⚠️ **PARTIAL** | The claim is partially realized: the user-facing surface exists but a sub-requirement (a field, an edge case, an audit row, a config toggle) is absent. |
| ❌ **MISSING** | The claim is not realized — no code implements it. |
| ⏸️ **DEFERRED** | The spec itself marks this out of scope or follow-up. |

There is **no DIVERGED verdict**. If the impl differs from the spec
but is equivalent or better → IMPLEMENTED. If it differs and is
worse or incomplete → PARTIAL or MISSING.

### Step 4 — Anchor every verdict

- IMPLEMENTED / PARTIAL: cite `file:line` or `file:symbol`.
- MISSING: cite the *expected* location — the place you searched
  and didn't find it. "Expected at `auth/audit_service.py` — no
  call site exists" beats "missing".
- DEFERRED: cite the section of the spec that defers it.

## Output format

Produce exactly this structure, in this order:

```
## Spec verification — <spec name>

| Claim | Verdict | Evidence |
|---|---|---|
| <atomic claim 1> | ✅ IMPLEMENTED | <file:line> |
| <atomic claim 2> | ⚠️ PARTIAL | <file:line> — <what's missing> |
| <atomic claim 3> | ❌ MISSING | expected at <path> |
| <atomic claim 4> | ⏸️ DEFERRED | spec §<section> |
| ... | | |

## Real gaps

Only MISSING and PARTIAL claims, numbered, one sentence each on
what's absent and where it should live:

1. **<claim>** (MISSING) — <one-sentence description of what's
   absent and where it should land>.
2. **<claim>** (PARTIAL) — <what surface exists vs what's missing>.

If neither MISSING nor PARTIAL: write "No gaps. All in-scope spec
claims are implemented."

## Summary

- Total claims: N
- ✅ Implemented: X
- ⚠️ Partial: Y
- ❌ Missing: Z
- ⏸️ Deferred: W
```

End with one line:
- `<spec> fully implemented. No gaps.` (when Z=0 and Y=0)
- `<spec> verified — <Z> missing, <Y> partial, <W> deferred.` (otherwise)

## Hard rules

1. **Better-than-spec is not a gap.** If the implementation refined
   or exceeded the spec, mark IMPLEMENTED. Do not suggest re-aligning
   the spec to the implementation — the spec is a historical record.
2. **Every verdict needs evidence.** Never claim IMPLEMENTED without
   a `file:line`. Never claim MISSING without citing the place you
   looked. A claim with no evidence is a discussion item, not a
   verdict.
3. **Don't recommend new work in the output.** This skill audits;
   `/demo-plan` plans the fixes once gaps are surfaced. Resist the
   urge to pad the report with "you should also..." sections.
4. **Don't edit the spec.** The spec is durable. Verification
   results live in this skill's output, never as edits to the source
   doc. Updating `STATUS.md` is the user's call after seeing the
   results — not part of this skill's automatic flow.
5. **Stay in scope.** If the spec defers something to a follow-up,
   mark DEFERRED — don't pull the follow-up's surface into this
   audit.
6. **Decompose ruthlessly.** A coarse claim that bundles 5
   sub-features hides 4 of them. If a claim mentions "...and X, Y,
   Z", split into 4 claims, one per item.
7. **No fuzzy verdicts.** A claim is IMPLEMENTED only if you
   located concrete code that realizes it. "Probably in
   `service/foo.py` somewhere" is not evidence. If you cannot find
   the code in a reasonable search, the verdict is MISSING with the
   expected location cited — not a guess.

## Examples

### Example 1: verify a multi-phase plan

```
/demo-spec-verify docs/plans/audit-retention-policy/
```

Reads the parent roadmap + all phase sub-plans, extracts the
atomic claims (one per concrete acceptance criterion), verifies
each against the codebase in parallel, outputs the verdict table +
real-gaps section.

### Example 2: verify a single-file plan

```
/demo-spec-verify docs/plans/multi-tenant-orgs/multi-tenant-orgs.md
```

Single-doc input. Same workflow.

### Example 3: verify a free-form requirement

```
/demo-spec-verify "We should have a /admin/users/{id}/deactivate
endpoint that sets users.is_active=false and writes an audit row."
```

Treats the text as a single-source spec. Decomposes into:
1. Endpoint exists at `POST /admin/users/{id}/deactivate`.
2. Endpoint sets `users.is_active=false`.
3. Endpoint writes an audit row.

Verifies each, outputs the same shape.

### Example 4: verify a PRD outside the plans folder

```
/demo-spec-verify docs/some-prd.md
```

Same workflow; no special handling for plan directories.

## See also

- [`demo-plan`](../demo-plan/SKILL.md) — once gaps are surfaced,
  plan their resolution.
- [`demo-debug`](../demo-debug/SKILL.md) — when the spec says X but
  code does Y, debug which side is wrong.
- [`demo-doc-audit`](../demo-doc-audit/SKILL.md) — when the
  verification surfaces broad doc drift, this is the systematic
  doc-fix path.
