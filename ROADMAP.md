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

## Next up

1. **Author ratifies the port** — the primitive spellings chosen during the
   port (marker-function `deferred` vs JSDoc-tagged `declare`; `| null` on
   `match_task`; `feedback?` optionality; `Agent<ModelId>` generics) plus the
   6 preserved findings, resolved in the first Centina iterate session.
2. **Checker harness** — load the program via the TypeScript compiler API
   (likely ts-morph), run tsc-with-filtering, merge in spec-plane diagnostics;
   CLI entry point (`npm run check`).
3. **First spec rule: hole enumeration** — list every `deferred`, `@agent:`,
   `@external`, and boundary with its routing; "clean" = no unmarked gaps.
4. **Boundary direction rule** — `@datasource` doors must return data,
   `@datasink` doors must return void (direction from returns, per
   `docs/boundaries.md`).
5. **Assumption bookkeeping** — report every `as` cast as a recorded
   assumption; flag casts that launder shape without a source.
6. **Naming-consistency rule** — port the AISL typo/drift detection idea
   (e.g. the fixture's `loopRun` vs `loop_run`).
7. **Skills revision** — update `aisl-fit`/`aisl-iterate` to Centina (concepts
   unchanged; tool references and syntax stale). Rename accordingly.
8. **TS language-service plugin** — same rule code surfaced live in-editor;
   filter/downgrade spec-irrelevant tsc diagnostics.
9. **TextMate injection grammar** — tint `@agent:`/`@external`/role tags and
   `deferred` on top of stock TS highlighting (tiny extension, no publishing
   needed for local dev).

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
