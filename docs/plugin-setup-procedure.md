# Plugin setup procedure

Run this before anything else in `centina-session-zero` or `centina-iterate`.
Terse and imperative on purpose — this is what to do, not why. For rationale,
see `plugin-setup-step.md` in the project's dev history (not bundled here).

Two things need a human's answer: which directory is the host project root, and
whether to create a new project. Everything else is one command,
`centina-check setup`, which is deterministic and safe to rerun. Do not
reproduce its work by hand.

```
node "${CLAUDE_PLUGIN_ROOT}/bin/centina-check" setup [--host-root <path>] <artifactsRoot>
node "${CLAUDE_PLUGIN_ROOT}/bin/centina-check" setup --find <dir>
```

## Step 0 — registry fast path

Run `centina-check setup --find <CWD>`. It prints the registered
`artifactsRoot` that CWD sits at or under (nearest first, matching whole path
segments, ignoring an entry whose `.centina/config.json` is gone), or prints
nothing.

If it printed a root, bind to that project, skip Steps 1 and 2, and go straight
to Step 3 — the project already has a root and a config, but its generated files
still need refreshing against the loaded plugin.

If it printed nothing, this is a first run in this tree. Continue to Step 1.

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

If Step 0 found no registry entry and this is about to create a new config, ask
first: "No existing Centina project found. Create a new one at
`<artifactsRoot>`?" — fires once per tree, never on a subsequent session once a
config exists anywhere Step 0 or this walk can reach.

## Step 3 — run setup

Run `centina-check setup <artifactsRoot>`. Add `--host-root <path>` with the
Step 1 answer when the project has no config yet, or when the command asks for
it. Relative paths resolve against the directory you run it from. Say what it
reported in a line or two; do not paste its output.

It creates `specs/`, copies `centina.ts` and `conformance.ts`, writes
`tsconfig.json`, keeps `.gitignore` and `.gitattributes` current, writes or
updates `.centina/config.json` (below), and registers the project in
`${CLAUDE_PLUGIN_DATA}/known-projects.json`. It refuses before the first write if
any of that can't be done, and it copies no docs. What each write is for, how to
run setup or the checker from a plain shell, and why live editor diagnostics may
not load are in `centina-check-setup.md`, for a human who asks. You don't need
it to run setup.

### The config

```json
{
  "hostRoot": "<path from artifactsRoot to the host root, forward slashes, e.g. \"..\">",
  "artifactsRoot": ".",
  "pluginVersion": "<version field from ${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json>"
}
```

Both paths are **relative** to the directory holding `.centina/`, which is the
artifacts root, so `artifactsRoot` is always `"."`: the config is committed and
read on other machines, and an absolute path is right on only one.
`known-projects.json` is machine-local and stays absolute.

The file gains other keys as they are needed — `ledgerHook`, and a `systems`
entry per system carrying its `buildRoots` (`ledger.md`, "The checker"). Setup
keeps every key it does not own, in place.

On an existing config, setup:

- rewrites an absolute `hostRoot` or `artifactsRoot` as relative;
- refuses an absolute `hostRoot` that does not exist on this machine, because the
  config came from another one and it will not derive the host root from the dead
  path. Offer the nearest ancestor of the artifacts root that holds a `.git`
  (Step 1, option 2; the refusal names it), ask the human to confirm, and rerun
  with `--host-root`;
- warns about a relative `hostRoot` that does not resolve to a directory;
- writes the loaded plugin version into `pluginVersion`, and when it differed
  from the old one reports `stub tsconfig regenerated: plugin updated from X → Y`.
  Without that write the same line would reappear every run.

### What to do with what it reports

- A `NOTE` that `tsconfig.json` is tracked by git: give the human the
  `git rm --cached` command it printed. Do not run it.
- A refusal: fix the cause it names and rerun. Nothing was written. Don't work
  around it by editing the files it would have written.
- `CLAUDE_PLUGIN_DATA/checker/tsPlugin.cjs is missing`: the checker isn't
  installed yet. It installs at the start of a Claude Code session with the plugin
  loaded; if this is one, `centina-check` itself would have refused first.

## Idempotency

Setup rewrites only what differs, and a project that is already current is left
byte-for-byte alone (`setup: <root> is already current`), so run it at the start
of every session, Step 0's fast path included. It is the only thing that carries
an updated `centina.ts` or tsconfig template into a project set up under an older
plugin version, so never skip it for a known project.

Steps 1 and 2 never re-run once a config exists anywhere Step 0 or a fresh walk
can find it.

