# Install: Claude Code

Centina ships as a self-contained Claude Code plugin. There's nothing to install globally and no server to run. Claude Code even installs the checker's dependencies for you, the first time it needs them. Here's how to get to your first spec.

## 1. Install the plugin

Clone the Centina repo, anywhere you like, and run the installer:

```console
git clone https://github.com/adamtwede/centina.git
cd centina && node install.mjs
```

That copies the plugin (the vocabulary, the checker, the skills, and the docs the skills read; [Plugin file layout](/plugin-file-layout) has the exact list) into `~/.claude/skills/centina/`, or `%USERPROFILE%\.claude\skills\centina` on Windows. Claude Code loads it from there in every session, with no flag needed. If you've set `CLAUDE_CONFIG_DIR`, the install goes under that directory instead.

A few details worth knowing:

- `install.mjs` is plain Node, so the same command works on Windows (PowerShell or cmd), macOS, and Linux. `./install.sh` is a thin wrapper around it for POSIX shells.
- If there's already an install at the destination, it asks before overwriting it. `--yes` skips the question.
- Installing clears the destination first, so it refuses any destination that would take the clone or your home directory with it.

**You can delete the clone once it's installed.** The clone is a one-time source, not a link. Nothing in the installed copy points back at it. Claude Code loads the plugin from the install location, and the compiled checker that live in-editor checking depends on lives in Claude Code's own per-plugin data directory, keyed by the plugin's name rather than by any checkout's path. The only reason to keep the clone is if you plan to `git pull` updates later and re-run `install.mjs`.

The checker's command-line tool ends up at `~/.claude/skills/centina/bin/centina-check`. There's nothing to configure there, because the skills call it directly through `${CLAUDE_PLUGIN_ROOT}`. If you want to run the checker from a terminal yourself, see [Running it without a session](/plugin-setup-procedure#running-it-without-a-session).

Would you rather try it out for a single session without installing anything? `claude --plugin-dir /path/to/centina` loads it for that session only, with no lasting change. [Plugin distribution](/plugin-distribution) covers that option, plus the marketplace options for when you want to share Centina with someone else or use it across machines.

## 2. Start Claude Code in your project

```console
cd your-project
claude
```

## 3. Run session zero

Invoke the `centina-session-zero` skill, either with `/centina-session-zero` or by describing what you want to build and letting it come up on its own. The first time you run it in a new project, it goes through the [setup procedure](/plugin-setup-procedure), which asks where your project root is and where Centina's own files should live (`artifactsRoot`, `./centina/` by default). From there it walks you through each gated phase: drawing out the shape, routing every undecided question into a visible hole, and finally writing a skeleton spec set and an `ARCHITECTURE.md`.

Not using Claude Code? See [Using Centina without Claude Code](/install-other-harnesses#using-centina-without-claude-code). The skills are plain markdown that any capable agent can follow, but you'll have to do the setup steps Claude Code automates by hand.

## What you end up with

Session zero hands you a skeleton spec set and an `ARCHITECTURE.md`. From there, you run `centina-iterate` on each component. It walks the component to clean, and once it's clean, it derives that component's `PLAN.md`. Right before it does, it brings `ARCHITECTURE.md` and the system [ledger](/ledger) up to date with the finished component, so the record never claims more than what's actually settled.

Keep running `centina-iterate`, one component at a time, until every seam you intend to build now has a plan. Not every component needs one right away. A mocked boundary is a legitimate stopping point, and often a smart one, because it lets you shepherd a complex project through meaningful, isolated phases. ([Which specs earn a plan](/plan-organization) goes into this.)

The end result is a self-contained package: one or more `PLAN.md` files (pegged to boundary-sets, not necessarily one per file), plus a reconciled `ARCHITECTURE.md` recording the DAG, the frozen contracts, and what's still deferred. That package is designed to travel. Hand it to any coding agent, in this repo or a completely different codebase, and it has everything it needs to implement against, no in-session context required.

For what actually happens inside those sessions, see [How to actually use it](/using-it#how-to-actually-use-it).
