---
name: demo-install
description: Bring up a project's local development stack on a fresh Windows or macOS workstation. Detects what's already on the machine, asks before installing anything, prefers user-scoped + reversible installers (winget / scoop / Homebrew / nvm / pyenv / uv) over system-wide ones, walks through .env interactively with credential-safety warnings, brings up the runtime stack, and smoke-tests. Never installs silently. Use when onboarding a new developer or setting up a clean machine.
argument-hint: <empty for full guided install, or one of "check" | "deps-only" | "env-only" | "stack-only" | "smoketest">
allowed-tools: Read, Glob, Grep, Bash, PowerShell, Edit, Write, AskUserQuestion
user_invocable: true
---

# Install the project locally

Take a brand-new workstation (Windows or macOS) from "fresh
checkout" to "running stack" without trampling the user's
environment.

The skill is **interactive by design**. Every install asks consent
first, presents options, and prefers gentle (user-scoped,
reversible) install paths. The user's existing tools are
detected and re-used, never replaced.

The skill is **project-agnostic**. It encodes the *workflow*
(detect → consent → install → bootstrap → env → start → smoke) and
the *safety rails* (no silent installs, no credential echo,
rollback list). Stack-specific details (which package manager,
which env vars, which start command) come from the project's
README, `.env.example`, and start scripts — read those first to
specialize the run.

## Hard rules

1. **Never install anything without consent.** For each missing
   prereq, present at least two options (recommended +
   alternative) and a "skip + here's what breaks" path. Wait for
   the user's pick before running any installer.
2. **Prefer user-scoped, reversible installers.** Mac: Homebrew /
   pyenv / nvm. Windows: winget / scoop / nvm-windows / pyenv-win.
   Avoid `sudo` paths; avoid replacing system Python or system
   Node.
3. **Never use `--no-verify` or `--force` on any installer flag**
   that bypasses safety checks. If a step fails, surface the
   error and ask the user, don't silently work around it.
4. **Never echo credentials back to the user.** The .env
   walkthrough takes secrets via the AskUserQuestion tool, writes
   them straight to `.env`, and acknowledges they were stored —
   never quotes the value back in the chat.
5. **Always provide rollback.** Track every tool installed in
   this session and show the user the uninstall command for each
   at the end.
6. **Never commit or push anything.** The skill ends with the
   stack running locally; the user starts work from there.
7. **Read the project before assuming.** Before doing anything
   else, scan the repo for `README.md`, `CONTRIBUTING.md`,
   `.env.example`, `package.json`, `pyproject.toml` /
   `requirements*.txt`, `*.csproj`, `go.mod`, `docker-compose*.yml`,
   `Makefile`, and any `scripts/` directory. The actual install
   commands come from those — the skill orchestrates them
   safely.

## Scope flag

`$ARGUMENTS`:

| Value | Behaviour |
|---|---|
| _empty_ | Full guided flow: prereqs → install missing → repo bootstrap → .env → stack → smoketest. |
| `check` | Audit only — what's installed, what's missing, what would happen. No installs, no edits. |
| `deps-only` | Stop after prereq install + repo bootstrap (project's dependency install + any `pre-commit` / lint hook setup). |
| `env-only` | Skip prereqs. Just walk through `.env.example` and write `.env`. |
| `stack-only` | Skip prereqs + .env. Just bring up the runtime stack (containers, DB migrations, seed) + run smoketest. |
| `smoketest` | Only verify the running app: project-defined health endpoints. |

## Procedure

### 1. Detect OS + shell

Use Bash on macOS/Linux, PowerShell on Windows. Detect:

```bash
# macOS / Linux
uname -s         # Darwin / Linux
```

```powershell
# Windows
$PSVersionTable.OS  # Microsoft Windows ...
```

If on Linux, treat it as macOS-equivalent (Homebrew + pyenv + nvm
all work on Linux). If on Windows, switch to PowerShell tooling.

Cap the rest of the skill's tool selection to the OS-appropriate
shell — the skill is one or the other for the duration.

### 2. Read the project's expectations

Before running any installer, read:
- The project README — entry point, mentioned tools, commands.
- `CONTRIBUTING.md` if present — onboarding flow.
- `.env.example` — required and optional environment variables.
- The dependency manifest(s) (`package.json`, `pyproject.toml`,
  `requirements*.txt`, `*.csproj`, `go.mod`, etc.).
- `docker-compose*.yml` if present — runtime services.
- Any prereq-checker script (commonly under `scripts/utils/`,
  `scripts/check/`, or referenced in the README) — run it to
  capture the project's own missing-tool list.

From this, build the list of tools the project actually needs.
Don't install things the project doesn't use.

### 3. Audit prerequisites

Run the project's prereq checker if it has one. Otherwise, derive
the list from the manifests:

| Manifest | Implies |
|---|---|
| `package.json` | Node + npm/yarn/pnpm at the version pinned in `engines` or `.nvmrc` |
| `pyproject.toml` / `requirements*.txt` | Python at the version pinned in `python_requires` / `.python-version`; possibly `uv` / `poetry` / `pip-tools` |
| `*.csproj` / `*.sln` | .NET SDK at the version in `global.json` |
| `go.mod` | Go at the version in the `go` directive |
| `Cargo.toml` | Rust toolchain at the version in `rust-toolchain.toml` |
| `Gemfile` | Ruby at the version in `.ruby-version` |
| `docker-compose*.yml` | Docker + `docker compose` v2 |
| Pre-commit hook config | `pre-commit` (or the project's hook tool) |

For each tool, capture installed-or-missing + version.

### 4. Present install options + ask consent

For each missing tool, use AskUserQuestion to surface the choice.
The recommended option is always the gentlest (user-scoped, no
sudo, clean uninstall).

#### macOS recommendations (general)

| Tool | Recommended (gentle) | Alternative | Skip impact |
|---|---|---|---|
| Homebrew | `curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh \| bash` | _system pkg manager_ | Most other installs assume brew. |
| Python | `pyenv install <version>` | `brew install python@<version>` | Backend / scripts won't run. |
| Node | `nvm install <version>` (per-project versioning) | `brew install node@<version>` | Frontend / Node-based tooling won't run. |
| Docker | Docker Desktop (download + install manually) | colima (lighter, CLI-only) | DB / containers must be installed natively; many tests skip. |
| pre-commit | `<project pkg manager> install pre-commit` (project-scoped) | `brew install pre-commit` | Lint hook won't fire. |

Add language-specific tools (`uv`, `poetry`, `dotnet`, etc.) as
the project's manifests dictate.

#### Windows recommendations (general)

| Tool | Recommended (gentle) | Alternative | Skip impact |
|---|---|---|---|
| winget | _ships with Win 10/11_ | Install from MS Store | Most other installs assume winget. |
| Python | `winget install Python.Python.<version>` | `pyenv-win install <version>` | Backend / scripts won't run. |
| Node | `winget install CoreyButler.NVMforWindows` then `nvm install <version> ; nvm use <version>` | `winget install OpenJS.NodeJS.LTS` | Frontend / Node-based tooling won't run. |
| Docker | Docker Desktop for Windows (download + install manually) | _no good lighter alternative on Windows_ | DB / containers must be installed natively. |
| pre-commit | `<project pkg manager> install pre-commit` | `winget install --id=pre-commit.pre-commit` | Lint hook won't fire. |

Wrap each install with:

1. AskUserQuestion: "I want to install <tool> via
   <recommended-method>. Alternative: <alternative>. Skip:
   <consequence>. Proceed?"
2. If approved, run the install.
3. On success, log the tool to a "rollback" list (what to show at
   the end).
4. On failure, surface the exact stderr to the user; offer to
   retry, pick the alternative, or skip.

Big installs (Docker Desktop, IDEs) link the user to the download
page rather than scripting them — the GUI installer needs admin
rights and human consent, and installing it silently violates
the user's trust.

### 5. Repo bootstrap

Once prereqs land, run the project's bootstrap. The exact
commands come from the project's manifests / scripts — common
shapes:

```bash
# Python (uv-managed)
uv sync --locked --group dev
uv run pre-commit install

# Python (pip / requirements)
python -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt

# Node
npm ci          # locked install — uses package-lock.json
# or pnpm install --frozen-lockfile / yarn install --immutable

# .NET
dotnet restore

# Go
go mod download

# Multi-stack project — run each
```

If the project ships a `scripts/dev/bootstrap.sh` (or
PowerShell equivalent), prefer that — the project's own script is
the most accurate source of truth for how to bootstrap.

If the project includes a frontend that's built separately, run
its build:

```bash
# Example: SPA build
cd <frontend-dir>
npm ci
npm run build
cd -
```

Surface any version mismatch errors verbatim and offer to bump
the relevant runtime via the appropriate version manager.

### 6. .env walkthrough — interactive + safety-aware

This is the most sensitive step. The user is providing real
credentials (third-party API tokens, signing keys, etc.) in
exchange for a working local stack.

**Open with the safety statement** before asking for any value:

> I'll walk through `.env.example` and ask for each value.
> A few important notes:
>
> - These credentials are written **directly to `.env`** in your
>   repo. Make sure `.env` is gitignored (I'll check).
> - When you give me a value via the chat, it lives in the chat
>   transcript. For a public/recorded demo, paste a throwaway
>   token, not your daily-driver one.
> - You can hit "skip" on any non-essential value; the skill will
>   leave it unset and the related feature will simply be
>   disabled.
> - Required-for-boot values are documented in `.env.example` —
>   I'll generate strong defaults for any cryptographic secrets
>   if you don't have your own.

Read `.env.example` and parse it into sections (typically
`# CATEGORY — Subcategory` headers). Walk section by section.

For each variable:

1. Show the variable name + the comment describing what it's for
   + any link to "where to get this token" that's already in
   `.env.example`.
2. Show the current value if `.env` already exists and the
   variable is set (treat existing values as a checkpoint —
   don't ask again unless the user wants to change it).
3. AskUserQuestion: provide it / skip / generate-strong-default
   (where applicable).
4. Write the value to `.env` immediately on response.
5. Move to the next variable.

#### Required-for-boot defaults

If the user has no value to provide for cryptographic secrets,
generate one. Common shapes:

| Kind | Default generator (example) |
|---|---|
| Random URL-safe token (JWT secret, session secret) | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| Symmetric encryption key | language-appropriate (e.g. Python: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) |
| DB connection string | match the value documented in `docker-compose*.yml` for the local DB service |

For random secrets, recommend the generated default — there's
no reason for a local stack to use a "real" one. Roll a fresh
value per install.

#### Sensitive sections (third-party tokens)

For any third-party API token / OAuth secret / signing key:

1. Acknowledge: "This is a credential. See note above re. chat
   transcripts."
2. Ask the user to paste the token.
3. Write it to `.env` immediately.
4. Confirm in chat as: `"Stored <VAR_NAME> to .env (length:
   N chars)"` — never echo the value itself.

#### Optional sections

Provider-specific keys (LLM providers, message platforms, doc
stores) — present each as a yes/skip question. Skipping disables
the corresponding feature but doesn't break boot.

Verify `.env` is git-ignored before continuing:

```bash
git check-ignore -v .env
# Expect: a line indicating .gitignore matches the file.
# If not, surface the warning and offer to add `.env` to .gitignore.
```

### 7. Bring up the stack

Once `.env` is in place, bring up the runtime stack using the
project's own start command. Common shapes:

```bash
# Compose-based stack
docker compose up -d --build

# Local-process stack
make dev   # or: <project's run script>

# Frontend-only project
npm run dev
```

This typically pulls dependencies, builds containers (if any),
runs migrations on first boot, and seeds default data.

Health-check the stack using the project's documented health
endpoints. Generic pattern:

```bash
# Wait up to 60s for the app to become healthy
for i in {1..60}; do
    curl -fs http://localhost:<port>/<health-path> > /dev/null && break
    sleep 1
done
curl -s http://localhost:<port>/<health-path>
```

If health-check times out, surface the relevant log output
(`docker compose logs <service> --tail 50`, or the local process
log) to the user and ask them to paste relevant errors back.

### 8. Smoke-test

Print a "you're done" block. Keep it project-shaped — pull the
URLs, default credentials (if any are documented), and "next
steps" from the project README:

```
✓ Backend running on http://localhost:<port>
✓ Health endpoint: http://localhost:<port>/<health-path>
✓ Frontend (if separate): http://localhost:<frontend-port>

Default credentials (if applicable):
  See <where-the-project-documents-them>

Change the default credentials before any real use.

Next steps:
  - Open the UI, log in, change the default password.
  - If you skipped any optional integrations, add them later by
    editing .env and running: <project's restart command>
  - Verify the lint gate works: make a tiny edit + git commit;
    pre-commit (or the project's hook tool) should fire.
```

### 9. Print the rollback summary

List every tool installed during this session with its uninstall
command. Generic pattern (specifics depend on what was actually
installed):

```
What I installed during this run:
  ✓ Homebrew              → /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
  ✓ Python <version>      → pyenv uninstall <version>   (or `brew uninstall python@<version>`)
  ✓ Node <version>        → nvm uninstall <version>     (or `brew uninstall node@<version>`)
  ✓ Docker Desktop        → drag from /Applications to Trash + sudo rm -rf ~/Library/Containers/com.docker.docker
  ✓ pre-commit            → <project pkg manager> uninstall pre-commit  (or `brew uninstall pre-commit`)

The project itself is just a directory — `rm -rf <repo>` is
sufficient to remove it. Container volumes are removed by
`docker compose down -v`.
```

## Anti-patterns

- ❌ Running `curl … | bash` without the user seeing the URL first.
- ❌ Modifying the user's PATH in `.bashrc` / `.zshrc` /
  `$PROFILE` permanently (let the installers handle their own
  PATH; print the relevant lines for the user to add manually if
  needed).
- ❌ Replacing system Python or system Node. Use a version
  manager (pyenv / nvm) when the user already has a system
  version.
- ❌ Echoing credentials back into the chat after writing them to
  `.env`. Confirm by length only.
- ❌ Auto-committing the populated `.env` (it should be
  gitignored, but double-check; never `git add .env`).
- ❌ Pretending the install succeeded when a step failed. Surface
  the error verbatim.
- ❌ Installing tools the project doesn't actually use, just
  because they're "common in dev environments".

## When to invoke

- "Help me set this up on a new laptop"
- "Onboard me onto the project"
- "Install the stack locally"
- "I want to demo this — what do I need?"

## When NOT to invoke

- The user already has a working install and just wants to run a
  workflow. Use a task-specific skill instead.
- The user is deploying to production. See the project's
  deployment docs.
- The user is on Linux and prefers system package managers
  (`apt` / `dnf` / `pacman`). This skill assumes Mac/Win; Linux
  is best-effort via the same Homebrew/pyenv/nvm flow.

## Open implementation questions for first run

These get pinned the first time the skill is invoked; subsequent
runs respect the previous choice:

1. **Docker preference** — Docker Desktop (heavy, GUI, fully
   supported) vs colima (Mac only, lighter, CLI). Recommended:
   Desktop unless the user has a low-end machine.
2. **Node version manager** — nvm (Mac) / nvm-windows (Win) is
   recommended for project-scoped Node. For users who only ever
   touch this one project, system Node via Homebrew/winget is
   fine.
3. **Python isolation** — `uv` or `poetry` handles venv
   per-project, so even the user's system Python can be used as
   the base interpreter. No need for pyenv unless they're
   juggling many Python versions.
4. **Pre-commit scope** — install via the project's package
   manager (project-scoped) or globally via Homebrew/winget?
   Recommended: project-scoped for tighter scoping.
