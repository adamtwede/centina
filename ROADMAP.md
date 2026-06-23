# AISL Tooling Roadmap

Tracks the implementation of the AISL checker/tooling, as distinct from `PLAN.md`
(which tracks the AISL *language spec* itself, via the not-yet-written
`SPEC.md`/`ARCHITECTURE.md`). See `RUNLOG.md`-style usage if this grows long —
for now, current state lives here directly.

## Done

- Indentation-aware lexer (`src/lexer.ts`)
- AST definitions (`src/ast.ts`)
- Recursive-descent parser (`src/parser.ts`)
- Checker v0 (`src/checker.ts`):
  - scope/identifier resolution
  - nominal type checking on annotated params/vars/returns, `Unspecified` as the gradual-typing escape hatch
  - exhaustive `match`/`case` checking over declared enums (no catch-all `else`)
  - `Agent.prompt()`/`.review()` always type as `Unspecified`; using the result as another type requires an explicit `as` cast
  - `@prompt:`-tagged comment-only function bodies are treated as intentional stubs, not flagged
  - undeclared dot-notation property access (e.g. `target_model.specification`) is unchecked by design
- CLI (`src/cli.ts`, `npm run check <file>`)
- Validated against `prototype.aisl`: surfaces exactly one real diagnostic (see below), no false positives

Also done:

- **Interactive iteration loop** — `aisl-iterate` project skill (`.claude/skills/aisl-iterate/SKILL.md`) encoding: run checker -> triage each diagnostic as mechanical-fix-it or genuine-ambiguity-ask-the-human -> apply agreed fix -> re-run -> repeat until clean. Chosen over a CLAUDE.md instruction or a hypothetical harness "mode" (not a real extension point in this tool).
- First real use of the loop: `prototype.aisl:50`'s `Step`/`String` mismatch in `escalate()` resolved by threading `implementation_step` through `escalate`'s signature so re-escalation re-enters `implementation_loop` with the abstract step (letting it regenerate a prompt tailored to the escalation model's `specification`), rather than retrying the original target's pre-rendered prompt verbatim. `prototype.aisl` now passes the checker with zero diagnostics.

Also done:

- **Test fixtures** (`tests/`, run via `npm test`) — `node:test` + `tsx`, zero extra dependencies. `lexer.test.ts`, `parser.test.ts`, `checker.test.ts` (17 cases covering scope errors, nominal mismatches, enum exhaustiveness, the `Unspecified`/cast rule, stub bodies, arg-count/unknown-type errors), and `prototype.test.ts` as a standing regression fixture asserting `prototype.aisl` stays at zero diagnostics.
- Writing the `Unspecified`/cast tests caught a real bug: `tyEquals` was symmetric, so an uncast `Agent.prompt()`/`.review()` result was silently accepted anywhere — defeating the whole point of the cast rule. Fixed by replacing it with a directional `isAssignable(expected, actual)`: `Unspecified` is accepted wherever a concrete type is expected only via going the other way (concrete -> `Unspecified` slot is fine; `Unspecified` -> concrete slot requires an explicit `as` cast).

Also done:

- **VSCode syntax highlighting** (`editors/vscode/`) — minimal, unpublished extension: `package.json` registers the `.aisl` language, `language-configuration.json` covers comments/brackets/auto-indent-after-`:`, `syntaxes/aisl.tmLanguage.json` is a heuristic TextMate grammar (keywords, builtin types, `@prompt:` comments highlighted distinctly from plain comments, ALL_CAPS-as-enum-member and PascalCase-as-type-name heuristics, decl-name capture for `function`/`enum`/`type`). To use: open `editors/vscode/` as a folder in VS Code and press F5 to launch an Extension Development Host with it active — nothing to publish or package for local dev.
- **VSCode inline diagnostics** (`.vscode/tasks.json`) — a "AISL: Check current file" task that shells out to the existing `aisl-check` CLI (`tsx src/cli.ts`) and a problemMatcher regex (`^(.*):(\d+):\s+(error|warning):\s+(.*)$`) that maps its output straight into the Problems panel. Per-save/per-task-run, not live-as-you-type — deliberately the cheap option, see below.

## Next up

1. **Warning-level structural checks** — candidates: likely-typo/ambiguous property names on `Unspecified`-typed objects, dead code after `return`, functions declared but never called, params declared but never used. Not yet started; "structural = warning, nominal = error" rule already established in the checker design.

## Deferred

- **Language Server (LSP)** for live-as-you-type diagnostics, wrapping the existing checker. Not started — the Problem Matcher task covers diagnostics cheaply for now, and the language's syntax/type rules are still changing session-to-session; an LSP is a bigger investment better spent once that settles down.

## Backlog / not yet scheduled

- `prototype.aisl` still has more to iterate on (per the human) beyond the one resolved mismatch — revisit with `aisl-iterate` in a future session.
