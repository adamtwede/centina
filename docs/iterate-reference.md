# Centina iterate reference

Detail `centina-iterate` reads on demand. Each section was moved here
verbatim from the skill, which keeps a short form of it, so the skill stays
under the post-compaction cap (`ROADMAP.md`, "Skills over the post-compaction
cap").

## Boundary declarations as extraction candidates

Any `@datasource`/`@datasink`/`@boundary` declared inline in a spec file is a
candidate for extraction into its own provisional file (e.g.
`task-matcher.centina.ts`) — this is not gated on the author having left an
`@agent:` note about it; every inline boundary carries the same reinvention
and dependency-direction risk regardless of whether it was flagged. Writing
it inline first is fine and expected — a spec writer should be able to stand
an idea up quickly without a detour to a second file. Two things to check
during a normal iteration pass:

- **Dependency direction.** A boundary door's parameters/return types must
  not resolve to a type declared in the _consuming_ spec (a local interface,
  or an object-shaped type alias) — that's the boundary depending on its own
  caller, backwards from how a real external system would typecheck.
  Primitives, `unknown`, opaque `Unshaped<...>` brands, and closed enums are
  fine, since they carry no shape for the boundary to depend on. If a door
  needs a real structured payload, prefer `unknown` at the door over
  importing the caller's own record type.
- **Whether it's ready to move out.** If the boundary looks stable and
  reusable — a real seam other future specs would also want, not something
  still being shaped — offer to extract it into its own file. Extraction
  itself is mechanical (relocating already-written declarations, adding an
  import), but it's a cross-file move and worth stating plainly to the human
  rather than doing silently, even though it doesn't require a full stop.

A provisional boundary file gets a clear header marking it as such (e.g.
`// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.`)
and contains only `declare class`/`type`/`interface` declarations plus, if
the boundary is naturally a shared singleton, one instantiation (e.g. `export
const taskMatcherEngine = new TaskMatcherEngine()`) — no function bodies, no
spec logic. This keeps it trivially greppable/discoverable by a future spec
before that spec reinvents the same boundary, and gives the eventual real spec
for that system a natural home to grow into.

## Starting from a fresh skeleton

If this is the first `centina-iterate` pass on a component and its holes are
still untouched since `centina-session-zero` emitted it (the file is
essentially all typed seams plus `deferred`/`@agent:` holes, with no
human-authored bodies yet), say so plainly and offer **starting-point
suggestions** before diving into diagnostics — an empty-looking file with a
wall of `tsc` errors is not a useful place to drop a human with no
orientation. Suggest an order, don't pick one:

- Holes with the most **downstream dependents** (other holes or components
  that reference this one) tend to unblock the most subsequent work if
  resolved first.
- Holes on the **primary/most-traveled path** through the component (the
  logic every call exercises) usually clarify the shape of everything nearby
  faster than a rarely-hit edge case.
- If neither is obvious, the **simplest hole** — the one with the fewest
  unknowns — is a reasonable default just to get momentum going.

This is process guidance, not meaning: naming which hole is worth tackling
first is a structural observation the agent is allowed to make (Rule 0 is
about deciding what a hole _resolves to_, not about suggesting an order to
approach them in). Let the human pick the actual starting point; then proceed
into the normal check/fix loop below.

## Reference labels and formula explanations

Both apply throughout this loop, not just in a fresh session-zero handoff:

- **Label references get explained, not just cited.** With a ledger, labels
  are ledger labels (`task-matcher:F7`); without one, short session labels
  (`P<n>` proposal, `Q<n>` question, `F<n>` finding, `O<n>` option). The first
  time a label comes up, give a one-clause summary ("task-matcher:F7, the
  scope-crossing identifier in `matchTasks`," not the bare tag). When
  re-citing one, restate a brief reminder if more than 10 labels of the same
  letter have come up since. Err toward restating when unsure. With a ledger,
  the label index is `LEDGER-LABELS.md`; without one, keep a compact label
  index in the state file.
- **Transcripts and concurrency.** Never open a session transcript without
  asking first, and warn the human about concurrent sessions, per `ledger.md`.
- **Explain formula terms on introduction.** When a mathematical or scientific
  formula appears for the first time in a session, or reappears in a long
  session where you can't be confident the human still has each term in mind,
  spell out every symbol in plain language next to the formula. Do the same
  unconditionally whenever a formula goes into PLAN.md, ARCHITECTURE.md, or any
  other document — never rely on a formula being self-explanatory or defined
  earlier in the conversation.

## Reconciling ARCHITECTURE.md before the plan

If the spec came out of a `centina-session-zero` run, `specs/<system>/ARCHITECTURE.md`
exists alongside it and records the contracts and holes for
the whole system. A plan-per-boundary-set is derivable from a frozen
contract ledger, and drifts exactly when the ledger drifts.

**If the system has a ledger,** statuses already changed in ledger headers as
decisions were made, so ARCHITECTURE.md only needs its structure checked.
**Once the spec goes clean and before writing PLAN.md**, run the ledger sweep
(`ledger.md`, "Sweeps"), then update ARCHITECTURE.md where this loop changed:

- a door signature;
- a file location (a boundary extracted into its own file);
- a terminal's concrete `@external` source;
- the labels cited, where a decision was superseded.

**If the system has no ledger** (older projects), fixes made during this loop
routinely make ARCHITECTURE.md's contract and hole ledgers stale —
resolving a `deferred` hole's routing, pinning a provisional contract, fleshing
out an `@agent:` stub into real structure, or extracting a boundary into its
own file (see "Boundary declarations as extraction candidates" above) all
change something the ledger described. **Once the spec goes clean and before
writing PLAN.md**, reread `ARCHITECTURE.md` against the now-clean spec and
reconcile it:

- Contract ledger entries touching this component's seams move from
  provisional → decided, or get their signature updated if it changed during
  fill.
- Hole ledger entries this component closed are marked resolved/routed, not
  left showing as still-open.
- Terminal-node entries get their concrete `@external` source filled in if it
  was previously "TBD" and got pinned during fill.
- If a boundary was extracted into its own file, note the new file location.
- Risks/watch-items get updated — resolved risks removed or marked closed, new
  ones surfaced during fill added.

This is a mechanical reconciliation, not new authorship — every entry being
updated reflects a decision the human already ratified earlier in this same
loop, so the agent may write the update directly (the same standing as writing
PLAN.md itself), but call out what changed in ARCHITECTURE.md before moving on so
the human isn't surprised by a silently-updated file. If other components in
the system haven't been through `centina-iterate` yet, their ARCHITECTURE.md entries are
untouched — reconciliation only ever covers the component just finished.

## Writing the implementation plan

When the check is clean and the human is satisfied with the spec, derive an
implementation plan and write it as a PLAN.md file alongside the spec:

- **Location**: same directory as the `.centina.ts` file. If a `PLAN.md`
  already exists there, name it `PLAN_<spec_name>.md`. If that also already
  exists, ask the human how they'd like to proceed rather than overwriting
  existing contents.
- **Provenance**: the first section must name the spec file that produced
  it, e.g. `**Spec source**: hill-climbing-loop.centina.ts`. This makes the plan's
  origin traceable. If the spec came out of a `centina-session-zero` run, name
  its `ARCHITECTURE.md` too — reconciled per the step above, so what the plan
  cites is accurate at the moment the plan is written. If the system has a
  ledger, cite the labels of the decisions each step depends on.
- **Completeness**: the plan must be self-contained enough that a capable
  coding agent can implement the feature with little or no additional input
  from the human. It should name every file that changes, describe each
  change precisely (not just "update X"), call out any cascade effects
  across the pipeline, and list concrete completion criteria (commands that
  should pass, behaviors that should be observable).
- **No implementation context in the session**: the implementation plan is
  the deliverable. The agent implementing it works from the plan, not from
  any in-session context — write the plan as if it will be handed to someone
  who wasn't in the room.

## After implementation

Once an implementation plan has been executed and the human approves the
outcome, update the PLAN.md (or whatever name was chosen) to reflect the
completed status:

- Add `**Status**: Implemented ✓` (or a failure note) near the top.
- Record any deviations from the plan that arose during implementation.
  These deviations are signal about where the spec was underspecified —
  useful for improving future specs.

## Lessons from use

### Encode ratified intent into the type system — surface it, let the human apply it

Intent-as-spec is one of Centina's headline concerns, and TypeScript is the
grammar precisely so a decision about _meaning_ can be made load-bearing and
checkable rather than left to a prose note an implementer can skip. When a
decision the human has already settled _isn't_ carried by the spec code but
_easily could be_ — a non-empty-array precondition as `[T, ...T[]]`, a
discriminated union that makes an illegal status unrepresentable, a branded
identity, an exhaustive enum — call it out and show a concrete example of the
encoding. Then stop: per Rule 0a the human holds the pen, so surface the option
and let _them_ decide whether to apply it. (This is the one place iterate differs
from `centina-session-zero`, where the agent has standing authority to emit such
an encoding into the skeleton directly — here it only proposes.) When the
constraint genuinely can't be typed (e.g. array homogeneity), an `@agent:` note
is the honest fallback rather than a forced encoding. (From the grid-inventory
live session, 2026-07-21.)

### Warning triage is design discussion, not cleanup

Diagnostics that survive an initial cleanup pass often reveal genuine design
questions — e.g. a cast warning on a stand-in value exposed the question of
whether a type was a new domain noun or a placeholder for an existing
codebase type. Treat lingering warnings as prompts for design conversation,
not noise to suppress.

### `@external` for stand-in types, `deferred`/`@agent:` for stand-in values

When a spec references a type or function that already exists in the real
codebase but whose internal structure the author doesn't want to prescribe,
use a `/** @external "path/to/real/file" */`-tagged `declare` rather than a
full local type or implementation. This communicates intent ("this belongs to
the implementation, not the spec") without manufacturing a value the spec
doesn't own. Where a function body needs to construct or return a value the
spec can't own the logic for, use `deferred<F>()` (or an `@agent:` stub if
the shape isn't even settled yet) instead of a cast that pretends the value
exists.

### A cast at the `declare` site records the assumption once

Centina's provenance model is bookkeeping, not prohibition: casts are
expected and fine, but they should be recorded once, at the `declare` site where a value
first enters the spec (an `@external` function's return type, an `Agent`
call's result), rather than scattered as ad hoc `as` casts at every use site.
One recorded assumption beats the same assumption re-made silently in five
places.

### Scope-crossing identifiers are a common real finding

The port of `prototype.aisl` to `hill-climbing-loop.centina.ts` (then still
named `prototype.centina.ts`) reproduced (by design)
six `tsc` errors, several of which were a value referenced in a `switch`/`if`
branch other than the one that created it (e.g. an `attempt` used in a
branch where no code path actually constructs one). This is exactly the
"genuine ambiguity" category above — resist the urge to silence it with a
declaration hoisted to a wider scope; ask whether the missing construction is
itself the finding.
