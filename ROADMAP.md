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

Also done:

- **String templating** — backtick-delimited template strings (`` `text ${expr} more` ``), added across the full stack: lexer (`TEMPLATE_STRING` token, segment-splitting on `${...}` with brace-depth tracking), AST (`TemplateStr` expr node with `TemplatePart[]`), parser (each `${...}` raw segment is re-tokenized/re-parsed as a standalone expression via a nested `Parser` instance, with token line numbers patched to the original source line), checker (`TemplateStr` always types as `String`; each embedded expression is still checked for undefined identifiers etc., same as any other expression), and the VSCode grammar (backtick strings get their own `string.template.aisl` scope, with `${...}` bodies highlighted via a self-recursive embedded-language region so expressions inside get full AISL highlighting, not just plain string color). `prototype.aisl`'s five `+`-concatenation call sites were converted to templates as the worked example; `+` itself is untouched (still used for non-string-building contexts, and the checker still doesn't special-case it) — whether to add a structural warning nudging future `+`-on-strings usage toward templates is open, see backlog.
- **`@prompt:` highlighting fix** — `@prompt:` comments were already a separate TextMate scope, but most themes don't visually distinguish "doc comment" from "comment," so it rendered identically to a plain `#` comment in practice. Fixed by giving just the `@prompt:` marker itself a `keyword.other.prompt.aisl` scope (reliably colored across themes) via a `begin`/`beginCaptures` rule, while the rest of the line stays scoped as a normal line comment.

Also done:

- **Warning-level structural checks, first batch** (`src/checker.ts`):
  - **Property access on `Unspecified` warns** — `.prop` access on a value whose own type is `Unspecified` (an uncast `Agent.prompt()`/`.review()` result, or an `Unspecified`-typed binding) now warns, since it's an unproven assumption about a shape nothing has committed to yet. Deliberately *not* re-flagged on chained access (`a.spec.nested`) — property access always types as `Unspecified` by design (properties stay dynamic), so only the first dot off a non-Member expression is checked; otherwise every legitimate chained property access would falsely trip the same warning.
  - **Property-name typo detection** — collects every `obj.prop` access where `obj`'s type is a known named type into a `typeName -> propName -> lines[]` map, then flags spellings that are close (Levenshtein distance, scaled by name length) to a *strictly more common* spelling on the same type as a likely typo. Equally-common spellings are left alone — that's a genuine naming inconsistency for a human to resolve, not something the checker can pick a side on.
  - Still open from the original candidate list: dead code after `return`, functions declared but never called, params declared but never used.

Also done:

- **External symbol references, unified across real code and other local `.aisl` files** — one syntax, `external (type|function|object) Name from "path"`, or with a renamed real symbol, `external renamed (type|function|object) Name from "path" was RealName`, e.g. `external type Step from "src/models.ts"` or `external type Step from "shared.aisl"`. There's no separate `import` keyword — resolution branches internally on the target path's extension, but the AISL author always writes the same statement shape regardless of what's on the other end. (Syntax notes: `from` replaced an earlier `=` to read less like an assignment; the `renamed`/`was` clause keeps the AISL-facing alias in the same position relative to the source path whether or not it's renamed, rather than a trailing bare name that read like an assignment target; `type`/`function`/`object` stay explicit kind keywords — collapsing them into one generic `symbol` keyword, or omitting the kind entirely, were both considered and rejected, since the kind cross-check against the real file is worth keeping in both cases.)
  - **Real code or a bare library specifier** (`src/resolveExternals.ts`, runs *after* `check()`) — the symbol always types as `Unknown` (distinct from `Unspecified`: same must-cast-before-flowing-into-a-concrete-slot rule, but member/method access on `Unknown` is never flagged, while every cast *off* `Unknown` warns about the unverified assumption). Verification is regex-based, not a real parser, and only covers ECMAScript and Python; bare library specifiers (`"lodash"`, `"numpy"`) are never resolved at all. Every miss is a warning, never an error, since the heuristic can't see re-exports/barrel files/decorators.
  - **Another local `.aisl` file** (`src/resolveLocalExternals.ts`, runs *before* `check()`, since the checker needs the real declaration's shape synchronously) — the symbol is treated exactly as though declared natively in this document: real nominal typing, never `Unknown`, because the target can be parsed and checked directly. Finds the requested name among the target's own declarations across every namespace (enum/type/function/global/external), clones it under the alias, and splices the clone into the importing program before `check()` runs (results cached per absolute path, so a file referenced several times is only parsed/checked once). If the declared kind keyword doesn't match what the target actually declares, that's a warning, but resolution still proceeds using the *real* discovered kind, so usage isn't broken just because the label was wrong.
    - **Errors (not warnings) on**: the target file having its own checker errors (`"errors in '<file>' must be resolved before symbols can be referenced"`); the requested name resolving only via *another* `external` entry in the target file — a forwarding chain — rather than a real declaration (`"'<name>' is itself declared as external... reference it directly"`, refusing to chase the chain); the alias colliding with anything already declared locally or with another external's alias in the same file.
    - **Deliberately single-hop, never transitive**: resolution never recurses past the one file directly named in the `external` statement. Side effect: no real cycle-detection machinery is needed, since a chain longer than one hop can't form — `A` referencing `B` referencing `A` just fails fast with the forwarding-chain error the moment a second hop would be needed.
    - **Known limitation, not yet solved**: only the requested declaration itself is cloned. If a referenced function's signature (or a referenced global's type annotation) names another custom type that isn't itself separately referenced, that type won't resolve in the importing file.
    - A cloned `external` entry whose own target is a local real-code path gets that path rebased to an absolute path anchored at the file it was found in (not the importer), so a later `resolveExternals` pass run from the importing file's directory still finds the right file.

## Next up

Nothing actively queued — see Backlog below for what's under discussion.

## Deferred

- **Language Server (LSP)** for live-as-you-type diagnostics, wrapping the existing checker. Not started — the Problem Matcher task covers diagnostics cheaply for now, and the language's syntax/type rules are still changing session-to-session; an LSP is a bigger investment better spent once that settles down.

## Backlog / not yet scheduled

- `prototype.aisl` still has more to iterate on (per the human) beyond the one resolved mismatch — revisit with `aisl-iterate` in a future session.
- Possible structural warning: flag `+` used to concatenate two `String`-typed operands, nudging toward template strings instead. Not designed yet — would need to decide whether it only fires when both sides are *known* String (vs. Unspecified, where `+` could mean something else entirely).
- Type declaration syntax — under discussion; types currently declare a name only with fully dynamic, unchecked properties by design, to keep an AISL document feeling like a structured conversation rather than a prescriptive schema. Considered and rejected: (1) optional property lists with zero enforcement (too easy to mistake for real enforcement), (2) opt-in per-type `strict` enforcement (still schema-shaped, in tension with the "conversation, not contract" framing). Current direction: no new declaration syntax — the typo-detection check above and usage-based autocompletion (next item) are meant to deliver most of the same ambiguity-reduction value without introducing a schema.
- **IDE autocompletion on type properties** (deferred, not started) — usage-based rather than declaration-based: scan the document for all `x.prop` accesses on variables of a given type (the same `propertyUsage` map the typo check already builds) and offer those as completions, rather than requiring properties to be declared up front. Bigger lift than the typo check since it needs to run live in the editor (a `CompletionItemProvider` in the VSCode extension, shelling out to re-run analysis on keystroke) rather than once at check-time — no LSP required, but more than the current Problem Matcher task does today.
- **Full module resolution for library specifiers** (deferred) — resolving `external` declarations that point at installed packages (`node_modules`, Python `site-packages`) rather than local files would need real module resolution and `.d.ts`/stub parsing — a "fully dedicated linker/resolver," not a regex heuristic. Bare specifiers stay permanently unverified (single warning) until this is built, if ever justified by actual need.
- **Transitive type-dependency resolution for `.aisl`-targeted externals** (deferred) — referencing a function or global whose signature names a custom type not separately referenced currently leaves that type name unresolved in the importer. Auto-pulling in everything a requested declaration's signature touches is real dependency-graph work; not attempted yet since it wasn't needed for the worked examples so far.
