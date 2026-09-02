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

What exists:

- `centina.ts` — the vocabulary module (`Unshaped`, `deferred`, `Agent`); the
  comment header documents the boundary/external JSDoc-tag spellings.
- `specs/hill-climbing-loop/hill-climbing-loop.centina.ts` — the founding
  fixture, a 1:1 port of the author's `prototype.aisl` rewrite, ratified and
  resolved by the author. `specs/` also holds later fixtures
  (`grid-inventory/`, `wordboard/`, `turnball/`) built to exercise the
  checker and the session-zero/iterate skills.
- `tsconfig.json` — the deliberately permissive spec-plane config.
- `.prettierrc` — formatting convention (`semi: false`) for `.centina.ts`
  files.
- **The Centina checker** (`checker/`, its own npm workspace) — `tsc`'s
  structural diagnostics merged with the spec-plane rules (hole enumeration,
  boundary direction and dependency-direction, assumption bookkeeping,
  naming-consistency, spec-explanation, labeled-`@agent`-note conflicts) plus
  a live TS language-service plugin (`checker/tsPlugin.cjs`) for in-editor
  diagnostics. Run via `npm run check`.
- **Plugin packaging** (`.claude-plugin/plugin.json`, `hooks/`,
  `scripts/session-start-install.mjs`, `bin/centina-check`,
  `tsconfig.template.json`) — Centina's checker and skills are installable
  and runnable in any project via `claude --plugin-dir .`, independent of
  this repo. See "Where new spec-writing happens" below.
- `skills/centina-session-zero/` and `skills/centina-iterate/` — the bundled
  skills (plugin-relative, `${CLAUDE_PLUGIN_ROOT}`-relative paths), the
  single copy going forward. The old project-level `.claude/skills/` copy
  was retired.

`ROADMAP.md` tracks build order and is kept current — read it for what's
done vs. still open, rather than assuming from this file alone.

## Where new spec-writing happens

Because Centina now ships as a plugin, a new spec-writing project — a human
standing up a real system in Centina — normally starts in *that* project's
own repo: install the plugin there and run `centina-session-zero` from that
directory, not from here.

The exception is a spec that exists to exercise or pressure-test Centina
itself, e.g. `specs/hill-climbing-loop/` or a case from
`docs/session-zero-test-cases.md`. Those stay in-tree by design.

**Default assumption for a new agent session in this repo:** unless the
`centina-session-zero` or `centina-iterate` skill is explicitly invoked,
treat the session as a **Centina improvement session** (checker, skills,
vocabulary, docs) — not as a new spec-writing session.

## Commands

- `npm run typecheck` — tsc over the vocabulary + all `*.centina.ts` specs.
  Expect zero errors; any diagnostic is a real regression to raise with the
  author, not something to fix unilaterally (see Rule 0).
- `npm run check` — the Centina checker (`checker/cli.ts`): `tsc` plus the
  spec-plane rules. Accepts `-- <file...>` to scope to specific specs and
  their transitive local-spec dependencies; no arguments checks the whole
  project.

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
  (`skills/`) are the current toolchain — Centina vocabulary, the `checker/`
  harness (`npm run check`, `tsc` underneath it) as the checker.
  `centina-session-zero` is the front door for standing up a new multi-spec
  system; `centina-iterate` refines a single spec. Per "Where new
  spec-writing happens" above, a real spec-writing run of either skill
  normally happens outside this repo. The former `centina-fit` skill was
  retired — its fit lens (structural vs realization, routing not
  gatekeeping) folded into `centina-session-zero`.
- `docs/session-zero-test-cases.md` — the pick-up-and-go harness for
  pressure-testing session-zero's **fit-as-jurisdiction** reframe (under
  refinement in the skill's "⚗️ Under refinement" section). Naming a case (e.g.
  "run the oauth-callback case") is enough: the doc carries the goals, the
  method, each case's seed/prediction/progress, and the author-gated protocol
  for promoting a proven lesson into the skill.

## Session-zero and iterate: managing long-running output

The output-splitting rule for long `centina-session-zero`/`centina-iterate`
ledgers now lives in `docs/output-management.md` (extracted so the plugin
bundle has a file to point at — there's no `CLAUDE.md` inside the bundle).
Read it before either skill produces a state file. This project's own
skills reference it directly; a spec author using the packaged plugin gets
it via `${CLAUDE_PLUGIN_ROOT}/docs/output-management.md`.
