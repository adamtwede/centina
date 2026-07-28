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
needed a checker, not a grammar. `@agent:` notes may carry an author-chosen
label — `@agent(C1): ...` — giving the note a stable name to reference later
instead of an ephemeral line number; labels are free text the human assigns.
**The entire AISL v0 toolchain and its docs
are preserved at git tag `aisl-v0-standalone-language`** — consult the tag,
not this working tree, for anything AISL-era. Do not rebuild AISL-era
machinery (lexer, parser, `.aisl` checking); `prototype.aisl` (now at
`specs/hill-climbing-loop/`) and `widgets.aisl` remain in-tree only as port
references.

## Two different "agent" concepts — do not conflate

- **`Agent<Model>` / `.prompt()` / `.review()`** (`centina.ts`) — domain
  content. Describes the *real system a spec is about* prompting or judging
  an LLM agent at runtime, once the spec becomes an implementation. E.g. in
  `hill-climbing-loop.centina.ts`, `supervisorModel.prompt(...)` models the
  eventual harness prompting the actual agent orchestrating that loop.
- **`@agent:` / `@agent(label):` comments** — spec-authoring-time metadata.
  A direct channel between the human spec-writer and whichever coding agent
  is running a `centina-iterate`/`centina-session-zero` session with them.
  Never part of the spec's domain content, never describing runtime behavior.

These are unrelated concepts that happen to share the word "agent." See the
clarifying comment in `centina.ts` next to the `Agent` class.

## Project state

Early post-pivot. What exists:

- `centina.ts` — the vocabulary module (`Unshaped`, `deferred`, `Agent`); the
  comment header documents the boundary/external JSDoc-tag spellings.
- `specs/hill-climbing-loop/hill-climbing-loop.centina.ts` — the founding
  fixture, a 1:1 port of the author's `prototype.aisl` rewrite. The port's 6
  preserved findings (missing
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
  the subject is Centina itself, not a task being specced). **That lift does
  not extend to a `centina-session-zero`/`centina-iterate` skill run — even
  one whose *purpose* is to pressure-test the skill or the language — unless
  the author explicitly invokes it for that run. Inside a skill run the
  subject is a task being specced (e.g. the game), and whether the agent
  confabulates or elicits at high scope is often the very thing under test, so
  Rule 0 and Rule 0a stay live for all spec content by default. A run being an
  "experiment on Centina" is not itself the trigger; the author saying so, for
  that run, is.**
- **Rule 0a: don't offer to make spec-file edits, and push back when asked.**
  During a `centina-iterate`/`centina-session-zero` session, the agent should
  not volunteer to write changes into a `.centina.ts` file — surface the
  decision and let the human make it, then let *them* say whether they want
  it applied. If a human does ask the agent to make the edit, push back once
  (name the risk: they may be offloading thinking that's meant to stay
  theirs) rather than silently complying — but don't refuse outright if they
  persist after that pushback. This is separate from Rule 0's "never decide
  the meaning" — Rule 0a is about who's holding the pen once meaning has
  already been decided. Lifted, same as Rule 0, for internal language-design
  work, and the author may explicitly invoke a development-purposes override
  for minor spec edits (as happened settling `Score.MAX_ESCALATED` on
  `hill-climbing-loop.centina.ts`).
- `docs/boundaries.md` — boundary design (affordances-not-transports, the
  three roles, direction-from-returns, drawing guidelines) carries over from
  AISL unchanged; only its concrete syntax section is AISL-era.
- `docs/fit-validation.md` — the running design memo: goals, the
  falsifiability frame, and the findings log (including the evidence that
  drove the pivot). Read it before proposing language/checker changes.
- The project skills `centina-session-zero` and `centina-iterate`
  (`.claude/skills/`) are the current toolchain — Centina vocabulary, `tsc`
  (plus the `checker/` harness) as the interim checker, no `.aisl`/`src/cli.ts`
  references. `centina-session-zero` is the front door for standing up a new
  multi-spec system; `centina-iterate` refines a single spec. The former
  `centina-fit` skill was retired — its fit lens (structural vs realization,
  routing not gatekeeping) folded into `centina-session-zero`.
- `docs/session-zero-test-cases.md` — the pick-up-and-go harness for
  pressure-testing session-zero's **fit-as-jurisdiction** reframe (under
  refinement in the skill's "⚗️ Under refinement" section). Naming a case (e.g.
  "run the oauth-callback case") is enough: the doc carries the goals, the
  method, each case's seed/prediction/progress, and the author-gated protocol
  for promoting a proven lesson into the skill.

## Session-zero and iterate: managing long-running output

When a `centina-session-zero` or `centina-iterate` session produces a ledger or
state file (e.g., `SESSION-ZERO-STATE.md`) that grows beyond ~1500 lines,
**split it automatically** into an index file + detail files. This keeps context
tokens manageable across compactions while preserving resumability.

**Strategy (Option A — split by mining node):**

- **Index file** — `SESSION-ZERO-STATE.md` (kept < 300 lines, always in context):
  - Run frame (purpose, operating mode, Rule 0 status)
  - Mining tree (statuses only; "Match: MINED (see SESSION-ZERO-MATCH.md)")
  - Contract ledger (summary table, links to detail)
  - Hole ledger (summary table, links to detail)
  - Findings list (titles and `@file` links)
  - Pointers to detail files

- **Detail files** — one per mining-tree node, holds full interior content:
  - `SESSION-ZERO-MATCH.md` — all Match interior (rounds 1–10)
  - `SESSION-ZERO-CAREER.md` — all Career interior (round 11+)
  - `SESSION-ZERO-SIMENGINE.md` — all Simulation engine (round 11b+)
  - `SESSION-ZERO-FINDINGS.md` — all findings with full text (F1–F9+)
  - `SESSION-ZERO-CORE-DECISIONS.md` — core/non-switchable decisions

**In-conversation:** Only the index file stays in context every turn (~ 90%
token savings). Agents read detail files on demand when diving into a specific
node's rounds. On compaction, index carries cursor position and status; resuming
agent loads index + the relevant detail file.

**Trigger:** Split when the main file reaches ~1500 lines. Once split, maintain
the strategy for all subsequent rounds (don't merge back).

**For iterate sessions:** Same strategy applies if the session produces a
similarly sized ledger (e.g., a complex component with many rounds of
refinement). Name detail files `ITERATE-<component>-*.md` and keep the index
as `ITERATE-STATE.md`.

This is automatic — no special permission or human involvement needed. Agents
implementing it should note the split in the session conversation so the human
knows it happened and can navigate if needed.
