# Contributing to Centina

## Developing Centina itself

Working on Centina's own vocabulary, checker, or skills is the one case where you *do* run the plugin against the repo it lives in. From the Centina checkout's own root:

```console
claude --plugin-dir .
```

Prefer `--plugin-dir .` over your `~/.claude/skills/centina/` install for this: that install is a frozen `install.mjs` snapshot, so it won't reflect edits you're making in the checkout at all, and re-running `install.mjs` to pick them up would also make every *other* session on the machine load in-progress or possibly-broken changes — fine for a stable daily-driver install, not for iterating on Centina itself.

This is also the path for verifying a packaging change actually works end-to-end, as opposed to the harness-level checks `npm run check` and `npm run typecheck` already cover. A first session in a freshly cloned or freshly reset checkout is a real test of the whole plugin lifecycle at once — the `SessionStart` hook, skill auto-discovery, and the [setup procedure](docs/plugin-setup-procedure.md)'s first-run path all fire for the first time. Worth checking for, in order:

1. **The `SessionStart` hook ran.** No visible output on success (that's by
   design — see [docs/plugin-checker-install.md](docs/plugin-checker-install.md));
   a failure should surface a clear message, never a silent no-op. You can
   confirm it directly: `${CLAUDE_PLUGIN_DATA}/checker/node_modules` should
   exist after the session starts.
2. **The skills are discoverable.** `/centina-session-zero` and
   `/centina-iterate` should both appear.
3. **Invoking one triggers first-run setup.** Since this repo already has
   its own `specs/`, `centina.ts`, and `tsconfig.json` at its root, the
   setup step's host-root and artifacts-root prompts are exercised for
   real — watch for whether it correctly treats the repo root as a
   sensible default rather than getting confused by the pre-existing
   layout.
4. **The checker actually runs.** `bin/centina-check` (invoked by the
   skill, or directly: `node "${CLAUDE_PLUGIN_ROOT}/bin/centina-check" --project <resolved tsconfig path> <a spec file>`)
   should produce the same
   findings `npm run check` does natively against the same file.
5. **The generated `tsconfig.json`'s plugin path points at `DATA`, not
   `ROOT`.** Open `<artifactsRoot>/tsconfig.json` and check
   `compilerOptions.plugins[0].name` — it should resolve inside
   `${CLAUDE_PLUGIN_DATA}` (e.g. `.../plugins/data/centina-inline/checker/tsPlugin.cjs`),
   never inside the checkout. This is what makes an already-set-up project
   survive the checkout being moved or deleted (see the DATA-vs-ROOT
   discussion in `docs/plugin-setup-step.md`'s Step 4) — a regression here
   would silently reintroduce that fragility without any test above
   catching it, since 1–4 all still pass either way.

`install.mjs` is separate from the session-lifecycle checks above — it's a plain Node script (`scripts/bundle.test.mjs` exercises its copy logic), not something a Claude Code session exercises on its own. After changing it, run it against a scratch destination (`node install.mjs /tmp/centina-install-test`) and diff the result against
`docs/plugin-file-layout.md`'s directory tree by hand; there's no automated check for it.

Anything that doesn't match — a silent hook failure, a skill that doesn't surface, a setup prompt that behaves unexpectedly against this repo's own layout, a stale `ROOT` path back in the generated tsconfig — is exactly the kind of gap `npm run check`/`npm run typecheck` can't catch, since neither exercises the plugin machinery at all.
