# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**Centina** is spec-flavored TypeScript: a medium for writing structured,
rule-checked pseudocode ("falsework") for a coding task before it's built.
TypeScript is the grammar; a spec-plane checker — not tsc — is the intended
arbiter of correctness. A spec is done when every gap in it is deliberate,
typed, and *routed* (deferred to the human, delegated to an agent, referenced
from external code, or quarantined behind a boundary) — not when it compiles.

The four goals in `README.md` ("The goals") are the project's only invariant;
every rule and primitive is a means under test against them. Notably,
"provenance" here means *bookkeeping* (names must resolve; every `as` cast is
a recorded assumption), not prohibition — the AISL-era `Unprivileged`
privilege system was deliberately retired after real usage overturned it (see
`docs/fit-validation.md`).

## History: the AISL pivot

Centina began as AISL, a from-scratch spec language with its own
lexer/parser/checker. In July 2026 the author pivoted: real spec-writing
showed that TS already had every *structural* feature being reached for, while
the genuinely novel inventions (`deferred`, `@agent:` direction, boundaries)
needed a checker, not a grammar. **The entire AISL v0 toolchain and its docs
are preserved at git tag `aisl-v0-standalone-language`** — consult the tag,
not this working tree, for anything AISL-era. Do not rebuild AISL-era
machinery (lexer, parser, `.aisl` checking); `prototype.aisl` and
`widgets.aisl` remain in-tree only as port references.

## Project state

Early post-pivot. What exists:

- `centina.ts` — the vocabulary module (`Noun`, `deferred`, `Agent`); the
  comment header documents the boundary/external JSDoc-tag spellings.
- `prototype.centina.ts` — the founding fixture, a 1:1 port of the author's
  `prototype.aisl` rewrite. The port's 6 preserved findings (missing
  target-model prompt call; values used outside the branch that creates
  them) **have been ratified and resolved by the author** — `npm run
  typecheck` is clean. The primitive spellings chosen during the port
  (marker-function `deferred`, `Agent<ModelId>` generics, camelCase naming)
  are the settled convention going forward, not open questions.
- `tsconfig.json` — the deliberately permissive spec-plane config.
- `.prettierrc` — formatting convention (`semi: false`) for `.centina.ts`
  files.

The Centina checker does **not** exist yet — don't assume it. `ROADMAP.md`
tracks build order.

## Commands

- `npm run typecheck` — tsc over the vocabulary + all `*.centina.ts` specs.
  Expect zero errors; any diagnostic is a real regression to raise with the
  author, not something to fix unilaterally (see Rule 0).

## Rules of engagement

- **Rule 0: never author a spec's *meaning* on the human's behalf** — data
  nouns, shapes, directions, and the resolution of `deferred` holes are the
  human's thinking. Supplying *form* (skeletons, syntax, holes) is fine. The
  author has lifted Rule 0 only for internal language-design sessions (where
  the subject is Centina itself, not a task being specced).
- `docs/boundaries.md` — boundary design (affordances-not-transports, the
  three roles, direction-from-returns, drawing guidelines) carries over from
  AISL unchanged; only its concrete syntax section is AISL-era.
- `docs/fit-validation.md` — the running design memo: goals, the
  falsifiability frame, and the findings log (including the evidence that
  drove the pivot). Read it before proposing language/checker changes.
- The project skills `centina-fit` and `centina-iterate` (`.claude/skills/`)
  have been rewritten for the pivot — Centina vocabulary, `tsc` as the
  interim checker, no `.aisl`/`src/cli.ts` references. Use them directly.
