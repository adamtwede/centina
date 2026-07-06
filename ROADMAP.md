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
- **Founding fixture** (`prototype.centina.ts`) — 1:1 port of the author's
  `prototype.aisl` rewrite, open questions and known gaps preserved. tsc
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

## Next up

1. **Naming-consistency rule** — port the AISL typo/drift detection idea.
2. **TS language-service plugin** — same rule code surfaced live in-editor;
   filter/downgrade spec-irrelevant tsc diagnostics.
3. **TextMate injection grammar** — tint `@agent:`/`@external`/role tags and
   `deferred` on top of stock TS highlighting (tiny extension, no publishing
   needed for local dev).
4. **Scoped/incremental checker runs** — `npm run check` currently loads and
   checks every `*.centina.ts` file the tsconfig includes. Add a file/glob
   argument (`npm run check -- prototype.centina.ts`) that runs the full rule
   set only on the requested file(s) plus whatever they import (so checking
   `prototype.centina.ts` still pulls in `task-matcher.centina.ts` for the
   boundary-direction/dependency rules, which are meaningless read in
   isolation from the class they're declared on) — dependencies checked
   before dependents, cycle detection needed since nothing currently
   prevents one.

## Open / under discussion

- **Head-to-head validation** (from `docs/fit-validation.md`): prose vs.
  Centina on the same anchor task, both handed to a fresh agent, comparing the
  implementation plans (goal-3 evidence). The planned third arm (from-scratch
  AISL) was mooted by the pivot.
- Exhaustiveness on `switch` over spec enums — tsc doesn't require it; decide
  whether the checker should (AISL's match rule said yes).
- Whether `deferred` should carry a structured routing argument
  (`"this-spec" | "separate-spec" | "runtime-agent"`) or stay a free note.
- The remaining fit-validation candidate set (monorepo dependency-impact tool,
  game systems, synthetic seam cases) — paused during the pivot; resume once
  the checker can participate.
