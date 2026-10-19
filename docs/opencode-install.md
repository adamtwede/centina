# Installing Centina for OpenCode

Covers a one-time, correct-the-first-time install of Centina for
[Opencode](https://github.com/anomalyco/opencode), which requires different steps from what is
detailed in [Claude Code setup](install-claude-code.md), or even in [Using Centina without Claude Code](install-other-harnesses.md)
as presently written, which covers a more general (but less turnkey) setup.

## Why the generic "without Claude Code" instructions aren't enough

[Using Centina without Claude Code](install-other-harnesses.md)
already covers running the checker with no Claude Code environment variables
set. That's necessary but not sufficient for OpenCode specifically, because of
one additional constraint that doesn't exist for a human running commands by
hand: sandboxing.

#### Sandbox workarounds

**Many harnesses run every session inside an OS-level sandbox 
(e.g., `sandbox-exec` / Seatbelt on macOS) that only grants file-read access 
to `$CWD` (wherever the session happens to start) plus a fixed `$HOME` 
allowlist — never an arbitrary sibling path.** It cannot "hike up" out of 
`$CWD` to read a project checkout that happens to live somewhere else on disk,
the way a human's shell or an unsandboxed agent could. These sandbox configs are 
often regenerated from a canonical source on every harness startup, so there is no 
local workaround — a policy change has to be requested from the harness maintainers,
not patched in place.

The practical consequence: if you clone Centina to, say, `~/Projects/centina`
and point a skill's `${CLAUDE_PLUGIN_ROOT}`-equivalent references directly at
that checkout, every reference resolves *correctly* only for a OpenCode session
started inside that checkout. Start a session in any other project — which
is the normal case, since Centina specs a project you're actually working
on — and OpenCode cannot read `centina.ts`, the `docs/` reference files, or
`tsconfig.template.json` from the checkout at all. The setup procedure and
both skills fail partway through, having looked fine in whatever directory
you tested them from.

**The fix:** install Centina's runtime files (the subset a skill or the
checker actually reads, not the dev checkout itself) into a location that
*is* on OpenCode's `$HOME` allowlist, regardless of `$CWD`. This is typically
 `~/.config/<harness name>/`, e.g., `~/.config/opencode/`. Please note 
that this is just an example of a vanilla OpenCode setup, in reality your own 
harness might have a different name, which you'll want to use here, as well as 
everywhere else in this document where this (or an equivalent) path is referenced.
This plays the same role Claude Code's `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` 
play for the plugin install, just resolved once at install time into concrete paths 
instead of by an environment variable OpenCode doesn't set.

**Note:** confirm your own OpenCode config's sandbox allowlist
first. For example, grep its `sandbox.sb` for `home-subpath`/`home-literal` entries
before assuming `~/.config/opencode` is included; this doc assumes the
allowlist observed at the time of writing. If your agent lacks proper read/write
privileges to any such paths, you will need to improvise by installing the
required files within a directory your agent can read/write.

## One-time install steps

Do these once. `$CENTINA_CHECKOUT` below is wherever you cloned *this repo*
(e.g. `~/Projects/centina`) — it is **not** touched at runtime after this,
only used to produce the install and to source updates from later.

1. **Standalone install, to a sandbox-reachable path — not the dev
   checkout.** Reuse the repo's own `install.mjs`, same as the Claude Code
   path, just pointed at `~/.config/opencode/centina` instead of
   `~/.claude/skills/centina`:

   ```console
   cd $CENTINA_CHECKOUT
   node install.mjs ~/.config/opencode/centina
   ```

   This copies `centina.ts`, `conformance.ts`, `tsconfig.template.json`,
   `checker/` (source only — see next step), and the `docs/` subset the
   skills reference (`plugin-setup-procedure.md`, `output-management.md`,
   `ledger.md`, `measurement-methodology.md`, `realize-conformance.md`, `trail.md`, `session-zero-routing.md`,
   `session-zero-reference.md`, `iterate-reference.md`) into the install root, and
   deliberately strips `checker/node_modules` and
   `package-lock.json` — those are install-time artifacts, not something to
   ship stale.

2. **Install the checker's own dependencies into the data dir, once, with the bundled SessionStart hook.** The checker runs from `centina-data/checker/`, the only copy with `node_modules`. This is the same split as Claude Code's `${CLAUDE_PLUGIN_DATA}`. The hook copies the checker source there and runs `npm install`, gated by a hash of `checker/package.json`. Running it again is also how updates are applied (see "Updating the install"):

   ```console
   CLAUDE_PLUGIN_ROOT=~/.config/opencode/centina \
   CLAUDE_PLUGIN_DATA=~/.config/opencode/centina-data \
   node ~/.config/opencode/centina/scripts/session-start-install.mjs
   ```

   Verify `~/.config/opencode/centina-data/checker/node_modules/.bin/tsx` exists afterward. That binary is what the adapted `centina-iterate` skill invokes directly in place of Claude Code's `bin/centina-check` (which hard-requires `CLAUDE_PLUGIN_DATA` and refuses to run without it).

3. **Create a persistent data directory, separate from the install root.**
   This is the OpenCode stand-in for `${CLAUDE_PLUGIN_DATA}`. It holds the
   checker's synced source and `node_modules` (step 2), the cross-project
   registry (`known-projects.json`), and the adapted setup procedure (step 4).
   It must be a **different** directory from step 1's install root, because
   `install.mjs` does `rm -rf` and recreates that root wholesale on every run.
   Anything written inside it, including the checker's `node_modules`, would be
   destroyed on the next refresh. (Step 2 creates it if missing, so this is a
   no-op after step 2.)

   ```console
   mkdir -p ~/.config/opencode/centina-data
   ```

4. **Write the OpenCode-adapted setup procedure** to
   `~/.config/opencode/centina-data/setup-procedure.md`: a copy of
   `~/.config/opencode/centina/docs/plugin-setup-procedure.md` with these
   substitutions applied throughout, using absolute, `~`-expanded paths in the
   written file:

   | In the procedure | Replace with |
   |---|---|
   | `${CLAUDE_PLUGIN_ROOT}` | `~/.config/opencode/centina` |
   | `${CLAUDE_PLUGIN_DATA}` | `~/.config/opencode/centina-data` |
   | `node "<root>/bin/centina-check" ...` | `CLAUDE_PLUGIN_ROOT=<root> CLAUDE_PLUGIN_DATA=<data> node "<root>/bin/centina-check" ...`, the environment set inline on the same command |

   The last row is needed because `centina-check` refuses to run without both
   variables, and no session sets them here. It is the same form the procedure's
   own "Running it without a session" section shows.

   The procedure's Step 1 directory walk will generally find nothing past `$CWD`
   under this sandbox, because parent directories aren't readable. That is
   expected, not a bug, and the walk should degrade gracefully rather than error.

5. **Install the two skills into OpenCode's global skill directory,**
   `~/.config/opencode/skill/centina-session-zero/SKILL.md` and
   `~/.config/opencode/skill/centina-iterate/SKILL.md` — copies of
   `skills/centina-session-zero/SKILL.md` and
   `skills/centina-iterate/SKILL.md` with:
   - Every `${CLAUDE_PLUGIN_ROOT}/docs/...` reference resolved to
     `~/.config/opencode/centina/docs/...` (the **install** root, never the
     dev checkout).
   - The `${CLAUDE_PLUGIN_ROOT}/docs/plugin-setup-procedure.md` reference
     resolved instead to the OpenCode-adapted copy from step 4,
     `~/.config/opencode/centina-data/setup-procedure.md`.
   - `centina-iterate`'s `${CLAUDE_PLUGIN_ROOT}/bin/centina-check` invocation
     replaced with a direct call to the data dir's checker, which is the copy
     that has `node_modules`. The install root's copy does not:
     `~/.config/opencode/centina-data/checker/node_modules/.bin/tsx ~/.config/opencode/centina-data/checker/cli.ts --project <artifactsRoot>/tsconfig.json <file>`.

   **Before writing there by hand**, confirm your OpenCode config's global
   skill directory isn't itself managed by an automated vendoring/sync tool
   (e.g. `peru`, if your OpenCode config uses it) — check for a
   `.peru`/`peru.yaml` alongside it. If it is, a hand-written file can be
   silently overwritten on the next sync; use whatever escape hatch that
   tooling provides for personal, unsynced skills instead of writing
   straight into the synced tree.

## What must resolve into the install, never the dev checkout

Every path a skill or the setup procedure reads **at runtime** (i.e.,
whenever `centina-session-zero` or `centina-iterate` actually runs, not just
at install time) must resolve into `~/.config/opencode/centina` or
`~/.config/opencode/centina-data` — never into `$CENTINA_CHECKOUT`. A session
started in an unrelated project can't be assumed to be able to read the checkout 
directory, so any leftover reference to it fails invisibly until someone starts a 
session from the wrong place. Concretely, this covers:

- `centina.ts`
- `docs/boundaries.md`, `docs/fit-validation.md`, `docs/plan-organization.md`,
  `docs/output-management.md`
- `tsconfig.template.json`
- `~/.config/opencode/centina-data/checker/cli.ts`,
  `~/.config/opencode/centina-data/checker/tsPlugin.cjs`,
  `~/.config/opencode/centina-data/checker/node_modules/.bin/tsx` (the checker
  runs from the data dir; see step 2)
- `.claude-plugin/plugin.json` (only its `version` field, if a skill
  surfaces it)

The dev checkout (`$CENTINA_CHECKOUT`) is only ever needed again for
"Updating the install" below — nothing at runtime should read from it.

## Updating the install after a `git pull`

`install.mjs` overwrites the install root wholesale and deliberately strips
`checker/node_modules`/`package-lock.json` on every run. The root's dependencies
are never carried over, and the data dir's `node_modules` lives outside the
root, so it survives. Step 2's hook re-syncs the checker source and reinstalls
dependencies only if `checker/package.json` changed:

```console
cd $CENTINA_CHECKOUT
git pull
node install.mjs ~/.config/opencode/centina
CLAUDE_PLUGIN_ROOT=~/.config/opencode/centina CLAUDE_PLUGIN_DATA=~/.config/opencode/centina-data node ~/.config/opencode/centina/scripts/session-start-install.mjs
```

The two installed `SKILL.md` copies (step 5) and the adapted setup procedure
(step 4) are **not** regenerated by `install.mjs` — they're static files this
process hand-derives from the source skills, not symlinks or templated
output. If the source skills or `docs/plugin-setup-procedure.md` change
upstream, redo steps 4–5's substitutions by hand (or ask an agent to redo
them against the new source text) after the `git pull` above. There is no
auto-sync; a stale copy will keep working but silently miss upstream fixes.

## Verifying the install

Confirm every path in "What must resolve into the install" is actually
readable, and that the checker runs, from a scratch directory that is
**neither** `$CENTINA_CHECKOUT` **nor** the install root — that's the one
condition the whole install exists to satisfy, so it's the only test that
actually proves it:

```console
mkdir -p /tmp/centina-install-check/specs
cp ~/.config/opencode/centina/tsconfig.template.json /tmp/centina-install-check/tsconfig.json
# substitute compilerOptions.plugins[0].name -> ~/.config/opencode/centina-data/checker/tsPlugin.cjs
cp ~/.config/opencode/centina/centina.ts /tmp/centina-install-check/
cat > /tmp/centina-install-check/specs/demo.centina.ts <<'EOF'
import { deferred } from "../centina"
export function add(a: number, b: number): number {
  return deferred<(a: number, b: number) => number>()(a, b)
}
EOF
~/.config/opencode/centina-data/checker/node_modules/.bin/tsx \
  ~/.config/opencode/centina-data/checker/cli.ts \
  --project /tmp/centina-install-check/tsconfig.json \
  /tmp/centina-install-check/specs/demo.centina.ts
```

Expect `tsc: clean`, then warnings only, with a `hole-enumeration` warning on the
`deferred` call and a `spec-explanation` warning on the file. Warnings are a
correctly-working checker, not a failure. Exit code is 0. Clean up
`/tmp/centina-install-check` afterward.

## Uninstalling

Everything this install writes lives in the four locations below — nothing
touches `$CENTINA_CHECKOUT`, so uninstalling never requires touching the
Centina git clone itself (delete it separately, or keep it, independent of
this procedure).

1. **The two installed skills:**

   ```console
   rm -rf ~/.config/opencode/skill/centina-session-zero
   rm -rf ~/.config/opencode/skill/centina-iterate
   ```

   If your OpenCode config's skill directory is peru-vendored (see the caveat
   in step 5 of the install above) and you installed these as an override
   or in a personal/unsynced location instead of directly under
   `~/.config/opencode/skill/`, remove them from wherever that override
   actually placed them instead.

2. **The standalone install (the checker source and the skills' reference docs):**

   ```console
   rm -rf ~/.config/opencode/centina
   ```

3. **The OpenCode-specific data dir** (the checker's `node_modules`, the adapted
   setup procedure, and the cross-project registry):

   ```console
   rm -rf ~/.config/opencode/centina-data
   ```

4. **Per-project artifacts, if you want them gone too.** Uninstalling the
   tool doesn't retroactively remove anything a `centina-session-zero` or
   `centina-iterate` session wrote into a project's own `artifactsRoot`
   (default `<project>/centina/`) — that's project content (specs,
   `ARCHITECTURE.md`, `PLAN.md` files), not install state, and this
   procedure deliberately leaves it alone. Remove it by hand, per project,
   only if you actually want the specs gone:

   ```console
   rm -rf <project>/centina
   ```

   There's no central list of which projects have one of these short of
   `known-projects.json` from step 3 above — read it before deleting step 3
   if you want to track down every project that has an `artifactsRoot`
   before its registry disappears.

Steps 1–3 alone fully remove the tool (skills stop being discoverable, and
even a stale skill invocation fails cleanly — every path it reads lives
under `~/.config/opencode/centina*`, which is now gone). Step 4 is optional
and separate, since it deletes project-owned content, not install state.
