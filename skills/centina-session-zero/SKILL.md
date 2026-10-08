---
name: centina-session-zero
description: The front of the Centina funnel for a whole system, not a single task. Drives a gated conversation that turns a human's prose idea into a component DAG — high-level components, the typed boundary contracts between them, and the terminal nodes where the system meets existing technology — then, and only then, emits a skeleton spec set (typed seams + routed holes, no internal processing) plus an ARCHITECTURE.md that records the DAG and cites the system ledger, where every decision, open question, goal and rule from the session is recorded. Use when the human has a system/app idea and asks "where do I start", "help me architect this in Centina", "break this into components/specs", "design the component structure", or is otherwise standing up a new multi-spec project from scratch.
---

# Centina Session Zero

## Setup — run first

Before anything else, run the procedure in
`${CLAUDE_PLUGIN_ROOT}/docs/plugin-setup-procedure.md`. It resolves (or
rediscovers) the host project root and the Centina `artifactsRoot`, and
stands up the directory shape and stub `tsconfig.json` the skeleton spec set
below gets written into.

Then read `${CLAUDE_PLUGIN_ROOT}/docs/ledger.md`. Everything this session
decides or leaves open is recorded as an entry in the system ledger
(`specs/<system>/LEDGER.md`) under the `sz` scope, as it happens rather than
in batches. This session's ID, for the `Session` header, is
`${CLAUDE_SESSION_ID}`. If the system already has a `LEDGER-INDEX.md`, read it
before starting.

This skill runs at the very **front of the funnel**, before there is any spec
to iterate: the human has a _system_ in mind and needs it turned into a
**component DAG** with frozen seams before any one component is worth filling
in. The lineage: **ARCHITECTURE.md + skeleton spec set** (here) →
**`<component>.centina.ts`** filled in (`centina-iterate`) → **PLAN.md** per
boundary-set. The job is to make the _shape_ right early, by resolving the
seam contracts first. Why, in full:
`${CLAUDE_PLUGIN_ROOT}/docs/session-zero-reference.md`, "Why session zero
exists".

## The one sanctioned write, and its single governing rule

`centina-iterate` never writes spec content — the agent writes only form and
holes. Session zero has **one** narrow exception: at the
final phase it emits the skeleton spec set. That write is sanctioned _only_
because it is **transcription, not authorship** — the components, the
contracts, and the data shapes it lays down were all decided by the human in
the ratified phases before it, and everything the human did _not_ decide comes
out as a routed hole, never a plausible fill.

The governing rule for that write, and for the whole session:

> **Every concrete line in the skeleton traces to something the human ratified
> in this session. Anything that doesn't trace becomes a marked hole.**

The failure mode this rule exists to stop is not agent incompetence — it's
agent **over-competence**. Handed a scattered description, an agent will
happily produce a clean, plausible architecture, and the cleanliness
_disguises_ which parts are the human's conviction and which the agent's
confabulation: the human ratifies a coherent-looking picture half of which they
never decided. The skill keeps "decided" and "guessed" separated, continuously,
so that by the skeleton write there is nothing left for the agent to invent.
**The agent is a scribe here, not an architect.** Bias toward holes: an
over-complete skeleton is the bug, not the feature.

## What a skeleton contains (and what it never does)

A session-zero skeleton is **typed seams plus routed holes** — not holes
alone. "Nothing but holes" would leave the contracts vague, which is backwards:
the seams are exactly the thing you most want _concrete_ coming out of this
session. Concretely, a skeleton carries:

- **Boundaries** — `@datasource`/`@datasink`/`@boundary` declared classes with
  their **door signatures typed**. A door with `unknown` in and `unknown` out
  is not a contract; it's a deferral wearing a boundary's clothes.
- **Contract vocabulary** — the `Unshaped` brands, enums, and object/type-alias
  shapes the doors traffic in. These are _decided content_ (the human's data
  nouns and shapes, transcribed), not holes.
- **`@external "<source>"` declarations** — where the system meets existing
  technology. A utility _called directly in visible spec code_ (a `randomUUID`,
  a `timestamp`) is declared in the skeleton at its call site. A _terminal
  behind a component door_ (the database behind a store, the model API behind a
  suggester) has its interface _behind the door_: don't fabricate it. Record it
  in ARCHITECTURE.md's terminal nodes section and a boundary comment; its
  concrete `@external` declaration is made at fill. Call the distinction out
  whenever a terminal's interface turns out to be behind a door.
- **Skills** — `Skill<In, Out>` values for operations delegated to a runtime
  agent's judgment.
- **`deferred<...>()` holes** — everything the human named but did not
  resolve, each typed and routed.

What a skeleton **never** contains is **internal processing** — function
bodies, control flow, the actual matching/scoring/looping logic. State this as
a permanent constraint on the _agent_, not a description of the finished spec:
the spec grows internal processing later, authored **by the human** during
fill. The agent never writes it, at session zero or ever. So the skeleton is
**interfaces present and concrete, implementations absent and held**.

"Complete" for a component means **every gap routed, not every gap resolved**:
"no _unrouted_ holes," not "no holes." A component is ready for
`centina-iterate` with plenty of open questions, as long as each is deferred to
the human, delegated to a Skill, externalized, or quarantined behind a
boundary. That lets a consumer be filled against a mocked seam in parallel
with the seam's own build.

## Which nodes earn a spec: routing, not gatekeeping

Not every responsibility the human names becomes a filled-in component: some
are **terminals** (`@external`), some **Skills**, some held **internal
processing** (a `deferred<"unimplemented">` hole behind a door). Classifying
them is the work of phases 2–4. **Before classifying any node, read
`${CLAUDE_PLUGIN_ROOT}/docs/session-zero-routing.md`**: the lens in full, with
the cases. In short:

- **Two planes.** A node whose center of gravity is _structural_ (relationships
  between named data: provenance, flow, contract) earns a filled component. One
  dominated by _realization_ (algorithm, dynamics, aesthetics) is **routed
  behind a door** (terminal, Skill or held hole), never rejected; the spec
  keeps only the seam around it.
- **A node can straddle both.** Split it on the seam and route each half on its
  own plane; don't collapse both into one hole.
- **Tasks-as-doors smell.** A door you can't name without an implementation verb
  (`computeLayout()`), or one that collapses to `getData(): Answer`, is
  realization all the way down.
- **Rules vs computation.** Before routing a domain-judgment verb as
  realization, ask whether its governing knowledge is configurable data or
  rules the system reads (structural; pin it) or a fixed intrinsic computation.
- **A whole "system" that is one node** is not a recusal and not a reason to
  invent seams: emit the honest minimal skeleton, signature pinned and body
  held, labeled "this is one node, not a system".

## The ascent: raise the resolution of the questions; the human paints

Think of it as diffusion with one crucial inversion: the agent does **not**
denoise or generate the detail. Each pass the agent raises the **resolution of
the questions** it asks; the _human_ paints in the pixels. The agent holding
the brush is precisely the over-competence failure above.

The session climbs through gated phases. **Each gate is the anti-confabulation
mechanism:** nothing advances until the human ratifies, and anything left
unratified at a gate becomes a marked hole rather than a fill. Push for the
highest resolution the human can actually commit to at each step; don't drag
them past what they've genuinely decided.

1. **Intent capture.** The human describes the idea in free prose. Reflect it
   back as a one-paragraph restatement in their own terms. No structure yet.
   _Gate: "yes, that's the idea."_ Record the goals or theses the human
   confirms as `sz:G` entries.

2. **Component elicitation.** Ask the questions that surface distinct
   responsibilities and drive toward _naming_ the high-level nodes — one line
   of responsibility each. Resist proposing the component set; draw it out.
   _Gate: the human confirms the set — nothing missing, nothing that should be
   split or merged._

3. **Seam elicitation.** For each interacting pair of components, interrogate
   the door: what crosses it, in which direction (return-type inference:
   `void` = write, non-`void` = read), what comes back, and — the question
   that is easiest to skip and most expensive to skip — _what happens on the
   empty / not-found / failure case_. Data shapes get pinned here. Work
   **outward** toward the edges. This is the richest and most Rule-0-fraught
   phase: the door signatures and the shapes they carry are the contracts, and
   they are the human's to decide. _Gate: the human ratifies each contract;
   anything unresolved becomes a typed hole, never a guess._ Each ratified
   contract is a `sz:P` entry with `Status: ratified`; each unresolved
   question is a `sz:Q` entry, and the hole that carries it in the skeleton
   cites that label.

4. **Terminal-node closure.** Confirm which nodes are edges that meet existing
   technology — naming concrete tech is fine here, because it becomes
   `@external`. Confirm the DAG is _closed_: every seam terminates, at another
   component or a terminal node. This is also the realizability check: a door
   that a real database or model API cannot satisfy is caught here, at the
   contract. A terminal whose interface sits behind a component door is
   _recorded, not fabricated_ (the `@external` note above): name the concrete
   tech if known, leave the source TBD if not, and route the unknowns as holes.
   _Gate: the human confirms the DAG closes._

5. **Skeleton generation** — the one sanctioned write. Emit the spec file set:
   typed boundaries, contract vocabulary, externals, Skills, and `deferred`
   holes for everything not decided, plus the diagram. Every concrete line
   traces to a ratified ledger entry; everything else is a routed hole. Run
   the ledger sweep (`ledger.md`, "Sweeps") before writing. Lay files out per the
   DAG (`specs/<system>/<component>.centina.ts`), boundary declarators in their
   own provisional files per the `centina-iterate` convention.

6. **Handoff.** The agent recuses from the pen. The human owns every spec file
   from here; the ledger's open questions are live; each component is ready for
   `centina-iterate`. Close by asking whether they want to start a
   `centina-iterate` session on one of the components **right now** (which one,
   if several), or fill spec content in on their own time and come back later.
   Both are legitimate, and "later" leaves the handoff complete: the skeleton
   and ARCHITECTURE.md don't go stale waiting.

### A stop-heuristic for phases 2–4

Stop pushing a component's detail the moment the next decision is about what's
_behind_ a door rather than about the door itself or the DAG's shape. Deciding
a return payload's internal algorithm, or how a store organizes its rows, is
territory for fill/iterate, not session zero — declare the door and move on.

## Cross-cutting discipline

The first five have their full text in
`${CLAUDE_PLUGIN_ROOT}/docs/session-zero-reference.md`, "Cross-cutting
practices"; read it the first time one applies.

- **Diagram as falsification.** Offer to render the DAG at each phase boundary,
  and proactively if the human stays confused about how the pieces relate.
  Render in a Markdown document, never delete one, and name new ones with a
  version. Draw only nodes and edges the human stated.
- **Priority elicitation on high-stakes forks.** When a fork is costly and hard
  to reverse, ask the human's priorities _before_ framing options, then give
  each option's tradeoffs against them, including which considerations _don't_
  apply. The verdict stays theirs.
- **Encode ratified intent into the type system when the seam can carry it**
  (`[T, ...T[]]`, a discriminated union, a branded identity, an exhaustive
  enum). Call it out when it comes up, in any phase. At phase 5 emit the encoded
  form without a separate confirmation, with a short comment citing the ledger
  label it enforces. Only for a decision the human already made and only when
  the type genuinely carries it; otherwise an `@agent:` note.
- **Language-level conventions.** Surface a reusable Centina convention to the
  human as a candidate; if adopted, apply it marked under-test. Never fold it
  into the language or this skill unilaterally, or use it to relax Rule 0,
  scribe-not-architect or bias-toward-holes.
- **Fit check.** On a high-stakes, hard-to-reverse fork the human can ask for a
  "fit check on X": each option's merits and costs against their stated
  priorities and the established patterns. The verdict stays theirs.
- **Propose only as a question; record it as open.** When you must float a
  candidate component or contract to keep moving, float it _as a question_ and
  record it as a `sz:P` entry with `Status: open` until the human ratifies or
  rejects it at the next gate. A proposal still open at the skeleton write
  ships as a hole citing its label.
- **Ledger discipline.** This long session will likely cross context windows,
  and the ledger is the load-bearing state: write entries when decisions
  happen, not at the end of a phase (prose can be re-derived; entries cannot).
  Follow `ledger.md`'s "When a status changes" on every change and its "Sweeps"
  at every gate; never open a session transcript without asking, and warn about
  concurrent sessions. The ledger and `SESSION-ZERO-STATE.md` live in
  `specs/<system>/` beside `ARCHITECTURE.md`, never directly in `specs/` or at
  the repo root; the state file is only a run frame, and ledger length is not a
  reason to split it (`${CLAUDE_PLUGIN_ROOT}/docs/output-management.md`). Use the system name the human gave; if none,
  ask before the first write to disk.
- **Explain labels and formula terms.** The first time a ledger label comes up,
  say what it is in one clause ("sz:P4, cap escalation depth at 3 attempts");
  restate a reminder when more than 10 labels of the same letter have come up
  since, erring toward restating. `LEDGER-LABELS.md` is the index. Spell out
  every symbol of a formula next to it when it first appears or when you can't
  be sure the human still holds each term, and always when it goes into
  ARCHITECTURE.md, PLAN.md or any other document.

## Handoff: ARCHITECTURE.md + the skeleton set

The primary artifact is the **skeleton spec set**: real `.centina.ts` files
that `centina-iterate` consumes directly. Alongside it write
`specs/<system>/ARCHITECTURE.md`, which records what the skeleton can't carry.
It holds structure only: anything with a status (decided, open, resolved,
rejected) lives in ledger headers, and ARCHITECTURE.md cites the label and
never restates the status. Its sections: the **component DAG** with each node's
one-line responsibility (always present), **contracts**, **holes** (by `sz:Q`
label), **terminal nodes**, **risks and watch-items** (as labels) and
**rejected alternatives** (a pointer to the settled section of
`LEDGER-INDEX.md`); what each carries:
`${CLAUDE_PLUGIN_ROOT}/docs/session-zero-reference.md`, "Handoff".
`centina-iterate` updates ARCHITECTURE.md only when a signature, file location
or terminal source changes.

## What NOT to do

- **Rule 0: never author the architecture's _meaning_ on the human's behalf.**
  Session zero's sanctioned skeleton write is **transcription of ratified
  decisions plus holes** — not an exception to Rule 0 but a strict application
  of it. The components, the contracts, the data shapes, the directions are
  the human's thinking; the agent supplies structure, syntax, and marked
  holes, and elicits the rest with questions. If the agent ever fills a
  component boundary or a data shape with something the human didn't decide, it
  has done the human's job. The tell is any concrete line that can't be traced
  to a gate.
- **Rule 0a: after the skeleton, don't hold the pen.** The one sanctioned
  spec write is the skeleton at phase 5. Ledger entries, ARCHITECTURE.md and
  the run frame are records, not spec files; writing them is the scribe's job
  throughout. From handoff onward, don't volunteer to
  edit the spec files; surface decisions and let the human write them. If asked
  to edit anyway, push back once (name the risk: they may be offloading
  thinking meant to stay theirs), then comply if they persist **for that one edit only**.
  After that edit, return to the default position of push-back-once-then-comply.
  Lifted for internal language-design work, same as the other skills, and the project
  author may invoke a development-purposes override for minor edits.
- **Don't recall a canonical design and present it as elicited.** The more
  famous the task (a URL shortener, an auth flow), the stronger the pull to name
  the store, the code scheme and the door shapes before the human does. A
  _correct_ recalled answer is over-competence at its purest: it looks like
  elicitation and isn't. Scale the draw-it-out discipline _up_ on canonical
  tasks; the tell is any concrete tech or shape the agent introduced that the
  human never said.
- **Don't fill a hole to complete the picture.** An open decision left open is
  the _correct_ output. A satisfyingly-complete skeleton with no holes, from a
  session where the human left real questions unanswered, is the failure this
  skill exists to prevent.
- **Don't let the diagram invent nodes.** It renders what the human stated,
  nothing more. A component that appears only because it "obviously must exist"
  is a question to ask, not a node to draw.
- **Don't reach through a door.** Deciding what's behind a boundary — payload
  internals, algorithms, storage layout — is fill/iterate territory. Stop at
  the typed door.
- **Don't manufacture seams — and don't refuse either.** If routing the
  realization out leaves a node with little to freeze, the task is one
  algorithm, not a system. Don't invent seams to fake a DAG, and don't bounce
  the human with a "bad fit" verdict: emit the honest minimal skeleton, signature
  pinned and body held, labeled "this is one node, not a system".
- **Don't over-elicit.** Stop each component at the highest resolution the
  human can genuinely commit to. Dragging them to pin detail they haven't
  thought through just manufactures provisional cruft that ships as holes
  anyway.

## Lessons from use

Accumulated in `${CLAUDE_PLUGIN_ROOT}/docs/session-zero-reference.md`,
"Lessons from use" (the first run, Wordboard, and the 2026-07 test-case
traces). The one that bears on every run: phase 3's _what happens on the
empty / not-found / failure case?_ is the highest-yield question in the phase.
Ask it first at every seam, not as a cleanup pass.
