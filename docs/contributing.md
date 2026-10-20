# Contributing to Centina

## Developing Centina itself

Working on Centina's own vocabulary, checker, or skills is the one case where you *do* run the plugin against the repo it lives in. From the root of your Centina checkout:

```console
claude --plugin-dir .
```

Use `--plugin-dir .` for this, not your `~/.claude/skills/centina/` install. That install is a frozen snapshot from whenever you last ran `install.mjs`, so it won't reflect anything you're editing in the checkout. And re-running `install.mjs` to pick up your edits would make every *other* Claude Code session on the machine load your in-progress, possibly broken changes too. That's fine for a stable, everyday install. It's not fine while you're in the middle of changing Centina itself.

## Checks to run

Before you call a change done, run the checks that cover what you touched:

- `npm run typecheck` runs `tsc` over the specs and vocabulary, the checker, and `hooks/`. The first two passes should come back with zero errors.
- `npm test` runs the checker's and the scripts' tests.
- `npm run check` runs the Centina checker over every spec in the repo.
- `npm run docs:build` builds this site. Dead links and broken anchors fail the build.

If you changed the ledger mod (`hooks/`), also run `claude plugin validate .` and `claude plugin test .`.

None of these exercise the plugin machinery itself, though: the hook that runs at session start, skill discovery, first-run setup. For that, you need a real session.

## Testing the plugin end to end

`claude --plugin-dir .` is also how you check that a packaging change actually works end to end. The first session in a freshly cloned or freshly reset checkout tests the whole plugin lifecycle at once, because the `SessionStart` hook, skill auto-discovery, and the [setup procedure](/plugin-setup-procedure)'s first-run path all fire for the first time. Check these, in order:

1. **The `SessionStart` hook ran.** It shows no output when it succeeds; that's
   by design (see [Plugin checker install](/plugin-checker-install)). A failure
   should show a clear message, never fail silently. You can confirm it
   directly: `${CLAUDE_PLUGIN_DATA}/checker/node_modules` should exist once the
   session has started.
2. **The skills are discoverable.** `/centina-session-zero`,
   `/centina-iterate`, `/centina-realize`, and `/centina-spike` should all
   show up.
3. **Invoking one triggers first-run setup.** This repo already has its own
   `specs/`, `centina.ts`, and `tsconfig.json` at its root, so the setup
   step's host-root and artifacts-root questions get a real workout. Watch
   whether it correctly offers the repo root as a sensible default, rather
   than getting confused by the existing layout.
4. **The checker actually runs.** `bin/centina-check` (invoked by a skill, or
   directly with `node "${CLAUDE_PLUGIN_ROOT}/bin/centina-check" --project <resolved tsconfig path> <a spec file>`)
   should produce the same findings `npm run check` does against the same
   file.
5. **The generated `tsconfig.json`'s plugin path points at `DATA`, not
   `ROOT`.** Open `<artifactsRoot>/tsconfig.json` and look at
   `compilerOptions.plugins[0].name`. It should resolve inside
   `${CLAUDE_PLUGIN_DATA}` (for example
   `.../plugins/data/centina-inline/checker/tsPlugin.cjs`), never inside the
   checkout. That's what lets a project that's already set up survive the
   checkout being moved or deleted (see the DATA-versus-ROOT discussion in
   Step 4 of [Plugin setup step](/plugin-setup-step)). A regression here would
   quietly bring that fragility back, and nothing above would catch it,
   because checks 1 through 4 all pass either way.

Anything that doesn't line up is exactly the kind of gap the `npm` checks can't catch: a hook that fails silently, a skill that doesn't show up, a setup question that behaves strangely against this repo's own layout, or a stale `ROOT` path in the generated tsconfig.

## Changing the installer

`install.mjs` sits outside all of that. It's a plain Node script, not something a Claude Code session ever runs on its own. `scripts/bundle.test.mjs` covers part of it: it checks that the installed docs match the `docs/` branch of the directory tree in [Plugin file layout](/plugin-file-layout), and that the installer replaces its destination and leaves out dev-only files. The rest of the tree isn't checked automatically. So after changing `install.mjs`, run it against a scratch destination and compare the result to that tree by hand:

```console
node install.mjs /tmp/centina-install-test
```
