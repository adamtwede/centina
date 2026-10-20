# Installing Centina for OpenCode

This page covers a one-time install of Centina for [OpenCode](https://github.com/anomalyco/opencode) that works the first time. OpenCode needs different steps from the [Claude Code install](/install-claude-code), and more than the general [Using Centina without Claude Code](/install-other-harnesses) page covers.

## Why the general instructions aren't enough

[Using Centina without Claude Code](/install-other-harnesses) already covers running the checker without any of Claude Code's environment variables. For OpenCode that's necessary but not sufficient, because of one more constraint that a human typing commands by hand never runs into: sandboxing.

### The sandbox problem

**Many harnesses run every session inside an OS-level sandbox (for example `sandbox-exec`, or Seatbelt, on macOS) that only grants read access to `$CWD`, wherever the session started, plus a fixed allowlist under `$HOME`. It never grants access to an arbitrary sibling path.** A sandboxed session can't climb out of `$CWD` to read a checkout that lives somewhere else on disk, the way your own shell or an unsandboxed agent could. These sandbox configs are often regenerated from a canonical source every time the harness starts, so there's no local workaround. A policy change has to be requested from the harness maintainers, not patched in place.

Here's what that means in practice. Say you clone Centina to `~/Projects/centina` and point the skills' `${CLAUDE_PLUGIN_ROOT}` references straight at that checkout. Every reference resolves correctly, but only for an OpenCode session started *inside* that checkout. Start a session in any other project, which is the normal case since you're speccing a project you're actually working on, and OpenCode can't read `centina.ts`, the `docs/` reference files, or `tsconfig.template.json` at all. The setup procedure and the skills fail partway through, after looking fine in whatever directory you tested them from.

**The fix** is to install Centina's runtime files (the subset the skills and the checker actually read, not the whole dev checkout) somewhere that *is* on OpenCode's `$HOME` allowlist, no matter what `$CWD` is. That's typically `~/.config/<harness name>/`, which for a vanilla OpenCode setup is `~/.config/opencode/`. Your harness may go by a different name. If it does, use that name here and everywhere else this page uses `~/.config/opencode`. This plays the same role `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` play for the Claude Code plugin, except the paths are resolved once, at install time, instead of through environment variables OpenCode doesn't set.

**Check your own allowlist first.** For example, grep your OpenCode config's `sandbox.sb` for `home-subpath` and `home-literal` entries before assuming `~/.config/opencode` is on it. This page assumes the allowlist observed at the time of writing. If your agent can't read and write those paths, you'll need to improvise and install the files into a directory it can.

## One-time install steps

Do these once. Below, `$CENTINA_CHECKOUT` is wherever you cloned this repo (for example `~/Projects/centina`). Nothing reads it at runtime. It's only used to produce the install, and later as the source for updates.

1. **Install to a sandbox-reachable path, not the dev checkout.** This uses the repo's own `install.mjs`, same as the Claude Code install, just pointed at `~/.config/opencode/centina` instead of `~/.claude/skills/centina`:

   ```console
   cd $CENTINA_CHECKOUT
   node install.mjs ~/.config/opencode/centina
   ```

   That copies the vocabulary (`centina.ts`, `conformance.ts`), `tsconfig.template.json`, the skills, the checker's source, and the `docs/` subset the skills read (`plugin-setup-procedure.md`, `output-management.md`, `ledger.md`, `measurement-methodology.md`, `realize-conformance.md`, `trail.md`, `session-zero-routing.md`, `session-zero-reference.md`, `iterate-reference.md`) into the install root. It deliberately leaves out `checker/node_modules` and `checker/package-lock.json`. Those are install-time artifacts, and shipping a stale copy would cause more trouble than it saves.

2. **Create a data directory, separate from the install root.** This is OpenCode's stand-in for `${CLAUDE_PLUGIN_DATA}`. It holds the checker's synced source and its `node_modules` (step 3), the cross-project registry (`known-projects.json`), and the adapted setup procedure (step 4). It **must** be a different directory from step 1's install root, because `install.mjs` deletes and recreates that root on every run. Anything written inside it, including the checker's `node_modules`, would be wiped out on the next update.

   ```console
   mkdir -p ~/.config/opencode/centina-data
   ```

3. **Install the checker's dependencies into the data directory** with the bundled SessionStart hook. The checker runs from `centina-data/checker/`, the only copy that has `node_modules`, which is the same split Claude Code makes with `${CLAUDE_PLUGIN_DATA}`. The hook copies the checker source there and runs `npm install`, but only when a hash of `checker/package.json` has changed. Running it again is also how you apply updates (see [Updating the install](#updating-the-install-after-a-git-pull)).

   ```console
   CLAUDE_PLUGIN_ROOT=~/.config/opencode/centina \
   CLAUDE_PLUGIN_DATA=~/.config/opencode/centina-data \
   node ~/.config/opencode/centina/scripts/session-start-install.mjs
   ```

   Afterward, check that `~/.config/opencode/centina-data/checker/node_modules/.bin/tsx` exists. The adapted skills call that binary directly, in place of Claude Code's `bin/centina-check`, which refuses to run without `CLAUDE_PLUGIN_DATA`.

4. **Write the OpenCode-adapted setup procedure** to `~/.config/opencode/centina-data/setup-procedure.md`. It's a copy of `~/.config/opencode/centina/docs/plugin-setup-procedure.md` with these substitutions applied throughout, using absolute, `~`-expanded paths in the written file:

   | In the procedure | Replace with |
   |---|---|
   | `${CLAUDE_PLUGIN_ROOT}` | `~/.config/opencode/centina` |
   | `${CLAUDE_PLUGIN_DATA}` | `~/.config/opencode/centina-data` |
   | `node "<root>/bin/centina-check" ...` | `CLAUDE_PLUGIN_ROOT=<root> CLAUDE_PLUGIN_DATA=<data> node "<root>/bin/centina-check" ...`, with the environment set inline on the same command |

   The last row is there because `centina-check` won't run without both variables, and nothing sets them here. It's the same form the procedure's own "Running it without a session" section uses.

   Under this sandbox, the procedure's Step 1 directory walk will usually find nothing above `$CWD`, because parent directories aren't readable. That's expected, not a bug. The walk should come up empty gracefully rather than error out.

5. **Install the four skills into OpenCode's global skill directory,** as `~/.config/opencode/skill/<skill>/SKILL.md` for each of `centina-session-zero`, `centina-iterate`, `centina-realize`, and `centina-spike`. Each one is a copy of `skills/<skill>/SKILL.md` with these changes:

   - Every `${CLAUDE_PLUGIN_ROOT}/docs/...` reference resolved to `~/.config/opencode/centina/docs/...` (the **install** root, never the dev checkout).
   - The `${CLAUDE_PLUGIN_ROOT}/docs/plugin-setup-procedure.md` reference resolved instead to the adapted copy from step 4, `~/.config/opencode/centina-data/setup-procedure.md`.
   - Any `${CLAUDE_PLUGIN_ROOT}/bin/centina-check` invocation (`centina-iterate` and `centina-spike` have one) replaced with a direct call to the data directory's checker, since that's the copy with `node_modules` and the install root's copy isn't:
     `~/.config/opencode/centina-data/checker/node_modules/.bin/tsx ~/.config/opencode/centina-data/checker/cli.ts --project <artifactsRoot>/tsconfig.json <file>`.

   **Before writing there by hand,** make sure your OpenCode config's global skill directory isn't managed by an automated vendoring or sync tool (`peru`, for example). Look for a `.peru` or `peru.yaml` next to it. If there is one, a hand-written file can be silently overwritten on the next sync. Use whatever escape hatch that tool provides for personal, unsynced skills instead of writing straight into the synced tree.

## What must resolve into the install, never the dev checkout

Every path a skill or the setup procedure reads **at runtime**, meaning whenever one of the skills actually runs and not just at install time, has to resolve into `~/.config/opencode/centina` or `~/.config/opencode/centina-data`. Never into `$CENTINA_CHECKOUT`. You can't assume a session started in an unrelated project can read the checkout, so any leftover reference to it fails silently until someone starts a session from the wrong place. Concretely, that covers:

- `centina.ts`
- the `docs/` files listed in step 1
- `tsconfig.template.json`
- `~/.config/opencode/centina-data/checker/cli.ts`, `~/.config/opencode/centina-data/checker/tsPlugin.cjs`, and `~/.config/opencode/centina-data/checker/node_modules/.bin/tsx` (the checker runs from the data directory; see step 3)
- `.claude-plugin/plugin.json` (only its `version` field, if a skill reports it)

The only time you need the dev checkout again is for [Updating the install](#updating-the-install-after-a-git-pull) below. Nothing at runtime should read from it.

## Updating the install after a `git pull`

`install.mjs` replaces the install root wholesale on every run and deliberately leaves out `checker/node_modules` and `checker/package-lock.json`, so the root's dependencies never carry over. The data directory's `node_modules` lives outside the root, so it survives. Step 3's hook then re-syncs the checker source and reinstalls dependencies, but only if `checker/package.json` changed:

```console
cd $CENTINA_CHECKOUT
git pull
node install.mjs ~/.config/opencode/centina
CLAUDE_PLUGIN_ROOT=~/.config/opencode/centina CLAUDE_PLUGIN_DATA=~/.config/opencode/centina-data node ~/.config/opencode/centina/scripts/session-start-install.mjs
```

`install.mjs` does **not** regenerate the installed `SKILL.md` copies (step 5) or the adapted setup procedure (step 4). Those are static files you derived by hand from the source, not symlinks or templated output. If the source skills or `docs/plugin-setup-procedure.md` change upstream, redo the substitutions from steps 4 and 5 after the `git pull` above, by hand or by asking an agent to redo them against the new source. Nothing syncs them automatically. A stale copy will keep working, but it will quietly miss upstream fixes.

## Verifying the install

Check that every path in [What must resolve into the install](#what-must-resolve-into-the-install-never-the-dev-checkout) is readable, and that the checker runs, from a scratch directory that is **neither** `$CENTINA_CHECKOUT` **nor** the install root. That's the one condition the whole install exists to satisfy, so it's the only test that actually proves it worked:

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

You should see `tsc: clean`, followed by warnings only: a `hole-enumeration` warning on the `deferred` call and a `spec-explanation` warning on the file. Warnings mean the checker is working correctly, not that something failed. The exit code is 0. Delete `/tmp/centina-install-check` when you're done.

## Uninstalling

Everything this install writes lives in the four places below. None of it touches `$CENTINA_CHECKOUT`, so uninstalling never involves the Centina clone itself. Delete it separately, or keep it; that's independent of this.

1. **The four installed skills:**

   ```console
   rm -rf ~/.config/opencode/skill/centina-session-zero
   rm -rf ~/.config/opencode/skill/centina-iterate
   rm -rf ~/.config/opencode/skill/centina-realize
   rm -rf ~/.config/opencode/skill/centina-spike
   ```

   If your skill directory is peru-vendored (see the caveat in step 5) and you installed the skills somewhere else, as an override or in a personal, unsynced location, remove them from wherever they actually ended up.

2. **The install root** (the checker source and the skills' reference docs):

   ```console
   rm -rf ~/.config/opencode/centina
   ```

3. **The data directory** (the checker's `node_modules`, the adapted setup procedure, and the cross-project registry):

   ```console
   rm -rf ~/.config/opencode/centina-data
   ```

4. **Per-project artifacts, if you want those gone too.** Uninstalling the tool doesn't touch anything a Centina session wrote into a project's own `artifactsRoot` (by default `<project>/centina/`). That's project content (specs, `ARCHITECTURE.md`, `PLAN.md` files), not install state, so this procedure deliberately leaves it alone. Remove it by hand, one project at a time, and only if you really want the specs gone:

   ```console
   rm -rf <project>/centina
   ```

   The only list of which projects have one of these is `known-projects.json` in the data directory. If you want to track them all down, read it *before* you delete the data directory in step 3.

Steps 1 through 3 remove the tool completely. The skills stop being discoverable, and even a stale skill invocation fails cleanly, because every path it reads lived under `~/.config/opencode/centina*`, which is now gone. Step 4 is optional and separate, since it deletes project content, not install state.
