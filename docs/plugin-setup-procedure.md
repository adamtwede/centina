# Plugin setup procedure

Run this before anything else in `centina-session-zero` or `centina-iterate`.
Terse and imperative on purpose — this is what to do, not why. For rationale,
see `plugin-setup-step.md` in the project's dev history (not bundled here).

## Step 0 — registry fast path

Read `${CLAUDE_PLUGIN_DATA}/known-projects.json` (a flat list of
`artifactsRoot` paths). If CWD is a descendant of any entry (plain
path-prefix match), bind to that project and stop — skip every step below.

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
  "hostRoot": "<resolved absolute path from Step 1>",
  "artifactsRoot": "<resolved absolute path>",
  "pluginVersion": "<version field from ${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json>"
}
```

Append `artifactsRoot` to `${CLAUDE_PLUGIN_DATA}/known-projects.json`.

## Step 3 — create the directory shape

At `artifactsRoot`, if not already present, create:

- `specs/`
- `centina.ts` — copy (not symlink) of `${CLAUDE_PLUGIN_ROOT}/centina.ts`.
  Every spec imports this by relative path; without it, specs don't
  resolve.
- Copies (not symlinks) of `${CLAUDE_PLUGIN_ROOT}/docs/boundaries.md`,
  `fit-validation.md`, `plan-organization.md`.

## Step 4 — write the stub tsconfig

At `artifactsRoot`, write `tsconfig.json`: copy
`${CLAUDE_PLUGIN_ROOT}/tsconfig.template.json`, substituting
`compilerOptions.plugins[0].name` with the literal absolute path to
`${CLAUDE_PLUGIN_ROOT}/checker/tsPlugin.cjs`, resolved at write time (the
env var itself won't resolve later, when tsserver reads the file).

## Idempotency

Steps 3 and 4 regenerate unconditionally every time this procedure runs —
cheap writes, no diff-and-skip needed. If `pluginVersion` in the existing
config doesn't match the currently loaded plugin, say so in one line
("stub tsconfig regenerated: plugin updated from 0.3.0 → 0.4.0").

Steps 1 and 2 never re-run once a config exists anywhere Step 0 or a fresh
walk can find it.
