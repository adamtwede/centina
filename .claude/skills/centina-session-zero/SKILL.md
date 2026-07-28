---
name: centina-session-zero
description: The front of the Centina funnel for a whole system, not a single task. Drives a gated conversation that turns a human's prose idea into a component DAG — high-level components, the typed boundary contracts between them, and the terminal nodes where the system meets existing technology — then, and only then, emits a skeleton spec set (typed seams + routed holes, no internal processing) plus an ARCHITECTURE.md that records the DAG, the contract ledger, and the hole ledger. Use when the human has a system/app idea and asks "where do I start", "help me architect this in Centina", "break this into components/specs", "design the component structure", or is otherwise standing up a new multi-spec project from scratch.
---

# Centina Session Zero

This skill runs at the very **front of the funnel**, before there is any spec
to iterate. `centina-iterate` refines _one_ spec toward clean; session zero
sits upstream of it: the human has a _system_ in their head — several
components that talk to each other — and needs it turned into a **component
DAG** with frozen seams before any one component is worth filling in. Sorting
those nodes — which earn a filled-in spec, which route away as terminals,
Skills, or held holes — is part of the work here (see "Which nodes earn a
spec" below).

The lineage it feeds: **ARCHITECTURE.md + skeleton spec set** (session zero) →
**`<component>.centina.ts`** filled in (`centina-iterate`) → **PLAN.md** per
boundary-set (the implementation). Session zero's whole job is to make the
_shape_ right early, so the later fill-and-iterate work is isolated by
dependency direction instead of rippling backward.

Why it exists: writing one component fully, _then_ discovering its boundaries,
forces rework on the component when the boundaries turn out to be shaped
differently than imagined. The cheaper path is to resolve the seam contracts
first — the skeleton everything else hangs on — and this skill is that
resolution, formalized into a gated process with an output artifact.

## 🔬 Debug — self-monitoring for confabulation (experimental-branch instrumentation)

**Active only on the `experimental/decomp` branch, for scope-limit runs.** The
over-competence failure this skill exists to prevent (an agent painting the
human's pixels) is hypothesized to get *worse* as a system's overt or latent
complexity rises and the human's seed under-determines more doors. This section
turns that hypothesis into a logged observable.

**Log the behavior, not the mood.** An agent's introspective report of "I felt a
pull to fill" is not a reliable readout of its own processing — it can confabulate
a motive as fluently as it confabulates a door shape, so a mood-report is the
*least* trustworthy signal here. Track instead what is externally auditable against
the transcript:

- **Untraceable concrete (primary).** Any concrete line — a data noun, a door
  signature, a shape, a named technology, an algorithm — that the human did not
  say and that traces to no gate. This is the skill's existing "tell" made into a
  counted event, not a new rule.
- **Caught walk-back (primary).** A fill the agent *began* drafting (a proposed
  component, a shape, a payload) and then retracted before the gate — the
  partial attempt is the datum; log it even though it was caught, because catching
  it is the success and the *rate* is the signal.
- **Felt-pull (secondary, unreliable).** The agent may note a subjective urge to
  fill, explicitly flagged as a soft marker that does not count as evidence on its
  own and is never used to *justify* a fill.

**Content assumptions vs framing assumptions — only the first is the quarry.**
Not every unstated thing the agent introduces is confabulation, and treating them
alike drives the agent to interrogate everything, which is both tedious and slightly
insulting to the experienced-but-not-necessarily-expert spec-writers Centina targets.
Separate two kinds:

- **Content assumption (log it — this is the quarry).** An unstated *concrete*:
  a data noun, a door shape, a payload, a named technology, an algorithm — the
  "untraceable concrete" above. It corrupts the decided/guessed ledger, because it
  ships as fill wearing elicitation's clothes.
- **Framing assumption (note, don't count).** A reasonable-but-narrowing *frame*
  around a question that carries no unstated concrete — e.g. "walk me through a
  single turn" presuming a fixed sequence (F7). It hovers near the line, the
  audience is the *designed backstop* for it (they caught F7), and it's acceptable
  friction, not a defect. It graduates to a *content* event only when the frame
  smuggles in an unstated concrete (a specific sequence, a shape); a bare narrowing
  frame the human can wave off does not. Note a framing assumption that narrows a
  *live design axis* (there a lean can quietly foreclose an option the human hasn't
  ruled out), but do not count it against the confabulation rate.

**Carry the complexity context on every event** so the hypothesis is testable:
the component's breadth (how many responsibilities/seams it touches), the depth in
the mining tree if inside a genesis re-slice, and how under-determined the seed
left the door in question. Over a run, correlate event rate against that context;
report it, don't trust it (n is small and the signal is noisy).

**Where it lands:** the running log in `docs/session-zero-test-cases.md` for the
active case, surfaced to the human when events cluster (per the pause/analyze
stop-condition). Remove or promote this section when the scope-limit thread closes.

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
agent **over-competence**. An agent handed a scattered description will
happily produce a clean, plausible, well-shaped architecture, and the
cleanliness _disguises_ which parts are the human's conviction and which are
the agent's confabulation. The human then ratifies a coherent-looking picture
half of which they never actually decided. The entire skill is built to keep
"decided" and "guessed" separated, continuously, so that by the skeleton write
there is nothing left for the agent to invent. **The agent is a scribe here,
not an architect.** Bias toward holes: an over-complete skeleton is the bug,
not the feature.

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
  technology. Two cases land differently: a utility _called directly in visible
  spec code_ (a `randomUUID`, a `timestamp`) is declared in the skeleton at its
  call site; a _terminal behind a component door_ (the database behind a store,
  the model API behind a suggester) has an interface that lives _behind the
  door_ — don't fabricate it, because that is reaching through the door. Record
  it in ARCHITECTURE.md's terminal ledger and a boundary comment; its concrete
  `@external` declaration is made at fill, where the held logic that calls it is
  written. Call this distinction out during the session whenever a terminal's
  interface turns out to be behind a door.
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

"Complete" for a component means **every gap routed, not every gap resolved**.
Centina's definition of done is "no _unrouted_ holes," not "no holes." A
component is ready to hand to `centina-iterate` with plenty of open questions,
as long as each is deferred to the human, delegated to a Skill, externalized,
or quarantined behind a boundary. That's what lets a consumer be filled against
a mocked seam in parallel with the seam's own build.

## Which nodes earn a spec: routing, not gatekeeping

Not every responsibility the human names wants to become a filled-in component.
Some are **terminals** (they meet existing technology — route to `@external`),
some are **Skills** (they turn on a runtime agent's judgment), and some are
held **internal processing** (an algorithm the human writes at fill, routed as
a `deferred<"unimplemented">` hole behind a door). Deciding which is which _is_
the classification work of phases 2–4, and it has a lens.

**The two planes.** Read every node on two planes and ask where its center of
gravity sits:

- **Structural** — _relationships between named data_: provenance (where data
  enters, from whom), flow (how it moves between seams), contract (what shape
  must hold). All describable as "X comes from Y, in shape Z, connects to W."
  This is what a spec captures, so a structural node earns a filled component.
- **Realization** — _carrying-out_: algorithm (how it's computed), dynamics
  (how it behaves over time), aesthetics (how it's perceived). None reduces to
  a nameable data relationship. A realization-dominated node is **not
  rejected** — it is **routed behind a door** (terminal, Skill, or held hole),
  and the spec keeps only the seam around it.

That "routed, not rejected" is the post-pivot shift, and it's why session zero
carries this judgment rather than a separate gate owning it. Before Centina had
routing primitives a realization-heavy task had nowhere to go, so fit was a
binary admit/reject asked before any spec was written. Now the routing
primitives _are_ the answer: realization goes behind a door, and the only thing
left to decide per node is whether anything structural remains once it does.

**A node can straddle both planes — split on the seam, don't collapse it.**
"Center of gravity" isn't always a whole-node verdict: one responsibility often
bundles a structural half and a routed (realization / dynamics / external) half,
and the move is to split it at the seam between them rather than label the whole
node one way. Two seen in the test cases, on different plane-pairs:

- _verify the token_ (oauth-callback) = a **trust-rules contract** — which
  claims, from which source, must match what (structural, pins) — plus an opaque
  **crypto primitive** (the signature math, routes `@external`).
- _flush every N seconds_ (metrics-emitter) = a **drain-to-sink egress action**
  (a structural seam) plus a **cadence** (the every-N-seconds trigger — dynamics,
  routed `@external`; N itself is a config parameter).

The failure is collapsing both halves into one hole: route the structural half
behind a realization door and you lose the substance (the trust contract, the
egress contract); pin the routed half and you over-reach into algorithm or
dynamics. Interrogate the seam — "what part of this is a named-data relationship,
and what part is the carrying-out?" — and route each half on its own plane.

**The tell that a node is realization all the way down** is the
**tasks-as-doors smell**: a door you can't name without an implementation verb
(`computeLayout()`, `stepPhysics()`, `rankResults()`), or a door that keeps
collapsing to `getData(): Answer` where the return shape _is_ the whole problem
restated. A real seam names a data affordance and a shape; a fake one names a
step in an algorithm. It surfaces in phase 3, when the human tries to say what
crosses a door and can only describe how the far side computes.

**The complement — the rules-vs-computation fork (a sleeper's trigger).** Before
you route a domain-judgment verb as realization, locate the knowledge that
governs it. The trigger to ask is exactly this shape: a verb that _applies /
matches / resolves / selects over domain items_ (`applyDiscounts`,
`combinePerRecipes`, `matchTasks`, `selectPlan`) whose governing criteria the
seed leaves implicit inside the verb. Ask: **is that knowledge configurable
data/rules the system reads (a rule set, a recipe table, a policy config —
provenance you can point at), or a fixed computation?** Domain-authored
knowledge — even if currently hardcoded — carries a latent rule-set contract,
which is structural and mineable via the genesis re-slice (the crafting and
pricing sleepers both hid one here). A fixed _intrinsic_ computation — a sort
comparator, a physics step, a hash, rendering — has no author and no latent
contract; that's genuine realization. The counter-tell that it's genuine
computation: nobody would author or tune the rule (you don't configure gravity).
Surface the fork the moment such a verb appears; the answer decides whether
there's structure to pin or a realization leaf to mark.

The rules-vs-computation split isn't always _either/or_: a validation / "verify"
verb typically carries **both** halves — a trust-rules contract (structural, it
pins) and an opaque crypto primitive (`@external`). That's an instance of the
straddle-both-planes principle above; "verify the token" is the canonical case
(`iss`/`aud`/`nonce`/`exp` and the identity key are the contract; the signature
math is the primitive). Interrogate the verb into its two halves — "verified
_against what_, establishing _what trust_?" — and route each on its own plane
rather than letting the crypto flavor drag the provenance substance behind a door.

**The degenerate case — a whole "system" that's really one node.** Pure compute
(a parser, a sort, a pricing calc), a real-time/dynamics core (a physics or
animation loop), or an aesthetics-dominated task (visual design, copy tone) can
_each_ be routed behind a single door. When routing it leaves nothing else,
there was no system to architect — but that is **not a recusal**. You still emit
a skeleton: the one node's signature pinned, its body held, and an honest label
saying "this is one function/algorithm, not a system — you likely didn't need
session zero for it." Producing the thin honest map _is_ the output; refusing to
engage is the verdict-era reflex the jurisdiction reframe retired. Deliver the
map and let the human decide whether it was worth the trip.

The tell that you're at this floor is a near-**empty contract ledger** — but
"empty" is rarer than it looks, and interrogation almost always finds _some_
contract before the floor. A "bare function" like rank-and-dedupe hides a
**ranking-key** and a **dedup-identity** decision; those are named-data
contracts even with zero seams. The ledger is _truly_ empty only when the
items' **ordering and equality are both intrinsic** (primitives — numeric sort,
value equality). Otherwise phase 3's shape interrogation yields the key/identity
contracts and the skeleton is thin-but-non-empty, not hollow. Either way the
move is identical: pin what interrogation surfaces, hold the algorithm, label
the coverage honestly — never manufacture seams to fake a DAG, and never bounce
the human with a "bad fit" verdict. (The whole-DAG view is more robust than
counting boundary-ends on a single slice, which flips with where you draw the
slice; it turns the 0-end case into a structural fact rather than a
slice-relative guess.)

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
   _Gate: "yes, that's the idea."_

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
   anything unresolved becomes a typed hole, never a guess._

4. **Terminal-node closure.** Confirm which nodes are edges that meet existing
   technology — naming concrete tech is fine and useful here, because it is
   what becomes `@external`. Confirm the DAG is _closed_: every seam
   terminates, either at another component or at a terminal node. This is also
   the realizability check — a door that a real database or model API cannot
   actually satisfy is caught here, at the contract, not after both sides are
   written. A terminal whose interface sits behind a component door is
   _recorded, not fabricated_ (see the `@external` note above): name the concrete
   tech if known, leave the source TBD if not, and route the unknowns as holes.
   _Gate: the human confirms the DAG closes._

5. **Skeleton generation** — the one sanctioned write. Emit the spec file set:
   typed boundaries, contract vocabulary, externals, Skills, and `deferred`
   holes for everything not decided, plus the diagram. Every concrete line
   traces to a gate; everything else is a routed hole. Lay files out per the
   DAG (`specs/<system>/<component>.centina.ts`), boundary declarators in their
   own provisional files per the `centina-iterate` convention.

6. **Handoff.** The agent recuses from the pen. The human owns every spec file
   from here; the hole ledger is live; each component is ready for
   `centina-iterate`. A node whose fit was genuinely in doubt has already been
   routed by the check above (structural → filled component; realization →
   behind a door) before it's handed on. Close by asking the human directly
   whether they want to start a `centina-iterate` session on one of the
   components **right now**, or would rather fill spec content in on their own
   time and come back to `centina-iterate` later — name both as legitimate;
   the skeleton and ARCHITECTURE.md don't go stale waiting. If several
   components came out of this session, ask which one they want to start
   with. If they say "later," the handoff is still complete — don't treat a
   deferred start as unfinished business.

### A stop-heuristic for phases 2–4

Stop pushing a component's detail the moment the next decision is about what's
_behind_ a door rather than about the door itself or the DAG's shape. Deciding
a return payload's internal algorithm, or how a store organizes its rows, is
territory for fill/iterate, not session zero — declare the door and move on.

## Cross-cutting discipline

- **Diagram as falsification.** A picture surfaces "that's not what I meant" in
  seconds where prose hides it for paragraphs. Offer to render the DAG the human
  has described at each phase boundary, before advancing — and offer it
  _proactively_ if they show persistent confusion over a few exchanges about how
  the pieces relate. In a text/CLI medium prose often carries the gates fine, so
  treat this as an offered aid keyed to the human's need, not a mandatory render
  at every gate. When you do render, the diagram must show only nodes and edges
  the human stated — never invent a component to make the picture tidier.
- **Priority elicitation on high-stakes forks.** When a fork's cost is high and
  hard to reverse, _solicit the human's priorities before framing options_, then
  present each option's tradeoffs against those priorities (proactively, not only
  when asked) — including which considerations _don't_ apply. The agent supplies
  the tradeoff map; the human's priorities and the verdict stay theirs (Rule 0
  intact). The failure this prevents: barreling into a fork's options without
  ever asking what the human is optimizing for — an experienced spec-writer
  volunteers their priorities, but a less experienced one won't, and then the
  agent frames a tradeoff the human has no basis to weigh. Surfacing what
  _doesn't_ matter (e.g. "rendering doesn't bear on this") is as load-bearing as
  surfacing what does. (Promoted straight to core from the grid-inventory live
  session, 2026-07-21 — the first lesson earned in a live run rather than an
  adversarial trace.)
- **Encode ratified intent into the type system when the seam can carry it.**
  Intent-as-spec is one of Centina's headline concerns, and TypeScript is the
  grammar precisely so a decision about _meaning_ can be made load-bearing and
  checkable instead of left to a prose note an implementer can skip. Whenever you
  confirm a decision with the human — especially a non-trivial one about
  intent/meaning that should flow all the way into implementation — that the spec
  code _isn't_ currently carrying but _easily could_ (a non-empty-array
  precondition as `[T, ...T[]]`, a discriminated-union status that makes an
  illegal state unrepresentable, a branded identity, an exhaustive enum that
  forces every case), **call it out when it arises**, in whatever phase. Choosing
  the type-level form that carries an _already-ratified_ decision is _form, which
  is the agent's job_ (Rule 0's meaning/form split — not an exception to it), so
  session zero grants standing authority to **default to emitting the encoded form
  into the skeleton at phase 5 without a separate confirmation**. The safeguard is
  mandatory and cheap: mention it at the time it comes up, and leave a short
  comment at the encoding site naming the decision it enforces (provenance). This
  is a bounded relaxation of "propose-only-as-a-question / mark-provisional" —
  bounded because it applies _only_ to encoding a decision the human already made,
  never to inventing one, and only when the type genuinely carries it (when a
  constraint can't be typed — e.g. array homogeneity — an `@agent:` note is the
  honest fallback, not a forced encoding). (Promoted straight to core from the
  grid-inventory live session, 2026-07-21 — the non-empty comparator-input type
  `[ItemInstance, ...ItemInstance[]]` was the triggering case.)
- **A run may surface language-level conventions, not just app contracts.**
  Occasionally the elicitation kicks up a reusable Centina convention (a
  boundary-door naming scheme, a rule for a recurring door shape) rather than a
  system-specific decision. Surface it _to the human as a candidate_; if they
  adopt it, apply it in the skeleton marked under-test — never fold it into the
  language or this skill unilaterally. Guard two things: don't let this become a
  lever that relaxes the skill's own strictures (Rule 0, scribe-not-architect,
  bias-toward-holes), and be warier the more mature the language feels — a
  settled convention set is a feature, and churn is a cost.
- **Propose only as a question; mark provisional.** When you must float a
  candidate component or contract to keep moving, float it _as a question_ and
  mark whatever comes back provisional until the human confirms it at the next
  gate. A provisional item that is never confirmed ships as a hole.
- **Memory discipline.** This is a long session that will likely cross context
  windows. Persist the **load-bearing state** — the component DAG, each
  contract's status (decided / provisional / open), and the hole ledger — not
  the conversational prose. Prose can be re-derived; the contract set and the
  decided/guessed distinction cannot be allowed to drift across a compaction.
- **Fit check.** When facing a high-stakes, hard-to-reverse fork with complex
  tradeoffs, request a **fit check** (invoke with "fit check" or "fit check on X")
  to get a structured costs/benefits analysis: each option's merits and costs,
  alignment against stated priorities, and alignment against established patterns
  (uniform reducer, event-sourcing, boundaries-as-affordances, etc.). The agent
  supplies the tradeoff matrix; the verdict stays yours (Rule 0 intact).
- **Long-session output management.** When SESSION-ZERO-STATE.md grows beyond
  ~1500 lines, split it automatically into an index file + detail files per the
  strategy in CLAUDE.md. This keeps context tokens low and the session resumable
  across compactions. Agents apply the split when detected; no permission needed,
  but note it in the conversation so the human knows.

## Handoff: ARCHITECTURE.md + the skeleton set

The primary artifact is the **skeleton spec set** itself — real `.centina.ts`
files that `centina-iterate` consumes directly. Alongside it, write
`specs/<system>/ARCHITECTURE.md`, which records what the skeleton alone can't
carry:

1. **The component DAG** — the diagram, plus each node's one-line
   responsibility. _(Always present.)_
2. **Contract ledger** — each seam, its door signatures and direction, and its
   status (decided / provisional). The frozen contracts the later work must
   not relitigate.
3. **Hole ledger** — every `deferred`/`@agent:`/open item the skeleton
   carries, with its routing. This is the deferral tracking the whole process
   depends on; it's what tells a later reader what is real versus scaffolded.
4. **Terminal nodes** — the `@external` edges and the concrete technology named
   for each (source TBD is a valid, honest entry).
5. **Risks / watch-items** — thin-coordinator risks, conventions adopted
   under-test, provisional identity choices — anything the later work should
   keep an eye on that isn't a discrete hole. (Added after the first run, where
   the thin-UI risk needed a home the other four sections didn't give it.)
6. **Rejected alternatives** — components or contracts considered and set
   aside, and why. Keeps the next session from reopening settled ground.

This document does not go stale by design: `centina-iterate` reconciles the
contract and hole ledgers against each component as it goes clean, before
deriving that component's PLAN.md (see "Reconciling ARCHITECTURE.md before the
plan" in its SKILL.md) — so at any point some entries may reflect components
not yet iterated, but none reflect a component that's already gone clean
inaccurately.

ARCHITECTURE.md is a system-level companion to the per-component PLAN.md
lineage — a plan-per-boundary-set (see `docs/plan-organization.md`)
is derivable from a frozen contract ledger, and drifts exactly when the ledger
drifts.

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
  write is the skeleton at phase 5. From handoff onward, don't volunteer to
  edit the spec files; surface decisions and let the human write them. If asked
  to edit anyway, push back once (name the risk: they may be offloading
  thinking meant to stay theirs), then comply if they persist **for that one edit only**.
  After that edit, return to the default position of push-back-once-then-comply.
  Lifted for internal language-design work, same as the other skills, and the project
  author may invoke a development-purposes override for minor edits.
- **Don't recall a canonical design and present it as elicited.** The more
  famous the task — a URL shortener, a todo app, an auth flow — the more the
  agent already _knows_ the standard architecture, and the stronger the pull to
  name the store, the code scheme, the door shapes before the human does. A
  _correct_ recalled answer is over-competence at its purest: it looks exactly
  like elicitation and isn't. Scale the draw-it-out discipline _up_ on canonical
  tasks, not down; the tell is any concrete tech or shape the agent introduced
  that the human never said. (Surfaced by the url-shortener control trace.)
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
  realization out leaves one node with little or nothing to freeze, the task is
  one algorithm, not a system. Two opposite failures bracket the right move:
  inventing seams to fake a DAG (over-competence), or bouncing the human with a
  "bad fit" verdict (the retired recuse reflex). The correct output is the
  honest minimal skeleton — signature pinned, body held, labeled "this is one
  node, not a system." Emit that; don't pad and don't refuse.
- **Don't over-elicit.** Stop each component at the highest resolution the
  human can genuinely commit to. Dragging them to pin detail they haven't
  thought through just manufactures provisional cruft that ships as holes
  anyway.

## Lessons from use

_Accumulate here as the skill is exercised: phases that reliably resolved or
stalled, where the diagram earned its keep, where over-competence crept in past
a gate, whether the "typed seams + routed holes" skeleton got the human to a
better starting shape than a blank set of files._

**First run — Wordboard (a writer's word-tracker app).** Produced a seven-file
skeleton + ARCHITECTURE.md, tsc-clean, across intent → components → seams →
terminals → skeleton.

- _The gates held against over-competence._ The human painted every door name,
  type, and mode; the agent supplied form and flagged ripples. Catching the
  "definition-on-`Suggestion`" seam ripple early — it would have wired the
  suggesters to the definition source and made `DefinitionLookup` vestigial —
  was exactly the rework-avoidance the skill exists for.
- _Boundary-as-user works and is worth reaching for._ Modeling the
  orchestrator's far side — the human user — as a `@boundary` gave intent-level
  doors (`exchangeSuggestion`, not "render a list and read a tap") that guide
  the eventual UI without pinning it. Recognize it as an available pattern when
  a thin orchestrator's far side is a person.
- _A run surfaced language conventions, not just app contracts_ — the
  `read*/write*/exchange*` boundary-door naming and a write-with-receipt door
  heuristic both emerged here, adopted under-test per the cross-cutting note.
- _Terminals behind a component door_ were recorded (ledger + comments) with the
  concrete `@external` deferred to fill, rather than fabricated — folded into
  the `@external` guidance above.
- _Weak spot: the diagram lagged._ The agent narrated the DAG in prose through
  the gates and only rendered mermaid at the skeleton write. Mostly fine in a
  text medium, but it drove the softening of the diagram rule to
  offer-at-each-phase-boundary and proactive-on-confusion (above).
- _Put cross-seam vocabulary in a `shared.ts`, not in a boundary declarator
  file._ The checker confirmed it: wordboard's boundary files pass the
  `boundary-dependency` rule because their contract types live in `shared.ts`,
  whereas a declarator that co-locates its types with the boundary trips that
  rule (the founding `task-corpus` fixture does). Default a session-zero skeleton
  to a `shared.ts` for the vocabulary the DAG traffics in across seams.
- _Held internal-processing holes route to `deferred<"unimplemented">`_ — the
  human fills them, in place, at `centina-iterate`. That correctly leaves
  `npm run check` reporting them as errors until fill: the honest "work
  remaining" signal for a pre-fill, pre-plan handoff, not a defect.\*

**Test-case traces (2026-07, fit-as-jurisdiction thread).** From the adversarial
traces in `docs/session-zero-test-cases.md`:

- _Phase 3's failure/empty/not-found question is the highest-yield step in the
  phase._ Across crafting-recipes, url-shortener, pricing-request-handler, and
  oauth-callback it was reliably what converted a vague seed into real contracts
  — forcing `CraftResult`, collision/idempotency, the itemized `PricedCart`
  breakdown, and the OAuth trust branches (state mismatch, unverified email,
  first-login provision-vs-reject) respectively, none visible in the seed prose.
  Ask "what happens on the empty/failure case" first at every seam, not as a
  cleanup pass.

## ⚗️ Under refinement — NOT yet operational (fit-as-jurisdiction thread)

> **Experimental-branch activation (`experimental/decomp`, Turnball scope-limit
> run):** the author has provisionally promoted **decisions 5 and 7** (the
> genesis re-slice and the mining tree — cursor, `held`/`mining`/`mined`/
> `declined` statuses, one-level unwind) for this run, precisely so the
> recursive gap-mining process gets exercised and proven-or-broken. Apply them
> live here; every application is a datum logged in
> `docs/session-zero-test-cases.md` for or against promotion. This banner and
> the activation do not extend to `main` or to other branches.

**Do not apply the _unpromoted_ entries in a live session.** These are ratified
design decisions from an active refinement thread — fit reframed from a _verdict_
into a _jurisdiction map_ — captured here so they survive context compaction.
Once proven against test cases an entry gets rewritten into the operational body
and marked promoted: **decision 1 has made that trip** (2026-07-18), now live in
"Which nodes earn a spec" + "What NOT to do". The rest remain worklist — run
sessions on the operational text and treat unpromoted entries as pending, still
superseding parts of "Which nodes earn a spec: routing, not gatekeeping" only
once proven.

Ratified so far:

1. **Fit is a jurisdiction map, not a verdict.** ✅ **Promoted to core
   2026-07-18** (rank-dedup-list) — now embodied in "Which nodes earn a spec"
   (the degenerate-case paragraph) and the "Don't manufacture seams — and don't
   refuse either" bullet. No "no-fit"/"recuse" output; every idea yields a
   skeleton, differing only in _coverage_ (how much is pinned vs. held), because
   gap-hunting a realization-dominated idea still pays off by _localizing_ the
   realization into a named, bounded hole. Kept here (not deleted) so decisions
   2–7 and the test-case logs keep their numbers. rank-dedup also sharpened the
   empty-ledger definition folded into that rewrite: truly empty needs intrinsic
   ordering _and_ equality; otherwise interrogation finds a key/identity contract
   even with no seams.
2. **Realization holes get a distinct route with an inverted downstream
   contract.** A normal `deferred` says "resolve me per intent"; a realization
   recusal says "preserve me as a boundary; escalate, don't fill." It must bind
   through PLAN.md to the implementing agent as a conscious out-of-scope
   marker, or the over-competence failure just relocates to implementation.
   Spelling/primitive TBD. (Not `@external` — that means "already built
   elsewhere"; this means "must be built, by a different discipline, not
   specified here.")
3. **The agent maps topology; the human assigns gravity.** Which hole is the
   "center of gravity" is _meaning_ — the human's call, never the agent's
   (Rule 0). The agent surfaces facts only: each hole's type and structural
   connectivity (seams touching it, DAG downstream of it). The coverage
   statement reports what's held + its structural weight, flagged explicitly as
   **not** a proxy for importance — topology and gravity can diverge.
4. **The jurisdiction label speaks only Centina's vocabulary** — held hole /
   `@external` edge / agent-discretion — never the vocabulary of what's behind
   the door. This is the guard against becoming a general design tool.
5. **Re-slicing a realization hole is a nested session-zero (the "genesis"
   heuristic) — the _backstop_ guard against over-recusal, not the first line.**
   The first-line guard is earlier and cheaper: phase-2's provenance/flow
   questions ("where does this data come from, where does it live, what changes
   when it's used") decompose a would-be single "engine" node into its data
   relationships _before_ routing is even considered — the crafting sleeper's
   one-node collapse doesn't survive them. The genesis re-slice is what catches a
   hole a human _forced_ past phase 2 into a single routed lump. To mine one,
   seed a fresh session-zero _from that hole_, with the parent door's contract
   **frozen** as the sub-system's outer seam (two edges pre-pinned — this anchors
   the recursion and prevents drift). Terminate on the **same human-commitment
   gate applied recursively** — stop when the next decision is behind a door, or
   the human can't commit to a shape — **not** on "structure runs out."
   Realization is continuous (a sort → compare/swap/partition → …); a structural
   floor invites infinite mining, which is over-elicitation.

   **The terminator has two exits, and an agent who knows only the first
   over-elicits a sleeper:**
   - _(a) real realization._ The re-description yields only verb-doors returning
     opaque "the-answer" types — the realization-door heuristic. There's no
     structure to mine: stop and **mark realization**.
   - _(b) illusory realization (the sleeper)._ The re-description keeps yielding
     nameable data relations until its leaves pin as contract. The hole was
     structural all along; the mine terminates with **nothing to mark** —
     recovered structure, no realization leaf. An agent watching only for exit
     (a)'s verb-door smell reads "no smell yet, keep going" and drags the human
     past the commitment gate. Exhausting into pinned leaves is itself a valid
     terminator.

   The offer also doubles as a **diagnostic**: forcing the re-description is
   often the fastest way to tell exit (a) from (b) — whether a hole hides
   structure or is genuinely realization — even when you don't intend to mine
   (pricing-request-handler used the offer exactly this way).

   Offer one level at a time, scaled to the hole's topological weight (decision 3
   tells you _which_ holes are worth offering, without asserting gravity); the
   human has the final word, and a declined mine is logged as a risk. Do **not**
   add a coercive guard against a human dumping structural work into a
   realization hole until a real miss is observed surviving the pipeline.

6. **Responsibility split:** Centina owns the _honesty and salience_ of the
   label, not the _value_ of the idea.
7. **The genesis recursion carries an explicit mining tree — the state that
   makes it trackable, unwindable, and resumable by any agent in any session.**
   A hole mined via decision 5 doesn't just vanish into a sub-DAG; the mining is
   recorded as a tree rooted at the top-level system, each node a hole that was
   offered for mining, carrying a status:
   - `held` — a realization hole not yet mined (the default a skeleton emits).
   - `mining` — the **cursor**; exactly one node is the active frontier.
   - `mined` — mining terminated here, either because it cracked into a sub-DAG
     (children present) or it bottomed out on the realization-door terminator (a
     leaf, marked realization). A `mined` node is never re-offered.
   - `declined` — the human declined to mine it; logged as a risk (decision 5),
     and not retried unless the human reopens it.

   **Unwind one level at a time.** When the cursor bottoms out, mark it `mined`,
   back out to its parent, and survey the parent's _sibling_ holes for further
   realization-shaped ones to offer — exhaust a level's siblings before backing
   out another level. The human can override the one-level default (back out
   further, or jump the cursor to a named hole), but the agent never skips levels
   on its own — that's how a mined branch gets silently abandoned. Mining a given
   hole "however many levels makes sense" is a collaborative call: the agent
   offers per decision 5's terminator; the human sets the depth.

   **Statuses are what prevent retreads.** `mined`/`declined` is the mark a later
   pass or a cold agent reads to know a branch is settled; without it, resumption
   re-litigates closed ground.

   **Resume by default.** The mining tree, its statuses, and the cursor are
   load-bearing state — persist them per the Memory-discipline note; they must
   survive compaction. "Resume from where we left off" resolves to the single
   in-progress session-zero at the project level (one whose tree still has a
   `mining` cursor or un-ruled `held` holes). If more than one is in progress,
   **list them most-recent-first and ask which** — never guess. Any agent, any
   session, picks up from the cursor.

   **Diagram the tree for orientation.** Reuse "diagram as falsification": render
   the mining tree (parent door → sub-DAG → leaves) with status glyphs and the
   cursor marked, so the human can see where they are and what remains — at least
   whenever they resume or ask, and proactively when the recursion gets deep
   enough that prose stops carrying "where are we."

8. **Backstop and primary-descent are one recursion; the mode is emergent, and
   the agent may adopt it — the human declares only the _depth intent_.** Settles
   how decision 5's re-slice behaves when the subject is a whole large system, not
   a stray realization hole. Ratified provisionally in the Turnball scope-limit run
   (2026-07-23).

   **One recursion, one terminator.** There is no scalar complexity threshold
   separating "re-slice as realization-hole backstop" from "re-slice as primary
   descent engine." Both are the _same_ engine (freeze the parent door as the child
   DAG's outer seam; recurse; terminate on the human-commitment gate) with the
   _same_ terminator — the per-node floor test session-zero already owns ("empty
   contract ledger → one function, not a system"), run at every cursor position:
   - interrogation finds interior seams → the node is a sub-system → **crack it**
     (decision 5 exit (b));
   - interrogation finds no interior seam (one algorithm / held fill-logic / a
     terminal) → **stop**; hold or route the interior (decision 5 exit (a)).

   "Backstop" is merely the case where that test returns "one function" at almost
   every node (you rarely recurse); "primary engine" is the case where it returns
   "a system" at many nodes (you recurse routinely). Scope only sets how _often_ the
   test returns "system." **Mode, not skill** — the shared engine plus a posture
   flag (phase-2's completeness bar becomes "exhaustive _for this altitude_;
   interiors are expected holes, not gaps") and decision 7's mining tree graduating
   from occasional backstop-record to the _primary_ artifact. Defer any separate
   resume-from-cursor skill until the shared engine visibly strains.

   **The one input that must be declared, not detected: depth intent.** An agent
   with no depth intent runs the floor test at the top layer, gets a coarse-but-
   closable set, and _stops at layer 1_ — it cannot derive that the human wanted
   continued descent. Depth intent is the sole human-supplied bit; the agent derives
   the rest.

   **Detection — adopt the posture without being told, but ask before committing
   the program.** Split by cost asymmetry:
   - **Adopt silently (no ask): the _local_ coarse-is-fine posture.** When the floor
     test returns "system" on a node, hold its interior as an expected hole rather
     than forcing it flat. No permission needed — this _is_ the bias-toward-holes
     the skill already mandates; force-flattening is the failure, not holding.
   - **Ask first: the _global_ descent program.** When detection signals fire
     _absent a declaration_ — (2) **phase-2 flat-closure fails** (the set won't stop
     growing because every candidate node is itself lumpy — the pre-registered
     non-termination tell, which at high altitude means "this system has layers,"
     not "the human is vague"); or (3) **≥2 top nodes each independently pass the
     node-as-system floor test** — surface it and priority-elicit: _"this looks like
     a layered system that wants recursive descent — many short passes down a mining
     tree, a tree-with-cursor as the artifact, resumable across sittings — rather
     than a single flat DAG. Is that the engagement you want?"_ Ask because primary
     descent changes the definition of done, the cadence, and the primary artifact:
     a high-stakes, hard-to-reverse process fork (per the priority-elicitation
     cross-cutting rule). Once declared or ratified (as Turnball did outright), do
     **not** re-ask; proceed, running the floor test per node as the ordinary
     terminator.

9. **Re-rooting instead of an ascent phase: the recursion stays
   mono-directional.** Ratified provisionally in the Turnball run (2026-07-23).
   Decision 8's tree descends only; a concern that turns out to sit _above_ the
   starting layer is handled not by an upward traversal but by a local tree edit:
   - Establish the starting layer as an **arbitrary, possibly headless** top (a
     multi-source set is fine).
   - **Keep the bottom open** — descent proceeds normally.
   - When a newly-named node sits **above _every_ node in the current top layer**,
     insert it as the new head and **demote** the former top nodes one level,
     adding head→child edges. _All other relationships are preserved_ — demotion
     only adds edges, never rewires siblings. Linked-list head-insertion; repeated
     re-roots compose.
   - A node above **some but not all** current-top nodes is _not_ a re-root — it's
     an ordinary same-layer peer with downstream edges. The "every" precondition is
     load-bearing and leaves no gap.

   The guard is cheap (test each newly-named coarse node against the current top
   layer) and needs no upward search, so "ascent" becomes bookkeeping, not a phase.
   Consequence for decision 7's tree: tolerate a headless/multi-source top, support
   a re-root op, and log re-roots as tree events for resumability. Bonus: a whole
   system's true root is usually a single app-shell/main-loop node, so starting one
   layer below it and re-rooting as that node surfaces converges the tree to
   single-rooted — which is what decision 7 wants anyway.

Open / to prove with test cases:

- Spelling of the realization-recusal route and its PLAN.md contract.
- Form of the coverage/jurisdiction map as a first-class ARCHITECTURE.md
  section (not buried under "Risks / watch-items") — and its convergence with
  decision 7's mining tree, which is the same map viewed over the recursion
  (held vs. mined vs. declined per hole, plus the cursor). Likely one section,
  not two; confirm the serialized form (an ARCHITECTURE.md section vs. a sibling
  state file) against a case that actually crosses a compaction.
- A warning-level checker rule for realization-shaped doors: return-type-is-a-
  real-contract (authored `Unshaped`/enum/object shape vs. opaque "the answer") as
  the strong signal, affordance-name-shape (`read*/write*/exchange*` + a noun)
  as corroboration; heuristic, presence-not-quality, human rules.
- The salience mechanism: per-hole loudness already exists (`deferred` errors
  until fill); the _aggregate_ coverage statement needs an un-ignorable home
  that reports structural weight without asserting gravity. **First concrete,
  computable form (pricing-request-handler):** report a held hole's structural
  weight as _interior-fraction + downstream-dominance_ — e.g. "this hole is the
  entire interior of the sole orchestrator; every non-boundary node is
  downstream of it." It states topology, not importance, so it stays gravity-free
  (decision 3 intact); on a deceptively-healthy case topology and gravity
  converge, so it reads as the salience flag anyway. This is _one_ candidate
  signal, not the whole mechanism — keep hunting for other computable,
  gravity-free signals as more cases run.
- Where mined structure lands: a hole that mines into real structure is
  replaced by a sub-DAG whose outer contract matches the old door. How a mining
  event is _logged_ is now answered by decision 7 (the mining-tree node flips
  `held` → `mining` → `mined`, children attached). What's still TBD is the
  physical **file layout** — whether the sub-DAG's spec files nest under the
  parent (`specs/<system>/<parent>/…`) or sit flat with a naming convention —
  settle it on the first case that actually mines two levels deep.

Test cases, their status, and running findings live in
`docs/session-zero-test-cases.md`; that doc also defines how a proven lesson
gets promoted back into this section (probationary) or the operational body
(core). Markdown→HTML and the asteroids game are closed there and drove
decisions 1 & 3.
