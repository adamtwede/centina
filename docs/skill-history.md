# Skill history and background

History, provenance and justification taken from the Centina skills and the
docs they make an agent read. None of it is guidance an agent needs while a
session runs, so this file is not bundled with the plugin and no skill points
at it. It exists so the reasoning survives once the passages leave the files
agents load. The inventory that selected them, and what replaces each one at
its source, is `docs/skill-text-inventory.md`.

Every passage below is copied verbatim from its source as of commit `fc07251`,
with the source file and line range. A heading inside a copied passage is
kept one level down, and a source section heading that only repeats this
file's own heading is left out. The passages have since been removed from
their sources, so the line ranges point into `fc07251`, not the current
files. Where a passage is a fragment of a longer paragraph (a parenthetical
or a clause), the heading says so and the whole lines are copied for context.

## Part 1: History and provenance

### The failure cases behind the ledger format

From `docs/ledger.md`, lines 36-56.

Drawn from real-world use cases, which surfaced the failure modes this format 
exists to close. Most had no cross-reference to follow at the time the new decision 
was recorded, so a rule that only fires when a new proposal is recorded would not 
have caught them:

1. **Unlabeled claim.** A prose line ("Bathymetry is 2.5D") had no label; a
   proposal rejected it by name a day later, but nothing pointed back to the
   line. It stood unstruck for eleven days, and a terrain generator was
   designed against it.
2. **Status change without a new proposal.** Two entries still read `OPEN`
   after ratification, because ratification was written in a separate block.
3. **Only one copy amended.** A fix landed in one table row; a second,
   unstruck row making the same claim survived a doc migration and stood
   wrong for months.
4. **Dependency on a value, not a decision.** A spec comment quoted a figure
   a later decision changed; nothing tied the comment to the decision, and it
   stayed wrong for a week.
5. **Implicit contradiction.** One proposal contradicted an earlier one
   without naming it. Found a week later, during implementation.
6. **Stale reference.** A cross-reference pointed to "risk 16" as its
   successor; after renumbering, risk 16 was unrelated content.

### Where the label scheme comes from

From `docs/ledger.md`, lines 65-67.

The label scheme is drawn from legislative drafting (pinpoint citation,
amendments as separate instruments, no renumbering) and IETF RFCs
(`Obsoletes` / `Updates`, with reverse links recorded on the old document).

### Axiom statuses: the misfiling case (the clause after "not yet sourced")

From `docs/ledger.md`, lines 476-477.

Statuses: `provisional` (not yet sourced — the placeholder case that used to
get misfiled as `Kind: limit` on an `R`), `ratified` (a sourced value in

### The trail's place in the tracking work

From `docs/trail.md`, lines 1-7.

#### The trail (step 3 of the work-item progress tracking)

Agreed by the author (what counts as a decision, agent-drafted gates ruled by
the human over several turns, JSONL, one file per system). `centina-check trail <system-dir>`
validates it and writes `TRACKER.html` (see "The checker
and the tracker" below). `skills/centina-spike/SKILL.md` writes it, by
appending lines in the formats below.

### The trail is not the work tree: the terrain:W43 case (the parenthetical)

From `docs/trail.md`, lines 22-26.

- **Not the work tree.** Steps and spikes are ledger `W` entries with
  `Depends-on`; the trail points at them. (`centina-realize` already asks for
  one `W` entry per step and for no unplanned work; `terrain:W43` kept about
  twenty sub-steps as paragraphs of one entry instead. Making that rule bite
  is step 4's job, not the trail's.)

### The trail file's location (the parenthetical)

From `docs/trail.md`, lines 39-40.

One file per system, `TRAIL.jsonl` beside `LEDGER.md` (its place follows the
ledger folder refactor, ROADMAP "Open"). JSON Lines: append-only, one record

### Backfilled decisions: the terrain:W43 example

From `docs/trail.md`, lines 84-87.

- `options` may be omitted on a record written after the fact
  (`"backfilled":true`), when only the choice is known. This is what
  `terrain:W43` looks like: the ledger quotes the human's pick
  (`"route option 1"`) and the unchosen options are gone.

### Known weak points of the trail design

From `docs/trail.md`, lines 252-262.

1. **Capture depends on the agent.** Options are offered in prose, so there is
   nothing to hook. The rule goes in `centina-realize`, and the checker's
   warning is the only backstop. If it drops records in long sessions, the
   fallback is the mod extracting offered options from the reply with a cheap
   model call, which is a cost and an accuracy trade, not a free fix.
2. **Backfilling is partial.** For existing work the ledger gives the chosen
   path and rough anchors, not the unchosen options.
3. **A gate is a number, and not every step has one.** That is stated, not
   hidden, but a line whose goal is not a threshold needs a different kind of
   `gate` (a qualitative statement with `verdict` only); not designed yet.

### Why the conformance detail left the realize skill

From `docs/realize-conformance.md`, lines 3-10.

The detail behind "Conformance" and the step-close checks in
`skills/centina-realize/SKILL.md`, moved out of the skill because a skill's
text is re-injected after every compaction cut at 20,000 characters, and
what is cut is the end of the file. The skill keeps the rule; this file keeps
the reasons, the failure modes and the recipes. Read it before writing the
first conformance assertion of a session, and again when a fill is a
free-function hole, when a contract is added, split, renamed or removed, and
when a step closes.

### The callable that used to be in conformance.ts

From `docs/realize-conformance.md`, lines 67-72.

- **Nothing in `conformance.ts` is callable, deliberately.** An earlier
  version exported `declare function conforms()`. It type-checked and then
  threw `SyntaxError: Export named 'conforms' not found` the moment a test
  imported a fill, because an ambient declaration emits no binding. The
  type-only form cannot reach runtime at all. If a callable turns up in
  that module again, that is the bug returning.

### Why the routing lens has its own doc

From `docs/session-zero-routing.md`, lines 3-5.

Read by `centina-session-zero` before it classifies any node (phases 2 to 4).
Moved here verbatim from the skill so the skill stays under the post-compaction
cap (`ROADMAP.md`, "Skills over the post-compaction cap").

### Routing replaced the fit gate

From `docs/session-zero-routing.md`, lines 29-34.

That "routed, not rejected" is the post-pivot shift, and it's why session zero
carries this judgment rather than a separate gate owning it. Before Centina had
routing primitives a realization-heavy task had nowhere to go, so fit was a
binary admit/reject asked before any spec was written. Now the routing
primitives _are_ the answer: realization goes behind a door, and the only thing
left to decide per node is whether anything structural remains once it does.

### The retired recuse reflex (the clause "the verdict-era reflex the jurisdiction reframe retired")

From `docs/session-zero-routing.md`, lines 96-97.

session zero for it." Producing the thin honest map _is_ the output; refusing to
engage is the verdict-era reflex the jurisdiction reframe retired. Deliver the

### Why the session-zero reference doc exists

From `docs/session-zero-reference.md`, lines 3-6.

Detail `centina-session-zero` reads on demand. Each section was moved here
verbatim from the skill, which keeps a short form of it, so the skill stays
under the post-compaction cap (`ROADMAP.md`, "Skills over the post-compaction
cap"). The routing lens has its own doc, `session-zero-routing.md`.

### Where priority elicitation came from (the parenthetical)

From `docs/session-zero-reference.md`, lines 84-86.

  surfacing what does. (Promoted straight to core from the grid-inventory live
  session, 2026-07-21 — the first lesson earned in a live run rather than an
  adversarial trace.)

### Where encoding intent in types came from (the parenthetical)

From `docs/session-zero-reference.md`, lines 108-110.

  honest fallback, not a forced encoding). (Promoted straight to core from the
  grid-inventory live session, 2026-07-21 — the non-empty comparator-input type
  `[ItemInstance, ...ItemInstance[]]` was the triggering case.)

### Why ARCHITECTURE.md has a risks section (the parenthetical)

From `docs/session-zero-reference.md`, lines 188-189.

   cites the labels. (Added after the first run, where the thin-UI risk needed
   a home the other four sections didn't give it.)

### Session zero: lessons from use

From `docs/session-zero-reference.md`, lines 214-270.


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
- _Put cross-seam vocabulary in a `shared.centina.ts`, not in a boundary
  declarator file._ The checker confirmed it: wordboard's boundary files pass
  the `boundary-dependency` rule because their contract types live in
  `shared.centina.ts`, whereas a declarator that co-locates its types with the
  boundary trips that rule (the founding `task-corpus` fixture does). It must
  keep the `.centina.ts` suffix — the checker's spec-plane rules (hole
  enumeration, `@agent:` labels) only scan files with that suffix, and a plain
  `shared.ts` is invisible to them even though it can carry real spec content
  (holes included). Default a session-zero skeleton to a `shared.centina.ts`
  for the vocabulary the DAG traffics in across seams.
- _Held internal-processing holes route to `deferred<"unimplemented">`_ — the
  human fills them, in place, at `centina-iterate`. That correctly leaves
  `bin/centina-check` reporting them as errors until fill: the honest "work
  remaining" signal for a pre-fill, pre-plan handoff, not a defect.\*

**Test-case traces (2026-07, fit-as-jurisdiction thread).** From adversarial
test-case traces run during this skill's own development:

- _Phase 3's failure/empty/not-found question is the highest-yield step in the
  phase._ Across crafting-recipes, url-shortener, pricing-request-handler, and
  oauth-callback it was reliably what converted a vague seed into real contracts
  — forcing `CraftResult`, collision/idempotency, the itemized `PricedCart`
  breakdown, and the OAuth trust branches (state mismatch, unverified email,
  first-login provision-vs-reject) respectively, none visible in the seed prose.
  Ask "what happens on the empty/failure case" first at every seam, not as a
  cleanup pass.

### Session zero: passages the skill condenses, in their original wording

From `docs/session-zero-reference.md`, lines 273-322.

The skill keeps a shorter form of each of these; this is the text as it stood
before the skill was cut under the post-compaction cap.

#### Over-competence (under "The one sanctioned write")

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

#### What "complete" means (under "What a skeleton contains")

"Complete" for a component means **every gap routed, not every gap resolved**.
Centina's definition of done is "no _unrouted_ holes," not "no holes." A
component is ready to hand to `centina-iterate` with plenty of open questions,
as long as each is deferred to the human, delegated to a Skill, externalized,
or quarantined behind a boundary. That's what lets a consumer be filled against
a mocked seam in parallel with the seam's own build.

#### Phase 4, terminal-node closure

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

#### Don't recall a canonical design and present it as elicited

- **Don't recall a canonical design and present it as elicited.** The more
  famous the task — a URL shortener, a todo app, an auth flow — the more the
  agent already _knows_ the standard architecture, and the stronger the pull to
  name the store, the code scheme, the door shapes before the human does. A
  _correct_ recalled answer is over-competence at its purest: it looks exactly
  like elicitation and isn't. Scale the draw-it-out discipline _up_ on canonical
  tasks, not down; the tell is any concrete tech or shape the agent introduced
  that the human never said. (Surfaced by the url-shortener control trace.)

### Why the iterate reference doc exists

From `docs/iterate-reference.md`, lines 3-6.

Detail `centina-iterate` reads on demand. Each section was moved here
verbatim from the skill, which keeps a short form of it, so the skill stays
under the post-compaction cap (`ROADMAP.md`, "Skills over the post-compaction
cap").

### Where encoding intent in types came from, for iterate (the parenthetical)

From `docs/iterate-reference.md`, lines 189-190.

is the honest fallback rather than a forced encoding. (From the grid-inventory
live session, 2026-07-21.)

### Scope-crossing identifiers: the prototype.aisl port

From `docs/iterate-reference.md`, lines 222-230.

The port of `prototype.aisl` to `hill-climbing-loop.centina.ts` (then still
named `prototype.centina.ts`) reproduced (by design)
six `tsc` errors, several of which were a value referenced in a `switch`/`if`
branch other than the one that created it (e.g. an `attempt` used in a
branch where no code path actually constructs one). This is exactly the
"genuine ambiguity" category above — resist the urge to silence it with a
declaration hoisted to a wider scope; ask whether the missing construction is
itself the finding.

### How one spike entry grew to hundreds of kilobytes

From `skills/centina-spike/SKILL.md`, lines 86-89.

"Revising the plan"): a `W` entry and the human's confirmation first, never a
paragraph appended to this entry. Appending is how one entry grew to hundreds
of kilobytes and twenty steps, each admitted on its own merits and none
checked against the original question.

### Spike: open questions about the skill's own numbers

From `skills/centina-spike/SKILL.md`, lines 242-246.

_Accumulate here as the skill is exercised. Open: the starting values of N = 2
and of "two steps" at checkpoints are guesses; whether recording a decision
every turn holds up over a long session or drops records; whether a
qualitative gate needs more than a stated test and a verdict._

## Part 2: Justification and checker internals

The reasoning behind rules the docs keep. An agent needs the rule, and these
passages explain why it is shaped the way it is, or how the checker implements
it.

### Why session zero exists, and where it sits

From `docs/session-zero-reference.md`, lines 9-29.

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

### How the checker grades a bare-looking label

From `docs/ledger.md`, lines 120-139.

A bare-looking token (`A2`, `R1`, ...) found in prose is `ledger-bare-label`
only at `error` when its letter and number match a real entry somewhere in
this system, under whatever scope — almost certainly a citation that lost
its scope prefix. One that matches nothing anywhere is reported at
`warning`: coincidental prose (a test name, a grade, a model number) that
just happens to be letter-then-digits, which every new letter makes more
likely. This matters because ledger bodies are append-only (see "Entry
format"): an old line can't be edited to satisfy a check that starts firing
on it later, so that case can never block.

A match is dropped entirely — no finding, not even a `warning` — when every
matching entry is `Date`d after the entry containing the token: a citation
can't name something that didn't exist yet when it was written, so that's
not just probably prose, it's provably prose, and a permanently-true
`warning` on a line that can never be edited is pure noise once it's
proven. (Loose lines outside any entry, and citations in files other than
the ledger, have no containing `Date` to compare against, so they keep the
existence-only rule above.) Same-day counts as "could have existed" and
stays an `error`; a missing or malformed `Date` on either side does too,
rather than guessing.

### Why an ownerless unbuilt member is only a warning

From `docs/ledger.md`, lines 272-275.

A member that names **nobody** is a warning. Blocking on it would push an
author to cite whichever `W` is handy for a member no phase covers yet, and a
citation nobody means is the thing this check exists to catch. A label that
is **wrong** — unresolvable, not a `W`, or a `W` that closed — is an error.

### Why ownership citations are checked on every ledger write

From `docs/ledger.md`, lines 307-311.

Ownership citations fail in one direction. The string never changes and the
ledger does, so a citation turns from a pointer at whoever will build the
thing into a note about why the member is empty, with no edit anywhere and
nothing in an invalid state at any moment. The check therefore runs on every
ledger write, which is when a status moves.

### Why "depended on by" is computed, not a field

From `docs/ledger.md`, lines 491-498.

**"Depended on by" is a computed view, not a field.** Nothing hand-maintains
a reverse pointer on the axiom itself — that would reintroduce the
one-copy-amended drift "Why this format" exists to close, just on a new
field, since it'd be added to incrementally by different entries at
different times rather than written once by whoever supersedes something.
What depends on an axiom is found by scanning for `Premises` citations that
resolve to it, the same way `LEDGER-INDEX.md`'s "Affected work items" is
generated from `Depends-on`/`Premises` today.

### Why no generator can supply conformance assertions

From `docs/realize-conformance.md`, lines 136-138.

No generator fixes this. Deriving pairings by scanning for `implements`
inherits the same blind spot, and a free-function fill has no `implements`
to scan for — naming the pairing is the work, not a by-product of it.

### The whole-DAG view of an empty contract set (the parenthetical)

From `docs/session-zero-routing.md`, lines 110-113.

the human with a "bad fit" verdict. (The whole-DAG view is more robust than
counting boundary-ends on a single slice, which flips with where you draw the
slice; it turns the 0-end case into a structural fact rather than a
slice-relative guess.)

