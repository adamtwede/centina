# Plugin file layout and manifest (design spec)

Status: design, not yet implemented. Companion to
`docs/plugin-setup-step.md` and `docs/plugin-checker-install.md` — this doc
covers the plugin bundle's own directory structure and manifest, which
those two depend on (`${CLAUDE_PLUGIN_ROOT}` paths, the `skills/` folder,
the `hooks/hooks.json` entry) but never specified directly.

Schema details below are sourced from the current official plugin
reference/development docs. Two things those docs leave undocumented are
called out explicitly rather than guessed at — see Open items.

## Directory tree

```
centina-plugin/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── skills/
│   ├── centina-session-zero/
│   │   └── SKILL.md
│   └── centina-iterate/
│       └── SKILL.md
├── bin/
│   └── centina-check
├── scripts/
│   └── session-start-install.mjs
├── checker/
│   ├── package.json
│   ├── cli.ts
│   ├── harness.ts
│   ├── types.ts
│   ├── vocabulary.ts
│   ├── tsPlugin.cjs
│   ├── tsPluginImpl.ts
│   └── rules/
│       └── *.ts
├── centina.ts
├── tsconfig.template.json
└── docs/
    ├── boundaries.md
    ├── fit-validation.md
    ├── plan-organization.md
    ├── plugin-setup-procedure.md
    └── output-management.md
```

This tree is exactly what `install.sh` (at the checkout's own root,
alongside but not part of this tree) copies into a durable install
location — see "Installing without keeping the checkout" below. The
checkout also carries dev-repo-only content this tree omits deliberately:
`specs/` (Centina's own dogfood specs), `README.md`, `CLAUDE.md`,
`ROADMAP.md`, root `package.json`/`package-lock.json` (the npm workspace
wrapper around `checker/`'s own `package.json`), `editors/vscode/`, and
`install.sh` itself.

`.claude-plugin/` holds only `plugin.json` — every other component
(`skills/`, `hooks/`, `bin/`) lives at plugin root, per the documented
convention. Skills are auto-discovered from `skills/` with no manifest
declaration required.

## `plugin.json`

Only `name` is required; everything else is optional metadata. Minimal
version:

```json
{
  "name": "centina",
  "displayName": "Centina",
  "version": "0.1.0",
  "description": "Spec-flavored TypeScript: type-checked falsework for coding tasks.",
  "license": "ISC"
}
```

No `dependencies` entry — that field is for declaring other *plugins* as
prerequisites (with semver constraints), which doesn't apply here; the
checker's own npm dependencies are handled entirely by
`docs/plugin-checker-install.md`'s `SessionStart` hook, outside the
manifest.

## `hooks/hooks.json`

Registers the checker install/update hook from
`docs/plugin-checker-install.md`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/session-start-install.mjs"
          }
        ]
      }
    ]
  }
}
```

`scripts/session-start-install.mjs` implements the copy-source /
hash-and-conditionally-`npm install` logic already specced in
`plugin-checker-install.md` — this file just wires it to the lifecycle
event.

## `skills/*/SKILL.md`

Content carries over from the current `.claude/skills/` files with two
required changes, identified earlier in this design process:

1. Every bare relative-path reference (`docs/plan-organization.md`,
   `docs/fit-validation.md`, this repo's own `CLAUDE.md` for the
   output-splitting rule) must become `${CLAUDE_PLUGIN_ROOT}/docs/...`.
   `ROADMAP.md` and `docs/session-zero-test-cases.md` references are
   dropped, not repathed — per the earlier "must travel vs. stays behind"
   classification, they're this project's own dev history, not
   spec-writing guidance. The output-splitting rule is extracted out of
   this repo's `CLAUDE.md` into its own bundled file
   (`docs/output-management.md`) rather than repathed, since there's no
   `CLAUDE.md` in the bundle to point at.
2. Each skill's first action must become a pointer to
   `${CLAUDE_PLUGIN_ROOT}/docs/plugin-setup-procedure.md` — the terse,
   imperative extraction of `docs/plugin-setup-step.md`'s Steps 0–5,
   written to actually be followed rather than to record design rationale.
   Both skills reference the same file rather than duplicating the
   procedure inline, the same single-source approach the project already
   uses for the tsconfig template and the vocabulary-alias resolver.

## `bin/centina-check`

Invokes the copy of the checker maintained by the `SessionStart` hook at
`${CLAUDE_PLUGIN_DATA}/checker/cli.ts`, not the bundle's own `ROOT` copy —
consistent with `plugin-checker-install.md`'s design, where `DATA` is the
only location with `node_modules` actually installed. Behavior: resolve
`${CLAUDE_PLUGIN_DATA}`, confirm `checker/node_modules` exists there (fail
with the explicit message specced in the checker-install doc if not), then
run the checker's CLI entry point against whatever arguments were passed
through, from a working directory inside `DATA` so ordinary Node module
resolution finds the installed dependencies without environment-variable
workarounds.

**Resolved: ship raw TypeScript, run via `tsx`, not precompiled JS.**
Considered precompiling to drop the `tsx` runtime dependency and its
loader-hook indirection, but at this stage — pre-1.0, checker rules still
actively changing — a build step in the release process is more machinery
than the project needs right now (the same "don't build for a
hypothetical future requirement" reasoning that applies to spec content
applies to the toolchain itself). `checker/package.json` in the bundle
declares `tsx` as a dependency alongside `ts-morph`/`typescript`, and gets
installed by the `SessionStart` hook like the others. Revisit precompiling
once the ruleset stabilizes and release cadence slows — noted in
ROADMAP.md as a deferred, not rejected, option.

## `tsconfig.template.json`

New addition this doc surfaces: `docs/plugin-setup-step.md`'s Step 4
currently hardcodes the stub tsconfig's JSON content directly in that
spec's prose. Better: ship one real `tsconfig.template.json` at plugin
root as the single source of truth, and have Step 4 read and copy *that*
file (substituting the plugin-path placeholder) rather than maintaining
the same compiler options in two places that can drift apart. This is a
small correction to fold back into `plugin-setup-step.md` before
implementation, not a new design question — flagging it here since this
is the doc that surfaces the plugin's own file layout.

## Installing without keeping the checkout

**Implemented.** `install.sh` at the checkout root copies exactly the
directory tree above into a destination (default
`~/.claude/skills/centina`) as a real, standalone directory — not a
symlink. Once it's run, the checkout is disposable: nothing in the copied
tree references the checkout's path (verified by grepping the installed
copy for the checkout's absolute path — no hits), and everything resolves
either through `${CLAUDE_PLUGIN_ROOT}` (now the install location itself,
whichever directory Claude Code loaded the plugin from) or
`${CLAUDE_PLUGIN_DATA}` (already independent of where `ROOT` lives, per
`docs/plugin-setup-step.md`'s Step 4 — that's what makes this work at all:
if the stub tsconfig still pointed at `ROOT`, an installed-then-deleted
checkout would break every existing project's live checking the same way
a moved-not-deleted checkout would have before that fix).

This is a frozen-snapshot install, not a tracked one: pulling an update in
a separate checkout, or re-cloning a newer version, does nothing to an
already-installed copy until `install.sh` runs again. That's a deliberate
match to how `claude plugin update` already behaves for a marketplace
install (an explicit action, not automatic), not a gap to close.

`install.sh` also strips `checker/node_modules` and
`checker/package-lock.json` from the copy if present from local dev use —
those are install-time artifacts the `SessionStart` hook regenerates
inside `${CLAUDE_PLUGIN_DATA}` on first use ( `docs/plugin-checker-install.md`),
so shipping a stale copy in the bundle itself would be redundant at best,
wrong at worst.

## Open items

- **`bin/` file convention is undocumented** — extension, shebang
  requirement, and Windows compatibility aren't specified in the current
  plugin reference docs. Needs empirical verification (test a trivial
  `bin/` script across platforms) before relying on any particular
  shebang/extension choice for `centina-check`.
- **`hooks/hooks.json`'s exact matcher semantics for `SessionStart`** —
  the example above uses `"matcher": "*"` by analogy with other hook
  types; whether `SessionStart` matchers support/require anything more
  specific wasn't confirmed. Verify against a working example before
  implementation.
