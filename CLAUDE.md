# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

AISL (Agent-Interpreted Specification Language) is a DSL for writing high-level, structured pseudocode that a human authors and a coding model (e.g. Claude) iterates on with them until it reaches a shared understanding, which is then turned into an implementation plan. In the fewest words: type-checked pseudocode. The goal is to replace ad-hoc conversation-first planning with a more structured artifact that:

- enforces naming consistency and reduces ambiguity in the pseudocode itself
- gives the coding model clearer guardrails to interpret correctly
- pushes the human to think through design decisions up front rather than offloading that thinking to the model

## Project state

There is a working TypeScript toolchain (lexer, parser, checker, CLI) implementing the AISL language as it currently stands — see `ROADMAP.md` for what's done, deferred, and backlogged. `prototype.aisl` is the standing worked example and regression fixture; it should stay at zero checker diagnostics (`tests/prototype.test.ts` enforces this). The language's syntax and type rules are still actively changing session-to-session — check `ROADMAP.md` before assuming a feature exists or a piece of syntax is final, and don't build ahead of it (e.g. an LSP) while it's still settling.

`PLAN.md` (the language *spec* itself, via `SPEC.md`/`ARCHITECTURE.md`) is still a placeholder — those documents don't exist yet. Don't assume them. The one piece of forward language design that *is* written down is `docs/boundaries.md` — a design proposal for first-class data boundaries (`datasource`/`datasink`/`boundary`), designed but not yet implemented; treat it as a not-yet-built feature (don't assume checker/parser support), and read it before designing anything in that area.

## Commands

- `npm run check <file.aisl>` — run the checker CLI on a single file (also `tsx src/cli.ts <file.aisl>` directly)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — runs all `tests/*.test.ts` via `node:test` + `tsx`, no extra test framework
- `npm run build` — `tsc` (emits `dist/`)
- VS Code: open `editors/vscode/` as its own folder and press F5 for an Extension Development Host with syntax highlighting active (unpublished, nothing to package for local dev). The "AISL: Check current file" task (`.vscode/tasks.json`) pipes CLI diagnostics into the Problems panel.

## Architecture

Pipeline, in order: `src/lexer.ts` (indentation-aware tokenizer) → `src/parser.ts` (recursive-descent → AST in `src/ast.ts`) → `src/resolveLocalExternals.ts` (pre-check pass) → `src/checker.ts` (`check()`) → `src/resolveExternals.ts` (post-check pass) → diagnostics merged and printed by `src/cli.ts`.

- **Two cross-file resolution passes, deliberately split around `check()`**, both reachable from a single `external (type|function|object) Name from "path"` (or `external renamed ... was RealName`) statement — there is no separate `import` keyword; which pass handles a given statement depends only on whether `path` ends in `.aisl`:
  - `resolveLocalExternals.ts` (pre-check) — for `.aisl`-extension targets. Parses and checks the target file, finds the real declaration in any namespace, and splices a renamed clone into the importing program's `enums`/`types`/`functions`/`globals` before `check()` runs, so the symbol gets full real nominal typing. Single-hop only: a name resolving only via another `external` entry in the target (a forwarding chain) is a hard error telling the human to reference the source directly, rather than chasing the chain — this is also what makes cycle detection unnecessary.
  - `resolveExternals.ts` (post-check) — for everything else (real code files, bare library specifiers). Regex-based heuristic verification (TS/JS and Python only); always types as `Unknown`; every miss is a warning, never an error.
- **`Unknown` vs `Unspecified`** (`src/checker.ts`) are deliberately distinct gradual-typing escape hatches: both require an explicit `as` cast before flowing into a concrete slot, but member/method access on `Unknown` is never flagged (vs. `Unspecified`, which warns on first-level `.prop` access), while casting *off* `Unknown` always warns about the unverified shape assumption.
- Two project skills cover the spec workflow, in order. Use `aisl-fit` (`.claude/skills/aisl-fit/SKILL.md`) *before* a spec exists, to decide whether a task even belongs in AISL and where to slice it: it runs the structural/realization two-plane model and a prose→signatures→thin-slice descent, then emits a `specs/<name>/FIT.md` handoff. Then use `aisl-iterate` (`.claude/skills/aisl-iterate/SKILL.md`) when iterating an `.aisl` file against the checker: run the checker, triage each diagnostic as mechanical-fix-it vs. genuine-ambiguity-ask-the-human, apply the agreed fix, re-run, repeat until clean. Per-feature lineage: **FIT.md → `<name>.aisl` → PLAN.md**. Both skills enforce Rule 0 — never author a spec (or a thin slice's *meaning*) on the human's behalf.
