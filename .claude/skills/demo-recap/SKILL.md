---
name: demo-recap
description: Pull every repo in the workspace and produce a very brief recap of what changed in the period (default last 2 weeks), with cross-references to the product PRD where possible. Use when you want a fast situational read across so-be / so-fe / so-gov / so-data / so-test.
argument-hint: <empty for last 2 weeks, or "1w" / "30d" / "1m" / a YYYY-MM-DD start date>
allowed-tools: Read, Glob, Grep, Bash, Agent
user_invocable: true
---

# Workspace Recap

Fast-forward every repo in the workspace, then produce a tight
per-repo recap of what changed in the period. Cross-references
the product PRD so each repo's activity gets a "scope hit" line
when commit themes map to a PRD section.

The output is **deliberately short** — a glance, not a digest. If
the user wants depth, they re-run with `/demo-release-notes` or
read the commits directly.

## Scope resolution

`$ARGUMENTS`:

| Value | Period |
|---|---|
| _empty_ | last 14 days |
| `1w` / `2w` / `4w` | last N weeks |
| `30d` / `60d` / `90d` | last N days |
| `1m` / `3m` / `6m` | last N months |
| `YYYY-MM-DD` | from that date through today |

Workspace repos: every directory under `git/` that contains a
`.git/` folder. Today that's `so-be`, `so-fe`, `so-gov`,
`so-data`, `so-test` — the skill does not hardcode the list, so
adding or removing a sibling repo just works.

PRD source: `git/so-gov/prd/*.pdf` and `git/so-gov/prd/*.md`. If
the gdrive sync is mounted (`gdrive-sync.lnk` resolves), also
scan `<gdrive-target>/PRD/`. If neither has any files, the
recap omits scope-hit lines without erroring.

## Hard rules

1. **Pull only fast-forward.** `git pull --ff-only` per repo.
   Never `--rebase`, never `--allow-unrelated-histories`. If a
   repo can't FF, skip it and note "diverged" in the output.
2. **Skip repos with uncommitted changes.** Run `git status
   --porcelain` first; if non-empty, skip pull + note "dirty
   working tree" in the output. Don't stash, don't commit, don't
   reset.
3. **Never push, never branch, never tag.** This skill is
   read-mostly with one fast-forward write.
4. **Detached HEAD or no upstream → skip.** Note the reason in
   the output. Don't try to "fix" it.
5. **Fail-soft per repo.** A failure on one repo doesn't abort
   the run. Capture the error, move to the next repo, surface
   the failure list at the end.
6. **No credential prompts.** Pulls run with stdin closed
   (`git -c core.askpass=true ...` or pipe `</dev/null`). If
   auth is needed and missing, skip + note "auth required".
7. **The brief stays brief.** Per repo: 3–5 lines max. The whole
   recap should fit on one screen for a 5-repo workspace.

## Procedure

### 1. Resolve the period

Convert `$ARGUMENTS` to an absolute `--since` date. Compute
`<from>` (YYYY-MM-DD) and `<to>` (today). All git commands use
`--since="<from>" --until="<to>"`.

### 2. Discover repos

```bash
ls -d git/*/.git 2>/dev/null | sed 's|/.git$||' | sed 's|^git/||'
```

That's the canonical list of workspace repos for this run. Save
to a variable; iterate downstream.

### 3. Pull each repo (parallel-safe, fail-soft)

For each repo in the list, in this exact order, capture output:

```bash
cd git/<repo>
git fetch --quiet </dev/null 2>&1            # populate refs
git status --porcelain                        # → dirty check
git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>&1
                                              # → upstream check
git pull --ff-only --quiet </dev/null 2>&1   # → ff-only
cd -
```

Per-repo decision tree:

| Pre-state | Action | Note in output |
|---|---|---|
| dirty working tree | skip pull | `dirty (skipped)` |
| no upstream | skip pull | `no upstream (skipped)` |
| pull --ff-only fails | leave as-is | `diverged (skipped)` |
| pull succeeds, 0 new commits | nothing | nothing extra |
| pull succeeds, N new commits | nothing | `+N commits pulled` |
| auth error | skip | `auth required` |

Run the pulls sequentially, not in parallel — different repos
can prompt for the same auth helper, and serial output is
easier to read.

### 4. Collect activity per repo

Now that the working trees are caught up, harvest per-repo
activity for the period:

```bash
cd git/<repo>

# commit count
git rev-list --count --since="<from>" --until="<to>" HEAD

# commit subjects (for theming + scope hits)
git log --since="<from>" --until="<to>" --no-merges \
  --pretty=format:'%h %s' --abbrev=8

# merged MRs / PRs (merge commits — captures GitLab/GitHub merges)
git log --since="<from>" --until="<to>" --merges \
  --pretty=format:'%h %s' --abbrev=8

# top changed files (signal for theme inference)
git log --since="<from>" --until="<to>" --no-merges --name-only \
  --pretty=format: | sort | uniq -c | sort -rn | head -10

# unique authors
git log --since="<from>" --until="<to>" --no-merges \
  --pretty=format:'%an' | sort -u

cd -
```

If the project has GitLab CLI (`glab`) or GitHub CLI (`gh`)
configured, optionally enrich with merged-MR titles — but only
when the CLI is already authenticated; never trigger an auth
flow.

### 5. Theme inference (1–3 themes per repo, max)

From the commit subjects + top changed paths, extract 1–3
short themes per repo. Keep them as 2–4 word labels.

Heuristics:
- Conventional-commit scope (`fix(rules):` → "rules") groups
  cleanly; lean on it when present.
- Top changed directories are a strong signal (e.g. 8 of the
  top 10 files under `src/services/auth/` → theme is "auth").
- If themes don't cluster (each commit is a different concern),
  write `mixed` and skip the per-theme detail.

If there's literally no activity for a repo: the entry is one
line — `**so-<name>:** no activity`.

### 6. PRD scope cross-reference

Locate the PRD:

```bash
ls git/so-gov/prd/*.pdf git/so-gov/prd/*.md 2>/dev/null
# also check the resolved gdrive target if gdrive-sync.lnk points to a live path
```

If at least one PRD file exists, read it (Read supports PDF; for
large PDFs use `pages: "1-20"`-style ranges and iterate, taking
~20 pages at a time). Build a small index:

- A list of PRD section headings (H1/H2/H3 in markdown; section
  numbers + titles in PDF — extract from the table of contents
  if present).
- For each section, a few keywords (the heading words plus any
  bolded glossary terms inline).

For each repo's themes, look for the closest PRD section by
keyword overlap. Output one of:

- `Scope hits: PRD §<n> (<short title>)` — when overlap is
  unambiguous (≥ 2 distinct content words match).
- `Scope hits: PRD §<n>? (<short title>)` — tentative; one
  weak overlap. The `?` flags low confidence.
- `Scope hits: none` — when nothing reasonable maps.

Cap at 2 scope hits per repo. If it touches more, the period is
too wide and the recap is the wrong tool — note it.

If no PRD file exists, omit the scope-hits line for every repo
and add a footer note: `PRD: not found (skipped scope cross-ref)`.

### 7. Render the brief

```markdown
# Workspace recap — <from> to <to>

## so-be
- <N> commits, <M> MRs merged · authors: <list-or-count>
- Themes: <theme1>, <theme2>
- Scope hits: PRD §<n> (<short title>)

## so-fe
- <N> commits, <M> MRs merged
- Themes: <theme>
- Scope hits: PRD §<n>?, §<m>

## so-gov
- <N> commits (governance / tooling)
- Scope hits: none

## so-data
- no activity

## so-test
- <N> commits
- Themes: <theme>
- Scope hits: PRD §<n>

---
**Pull status:** <K>/<total> ok · <list of skipped repos with reason>
**PRD:** `<filename>` (<size>) | not found
**Period:** <from> → <to> (<N days>)
```

Hard caps:
- Per repo: 3 lines if it had activity, 1 line if it didn't.
- "Themes" line: at most 3 themes, each at most 4 words.
- "Scope hits" line: at most 2 entries; omit when none and no PRD.
- Footer: 2–3 lines max.

If the recap exceeds ~30 lines for a 5-repo workspace, the user
asked for too long a window or there are too many themes — say
so in the footer and offer `/demo-release-notes` for depth.

## Anti-patterns

- ❌ **Pulling with merge or rebase.** `--ff-only` is the
  contract; anything else risks history rewrites the user
  didn't ask for.
- ❌ **Stashing the user's uncommitted work to make the pull
  succeed.** Skip the repo, note it, move on.
- ❌ **Auto-running `glab`/`gh` auth flows.** If the CLI isn't
  ready, skip the MR enrichment.
- ❌ **A "themes" line with five items.** That's not themes,
  that's a list of every commit. Cap at three.
- ❌ **Inventing PRD section numbers.** Cite the actual heading
  text from the PRD or omit the line.
- ❌ **A 100-line "brief".** Re-tighten or hand off to
  `/demo-release-notes`.
- ❌ **Failing the whole run because one repo is dirty.** That's
  what fail-soft is for.
- ❌ **Pushing, branching, or tagging anything.** Out of scope.

## When to invoke

- Monday-morning catch-up: "what happened across the workspace
  while I was off?"
- Pre-standup glance: tight summary before a sync call.
- Before `/demo-release-notes` — the recap surfaces whether a
  release-notes pass is even worth running yet.
- Before a stakeholder update — pairs with the PRD scope hits
  to anchor "this week we moved X% of the PRD".

## When NOT to invoke

- Cutting an actual release. Use `/demo-release-notes` — that
  one is built for the changelog format.
- Investigating a specific incident or bug. Use `/demo-debug`.
- Reviewing the open MR queue (this skill looks at *merged*
  history; for pending review work use `/demo-review-queue`).
- A single repo. Just `git log --since="2 weeks ago"` directly;
  this skill's overhead is only worth it across multiple repos.

## See also

- [`demo-code-sync`](../demo-code-sync/SKILL.md) — the same sync
  mechanics this skill runs in step 3, but standalone (no recap).
  Use when you want all repos caught up without the digest.
- [`demo-release-notes`](../demo-release-notes/SKILL.md) — same
  multi-repo aggregation but tuned for a release window and
  changelog-shaped output.
- [`demo-review-queue`](../demo-review-queue/SKILL.md) — open MRs
  awaiting review; orthogonal to this skill's "what merged".
- [`demo-repo-health`](../demo-repo-health/SKILL.md) — broader
  health sweep (CI status, secrets, freshness); use weekly.
