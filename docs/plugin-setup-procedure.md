# Plugin setup procedure

Run this before anything else in `centina-session-zero` or `centina-iterate`.
Terse and imperative on purpose — this is what to do, not why. For rationale,
see `plugin-setup-step.md` in the project's dev history (not bundled here).

## Step 0 — registry fast path

Read `${CLAUDE_PLUGIN_DATA}/known-projects.json` (a flat list of
`artifactsRoot` paths). If CWD is a descendant of any entry (plain
path-prefix match), bind to that project, skip Steps 1 and 2, and go
straight to Step 3 — the project already has a root and a config, but its
generated files still need refreshing against the loaded plugin.

If the file doesn't exist or nothing matches, this is a first run in this
tree. Continue to Step 1.

## Step 1 — resolve the host project root (first run only)

Ask the human to pick one:

1. **CWD** — the root is wherever the session started. Verify CWD is
   readable.
2. **Walk up to `$HOME`, collecting every `.git` found.** From CWD upward
   through `$HOME`: verify each directory is readable (stop the walk, keep
   what's collected so far, on the first unreadable one); record any
   directory containing `.git`. Present matches nearest-first. If nothing
   is found before `$HOME`, fall back to option 1 or 3.
3. **User-supplied path** — verify it's readable immediately. Reject and
   re-prompt on failure.

Never accept a candidate without a verified read against it, in all three
cases.

## Step 2 — resolve the artifacts root

Ask where Centina's files should live (default `./centina/` under CWD).

If no registry entry matched in Step 0 and this is about to create a new
config, ask first: "No existing Centina project found. Create a new one at
`<artifactsRoot>`?" — fires once per tree, never on a subsequent session
once a config exists anywhere Step 0 or this walk can reach.

Write `<artifactsRoot>/.centina/config.json`:

```json
{
  "hostRoot": "<path from artifactsRoot to the Step 1 host root, forward slashes, e.g. \"..\">",
  "artifactsRoot": ".",
  "pluginVersion": "<version field from ${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json>"
}
```

Write both paths **relative**, never absolute: the config is committed and read
on other machines, and an absolute path is right on only one. They are relative
to the directory holding `.centina/`, which is the artifacts root, so
`artifactsRoot` is always `"."`. (`known-projects.json` below is machine-local
and stays absolute.)

Those three keys are what setup writes; the file gains others as they are
needed — `ledgerHook`, and a `systems` entry per system carrying its
`buildRoots` (`ledger.md`, "The checker"). Keep any that are already there
when rewriting this file.

Append `artifactsRoot` to `${CLAUDE_PLUGIN_DATA}/known-projects.json`.

## Step 3 — create the directory shape

At `artifactsRoot`:

- `specs/` — create if absent.
- `centina.ts` — copy (not symlink) of `${CLAUDE_PLUGIN_ROOT}/centina.ts`,
  overwriting any existing copy. Every spec imports this by relative path;
  without it, specs don't resolve.
- `conformance.ts` — copy of `${CLAUDE_PLUGIN_ROOT}/conformance.ts`, same
  rules. Build-plane, not spec vocabulary: only a `centina-realize` build
  tree imports it, and a project that never runs that skill simply leaves it
  unread.

No docs are copied. The bundle's docs — `ledger.md`,
`output-management.md`, `measurement-methodology.md`, `realize-conformance.md`, `trail.md`, `session-zero-routing.md`,
`session-zero-reference.md`, `iterate-reference.md` and this file — are
read from `${CLAUDE_PLUGIN_ROOT}/docs/` by whichever skill needs them.
Centina's design reference (`boundaries.md`, `fit-validation.md`,
`plan-organization.md`) is not bundled at all; a human who wants it reads it
in the Centina repository.

## Step 4 — write the stub tsconfig

At `artifactsRoot`, write `tsconfig.json`: copy
`${CLAUDE_PLUGIN_ROOT}/tsconfig.template.json`, substituting
`compilerOptions.plugins[0].name` with the literal absolute path to
`${CLAUDE_PLUGIN_DATA}/checker/tsPlugin.cjs` — **not** the `${CLAUDE_PLUGIN_ROOT}`
copy — resolved at write time (the env var itself won't resolve later, when
tsserver reads the file). The `DATA` copy is the one the `SessionStart` hook
already keeps self-contained with its own `node_modules` (see
`docs/plugin-checker-install.md`), and `DATA` is keyed by the plugin's name,
not by where its checkout happens to sit — pointing here instead of at
`ROOT` means an existing project's `tsconfig.json` keeps working even if the
checkout is later moved or renamed.

Write the path with forward slashes on every platform: Windows accepts them,
and a backslash path needs every `\` escaped inside the JSON string.

The result is machine-specific, so it must not be committed. Make sure
`<artifactsRoot>/.gitignore` lists `/tsconfig.json` (create the file or append
the line; keep any other content). If the file is already tracked by git, say
so and give the human `git rm --cached <path>` to run themselves — do not run
it. A fresh clone has no `tsconfig.json` until this step runs, which it does on
the first session there.

The ledger command's generated files are written with LF endings, and a
Windows checkout with `core.autocrlf=true` turns them into CRLF. The checker
compares them ignoring that difference, so this is not required for a clean
`centina-check ledger --check`; it keeps the committed bytes stable. Make sure
`<artifactsRoot>/.gitattributes` has these lines (create the file or append
what is missing; keep any other content, and don't add a blanket `*` rule to a
repo that didn't ask for one):

```
LEDGER-INDEX.md text eol=lf
LEDGER-LABELS.md text eol=lf
LEDGER.json text eol=lf
STANDING.md text eol=lf
```

### Regenerating the tsconfig by hand

Running any centina skill regenerates it (this procedure runs at the start of
each). To do it without a session, for example after moving to a new machine,
where a committed or copied `tsconfig.json` still names the old machine's path:

- the plugin's own copy is at `~/.claude/skills/centina/` (or
  `$CLAUDE_CONFIG_DIR/skills/centina/`), the `CLAUDE_PLUGIN_ROOT` of a session;
- `CLAUDE_PLUGIN_DATA` is `~/.claude/plugins/data/centina-skills-dir` (under
  `$CLAUDE_CONFIG_DIR` instead, if that is set). It holds the checker with its
  `node_modules`, put there by the `SessionStart` hook; if
  `<DATA>/checker/tsPlugin.cjs` is missing, start one Claude Code session with
  the plugin loaded first.

Windows (PowerShell; set `$art` to the artifacts root):

```powershell
$art = "C:/path/to/artifactsRoot"
$data = "$HOME/.claude/plugins/data/centina-skills-dir"
$plugin = ($data -replace '\\','/') + "/checker/tsPlugin.cjs"
(Get-Content "$HOME/.claude/skills/centina/tsconfig.template.json" -Raw).Replace('<placeholder, substituted at generation time>', $plugin) | Set-Content -NoNewline "$art/tsconfig.json"
```

macOS, Linux and WSL:

```sh
CLAUDE_PLUGIN_ROOT="$HOME/.claude/skills/centina"
CLAUDE_PLUGIN_DATA="$HOME/.claude/plugins/data/centina-skills-dir"
sed "s#<placeholder, substituted at generation time>#$CLAUDE_PLUGIN_DATA/checker/tsPlugin.cjs#" \
  "$CLAUDE_PLUGIN_ROOT/tsconfig.template.json" > /path/to/artifactsRoot/tsconfig.json
```

Don't use the `sh` form from Git Bash on Windows: it writes `/c/Users/...`,
which Windows programs don't resolve.

**The `plugins` entry does not load in at least one tsserver.** The checker
CLI never reads `compilerOptions.plugins`, so `centina-check` is unaffected,
and the stale path of a copied `tsconfig.json` breaks nothing there. Only an
editor's tsserver reads it, and tsserver from TypeScript 6.0.3 declines it on
Windows, in either slash spelling: its log reads `Skipped loading plugin
<path> because only package name is allowed plugin name`. So the live in-editor
diagnostics are not confirmed to work from this entry on that version, and an
editor that bundles another TypeScript may differ. Check the editor's tsserver
log before relying on them.

## Idempotency

Steps 3 and 4 regenerate unconditionally every time this procedure runs,
Step 0's fast path included — cheap writes, no diff-and-skip needed. This
is the only thing that carries an updated `centina.ts`, docs or tsconfig
template into a project set up under an older plugin version, so never skip
them for a known project.

If `pluginVersion` in the existing config doesn't match the currently
loaded plugin, say so in one line ("stub tsconfig regenerated: plugin
updated from 0.3.0 → 0.4.0"), then write the loaded version into the
config. Without that write the same line reappears every session.

**Migrating an older config.** If `hostRoot` or `artifactsRoot` in the existing
config is an absolute path, rewrite it relative, keeping every other key:
`artifactsRoot` becomes `"."`, and `hostRoot` the path from the artifacts root
to the host root (usually `".."`), with forward slashes. When the absolute
`hostRoot` does not exist on this machine the config came from another one:
don't derive it from the dead path; offer the nearest ancestor of the artifacts
root that holds a `.git` (Step 1, option 2) and ask the human to confirm. Say
what changed in one line.

Steps 1 and 2 never re-run once a config exists anywhere Step 0 or a fresh
walk can find it.
