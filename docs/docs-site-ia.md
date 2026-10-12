# Docs site: information architecture and README overlap

Working doc for the GitHub Pages docs site. Maps the current README (870 lines)
onto site pages, records what overlaps with existing docs, and lists what can
be cut. Nothing here is applied yet. Line numbers refer to `README.md` as of
branch `centina-documentation` (cut from `documentation` at `25801b7`).

## Constraints

- **`install.mjs` ships a fixed doc list** (lines 30–38): `plugin-setup-procedure`,
  `output-management`, `ledger`, `measurement-methodology`, `realize-conformance`,
  `trail`, `session-zero-routing`, `session-zero-reference`, `iterate-reference`.
  Skills and the checker read these at runtime. They cannot be cut. Moving one
  means updating `install.mjs` and `docs/plugin-file-layout.md` together.
- **Maintainer-only, stays in-repo:** `CLAUDE.md`, `ROADMAP.md`,
  `docs/session-zero-test-cases.md` (CLAUDE.md says in-tree by design).
- **Anchors:** README links to its own headings (e.g. `#getting-started-claude-code`,
  `#using-centina-without-claude-code`) and `docs/opencode-install.md` links back
  to them. Migration needs those rewritten.
- **Skill links** in "How to actually use it" point at `github.com/.../blob/main/`.
  They 404 until this branch merges. Use relative links on the site.

## Proposed site map

| Site section | Source (README lines) | Notes |
|---|---|---|
| **Why** | 62–109 (Why this exists); 727–762 (goals; offers over planning) | Argument essay. Keep, shorten the lead. |
| **Concepts** | 110–192 (Centina's answer); 193–253 (Caveats) | "Who / when / not for" fits here, not in Why. |
| **Core mechanism** | 463–494 (typed holes) | Centerpiece. Link `docs/boundaries.md` for the boundary detail. |
| **Vocabulary** | 495–566 | Link `centina.ts` as the source of truth. |
| **Install: Claude Code** | 256–384 | Fix the Windows snippet bug (see below) or cut it. |
| **Install: other harnesses** | 385–452 + `docs/opencode-install.md` | Overlaps two other docs (see below). |
| **Quickstart** | 453–460; walkthrough 638–726 | Walkthrough must be checked against `specs/wordboard/`. |
| **Using it** | 569–637 (gap-hunting sessions) | Four skill blurbs. Shorten to links to each SKILL.md. |
| **Ledger & trail** | (existing `docs/ledger.md`, `docs/trail.md`) | No README section yet. |
| **Design rationale** | (existing `fit-validation`, `boundaries`, `centina-realize-design`, `measurement-methodology`) | Not reader-facing first. |
| **Reference: checker & commands** | 807–846 | Commands duplicate `package.json`. Replace with a link. |
| **Contributing** | 763–806 (developing Centina itself); 847–870 (repo layout) | Maintainer content. Probably `CONTRIBUTING.md`, not a primary page. |

## Overlap read-through

### 1. Windows path bug in README (lines 277, 324–325)

The README's Windows paths lost their backslashes:

- line 277: `%USERPROFILE%.claudeskillscentina`
- line 324: `Join-Path $claude 'skillscentina'`
- line 325: `Join-Path $claude 'pluginsdatacentina-skills-dir'`

The same paths in `docs/plugin-setup-procedure.md` (lines 149–160) are correct
(`"$HOME\.claude\skills\centina"`). Two copies of the same snippet drifted, and
the README copy is broken. Copying the procedure's version fixes it. Removing
the duplicate (cut #1 below) removes it too.

### 2. "Using Centina without Claude Code" (385–452) is a third copy

It duplicates:

- `docs/plugin-setup-procedure.md` "Running it without a session" (149–170):
  same env-var setup, same Windows and POSIX snippets.
- `docs/opencode-install.md` (340 lines): a full alternate install path.

The README version also lists manual steps (copy `centina.ts`, write
`tsconfig.json`, run `npx tsx cli.ts`) that the other two cover. The README
section has the least detail of the three and the only broken snippet.

### 3. OpenCode appendix is a fourth copy of the procedure: **resolved (option 1)**

The appendix (`opencode-install.md`, formerly lines 275–340) was a hand-written,
already-stale copy of `plugin-setup-procedure.md`. Replaced with a substitution
table (step 4) plus an install step that runs the bundled SessionStart hook to put
the checker's `node_modules` in the data dir (step 2). The skill's direct checker
call now points at the data dir too.

**Tested in a scratch layout (since deleted):**

- The earlier failure: `bin/centina-check setup` exits 1 with "checker dependencies
  aren't installed". The checker reads `node_modules` from `CLAUDE_PLUGIN_DATA`, but
  the install root holds the `node_modules`. Substitution alone could not work.
- Option 1: running `scripts/session-start-install.mjs` with the data dir set
  installs the deps there and writes the hash marker. Then `centina-check setup`
  (with both env vars inline) exits 0. It writes `tsconfig.json` with the plugin path
  pointing into the data dir.
- The doc's direct call, `<data>/checker/node_modules/.bin/tsx <data>/checker/cli.ts
  --project <tsconfig> <spec>`, returns `tsc: clean`, then warnings, exit 0.

**Found in passing, now fixed:** `checker/cli.ts`'s check path ignored
`CENTINA_CALLER_CWD`. Relative `--project` or spec paths passed through
`bin/centina-check` resolved against the checker's own directory and failed with
ENOENT. `main()` now resolves them against `CENTINA_CALLER_CWD` (falling back to
`cwd`), the same as the ledger, trail, and setup commands. Verified with the
checker run from its own dir and relative paths from the caller dir. Argument
parsing moved to `checker/cliArgs.ts` (`parseCheckArgs`, pure, takes `baseDir`),
with `checker/cliArgs.test.ts` covering relative, absolute, and fallback paths
and the missing `--project` value. All 153 checker tests pass (146 existing + 7).

### 4. Skill blurbs (569–637) vs SKILL.md descriptions

The four blurbs restate what each skill's `SKILL.md` frontmatter description says,
at more length. Site version: one line each, linking to the SKILL.md.

### 5. Boundaries principle restated (around 470–490)

README states "affordances, not transports" and the direction rule in a short
bullet list. `docs/boundaries.md` (359 lines) has the full treatment. The
bullet is fine as a summary. The link is already there.

### 6. "Commands" (836–846) and "Repository layout" (847–870)

Commands duplicate `package.json` scripts. Repository layout duplicates
`docs/plugin-file-layout.md`. Both go stale. Cut to links.

### 7. "State of the project" (807–835)

Duplicates `ROADMAP.md`, which the section itself says is the source. Cut to a link.

## Cut list

**No files are safe to delete.** Every doc is either shipped by `install.mjs`,
read by a skill or checker, or cited by another doc (checked by grep across the
repo).

**Safe cuts from README (replace with links):**

1. "Using Centina without Claude Code" body (385–452). **Done:** now one paragraph
   and links to `opencode-install.md` and `plugin-setup-procedure.md`. The broken
   Windows paths are *not* in this section; they are in the Claude Code section's
   "Running it yourself" block (README ~277, ~324–326). **Fixed in place:** backslashes
   restored, `bin\centina-check` corrected.
2. "Commands" (836–846) and "Repository layout" (847–870).
3. "State of the project" (807–835).
4. Skill blurbs (569–637): one line each plus a link.

**Relocate, don't cut:**

- `docs/opencode-install.md` moves under Install. The README's only link to it is
  line 389.
- `docs/session-zero-test-cases.md` stays in-repo, off the site.

**Not cut, despite looking like candidates:**

- `docs/centina-realize-design.md`. Its status says "not yet used on a project,"
  but `measurement-methodology.md` and `ROADMAP.md` cite it.
- `plugin-setup-step.md` and `plugin-setup-procedure.md`. Already decided to keep
  both.

## Open questions

1. Confirm the site map, or do you want "Why" trimmed harder?
2. Cut #1 means the README stops documenting manual install. OK to make that a
   link-only section?
3. OpenCode appendix and relative-path checker bug: both done. The fixture
   `specs/hill-climbing-loop/` reports `boundary-dependency` errors in
   `task-corpus.centina.ts` when checked. Confirm whether those are known before
   relying on the exit code there.
4. "Developing Centina itself" (763–806): `CONTRIBUTING.md` at repo root, or a site
   page?
