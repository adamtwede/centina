# What `centina-check setup` does, and running it yourself

`centina-check setup` stands a project up for Centina, and the skills run it at
the start of every session (`plugin-setup-procedure.md`). This page is for a
person: what the command writes, how to run it or the checker from a plain
shell, and a limit of the in-editor diagnostics. No skill reads it.

## What it writes

It does these, in order, and refuses before the first write if any can't be done:

- creates `specs/` if absent, and never touches what is already in it;
- copies `centina.ts` and `conformance.ts` from `${CLAUDE_PLUGIN_ROOT}`,
  replacing any existing copy and saying so when it differed (every spec imports
  `centina.ts` by relative path; `conformance.ts` is build-plane and read only by
  a `centina-realize` build tree, so a project that never runs that skill leaves
  it unread). A CRLF checkout of the same content is not a difference;
- writes `tsconfig.json` from `tsconfig.template.json`, with
  `compilerOptions.plugins[0].name` set to the absolute path of
  `${CLAUDE_PLUGIN_DATA}/checker/tsPlugin.cjs`, in forward slashes on every
  platform. It is the `DATA` copy, not the `ROOT` one, because that copy is
  the one the `SessionStart` hook keeps self-contained with its own
  `node_modules` (`plugin-checker-install.md`), and `DATA` is keyed by the plugin's
  name, not by where a checkout sits, so an existing project's tsconfig survives
  a moved checkout;
- ensures `<artifactsRoot>/.gitignore` lists `/tsconfig.json` (the file is
  machine-specific and must not be committed) and `<artifactsRoot>/.gitattributes`
  has `text eol=lf` for the four generated ledger files (`LEDGER-INDEX.md`,
  `LEDGER-LABELS.md`, `LEDGER.json`, `STANDING.md`). Existing content and line
  endings are kept, and no blanket `*` rule is added. The attributes are not
  required for a clean `ledger --check`, which ignores CRLF; they keep the
  committed bytes stable on a Windows checkout with `core.autocrlf=true`;
- writes `<artifactsRoot>/.centina/config.json`, or brings an existing one up to
  date (`plugin-setup-procedure.md`, "The config");
- appends `artifactsRoot` to `${CLAUDE_PLUGIN_DATA}/known-projects.json` unless
  it is already listed.

No docs are copied. The bundle's docs are read from `${CLAUDE_PLUGIN_ROOT}/docs/`
by whichever skill needs them; Centina's design reference (`boundaries.md`,
`fit-validation.md`, `plan-organization.md`) is not bundled at all, and a human
who wants it reads it in the Centina repository.

## Running it without a session

For example after moving to a new machine, where a copied `tsconfig.json` still
names the old machine's path. A plain shell has neither variable, so set them
first. Their values are the installed plugin and its data directory; under
`$CLAUDE_CONFIG_DIR` instead of `~/.claude` if that is set.

PowerShell:

```powershell
$env:CLAUDE_PLUGIN_ROOT = "$HOME\.claude\skills\centina"
$env:CLAUDE_PLUGIN_DATA = "$HOME\.claude\plugins\data\centina-skills-dir"
node "$env:CLAUDE_PLUGIN_ROOT\bin\centina-check" setup "C:\path\to\artifactsRoot"
```

macOS, Linux and WSL:

```sh
export CLAUDE_PLUGIN_ROOT="$HOME/.claude/skills/centina"
export CLAUDE_PLUGIN_DATA="$HOME/.claude/plugins/data/centina-skills-dir"
node "$CLAUDE_PLUGIN_ROOT/bin/centina-check" setup /path/to/artifactsRoot
```

The wrapper needs the checker's `node_modules` in `CLAUDE_PLUGIN_DATA`, which the
`SessionStart` hook puts there; if the directory is missing, start one Claude
Code session with the plugin loaded first. Claude Code names that directory, not
Centina, so if it differs on your machine, run `ls ~/.claude/plugins/data/` and
use the real name. The wrapper refuses to run while the dependencies are out of
date for the installed plugin version, rather than report from stale ones; the
next Claude Code session start reinstalls them.

To run a check rather than setup, the same variables apply:

```sh
node "$CLAUDE_PLUGIN_ROOT/bin/centina-check" --project ./tsconfig.json path/to/spec.centina.ts
```

Relative paths resolve against the directory you ran the command from, not
against the checker's own install location.

## A limit to know about

**The `plugins` entry does not load in at least one tsserver.** The checker CLI
never reads `compilerOptions.plugins`, so `centina-check` is unaffected, and the
stale path of a copied `tsconfig.json` breaks nothing there. Only an editor's
tsserver reads it, and tsserver from TypeScript 6.0.3 declines it on Windows, in
either slash spelling: its log reads `Skipped loading plugin <path> because only
package name is allowed plugin name`. So the live in-editor diagnostics are not
confirmed to work from this entry on that version, and an editor that bundles
another TypeScript may differ. Check the editor's tsserver log before relying on
them.
