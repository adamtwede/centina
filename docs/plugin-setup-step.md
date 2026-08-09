# Plugin setup step (design spec)

Status: design, not yet implemented. Written during a packaging-design session
(2026-08). Assumes the "Centina ships as a global Claude Code plugin" decision
(see conversation log / future ROADMAP.md entry) and the "fully self-contained,
no required host-project references" requirement that decision was built on.

## Problem

The plugin is installed once, globally, and its skills (`centina-session-zero`,
`centina-iterate`) become available in any Claude Code session regardless of
CWD. That's what makes it usable from an arbitrary folder. But the checker
(`tsc` under Centina's permissive `tsconfig.json`) needs to run isolated from
whatever host project a session happens to be sitting inside — it must not
pick up the host's own `tsconfig.json`, and it must correctly find whichever
`specs/` tree the human is actually working in, wherever that lives.

Two failure modes drove this design:

1. **Static `include` globs in a bundled `tsconfig.json` are relative to that
   file's own directory**, not CWD. A configurable artifacts location outside
   the plugin bundle is invisible to them.
2. **tsserver's live in-editor diagnostics discover a governing `tsconfig.json`
   by walking up from the open file**, independent of however the CLI checker
   loads its config. If a spec file lives inside a host project that has its
   own `tsconfig.json` between the spec and the filesystem root, tsserver
   finds the host's config first and Centina's rules silently never load —
   no error, just missing squiggles.

## Distribution model this assumes

- Centina ships as a Claude Code plugin, installed once, globally available.
- No required files or references in the host project. A host project can
  sit adjacent to or contain a Centina project's artifacts, but never needs
  to declare anything about Centina itself.
- Skills, not a `SessionStart` hook, own the interactive parts of this setup
  (host-root selection, artifacts-root selection). `SessionStart` fires on
  every session including ones with nothing to do with Centina, so it's
  reserved for the cheap, silent, non-interactive part: keeping the plugin's
  own vendored `node_modules` in sync with its bundled `package.json` (the
  documented Claude Code plugin pattern for this).
- The setup step below runs as the first action of `centina-session-zero`
  (or `centina-iterate`, if invoked standalone against a tree with no
  existing config) — before anything else in the skill.

## Step 0 — fast-path discovery via global registry

Before anything else, check `${CLAUDE_PLUGIN_DATA}/known-projects.json` — a
flat list of every `artifactsRoot` any prior setup run has established, on
this machine, across all host projects. If CWD is a descendant of any
registered root (plain path-prefix match, no filesystem walking), bind to
that project immediately. Skip every step below.

This is the primary discovery mechanism, not the upward filesystem walk in
Step 1. It's O(1), has no depth limit, and correctly finds a project no
matter how deeply nested the session's CWD is below the project's root —
which matters because spec hierarchies are expected to nest
(`specs/<system>/<component>/<sub-component>/...`), often deeper than any
reasonable fixed walk-up cap would reach.

If no registry entry matches, this is a first run in this tree. Proceed to
Step 1.

## Step 1 — resolve the host project root (first run only)

"Host project root" = the boundary of the codebase the Centina project will
live within or alongside, not the Centina project's own root. This step
establishes that boundary for two purposes: as the key recorded in the
registry, and — separately, and not guaranteed by this step alone — as
input to whatever filesystem-access confinement Claude Code's own permission
settings enforce. This step produces a *logical* boundary for Centina's
bookkeeping; it is not itself an access-control mechanism.

Require the human to choose one of three methods. No silent default.

**(1) CWD.** The root is wherever the session started. No upward read at
all. Verify CWD itself is readable before accepting — checked explicitly,
not assumed.

**(2) Walk up to `$HOME`, collecting every `.git` directory found along the
way.** Starting at CWD, check each directory upward through and including
`$HOME`:
  - Verify it's readable.
  - If unreadable (permission denied), stop the walk immediately. Keep
    whatever was collected below that point — don't fail the whole search.
  - If readable, check for a `.git` entry; record a match.

Present the collected list to the human, sorted nearest-first (tightest
scope first, broadest/monorepo-root last). This matters in monorepos: a
nested package's own `.git` and an enclosing monorepo's `.git` both show up
as distinct, separately selectable candidates, rather than the walk
guessing and silently landing on whichever is nearest (which can be far
broader than intended).

If the walk collects nothing before `$HOME`, fall back to prompting for
option 1 or 3.

**(3) User-supplied path.** Take the literal path, verify it immediately
with a read (confirm it exists and is accessible). Reject and re-prompt on
failure rather than silently falling back to something else.

**General rule, applies to all three:** never accept a candidate directory
as the root without a verified read against it. Not special to option 2 —
same check in all three cases, just applied at every level of the walk
there instead of once.

## Step 2 — resolve the artifacts root

Ask where Centina's own files (`specs/`, `docs/`, config) should live,
defaulting to `./centina/` under CWD. Write the result, along with the
Step 1 host root and the currently-loaded plugin version, to:

```
<artifactsRoot>/.centina/config.json
```

```json
{
  "hostRoot": "<resolved absolute path from Step 1>",
  "artifactsRoot": "<resolved absolute path>",
  "pluginVersion": "<bundled plugin version at generation time>"
}
```

Also append `artifactsRoot` to the global registry
(`${CLAUDE_PLUGIN_DATA}/known-projects.json`) so Step 0 finds it on every
future session, from any CWD beneath it, without walking anything.

**Before writing anything**, if no registry hit occurred *and* Step 1/2 are
about to create a brand-new config, surface one confirmation line first:

> "No existing Centina project found. Create a new one at `<artifactsRoot>`?"

This exists because upward discovery (were it ever used instead of the
registry) can only ever find projects *above* CWD, never inside descendant
directories — a session started at a parent of an existing nested project
has no way to detect it and would otherwise silently create a second,
independent one. The confirmation gives the human a chance to notice before
that happens. Fires once per tree, on first run only — never on subsequent
sessions once a config exists anywhere the registry or this walk can reach.

## Step 3 — create the directory shape

At `artifactsRoot`, if not already present:

- `specs/`
- Copies (not symlinks) of the bundled reference docs from
  `${CLAUDE_PLUGIN_ROOT}/docs/`: `boundaries.md`, `fit-validation.md`,
  `plan-organization.md`. These are the docs identified as load-bearing
  guidance the skills actively cite, as opposed to this project's own
  dev-history docs (`ROADMAP.md`, `session-zero-test-cases.md`), which stay
  behind and never ship.

## Step 4 — write the stub `tsconfig.json`

At `artifactsRoot`, write a fully self-contained config — not an `extends`
pointer back to the plugin's bundled `tsconfig.json`. `extends` was
considered and rejected: `compilerOptions.plugins` is opaque to `tsc` itself
(only tsserver's plugin loader reads it), and there's no confirmed guarantee
tsserver rebases a relative plugin path correctly when it's inherited
through `extends` rather than declared directly. Inlining removes the
question entirely, and costs nothing extra since this file is regenerated
every run anyway (see Step 5).

The content written isn't hardcoded in this step — it's read from
`${CLAUDE_PLUGIN_ROOT}/tsconfig.template.json` (see
`docs/plugin-file-layout.md`), so the plugin's own compiler options and
this generated stub can't drift apart by being maintained in two places.
The template:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "plugins": [{ "name": "<placeholder, substituted at generation time>" }]
  },
  "include": ["*.centina.ts", "specs/**/*.centina.ts"]
}
```

Step 4 copies this template, substituting the `plugins[0].name` placeholder
for the literal absolute path to `checker/tsPlugin.cjs` resolved from
`${CLAUDE_PLUGIN_ROOT}` at generation time — `${CLAUDE_PLUGIN_ROOT}` is a
Claude-Code-tool-call-time environment variable, and tsserver reading the
generated file later has no way to resolve that variable itself, so the
substitution must happen at write time, not left as a variable in the
output.

Writing this file at `artifactsRoot` is also what fixes tsserver's discovery
problem (failure mode 2, above): tsserver's upward walk from an open spec
file now finds this stub before it can find any host project's own
`tsconfig.json`, because the stub sits at the nearest enclosing directory.

## Step 5 — point the harness at the resolved config

`checker/harness.ts` currently hardcodes its tsconfig path relative to its
own module location (`path.resolve(__dirname, "..", "tsconfig.json")`) —
correct for the single-project layout this repo has today, wrong once
`artifactsRoot` is configurable. It needs to instead read `artifactsRoot`
from `.centina/config.json` (found via Step 0's registry or a fresh Step
1–4 run) and load `<artifactsRoot>/tsconfig.json`. This is the one required
code change, not just a generation step.

## Idempotency

Steps 3 and 4 (directory shape, stub tsconfig) regenerate unconditionally
on every skill invocation once a config exists — cheap JSON/file writes,
not an `npm install`, so there's no reason to diff-then-conditionally-skip.
If `pluginVersion` in `.centina/config.json` doesn't match the currently
loaded plugin, log one line to the human ("stub tsconfig regenerated:
plugin updated from 0.3.0 → 0.4.0") so a compiler-option or rule change
isn't silent.

Steps 1 and 2 (host-root and artifacts-root resolution) never re-run once a
config exists anywhere Step 0's registry lookup or a fresh walk can find —
they're first-run-per-tree only.

## Harness portability

Everything above is written against Claude Code specifically —
`${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PLUGIN_ROOT}`, the `SessionStart` hook,
and `centina-session-zero`/`centina-iterate` as Claude Code skills. Centina
itself has no reason to be Claude-Code-only — the vocabulary and checker are
plain TypeScript — so a future agent harness with a different plugin/skill
mechanism (or none at all) needs to be able to run this same setup without
those primitives existing. This section separates what a different harness
must reimplement from what it can take unchanged.

**Fixed regardless of harness — do not vary these:**

- The `.centina/config.json` schema (`hostRoot`, `artifactsRoot`,
  `pluginVersion` or an equivalent harness/tooling version field).
- The generated stub `tsconfig.json`'s content and the decision to inline
  rather than `extends` (Step 4's reasoning holds independent of which
  harness triggered the write).
- The directory shape at `artifactsRoot` (Step 3).
- The read-before-accept rule for every candidate directory (Step 1's
  general rule) — this isn't a Claude Code sandboxing accommodation
  specifically, it's a correctness rule for any harness that might have its
  own, differently-shaped filesystem restrictions.
- Discovery order: a fast registry-style lookup before any filesystem walk,
  a bounded/human-confirmed walk only as fallback (Step 0 vs. Step 1).
- `checker/harness.ts` reading its tsconfig path from resolved config rather
  than a hardcoded location (Step 5) — this is harness-agnostic TypeScript,
  not Claude-Code-specific, and should not need to change per agent harness.

**Claude-Code-specific — a different harness must supply its own equivalent:**

- **Persistent registry storage.** `${CLAUDE_PLUGIN_DATA}` is Claude Code's
  per-plugin persistent directory. A different harness needs its own
  durable, per-installation location for `known-projects.json` — wherever
  that harness conventionally keeps tool-level state.
- **Trigger point.** Here, the setup step runs as the first action inside a
  skill invocation. A harness without a skill concept needs some other
  well-defined trigger — e.g., a CLI wrapper that runs this check before
  invoking the checker, or an explicit `centina init` command run by hand.
- **Interactive prompting.** Steps 1 and 2 require putting a choice in front
  of a human. The mechanism for that (a skill's conversational turn here)
  doesn't exist in a non-conversational harness — a CLI-driven equivalent
  (flags, an interactive prompt, a config file the human edits by hand
  first) needs to satisfy the same "no silent default, verify before
  accept" requirement, not necessarily the same UI.
- **`${CLAUDE_PLUGIN_ROOT}` substitution.** Any harness needs some way to
  resolve "where is my own bundled `checker/tsPlugin.cjs`" to a literal
  absolute path at generation time — the mechanism is harness-specific, the
  requirement (bake a literal path into the stub, never a variable) is not.

**Adapter checklist for a new harness:** to add support, supply (a) a
persistent storage location, (b) a trigger point, (c) an interactive (or
explicitly non-interactive, human-edited) way to satisfy Steps 1–2, and (d)
a way to resolve its own bundle's absolute path — then reuse Steps 3–5 and
the config schema unchanged. If a harness can't satisfy the read-before-accept
or no-silent-default requirements at all (e.g., a fully non-interactive batch
mode), it should refuse to run setup rather than silently relaxing them.

## Open items

- Exact walk boundary/registry interaction needs implementation-time
  verification against real Claude Code plugin data-directory semantics
  (`${CLAUDE_PLUGIN_DATA}` scoping — confirm it's readable/writable the way
  this design assumes).
- Whether `${CLAUDE_PLUGIN_ROOT}` substitution needs to happen via the skill
  itself (reading the env var at tool-call time) or some other mechanism —
  not yet confirmed against actual plugin runtime behavior.
- This document doesn't yet cover plugin versioning/update mechanics beyond
  the `pluginVersion` comparison — see the earlier plugin-manifest research
  (SessionStart hook diffing bundled `package.json` for `node_modules`
  install/update) for the adjacent, already-researched piece.
