---
name: demo-code-sync
description: Sync every repo in the workspace to its upstream HEAD. Fast-forward only — never merges, rebases, pushes, stashes, or switches branches. Reports per-repo status (synced / up-to-date / dirty / diverged / no-upstream / auth-required). Use before starting work, after a few days off, or any time you want every working tree caught up.
argument-hint: <empty for all repos, or a specific repo name like "so-be">
allowed-tools: Bash, Read, Glob
user_invocable: true
---

# Workspace Code Sync

Bring every repo in the workspace up to its upstream HEAD via
`git pull --ff-only`. Read-mostly with one small write per repo;
fail-soft per repo; never destructive.

This skill does **only** sync. For sync + activity digest with PRD
cross-references, run `/demo-recap` instead.

## Scope resolution

`$ARGUMENTS`:

| Value | Behaviour |
|---|---|
| _empty_ | Sync every `git/so-*` repo found in the workspace |
| a repo name (e.g. `so-be`, `so-fe`, `so-gov`) | Sync that single repo |
| `--check` | Status-only — report per-repo state without running fetch or pull |

Workspace repos are detected by listing directories under `git/`
that contain a `.git/` folder. Today that's `so-be`, `so-fe`,
`so-gov`, `so-data`, `so-test` — adding or removing a sibling
repo just works without code changes here.

## Hard rules

1. **Fast-forward only.** Always `git pull --ff-only`. Never
   `--rebase`, never `--merge`, never `--allow-unrelated-histories`.
   If a repo can't FF, skip it and note `diverged` — don't try
   to "fix" it.
2. **Skip repos with uncommitted changes.** Run `git status
   --porcelain` first; if non-empty, skip pull + note
   `dirty (skipped)`. Don't stash, don't commit, don't reset.
3. **Never push, never branch, never tag, never checkout.** This
   skill stays on whatever branch the user has checked out. If
   there's no upstream for the current branch, skip + note
   `no upstream`.
4. **Fail-soft per repo.** A failure on one repo doesn't abort
   the run. Capture the error, move to the next repo, surface
   the failure list at the end.
5. **No credential prompts.** Run pulls with stdin closed
   (`</dev/null` or `git -c core.askpass=true ...`). If auth is
   needed and missing, skip + note `auth required`. Don't trigger
   a credential helper interactively.
6. **Sequential, not parallel.** Different repos can prompt the
   same auth helper, and serial output is easier to read for a
   5-repo workspace. Performance isn't the constraint; safety
   and legibility are.
7. **Never run on a detached HEAD.** Skip + note
   `detached HEAD (skipped)`. Pulling on detached HEAD is a
   footgun the user almost never wants.

## Procedure

### 1. Discover repos

```bash
ls -d git/*/.git 2>/dev/null | sed 's|/.git$||' | sed 's|^git/||'
```

If `$ARGUMENTS` names a single repo, narrow the list to just
that one. If it doesn't exist as a directory, error out with a
clear message before doing anything.

### 2. Pre-flight each repo

For every repo in the list, capture state before touching it:

```bash
cd git/<repo>

# Are we on a branch or detached?
git symbolic-ref --short -q HEAD || echo "DETACHED"

# Is the working tree dirty?
git status --porcelain

# Does the current branch have an upstream?
git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>&1

cd -
```

Decision tree (per repo):

| Pre-flight result | Outcome |
|---|---|
| Detached HEAD | skip; note `detached HEAD` |
| Working tree dirty | skip; note `dirty (skipped)` |
| No upstream | skip; note `no upstream` |
| All clean | proceed to fetch + pull |

If `$ARGUMENTS` is `--check`, stop here and emit the status table
without running fetch or pull.

### 3. Fetch + fast-forward pull

For repos that pass pre-flight:

```bash
cd git/<repo>
git fetch --quiet --tags </dev/null 2>&1
before=$(git rev-parse HEAD)
git pull --ff-only --quiet </dev/null 2>&1
rc=$?
after=$(git rev-parse HEAD)
cd -
```

Record the outcome:

| `rc` | `before` vs `after` | Outcome |
|---|---|---|
| 0 | same | `up-to-date` |
| 0 | different | `synced (+N commits)` where N = `git rev-list before..after --count` |
| nonzero, "Not possible to fast-forward" in stderr | — | `diverged (skipped)` |
| nonzero, auth-related stderr | — | `auth required (skipped)` |
| nonzero, other | — | `error: <first line of stderr>` |

For synced repos, optionally capture the file-change summary
(`git diff --stat before..after | tail -1`) for the output line.

### 4. Render the status table

Output a single-screen table — one line per repo, plus a one-line
summary footer:

```
✓ so-be     synced       +12 commits  (5 files changed, 287+/142-)
✓ so-fe     up-to-date
- so-gov    dirty         skipped — uncommitted changes
✗ so-data   diverged      skipped — local has 3 commits not in upstream
- so-test   no upstream   skipped — current branch (feat/x) has no tracking ref

5 repos checked · 2 synced (+12 commits) · 1 up-to-date · 2 skipped · 0 errors
```

Status glyphs:
- `✓` synced or up-to-date
- `-` skipped (non-error reasons: dirty, no upstream, detached)
- `✗` diverged or hard error

If any repo was skipped, add a one-line "to fix" hint in the
footer when the resolution is mechanical:
- `dirty` → "commit or stash, then re-run /demo-code-sync <repo>"
- `diverged` → "investigate with /demo-debug or rebase manually"
- `no upstream` → "set upstream: git branch --set-upstream-to=origin/<branch>"

## Anti-patterns

- ❌ **`git pull` without `--ff-only`.** A merge or rebase
  happens silently; the user may not want it. Always FF-only.
- ❌ **Stashing the user's uncommitted work to make the pull
  succeed.** Skip the repo, note it, move on. The user's
  in-progress work is sacred.
- ❌ **Pushing anything.** Out of scope for sync. If the user
  needs to push, they'll do it explicitly — likely after
  `/demo-group-and-commit`.
- ❌ **Switching branches "to get to a syncable state".** Stay
  on whatever branch the user has checked out.
- ❌ **Triggering a credential helper interactively.** If auth
  isn't already configured, skip and report — don't prompt.
- ❌ **Running fetch in parallel.** Serial is fine for a
  5-repo workspace and avoids interleaved auth prompts.
- ❌ **Aborting the whole run because one repo is dirty.**
  That's what fail-soft is for.

## When to invoke

- Start of the workday: catch up before opening any editor.
- Before `/demo-recap` — though `/demo-recap` runs the same sync
  itself.
- Before a cross-repo refactor (`/demo-cross-repo-impact`,
  `/demo-api-contract-review`) — so the impact analysis runs
  against current upstream, not stale local refs.
- After a long break (PTO, weekend, sprint switch).

## When NOT to invoke

- You want the activity digest, not just sync. Use `/demo-recap`.
- You want to push, branch, rebase, or otherwise mutate state.
  Out of scope. Use git directly or a more specific skill.
- You're in the middle of a complex merge/rebase. Finish it
  manually first.
- You only need to update one specific file or a sub-tree.
  Just run `git pull` (or `git fetch && git checkout`) by hand;
  this skill is workspace-wide overhead.

## See also

- [`demo-recap`](../demo-recap/SKILL.md) — same sync mechanics plus
  a per-repo activity digest with PRD scope cross-references.
  Use when you want to know *what* changed, not just that things
  are up-to-date.
- [`demo-review-queue`](../demo-review-queue/SKILL.md) — open MRs
  awaiting review across repos. Orthogonal to sync.
- [`demo-repo-health`](../demo-repo-health/SKILL.md) — broader
  workspace health sweep (CI, secrets, freshness). Use weekly.
- [`demo-cross-repo-impact`](../demo-cross-repo-impact/SKILL.md) —
  pairs well: sync first, then run impact analysis against
  current upstream.
