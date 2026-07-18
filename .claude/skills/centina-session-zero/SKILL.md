---
name: centina-session-zero
description: The front of the Centina funnel for a whole system, not a single task. Drives a gated conversation that turns a human's prose idea into a component DAG — high-level components, the typed boundary contracts between them, and the terminal nodes where the system meets existing technology — then, and only then, emits a skeleton spec set (typed seams + routed holes, no internal processing) plus an ARCHITECTURE.md that records the DAG, the contract ledger, and the hole ledger. Use when the human has a system/app idea and asks "where do I start", "help me architect this in Centina", "break this into components/specs", "design the component structure", or is otherwise standing up a new multi-spec project from scratch.
---

# Centina Session Zero

This skill runs at the very **front of the funnel**, before there is any spec
to iterate. `centina-iterate` refines *one* spec toward clean; session zero
sits upstream of it: the human has a *system* in their head — several
components that talk to each other — and needs it turned into a **component
DAG** with frozen seams before any one component is worth filling in. Sorting
those nodes — which earn a filled-in spec, which route away as terminals,
Skills, or held holes — is part of the work here (see "Which nodes earn a
spec" below).

The lineage it feeds: **ARCHITECTURE.md + skeleton spec set** (session zero) →
**`<component>.centina.ts`** filled in (`centina-iterate`) → **PLAN.md** per
boundary-set (the implementation). Session zero's whole job is to make the
*shape* right early, so the later fill-and-iterate work is isolated by
dependency direction instead of rippling backward.

Why it exists: writing one component fully, *then* discovering its boundaries,
forces rework on the component when the boundaries turn out to be shaped
differently than imagined. The cheaper path is to resolve the seam contracts
first — the skeleton everything else hangs on — and this skill is that
resolution, formalized into a gated process with an output artifact.

## The one sanctioned write, and its single governing rule

`centina-iterate` never writes spec content — the agent writes only form and
holes. Session zero has **one** narrow exception: at the
final phase it emits the skeleton spec set. That write is sanctioned *only*
because it is **transcription, not authorship** — the components, the
contracts, and the data shapes it lays down were all decided by the human in
the ratified phases before it, and everything the human did *not* decide comes
out as a routed hole, never a plausible fill.

The governing rule for that write, and for the whole session:

> **Every concrete line in the skeleton traces to something the human ratified
> in this session. Anything that doesn't trace becomes a marked hole.**

The failure mode this rule exists to stop is not agent incompetence — it's
agent **over-competence**. An agent handed a scattered description will
happily produce a clean, plausible, well-shaped architecture, and the
cleanliness *disguises* which parts are the human's conviction and which are
the agent's confabulation. The human then ratifies a coherent-looking picture
half of which they never actually decided. The entire skill is built to keep
"decided" and "guessed" separated, continuously, so that by the skeleton write
there is nothing left for the agent to invent. **The agent is a scribe here,
not an architect.** Bias toward holes: an over-complete skeleton is the bug,
not the feature.

## What a skeleton contains (and what it never does)

A session-zero skeleton is **typed seams plus routed holes** — not holes
alone. "Nothing but holes" would leave the contracts vague, which is backwards:
the seams are exactly the thing you most want *concrete* coming out of this
session. Concretely, a skeleton carries:

- **Boundaries** — `@datasource`/`@datasink`/`@boundary` declared classes with
  their **door signatures typed**. A door with `unknown` in and `unknown` out
  is not a contract; it's a deferral wearing a boundary's clothes.
- **Contract vocabulary** — the `Unshaped` brands, enums, and object/type-alias
  shapes the doors traffic in. These are *decided content* (the human's data
  nouns and shapes, transcribed), not holes.
- **`@external "<source>"` declarations** — where the system meets existing
  technology. Two cases land differently: a utility *called directly in visible
  spec code* (a `randomUUID`, a `timestamp`) is declared in the skeleton at its
  call site; a *terminal behind a component door* (the database behind a store,
  the model API behind a suggester) has an interface that lives *behind the
  door* — don't fabricate it, because that is reaching through the door. Record
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
a permanent constraint on the *agent*, not a description of the finished spec:
the spec grows internal processing later, authored **by the human** during
fill. The agent never writes it, at session zero or ever. So the skeleton is
**interfaces present and concrete, implementations absent and held**.

"Complete" for a component means **every gap routed, not every gap resolved**.
Centina's definition of done is "no *unrouted* holes," not "no holes." A
component is ready to hand to `centina-iterate` with plenty of open questions,
as long as each is deferred to the human, delegated to a Skill, externalized,
or quarantined behind a boundary. That's what lets a consumer be filled against
a mocked seam in parallel with the seam's own build.

## Which nodes earn a spec: routing, not gatekeeping

Not every responsibility the human names wants to become a filled-in component.
Some are **terminals** (they meet existing technology — route to `@external`),
some are **Skills** (they turn on a runtime agent's judgment), and some are
held **internal processing** (an algorithm the human writes at fill, routed as
a `deferred<"unimplemented">` hole behind a door). Deciding which is which *is*
the classification work of phases 2–4, and it has a lens.

**The two planes.** Read every node on two planes and ask where its center of
gravity sits:

- **Structural** — *relationships between named data*: provenance (where data
  enters, from whom), flow (how it moves between seams), contract (what shape
  must hold). All describable as "X comes from Y, in shape Z, connects to W."
  This is what a spec captures, so a structural node earns a filled component.
- **Realization** — *carrying-out*: algorithm (how it's computed), dynamics
  (how it behaves over time), aesthetics (how it's perceived). None reduces to
  a nameable data relationship. A realization-dominated node is **not
  rejected** — it is **routed behind a door** (terminal, Skill, or held hole),
  and the spec keeps only the seam around it.

That "routed, not rejected" is the post-pivot shift, and it's why session zero
carries this judgment rather than a separate gate owning it. Before Centina had
routing primitives a realization-heavy task had nowhere to go, so fit was a
binary admit/reject asked before any spec was written. Now the routing
primitives *are* the answer: realization goes behind a door, and the only thing
left to decide per node is whether anything structural remains once it does.

**The tell that a node is realization all the way down** is the
**tasks-as-doors smell**: a door you can't name without an implementation verb
(`computeLayout()`, `stepPhysics()`, `rankResults()`), or a door that keeps
collapsing to `getData(): Answer` where the return shape *is* the whole problem
restated. A real seam names a data affordance and a shape; a fake one names a
step in an algorithm. It surfaces in phase 3, when the human tries to say what
crosses a door and can only describe how the far side computes.

**The degenerate case — a whole "system" that's really one algorithm.** Pure
compute (a parser, a sort, a pricing calc), a real-time/dynamics core (a physics
or animation loop), or an aesthetics-dominated task (visual design, copy tone)
can *each* be routed behind a single door — but if routing it leaves nothing
else, there was no system to architect. The mechanical tell is an **empty
contract ledger**: session zero's one deliverable is frozen seam contracts, so
if the DAG won't decompose into components that exchange named data — phase 2
yields a single node, phase 3 finds no interior seam, phase 4 no terminal but
the node itself — the skeleton would be one boundary wrapping one
`deferred<"unimplemented">` hole. That **hollow skeleton** is the exact mirror
of the over-competence failure: over-complete ships seams the human never
ratified, hollow ships no seams at all, and both break "typed seams *plus*
routed holes." When you see it forming, stop and say so — this is one algorithm
to hand straight to implementation, not a system for session zero. (This is more
robust than counting boundary-ends on a single slice, which flips with where you
draw the slice; the whole-DAG view turns the 0-end degeneracy into a structural
fact — the empty ledger — rather than a slice-relative guess.)

## The ascent: raise the resolution of the questions; the human paints

Think of it as diffusion with one crucial inversion: the agent does **not**
denoise or generate the detail. Each pass the agent raises the **resolution of
the questions** it asks; the *human* paints in the pixels. The agent holding
the brush is precisely the over-competence failure above.

The session climbs through gated phases. **Each gate is the anti-confabulation
mechanism:** nothing advances until the human ratifies, and anything left
unratified at a gate becomes a marked hole rather than a fill. Push for the
highest resolution the human can actually commit to at each step; don't drag
them past what they've genuinely decided.

1. **Intent capture.** The human describes the idea in free prose. Reflect it
   back as a one-paragraph restatement in their own terms. No structure yet.
   *Gate: "yes, that's the idea."*

2. **Component elicitation.** Ask the questions that surface distinct
   responsibilities and drive toward *naming* the high-level nodes — one line
   of responsibility each. Resist proposing the component set; draw it out.
   *Gate: the human confirms the set — nothing missing, nothing that should be
   split or merged.*

3. **Seam elicitation.** For each interacting pair of components, interrogate
   the door: what crosses it, in which direction (return-type inference:
   `void` = write, non-`void` = read), what comes back, and — the question
   that is easiest to skip and most expensive to skip — *what happens on the
   empty / not-found / failure case*. Data shapes get pinned here. Work
   **outward** toward the edges. This is the richest and most Rule-0-fraught
   phase: the door signatures and the shapes they carry are the contracts, and
   they are the human's to decide. *Gate: the human ratifies each contract;
   anything unresolved becomes a typed hole, never a guess.*

4. **Terminal-node closure.** Confirm which nodes are edges that meet existing
   technology — naming concrete tech is fine and useful here, because it is
   what becomes `@external`. Confirm the DAG is *closed*: every seam
   terminates, either at another component or at a terminal node. This is also
   the realizability check — a door that a real database or model API cannot
   actually satisfy is caught here, at the contract, not after both sides are
   written. A terminal whose interface sits behind a component door is
   *recorded, not fabricated* (see the `@external` note above): name the concrete
   tech if known, leave the source TBD if not, and route the unknowns as holes.
   *Gate: the human confirms the DAG closes.*

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
   behind a door) before it's handed on.

### A stop-heuristic for phases 2–4

Stop pushing a component's detail the moment the next decision is about what's
*behind* a door rather than about the door itself or the DAG's shape. Deciding
a return payload's internal algorithm, or how a store organizes its rows, is
territory for fill/iterate, not session zero — declare the door and move on.

## Cross-cutting discipline

- **Diagram as falsification.** A picture surfaces "that's not what I meant" in
  seconds where prose hides it for paragraphs. Offer to render the DAG the human
  has described at each phase boundary, before advancing — and offer it
  *proactively* if they show persistent confusion over a few exchanges about how
  the pieces relate. In a text/CLI medium prose often carries the gates fine, so
  treat this as an offered aid keyed to the human's need, not a mandatory render
  at every gate. When you do render, the diagram must show only nodes and edges
  the human stated — never invent a component to make the picture tidier.
- **A run may surface language-level conventions, not just app contracts.**
  Occasionally the elicitation kicks up a reusable Centina convention (a
  boundary-door naming scheme, a rule for a recurring door shape) rather than a
  system-specific decision. Surface it *to the human as a candidate*; if they
  adopt it, apply it in the skeleton marked under-test — never fold it into the
  language or this skill unilaterally. Guard two things: don't let this become a
  lever that relaxes the skill's own strictures (Rule 0, scribe-not-architect,
  bias-toward-holes), and be warier the more mature the language feels — a
  settled convention set is a feature, and churn is a cost.
- **Propose only as a question; mark provisional.** When you must float a
  candidate component or contract to keep moving, float it *as a question* and
  mark whatever comes back provisional until the human confirms it at the next
  gate. A provisional item that is never confirmed ships as a hole.
- **Memory discipline.** This is a long session that will likely cross context
  windows. Persist the **load-bearing state** — the component DAG, each
  contract's status (decided / provisional / open), and the hole ledger — not
  the conversational prose. Prose can be re-derived; the contract set and the
  decided/guessed distinction cannot be allowed to drift across a compaction.

## Handoff: ARCHITECTURE.md + the skeleton set

The primary artifact is the **skeleton spec set** itself — real `.centina.ts`
files that `centina-iterate` consumes directly. Alongside it, write
`specs/<system>/ARCHITECTURE.md`, which records what the skeleton alone can't
carry:

1. **The component DAG** — the diagram, plus each node's one-line
   responsibility. *(Always present.)*
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

ARCHITECTURE.md is a system-level companion to the per-component PLAN.md
lineage — a plan-per-boundary-set (see `docs/plan-organization.md`)
is derivable from a frozen contract ledger, and drifts exactly when the ledger
drifts.

## What NOT to do

- **Rule 0: never author the architecture's *meaning* on the human's behalf.**
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
  thinking meant to stay theirs), then comply if they persist. Lifted for
  internal language-design work, same as the other skills, and the project
  author may invoke a development-purposes override for minor edits.
- **Don't fill a hole to complete the picture.** An open decision left open is
  the *correct* output. A satisfyingly-complete skeleton with no holes, from a
  session where the human left real questions unanswered, is the failure this
  skill exists to prevent.
- **Don't let the diagram invent nodes.** It renders what the human stated,
  nothing more. A component that appears only because it "obviously must exist"
  is a question to ask, not a node to draw.
- **Don't reach through a door.** Deciding what's behind a boundary — payload
  internals, algorithms, storage layout — is fill/iterate territory. Stop at
  the typed door.
- **Don't architect a hollow skeleton.** If routing the realization out leaves
  an empty contract ledger — one node, no interior seam, nothing to freeze —
  the task is one algorithm, not a system. Say so and recuse; don't manufacture
  seams to make it look like a DAG.
- **Don't over-elicit.** Stop each component at the highest resolution the
  human can genuinely commit to. Dragging them to pin detail they haven't
  thought through just manufactures provisional cruft that ships as holes
  anyway.

## Lessons from use

*Accumulate here as the skill is exercised: phases that reliably resolved or
stalled, where the diagram earned its keep, where over-competence crept in past
a gate, whether the "typed seams + routed holes" skeleton got the human to a
better starting shape than a blank set of files.*

**First run — Wordboard (a writer's word-tracker app).** Produced a seven-file
skeleton + ARCHITECTURE.md, tsc-clean, across intent → components → seams →
terminals → skeleton.

- *The gates held against over-competence.* The human painted every door name,
  type, and mode; the agent supplied form and flagged ripples. Catching the
  "definition-on-`Suggestion`" seam ripple early — it would have wired the
  suggesters to the definition source and made `DefinitionLookup` vestigial —
  was exactly the rework-avoidance the skill exists for.
- *Boundary-as-user works and is worth reaching for.* Modeling the
  orchestrator's far side — the human user — as a `@boundary` gave intent-level
  doors (`exchangeSuggestion`, not "render a list and read a tap") that guide
  the eventual UI without pinning it. Recognize it as an available pattern when
  a thin orchestrator's far side is a person.
- *A run surfaced language conventions, not just app contracts* — the
  `read*/write*/exchange*` boundary-door naming and a write-with-receipt door
  heuristic both emerged here, adopted under-test per the cross-cutting note.
- *Terminals behind a component door* were recorded (ledger + comments) with the
  concrete `@external` deferred to fill, rather than fabricated — folded into
  the `@external` guidance above.
- *Weak spot: the diagram lagged.* The agent narrated the DAG in prose through
  the gates and only rendered mermaid at the skeleton write. Mostly fine in a
  text medium, but it drove the softening of the diagram rule to
  offer-at-each-phase-boundary and proactive-on-confusion (above).
- *Put cross-seam vocabulary in a `shared.ts`, not in a boundary declarator
  file.* The checker confirmed it: wordboard's boundary files pass the
  `boundary-dependency` rule because their contract types live in `shared.ts`,
  whereas a declarator that co-locates its types with the boundary trips that
  rule (the founding `task-corpus` fixture does). Default a session-zero skeleton
  to a `shared.ts` for the vocabulary the DAG traffics in across seams.
- *Held internal-processing holes route to `deferred<"unimplemented">`* — the
  human fills them, in place, at `centina-iterate`. That correctly leaves
  `npm run check` reporting them as errors until fill: the honest "work
  remaining" signal for a pre-fill, pre-plan handoff, not a defect.*

## ⚗️ Under refinement — NOT yet operational (fit-as-jurisdiction thread)

**Do not apply this section in a live session.** These are ratified design
decisions from an active refinement thread — fit reframed from a *verdict* into
a *jurisdiction map* — captured here so they survive context compaction. Once
proven against test cases they get rewritten into the operational body; they
**supersede** the "Don't architect a hollow skeleton" bullet and parts of
"Which nodes earn a spec: routing, not gatekeeping" above. Until then, run
sessions on the operational text and treat this as the worklist.

Ratified so far:

1. **Fit is a jurisdiction map, not a verdict.** No "no-fit" / "recuse" output.
   Every idea yields a skeleton; skeletons differ only in *coverage* — how much
   is pinned vs. held. This supersedes the old "hollow skeleton → say so and
   recuse" framing: gap-hunting a realization-dominated idea still pays off by
   *localizing* the realization into a named, bounded hole.
2. **Realization holes get a distinct route with an inverted downstream
   contract.** A normal `deferred` says "resolve me per intent"; a realization
   recusal says "preserve me as a boundary; escalate, don't fill." It must bind
   through PLAN.md to the implementing agent as a conscious out-of-scope
   marker, or the over-competence failure just relocates to implementation.
   Spelling/primitive TBD. (Not `@external` — that means "already built
   elsewhere"; this means "must be built, by a different discipline, not
   specified here.")
3. **The agent maps topology; the human assigns gravity.** Which hole is the
   "center of gravity" is *meaning* — the human's call, never the agent's
   (Rule 0). The agent surfaces facts only: each hole's type and structural
   connectivity (seams touching it, DAG downstream of it). The coverage
   statement reports what's held + its structural weight, flagged explicitly as
   **not** a proxy for importance — topology and gravity can diverge.
4. **The jurisdiction label speaks only Centina's vocabulary** — held hole /
   `@external` edge / agent-discretion — never the vocabulary of what's behind
   the door. This is the guard against becoming a general design tool.
5. **Re-slicing a realization hole is a nested session-zero (the "genesis"
   heuristic), and the offer is the non-coercive guard against over-recusal.**
   To mine a hole, seed a fresh session-zero *from that hole*, with the parent
   door's contract **frozen** as the sub-system's outer seam (two edges
   pre-pinned — this anchors the recursion and prevents drift). Terminate on the
   **same human-commitment gate applied recursively** — stop when the next
   decision is behind a door, or the human can't commit to a shape — **not** on
   "structure runs out." Realization is continuous (a sort → compare/swap/
   partition → …); a structural floor invites infinite mining, which is
   over-elicitation. The realization-door heuristic is both guard and
   terminator: a fresh description that yields only verb-doors returning opaque
   "the-answer" types is the signal there's no structure to mine — stop, mark
   realization. Offer one level at a time, scaled to the hole's topological
   weight (decision 3 tells you *which* holes are worth offering, without
   asserting gravity); the human has the final word, and a declined mine is
   logged as a risk. Do **not** add a coercive guard against a human dumping
   structural work into a realization hole until a real miss is observed
   surviving the pipeline.
6. **Responsibility split:** Centina owns the *honesty and salience* of the
   label, not the *value* of the idea.
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
   back out to its parent, and survey the parent's *sibling* holes for further
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

Open / to prove with test cases:

- Spelling of the realization-recusal route and its PLAN.md contract.
- Form of the coverage/jurisdiction map as a first-class ARCHITECTURE.md
  section (not buried under "Risks / watch-items") — and its convergence with
  decision 7's mining tree, which is the same map viewed over the recursion
  (held vs. mined vs. declined per hole, plus the cursor). Likely one section,
  not two; confirm the serialized form (an ARCHITECTURE.md section vs. a sibling
  state file) against a case that actually crosses a compaction.
- A warning-level checker rule for realization-shaped doors: return-type-is-a-
  real-contract (authored `Noun`/enum/object shape vs. opaque "the answer") as
  the strong signal, affordance-name-shape (`read*/write*/exchange*` + a noun)
  as corroboration; heuristic, presence-not-quality, human rules.
- The salience mechanism: per-hole loudness already exists (`deferred` errors
  until fill); the *aggregate* coverage statement needs an un-ignorable home
  that reports structural weight without asserting gravity.
- Where mined structure lands: a hole that mines into real structure is
  replaced by a sub-DAG whose outer contract matches the old door. How a mining
  event is *logged* is now answered by decision 7 (the mining-tree node flips
  `held` → `mining` → `mined`, children attached). What's still TBD is the
  physical **file layout** — whether the sub-DAG's spec files nest under the
  parent (`specs/<system>/<parent>/…`) or sit flat with a naming convention —
  settle it on the first case that actually mines two levels deep.

Test cases, their status, and running findings live in
`docs/session-zero-test-cases.md`; that doc also defines how a proven lesson
gets promoted back into this section (probationary) or the operational body
(core). Markdown→HTML and the asteroids game are closed there and drove
decisions 1 & 3.
