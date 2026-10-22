# Centina iterate reference

Detail `centina-iterate` reads on demand. The skill keeps a short form of each
section.

## Boundary declarations as extraction candidates

The two checks are in the skill. Both apply to every inline boundary, flagged
or not, because each carries the same reinvention and dependency-direction
risk: a door typed against its caller's own types is backwards from how a real
external system would typecheck. Extraction itself is mechanical, but it's a
cross-file move, so state it plainly to the human; it doesn't need a full stop.

A provisional boundary file (e.g. `task-matcher.centina.ts`) gets a clear
header marking it as such (e.g.
`// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.`)
and contains only `declare class`/`type`/`interface` declarations plus, if
the boundary is naturally a shared singleton, one instantiation (e.g. `export
const taskMatcherEngine = new TaskMatcherEngine()`) — no function bodies, no
spec logic. This keeps it trivially greppable/discoverable by a future spec
before that spec reinvents the same boundary, and gives the eventual real spec
for that system a natural home to grow into.

## Starting from a fresh skeleton

A fresh skeleton is essentially all typed seams plus `deferred`/`@agent:` holes,
with no human-authored bodies yet, and an empty-looking file with a wall of
`tsc` errors is no place to leave a human without orientation. Why each
suggested order helps: resolving the holes with the most downstream dependents
(other holes or components that reference them) unblocks the most later work;
holes on the most-traveled path, the logic every call exercises, clarify the
shape of everything nearby faster than a rarely-hit edge case; and the simplest
hole, the one with the fewest unknowns, is a reasonable default just to get
momentum going. Once the human picks, proceed into the normal check/fix loop.

## Reference labels and formula explanations

The skill carries both rules. What it leaves to this doc:

- **Without a ledger**, labels are short session labels: `P<n>` proposal,
  `Q<n>` question, `F<n>` finding, `O<n>` option. Explain and re-cite them the
  same way as ledger labels, and keep a compact label index in the state file.
- **A formula that reappears** in a long session, where you can't be confident
  the human still has each term in mind, gets every symbol spelled out again.

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
routinely make ARCHITECTURE.md's contract and hole ledgers stale: resolving a
`deferred` hole's routing, pinning a provisional contract, fleshing out an
`@agent:` stub into real structure, or extracting a boundary into its own file.
**Once the spec goes clean and before writing PLAN.md**, reread
`ARCHITECTURE.md` against the clean spec and reconcile it. Contract entries
touching this component's seams move from provisional to decided, or take the
signature that changed during fill. Hole entries this component closed are
marked resolved or routed. A terminal's `@external` source that was "TBD" and
got pinned is filled in. An extracted boundary's new file location is noted.
Risks are updated: resolved ones removed or marked closed, new ones added.

Either way this is mechanical reconciliation, not new authorship: every update
reflects a decision the human already ratified in this loop, so you may write it
directly (the same standing as PLAN.md), but say what changed in
ARCHITECTURE.md before moving on so the file is never silently updated. It
covers only the component just finished; other components' entries stay
untouched until their own `centina-iterate` pass.

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

TypeScript is the grammar so that a decision about _meaning_ can be load-bearing
and checkable, not a prose note an implementer can skip. When a decision the
human has already settled _isn't_ carried by the spec code but _easily could
be_ (the skill lists the usual forms), call it out with a concrete example of
the encoding, then stop: per Rule 0a the human holds the pen. This is the one
place iterate differs from `centina-session-zero`, which may emit such an
encoding into the skeleton directly; here the agent only proposes. When the
constraint can't be typed (array homogeneity, say), an `@agent:` note is the
honest fallback, not a forced encoding.

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
