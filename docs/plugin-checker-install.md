# Vendored checker install/update (design spec)

Status: design, not yet implemented. Companion to
`docs/plugin-setup-step.md` — that doc covers per-project setup
(triggered by a skill, once per tree); this one covers keeping the
plugin's *own* checker dependencies (`ts-morph`, `typescript`) installed
and current, which is global to the plugin install, not per-project, and
runs via `SessionStart` rather than a skill.

## Problem

The plugin bundle (`${CLAUDE_PLUGIN_ROOT}`) ships `checker/` and
`centina.ts` as source, plus `checker/package.json` declaring their
runtime dependencies (`ts-morph`, `tsx`; `typescript` is a peer of both
`checker/` and the repo's own root-level `tsc` usage). In this repo,
`checker/` is also an npm workspace member — that's purely a dev-repo
convenience so `npm install` at the root hoists `checker/`'s deps for
local work; it has no bearing on the plugin bundle itself, which ships
`checker/package.json` standalone and installs it independently at
`${CLAUDE_PLUGIN_DATA}` per this doc. Those dependencies need to actually be installed somewhere
before `bin/centina-check` can run — and that can't happen at bundle-build
time the way an ordinary npm package's `node_modules` would, because
`${CLAUDE_PLUGIN_ROOT}` is the plugin's distributed content, not
necessarily writable, and gets replaced wholesale on update (unconfirmed —
see open items). `${CLAUDE_PLUGIN_DATA}` is the plugin's persistent,
writable, per-installation directory — that's where the install has to
live.

A second wrinkle specific to this project: it's ESM (`"type": "module"`
in `package.json`). Node's ESM resolver doesn't honor `NODE_PATH` the way
CommonJS does, so "run source from `ROOT`, resolve deps from `DATA`" can't
be done with an environment-variable trick — the two need to be colocated,
or `ROOT`'s `node_modules` needs to be a real (writable) location.

## Design: copy source into DATA, don't rely on ROOT being writable

Rather than assume `${CLAUDE_PLUGIN_ROOT}` can be written to (symlinking
a `node_modules` into it, for instance), treat `${CLAUDE_PLUGIN_DATA}` as
the single writable working area and copy everything the checker needs
into it — source and dependencies both. This avoids depending on an
unconfirmed assumption about `ROOT`'s writability, at the cost of a small
amount of redundant copying.

Two cost tiers, handled differently:

- **Cheap: copying `checker/` and `centina.ts` source.** A handful of
  small `.ts` files. Regenerate unconditionally, and cheap enough that
  `bin/centina-check` repeats it before every run rather than trusting
  `SessionStart` alone — see "Source freshness" below. No diff-and-skip
  logic is needed when the operation is this cheap.
- **Expensive: `npm install` for `ts-morph`/`typescript`.** Real time and
  network cost. Gate behind a content comparison, only run when changed.

## `SessionStart` hook behavior

Fires on every Claude Code session, including ones with nothing to do with
Centina — so the no-op path (nothing changed) must stay cheap: a file read
and a hash comparison, not a full reinstall attempted every time.

1. Copy `${CLAUDE_PLUGIN_ROOT}/checker/*` and
   `${CLAUDE_PLUGIN_ROOT}/centina.ts` into `${CLAUDE_PLUGIN_DATA}/checker/`
   and `${CLAUDE_PLUGIN_DATA}/centina.ts`, overwriting unconditionally.
2. Hash `${CLAUDE_PLUGIN_ROOT}/checker/package.json` and compare against
   a stored hash at `${CLAUDE_PLUGIN_DATA}/.installed-package-hash`.
   - **Match:** done. No install step. This is the common case on every
     session after the first.
   - **Mismatch or marker absent (first run, or plugin update changed
     dependencies):** copy `package.json` into
     `${CLAUDE_PLUGIN_DATA}/checker/`, run `npm install` there, and only
     on a **successful** exit write the new hash to the marker file.
3. **On install failure** (offline, `npm` not on `PATH`, registry error,
   disk full): leave the old marker untouched, so the next session retries
   rather than incorrectly believing it's up to date. Surface a clear,
   human-visible message rather than failing silently — this is the same
   silent-failure shape already flagged for the tsserver-discovery problem
   in the setup-step doc, and it's just as bad here: a checker that
   quietly never runs is worse than one that visibly errors.

## Source freshness

`SessionStart` is not enough on its own, and the original design's claim
that "unconditional means no stale-copy failure mode" was wrong: it is
unconditional *per session*, and a plugin update lands *during* one. The
hook does not fire again, so `DATA` keeps running the previous checker.

Measured in Chrysalis Underworld (`sensor-door:F31`'s own follow-up): a
human updated the plugin mid-session, `buildRoots` was registered, and the
checker printed `ledger: clean` twice against a tree with seven genuine
errors, because the `DATA` copy predated the rule and had nothing to
report. It was caught only by a deliberate positive control.

The shape is what makes it serious. A missing `node_modules` is detected
and refused with a clear message; a stale source copy **passes**. That is
the same failure the ledger's citation rules exist to catch — nothing in
an invalid state, an unchanged artifact whose meaning moved underneath it
— and it lands on exactly the run where a human has just added a rule and
most wants to know whether the tree complies.

So the source copy belongs in both callers. `scripts/checker-sync.mjs`
holds it, and `scripts/session-start-install.mjs` and `bin/centina-check`
both call it. `cpSync` adds and replaces without deleting, which is why
`DATA`'s installed `node_modules` survives a sync; a dev checkout's own
`node_modules` is filtered out so it is not dragged across.

## `bin/centina-check` wrapper

Invokes the copy at `${CLAUDE_PLUGIN_DATA}/checker/cli.ts` (via `tsx`, or
its compiled-JS equivalent — see open item below), never the `ROOT` copy
directly, so module resolution naturally finds
`${CLAUDE_PLUGIN_DATA}/checker/node_modules` by ordinary upward directory
resolution — no environment-variable tricks needed, since source and
dependencies are colocated by construction.

Before invoking, in order:

1. **Sync source** from `ROOT` ("Source freshness"). When
   `CLAUDE_PLUGIN_ROOT` is unset the sync cannot run, so say so on stderr
   rather than proceeding as if the copy were known current.
2. **Check `${CLAUDE_PLUGIN_DATA}/checker/node_modules` exists.** If it
   doesn't (install never succeeded, or hasn't run yet this install), fail
   with an explicit message pointing at the cause — "checker dependencies
   aren't installed; this should resolve on the next session start, or
   check network access" — rather than letting a bare module-not-found
   stack trace surface to whatever invoked the wrapper.
3. **Compare the dependency hash** against the marker. A mismatch means the
   synced source is newer than the installed dependencies, so refuse:
   running current rules against older dependencies is the same
   silent-wrong-answer case in a different place. The install happens at
   the next session start, and the message says so.
4. **Say which checker ran** — version and `ROOT` path, on stderr. Cheap,
   and it makes the thing that was invisible visible.

`pluginVersion` is read from `ROOT`'s own manifest rather than from
`.centina/config.json`'s `pluginVersion`, which is written once at project
setup and never maintained afterward.

## Concurrency

Two sessions starting at the same moment could both see a hash mismatch
and both trigger `npm install` into the same directory. Not handled here
beyond flagging it — worth a simple lock file (`.installing`, skip or wait
if present) if this turns out to matter in practice, but not worth
designing further pre-emptively for a low-probability, non-corrupting
race (worst case is a redundant simultaneous install, not corrupted
output, since `npm install` into a shared directory twice is generally,
if not perfectly, safe).

## Open items

- Whether `${CLAUDE_PLUGIN_ROOT}` is actually writable at runtime, and
  whether it persists unchanged across plugin updates or gets replaced
  wholesale — unconfirmed. This design deliberately doesn't depend on the
  answer (everything writable lives in `DATA`), but if `ROOT` turns out to
  be safely writable and persistent, the simpler symlink-based alternative
  (`ROOT/checker/node_modules` → `DATA/node_modules`) becomes viable and
  avoids the source-copy step entirely.
- Whether `SessionStart` hooks have a defined way to surface a message to
  the human on failure, or whether "surface a clear message" needs a
  different mechanism (e.g., deferring the error to the first skill
  invocation that actually needs the checker, rather than trying to
  message from the hook itself).
- ~~Whether to ship `checker/` as raw TypeScript run via `tsx`... or
  precompiled to plain JS~~ — **resolved** in `docs/plugin-file-layout.md`:
  raw TS via `tsx`, revisit once the ruleset stabilizes.
