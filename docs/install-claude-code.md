# Install: Claude Code

## Getting started

### Claude Code setup

Centina ships as a self-contained Claude Code plugin. There is nothing to install globally and no server to run — Claude Code installs the checker's own dependencies for you the first time it needs them. To stand up your first spec:

1. **Clone the Centina repo, anywhere, and install it.** The clone is a
   one-time source for the install — not something you keep around or
   reference afterward.

   ```console
   git clone https://github.com/adamtwede/centina.git
   cd centina && node install.mjs
   ```

   `install.mjs` is plain Node, so the same command works on Windows
   (PowerShell or cmd), macOS and Linux; `./install.sh` is a thin wrapper
   around it for POSIX shells. It asks before overwriting an existing
   install (`--yes` skips the question) and refuses a destination that
   would delete the clone or your home directory.

   This copies the plugin (vocabulary, checker, skills, docs — see
   [docs/plugin-file-layout.md](plugin-file-layout.md) for exactly
   what) into `~/.claude/skills/centina/` (`%USERPROFILE%\.claude\skills\centina`
   on Windows; both follow `CLAUDE_CONFIG_DIR` if you set it), which Claude Code auto-loads
   every session with no flag needed. **You can delete the clone after
   this step.** Nothing in the installed copy references the clone's
   location — Claude Code loads the plugin from the install location
   itself, and the one thing a project depends on afterward for live
   in-editor checking (the compiled checker) lives in Claude Code's own
   persistent per-plugin data directory, keyed by the plugin's name, not
   by any checkout's path. Keep the clone around only if you plan to pull
   updates and re-run `install.mjs` later — it's a frozen snapshot, not a
   tracked link.

   `bin/centina-check` (the checker's CLI) ends up at
   `~/.claude/skills/centina/bin/centina-check`. That's fine for normal
   use — Claude Code skills invoke it directly via `${CLAUDE_PLUGIN_ROOT}`,
   nothing to configure there.

   Prefer a one-off session against a specific checkout instead (no
   install, no lasting change)? `claude --plugin-dir /path/to/centina`
   loads it for that session only. See
   [Plugin distribution and install mechanics](plugin-distribution.md)
   for this and the marketplace options, once you want to share Centina
   with someone else or across machines.

   To run the checker from a terminal, see [Running it without a session](plugin-setup-procedure.md#running-it-without-a-session).

2. **Start Claude Code from the project you want to spec.**

   ```console
   cd your-project
   claude
   ```

3. **Invoke the `centina-session-zero` skill.** It's auto-discovered from
   the plugin (`/centina-session-zero`, or it may surface on its own from a
   description of what you want to build). First invocation in a new tree
   runs the setup procedure — [docs/plugin-setup-procedure.md](plugin-setup-procedure.md)
   — which asks where the host project root and Centina's own files
   (`artifactsRoot`, defaulting to `./centina/`) should live, then walks you
   through each gated phase: eliciting the shape, routing every undecided
   question into a visible hole, and emitting a skeleton spec set plus an
   `ARCHITECTURE.md` at the end.

   Not using Claude Code? See
   [Using Centina without Claude Code](install-other-harnesses.md#using-centina-without-claude-code)
   below — the skills are plain markdown any capable agent can follow, but
   the setup steps this section automates need to happen by hand instead.

**What you end up with.** Session zero hands off a skeleton spec set plus `ARCHITECTURE.md`; running `centina-iterate` on each component then walks it to clean and, once it's clean, derives that component's `PLAN.md` from it, reconciling `ARCHITECTURE.md`'s contract and hole ledgers against the now-finished component immediately beforehand, so the ledger never claims more
than what's actually settled. Repeat `centina-iterate` per component until the seams you intend to implement now all have plans (see [Which specs earn a plan](plan-organization.md): Not every component needs one immediately; a mocked boundary is a legitimate, practical, and even
advisable stopping point, allowing you to shepherd complex projects through meaningful, isolated phases).

The end state is a self-contained package: one or more `PLAN.md` files (pegged to boundary-sets, not necessarily one per file — see [docs/plan-organization.md](plan-organization.md)) plus a reconciled `ARCHITECTURE.md` recording the DAG, the frozen contracts, and what's still deferred. That package is designed to travel. Hand it to any coding agent, in this repo or an entirely different codebase, and it has everything it needs to implement against, with no in-session context required.

For what actually happens in that session (and in `centina-iterate`, the follow-on that refines a single spec toward complete) see [How to actually use it](using-it.md#how-to-actually-use-it).
