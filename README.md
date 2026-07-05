# Centina

> The German word for the falsework that holds an arch during construction is
> *Lehrgerüst* — literally, "teaching frame": the frame that teaches the arch
> its shape until the keystone goes in and it can stand alone.

**Centina** (Italian: the centering frame an arch is built over) is
spec-flavored TypeScript: a way to write structured, rule-checked pseudocode
for a coding task *before* it's built. TypeScript supplies the grammar and the
expressiveness; a spec-plane checker — not the TypeScript compiler — is the
arbiter of "done." A Centina spec is falsework: built first, structurally
checked, it teaches the implementation its shape, and it is honest about being
scaffolding rather than product.

## Why this exists (the origin story)

Have you ever struggled to explain to your coding agent of choice what you want it to do with the masterful clarity you need? Have you shaken your head in dismay as you burn precious tokens going back and forth trying to articulate what you want it to do? Have you ever sent your coding agent off to do something, only to have it produce something that doesn't do what you expected, and you realize you don't even know where to start explaining how to fix it? No? Well, I have. Here is my story.

Recently, I wanted to implement a moderately complex process that included escalation paths, loops, recursion, etc. I started typing out my initial prompt and within a few minutes became frustrated that I couldn't explain clearly what I wanted without laborious, tedious back-references, ambiguous terms, and constant parentheticals. I couldn't even explain it to *myself*, let alone an agent. After a handful of false starts, I thought to myself, "There has to be a better way!" So, I went looking for one.

I'm a latecomer to the agentic coding world. A holdout. A rebel turncoat. As such, I figured surely someone smarter than me (many people qualify) had already solved this problem. Naturally, I first asked the usual suspects: various popular chat agents. They all gave me the same few unsatisfying answers ("Goodness! What a brilliant idea! Nobody has ever thought of this! You're probably a genius!" shut up, baby, I know it). So I deigned to try an actual search engine, looking for a way to approach my agent's "planning mode" with something more structured, something less haphazardly free-form than \*ugh\* *organic conversation* (I already get enough of this with my kids, you know?) but, to my surprise, found nothing I liked. There were some diagramming tools, some hot tips and tricks, and a whole bunch of agent skills that promised to take my confusing, meandering, resignedly self-conscious prose and turn it into an implementation plan good enough to make Linus Torvalds weep with joy. (Spoiler: There's no crying in coding.)

I gave up the search and decided that the best way forward was to simply try and sketch the idea out for myself without involving the agent at all, as though I were back in the old days where we still wrote code by hand like common people. I thought if I could get a better handle on exactly *what* I was planning to ask for, maybe I could write a usable prompt to get things started on *how*. Almost without thinking, I started writing psuedocode. I know people are always bullying poor psuedocode, but it's actually pretty great. You can use familiar, structured programming conventions without being hobbled by the requirements of actually producing executable code (totally unreasonable in 2026). However, as I wrote and my pseudocode became more complex, making sure I was maintaining consistency in spelling, local conventions, proposed control flow, etc., started becoming really tedious, threatening to undermine the entire reason I was doing it.

I thought to myself, "There has to be a better way!" So, I went looking for one. Just kidding. I already did that. I decided to just make one. The result of that was AISL — a from-scratch spec
language with its own lexer, parser, and checker. Building and *using* AISL
taught the lesson that produced Centina: everything structural I reached for
while writing real specs (typed records, optional parameters, ordinary control
flow), TypeScript already had — and everything genuinely novel I invented
while writing (deferred decisions, agent-directed questions, declared data
boundaries) needed a *checker*, not a grammar. So the grammar was retired and
the ideas kept. AISL v0 is preserved in full at the git tag
`aisl-v0-standalone-language`.

## The goals (the invariant everything else serves)

Centina produces structured, rule-checked pseudocode that:

1. makes it easier for a human to describe and understand a complex coding
   task, at a given level of detail, to themselves and other humans, than
   conversational prose;
2. makes it more likely that unknowns, ambiguities, and oversights are caught
   during spec writing and review rather than surviving into implementation;
3. makes it more likely that a coding agent produces an implementation plan
   that accurately reflects the spec-writer's intention;
4. provides a foundation to iterate on, before and after planning and
   implementation.

Bonus: a spec is a self-documenting record for future reference.

## How it works

A Centina spec is a **valid TypeScript file** (suffix `.centina.ts`) importing
a small vocabulary module (`centina.ts`). No new grammar exists, so every
editor on earth already parses, highlights, and autocompletes a spec. On top
of that:

- **tsc runs in a deliberately permissive config** (`tsconfig.json`), kept for
  what it's genuinely good at — name resolution, arity, shape — and relieved
  of duties that fight a spec-writer (unused locals, missing implementations:
  `declare` is legal and encouraged).
- **The spec-plane checker** (planned, see `ROADMAP.md`) layers the rules that
  are actually Centina's: enumerating typed holes and their routing, boundary
  direction enforcement, assumption bookkeeping on casts, naming-consistency
  checks. Delivered as a CLI plus a TypeScript language-service plugin, so
  spec diagnostics appear live in the editor alongside (and filtering) tsc's.

The core idea is the **typed hole with routing**. A spec is not finished when
it compiles; it's finished when every gap in it is *deliberate, typed, and
routed*:

| Hole | Spelling | Routing |
|---|---|---|
| deferred decision | `const f = deferred<(a: A) => B>()` | human decides during iterate: this spec, a separate spec, or agent autonomy |
| agent-directed | `// @agent: ...` comment | coding agent resolves at spec-iteration (centina-iterate skill) or plan-doc build time |
| external | `/** @external "src" */ declare function ...` | lives in: existing code / an API / an external system |
| boundary | `/** @datasource\|@datasink\|@boundary */ declare class ...` | a declared, black box data seam; doors are the privileged entry/exit points |

Two operating principles carried over from AISL, one revised:

- **Boundaries model affordances, not transports** — see `docs/boundaries.md`,
  which survives the pivot intact.
- **Provenance is bookkeeping, not prohibition** (revised): every value's
  origin should be *visible* — names must resolve, and every `as` cast is a
  recorded assumption — but the spec-writer is free to assemble records and
  sketch structure without fighting a privilege system.

## State of the project

Post-pivot, early. What exists: the vocabulary module (`centina.ts`), the
permissive tsconfig, and the founding fixture `prototype.centina.ts` — a 1:1
port of the AISL prototype whose six current tsc errors are *preserved
findings* (real gaps the pipeline caught in the spec, awaiting the author's
decisions), not bugs in the port. The checker is not yet built. `ROADMAP.md`
tracks the order of work.

## Repository layout

- `centina.ts` — the spec vocabulary (`Noun`, `deferred`, `Agent`)
- `*.centina.ts` — specs (currently: `prototype.centina.ts`, the founding fixture)
- `docs/boundaries.md` — boundary design: affordances-not-transports, roles, drawing guidelines
- `docs/fit-validation.md` — the running design memo: goals, falsifiability frame, findings log
- `specs/` — per-feature FIT.md precedents and AISL-era spec history
- `prototype.aisl`, `widgets.aisl` — AISL v0 sources kept as port references (toolchain retired; full history at tag `aisl-v0-standalone-language`)
