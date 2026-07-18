# Centina Roadmap

Tracks Centina work post-pivot. The full AISL v0 roadmap/history lives at git
tag `aisl-v0-standalone-language` — it is deliberately not carried here.

## Done

- **The pivot** (July 2026) — retired the from-scratch AISL grammar/toolchain
  in favor of spec-flavored TypeScript: TS as grammar, spec-plane checker as
  arbiter. Rationale and evidence in `docs/fit-validation.md`. Renamed the
  project **Centina** (the Italian centering frame an arch is built over;
  npm-clean, no software collisions).
- **Vocabulary module** (`centina.ts`) — `Noun<Name>` (opaque branded domain
  nouns), `deferred<F>()` (typed hole with unresolved routing), `Agent<Model>`
  (the shipped boundary; `prompt`/`review` return `unknown`, casts are the
  assumption bookkeeping). Boundary roles and externals are JSDoc-tagged
  `declare` statements (`@datasource`/`@datasink`/`@boundary`, `@external`).
- **Permissive spec-plane tsconfig** — tsc kept for name resolution/arity/
  shape; relieved of unused-checks and emit.
- **Founding fixture** (`specs/hill-climbing-loop/hill-climbing-loop.centina.ts`,
  named `prototype.centina.ts` until its rename/relocation into `specs/`) —
  1:1 port of the author's `prototype.aisl` rewrite, open questions and known
  gaps preserved. tsc
  immediately surfaced 6 genuine findings (missing target-model prompt step;
  branch-scoped values used outside their branch) — the pipeline demonstrating
  goal 2 with zero custom code written.
- **Author ratified the port** — the author resolved all 6 preserved
  findings directly (the target-model prompt call now made; the escalation
  chain reworked as an ordered array rather than three named consts; the
  branch-scoping gaps fixed), settled `| undefined` over `| null` on
  `matchTask`, and moved the whole fixture to camelCase with a project
  `.prettierrc` (`semi: false`). `npm run typecheck` is clean.
- **Skills revision** — `aisl-fit`/`aisl-iterate` renamed to `centina-fit`/
  `centina-iterate` and rewritten: Centina vocabulary throughout, `tsc` named
  as the interim structural-plane checker (no checker CLI exists yet),
  `.aisl`/`src/cli.ts` references removed, the "never manufactures data"
  axiom reframed as bookkeeping (matching `fit-validation.md`), and the
  boundary-end "slice-relative" finding folded into `centina-fit` as a named
  limitation.
- **Checker harness v1** (`checker/`, `npm run check`) — loads the project via
  ts-morph, merges `tsc`'s structural diagnostics with three spec-plane
  rules: hole enumeration (every `deferred`/`@agent:`/`@external`/boundary
  declaration, as an info-level inventory — "clean" = no unmarked gaps, not
  no gaps), boundary direction (`@datasource` doors must return data,
  `@datasink` doors must return void), and boundary dependency-direction (a
  boundary's doors must not depend on a structured type declared in that same
  file — the rule this session's `task-matcher.centina.ts` extraction
  motivated, not originally listed below but folded in alongside items 2-3
  since it uses the same harness and AST-walk shape).
- **Assumption bookkeeping rule** (`checker/rules/assumptionBookkeeping.ts`) —
  every `as` cast in a spec is an info-level finding unless it narrows a
  value whose real type (peeling through throwaway `as unknown`/`as any`
  laundering steps first) isn't itself `unknown`/`any` or a stub object
  literal, in which case it's a warning: shape may be getting fabricated
  without a real source.
- **Naming-consistency rule** (`checker/rules/namingConsistency.ts`) — ports
  the AISL v0 typo/drift idea (see the pivot history in `ROADMAP.md`'s intro
  and the tag `aisl-v0-standalone-language`), but re-targeted: ordinary
  property access on a named type is already checked structurally by `tsc`,
  so the rule watches the two free-text namespaces no compiler pass ever
  validates — `Noun<"...">` brand literals and `@external "<source>"`
  strings. Collects each namespace's spellings into a frequency map and warns
  when a less-common spelling is a near-miss (restricted edit distance,
  transposition included, scaled by name length) of a *strictly* more common
  one; equally-common spellings are left alone as a genuine ambiguity for the
  human. `checker/vocabulary.ts` extracted the import-alias-resolution helper
  (`isFromVocabulary`) this rule needed, deduplicating logic that had already
  been copy-pasted (and once mis-copied) across two earlier rules.
- **TS language-service plugin** (`checker/tsPlugin.cjs` /
  `checker/tsPluginImpl.ts`, wired via `tsconfig.json`'s
  `compilerOptions.plugins`) — the same five rules surfaced live in-editor as
  real diagnostics on `.centina.ts` files, not just `npm run check` output.
  tsserver loads plugins via a synchronous CommonJS `require` and can't
  transpile TS itself, so the plugin entry is a two-line `.cjs` bootstrap
  (`require("tsx/cjs")` to register tsx's require hook, then hand off to the
  real TS implementation) — everything past that bootstrap is ordinary
  TypeScript reusing the existing `Rule`/`Finding` machinery unchanged. Each
  `getSemanticDiagnostics` call refreshes the target file's ts-morph
  `SourceFile` from the live (possibly unsaved) editor buffer via
  `languageServiceHost.getScriptSnapshot`, not from disk, so diagnostics
  track what's actually being typed; a `try`/`catch` around the whole rule
  pass guarantees a bug in our rules degrades to "no extra diagnostics," never
  breaks the editor's real TS features. Findings map to `ts.Diagnostic`
  (`error`/`warning`/`info` → Error/Warning/Suggestion category, whole-line
  span, a private code per rule starting at 91001, `source: "centina"`).
  Verified by driving the plugin directly against a real `ts.LanguageService`
  (no build step, no VSCode needed) and confirming both disk-state and
  live-unsaved-edit typos surface correctly. "Filter/downgrade spec-irrelevant
  tsc diagnostics" (the other half of the original roadmap wording) wasn't
  implemented — the spec-plane tsconfig is already deliberately permissive,
  so there's currently nothing known worth downgrading; revisit if a real
  case shows up.
- **TextMate injection grammar** (`editors/vscode/`) — a declaration-only,
  unpublished VS Code extension: two injection grammars layered onto the
  built-in TypeScript grammar (`injectTo: ["source.ts", "source.tsx"]`), no
  new language id, so `.centina.ts` files stay plain `typescript` for every
  other tool. `centina.comments.injection.json` (selector matches when the
  deepest scope is a `//` or JSDoc comment) tints the `@agent:` marker,
  `@boundary`/`@datasource`/`@datasink` role tags, and the `@external` tag;
  `centina.code.injection.json` (selector `source.ts`, broad — matches
  anywhere in a TS file) tints the `deferred` marker call, narrowed by a
  lookahead for `(`/`<` so an unrelated identifier literally named
  `deferred` doesn't light up. No compile step or activation code — the
  `editors/vscode/README.md` covers loading it locally (`Developer: Install
  Extension from Location...` or a symlink into the extensions folder).

- **`deferred` resolution classifier** (`centina.ts`, `checker/rules/holeEnumeration.ts`) — resolves the open question below: `deferred<F>()` stays exactly as it read before (no routing decided yet — now surfaced as a `warning`, not `info`, since it's a decision still owed), and an optional leading kind argument narrows it: `deferred<"unimplemented", F>()` (needs a real body before planning can begin — `error`), `deferred<"spec", F>()` (routed to a separate spec, part of a larger Centina-driven planning workflow — `info`), `deferred<"open", F>()` (left to the implementing agent's discretion when the plan is written — `info`). The kind always reads before `F` (`DeferredKind` exported from `centina.ts`); ordinary overload arity resolution (1 vs. 2 explicit type arguments) picks the right signature, verified against both forms plus a rejected bogus kind via `tsc`.
- **Spec-explanation rule** (`checker/rules/specExplanation.ts`) — a spec's code alone doesn't establish what it exists to describe, so this rule warns (heuristically, by length only — presence, not quality, same posture as the other rules) when a spec's first statement isn't preceded by a real leading comment. Verified clean against both real specs (each already opens with a substantial header) and a scratch file with no leading comment.
- **Labeled `@agent` notes** (`editors/vscode/syntaxes/centina.comments.injection.json`, `checker/rules/holeEnumeration.ts`, `checker/rules/namingConsistency.ts`) — an `@agent:` note may carry an author-chosen label, `@agent(C1): ...`, giving it a stable name to reference later (in conversation or a PLAN.md) instead of an ephemeral line number. The label tints in its own color, distinct from the `@agent` tag itself. `hole-enumeration` surfaces the label in its finding message when present; `naming-consistency` flags (`error`) two notes in the same file claiming the same label — unlike the Noun-brand/`@external` drift checks, this isn't a near-miss judgment call, a duplicate label is a direct conflict with the whole point of the convention. Scoped per file, since the same label in two unrelated specs isn't a conflict. Verified against the real specs (a real `@agent(C1):` note surfaces correctly, no false duplicate) and a scratch-forced duplicate, reverted after confirming the rule fires.
- **Scoped/incremental checker runs** (`checker/harness.ts`'s `resolveScope`,
  wired into `checker/cli.ts`) — `npm run check -- <file...>` now runs the
  full rule set on just the requested file(s) plus every local spec they
  transitively import (imports of `centina.ts` itself don't count — it's
  vocabulary, not a spec dependency), so checking `hill-climbing-loop.centina.ts`
  alone still surfaces `task-matcher.centina.ts`'s findings, per the
  confirmed design: dependencies are visited (and appear in the report)
  before dependents via post-order DFS, and an import cycle among local
  specs is caught during traversal and reported as its own `error`-severity
  `dependency-cycle` finding rather than looping or silently picking an
  order. `tsc` diagnostics are scoped the same way (`getPreEmitDiagnostics`
  per file in the resolved closure) when a scope is given; omitting all
  arguments keeps today's whole-project behavior unchanged. Verified against
  the real specs (single-file scope, transitive-dependency reporting, a
  scratch-induced import cycle, and a not-found path all behave as designed)
  with all scratch edits reverted.
- **Founding fixture relocated to `specs/`** — `prototype.centina.ts` →
  `specs/hill-climbing-loop/hill-climbing-loop.centina.ts`, its boundary
  declarator `task-matcher.centina.ts`, and its AISL-era ancestor
  `prototype.aisl` moved alongside it, all co-located in a self-contained
  sub-project folder. Settled the filename/folder convention going forward:
  dashes (matching every other post-pivot name — `task-matcher.centina.ts`,
  `fit-validation.md`, `boundaries.md`), not the underscore convention the
  older AISL-era `specs/` subfolders happen to use; those stay untouched as
  frozen history rather than being retroactively renamed.
- **`centina-fit` retired, folded into `centina-session-zero`** (July 2026) —
  the standalone fit skill (`.claude/skills/centina-fit/`, SKILL.md + the
  `precedents/` corpus) was deleted. Its job — a binary admit/reject gate run
  before a spec was written — was dissolved by the pivot's routing primitives:
  realization-dominated work is no longer *rejected* from Centina, it is
  *routed* behind a door (terminal, Skill, or held `deferred<"unimplemented">`
  hole). The surviving judgment (structural vs realization center of gravity,
  the tasks-as-doors smell, and the hollow-skeleton/empty-contract-ledger test
  for the degenerate "one algorithm, not a system" case) moved into
  `centina-session-zero` as a per-node routing decision during DAG
  construction — see its "Which nodes earn a spec" section. The whole-DAG view
  also retires the slice-relative boundary-end count as the primary tell.
  Living pointers updated in `CLAUDE.md`, `docs/boundaries.md`, and
  `centina-iterate`; existing `FIT.md` artifacts left in place as history.

## Open / under discussion

- **Head-to-head validation** (from `docs/fit-validation.md`): prose vs.
  Centina on the same anchor task, both handed to a fresh agent, comparing the
  implementation plans (goal-3 evidence). The planned third arm (from-scratch
  AISL) was mooted by the pivot.
- Exhaustiveness on `switch` over spec enums — tsc doesn't require it; decide
  whether the checker should (AISL's match rule said yes).
- The remaining fit-validation candidate set (monorepo dependency-impact tool,
  game systems, synthetic seam cases) — paused during the pivot; resume once
  the checker can participate.
