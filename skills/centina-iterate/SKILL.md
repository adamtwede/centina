---
name: centina-iterate
description: Drives the interactive Centina spec-refinement loop. Runs tsc against a .centina.ts file (the interim structural-plane checker, until Centina's own checker exists), walks the human through each diagnostic, distinguishes mechanical fixes from genuine design ambiguities, applies agreed fixes, and re-checks until clean. When the document is clean, derives an implementation plan and writes it to PLAN.md alongside the spec. Use when the user wants to iterate on, check, fix, or resolve errors in a .centina.ts file, or references tsc/typecheck output on a spec.
---

# Centina Iterate

## Setup — run first

Before anything else, run the procedure in
`${CLAUDE_PLUGIN_ROOT}/docs/plugin-setup-procedure.md`. It resolves (or
rediscovers) the host project root and the Centina `artifactsRoot`, and
regenerates the stub `tsconfig.json` the checks below run against. If this
skill is invoked against a tree with no existing config, this is the step
that stands one up.

**If `artifactsRoot`'s `specs/` has no `.centina.ts` files in it** — no
existing config was found and setup just created one, or a config exists
but nothing's been written into `specs/` yet — say so plainly and suggest
`centina-session-zero` instead, before going any further. This skill
refines a spec that already exists; with nothing to iterate on, running
the check below either reports nothing or (worse) leaves the human staring
at an empty, freshly created project with no sense of what to do next.
`centina-session-zero` is the front of the funnel — it turns a prose idea
into the component DAG and skeleton spec set this loop is meant to work
against. This is a suggestion, not a hard redirect: a human iterating on a
single spec they're about to hand-write, deliberately outside a full
session-zero system, is a legitimate use of this skill on its own — if
that's the intent, ask what the target file should be named and proceed.

This is the primary way a human refines a Centina spec: resolve diagnostics,
surface ambiguities the pseudocode left implicit, settle them with the human,
repeat until the document is clean and the human is satisfied. The goal of
each loop iteration is not just a passing check — it's a more precisely
specified `.centina.ts` document that's closer to a real implementation plan.

**Current state of the checker:** Centina's own spec-plane checker is the
`checker/` harness bundled with this plugin. `tsc` run under the generated,
deliberately permissive `tsconfig.json` remains part of the signal — it catches
name resolution, arity, and shape mismatches, which is real structural-plane
signal even though it knows nothing about `deferred`, `@agent:`, or boundary
direction. Read `tsc`'s diagnostics with that lens: some are exactly the kind
of gap Centina exists to surface (an undefined identifier that traces back to
a genuinely missing step), and tsc will never flag the things only a
spec-plane rule would (an un-enumerated `deferred` hole, a boundary door with
inferred direction that doesn't match its name). Don't mistake a clean `tsc`
run for a clean spec — it's a necessary floor, not the ceiling this loop is
aiming for.

## How to interpret a Centina spec

A `.centina.ts` file is valid, ordinary TypeScript — read it like
conversational prose organized into typed declarations, not like executable
code with precise runtime semantics. Keep these distinctions in mind:

- **The pseudocode itself** (function bodies, control flow, types) is a
  general description of implementation intent, presented in a structured
  format but semantically equivalent to well-organized prose. Interpret it as
  authorial intent, not a contract to execute literally. The types and
  control flow are guides, not specifications to be followed to the letter.

- **Plain `//` comments** (without a preamble) potentially add context but
  should be treated with some suspicion as to relevance and accuracy — they
  may reflect an earlier design state or a reminder to the human author that
  has since gone stale. Don't let them override what the pseudocode itself
  clearly expresses.

- **`@agent:` comments** are direct messages from the human developer to the
  coding agent reading the spec — the equivalent of injecting conversation
  into the spec. Treat these as authoritative context, not ordinary comments.
  During iteration, try to work with the human to convert `@agent:` stubs
  into proper Centina constructs (`deferred<F>()`, a typed boundary door)
  where the intent is clear enough to express. If it isn't, flag it as a
  genuine ambiguity and discuss. A note may carry an author-chosen label —
  `@agent(C1): ...` — giving it a stable name to reference later in
  conversation or in a PLAN.md, instead of an ephemeral line number. Labels
  are free text the human assigns; don't invent or renumber them yourself.

- **`deferred<F>()` calls** are marker functions: a typed hole whose *routing*
  (stays in this spec / belongs in a separate spec / left to a runtime
  agent's judgment) is still open. Don't resolve a `deferred` by guessing an
  implementation — the routing decision is exactly what this loop should
  surface and let the human make.

- **`@external "<source>"`-tagged `declare` statements** are references to
  code, APIs, or systems that already exist outside the spec. They're
  intentionally opaque (typed but bodiless) — don't try to flesh them out;
  their whole point is to record "this exists elsewhere" without duplicating
  it.

- **`@datasource`/`@datasink`/`@boundary`-tagged `declare class`
  declarations** are boundary roles. Direction is inferred from each door's
  return type (void = write, non-void = read) — if a door's name and its
  inferred direction seem to disagree, that's worth raising as a diagnostic
  even if `tsc` says nothing.

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
  not resolve to a type declared in the *consuming* spec (a local interface,
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

## Starting from a fresh session-zero skeleton

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
about deciding what a hole *resolves to*, not about suggesting an order to
approach them in). Let the human pick the actual starting point; then proceed
into the normal check/fix loop below.

## Process

1. **Run the check** against the target file:

   ```
   ${CLAUDE_PLUGIN_ROOT}/bin/centina-check --project <artifactsRoot>/tsconfig.json <file>
   ```

   (`artifactsRoot` is whatever the setup step above resolved.) Omitting
   `<file>` runs every `*.centina.ts` spec under `artifactsRoot`. If no file
   is specified and there's only one `.centina.ts` file in the project,
   focus on that one's diagnostics; if there are several, ask which one, or
   scope to all of them if the human wants a full sweep.

2. **If there are zero diagnostics**, say so plainly and ask whether the
   human wants to keep refining (e.g. resolve a `deferred` hole's routing,
   flesh out an `@agent:` stub, tighten an overly-loose type) or stop here. A
   clean `tsc` run is a floor, not a finish line — see above.

3. **If there are diagnostics**, take them one at a time, in the order
   reported (lowest line number first). For each one, classify it before
   doing anything:

   - **Mechanical fix** — the diagnostic has one obviously-correct resolution
     given everything already established in the document and the
     conversation (a typo matching an existing identifier, a missing `as`
     cast whose target type is unambiguous, a scope reference that clearly
     meant a different in-scope name). Propose the fix in one or two
     sentences and let the human apply it — see Rule 0a below on why the
     agent doesn't reach for the edit itself, even for a fix this small.

   - **Genuine ambiguity** — the diagnostic reveals that the pseudocode's
     _intent_ isn't actually settled (e.g. an undefined identifier that
     traces back to a missing step no one has designed yet — not a typo, a
     gap). Do not guess. Lay out the tension plainly — what the diagnostic
     found, why it's not just a mechanical fix — and either ask a direct
     question or use AskUserQuestion if there's a clean multi-way fork. Wait
     for the human's answer before touching the file.

4. **On a genuine ambiguity with a high-stakes fork, request a fit check.**
   If resolving a diagnostic requires choosing between architectural options
   with complex tradeoffs, invoke a **fit check** (say "fit check on X") to get
   a structured costs/benefits analysis: each option's merits and costs,
   alignment against stated priorities, and alignment against established
   patterns (uniform reducer, event-sourcing, boundaries-as-affordances, etc.).
   The agent supplies the tradeoff matrix; the verdict stays yours (Rule 0
   intact).

5. **Fix one thing, then re-check before fixing the next.** Types cascade —
   resolving one diagnostic can change, resolve, or newly expose others. Only
   batch multiple diagnostics together if they are obviously independent
   (e.g. two unrelated undefined-identifier typos in different functions).

6. **Repeat** from step 1 until the check is clean or the human says to stop.

6. Warnings (if the checker distinguishes them from errors) are reviewed the
   same way, but don't block calling the loop "done" — confirm with the human
   whether they want to address open warnings now or leave them.

## Long-session output management

If this session produces a ledger or state file (e.g., a session notes file or
refinement log) that grows beyond ~1500 lines, split it automatically into an
index file + detail files per the strategy in
`${CLAUDE_PLUGIN_ROOT}/docs/output-management.md`. This keeps context
tokens low while preserving resumability. Agents apply the split when detected;
no permission needed, but note it in the conversation so the human knows. For
iterate, name detail files `ITERATE-<component>-*.md` and keep the index as
`ITERATE-STATE.md`.

## Reference labels and formula explanations

Both apply throughout this loop, not just in a fresh session-zero handoff:

- **Label references (P/Q/F/O) get explained, not just cited.** Session-relevant
  items earn short labels for reference — `P<n>` a proposal, `Q<n>` a question,
  `F<n>` a finding, `O<n>` an option within a fork. The first time a label is
  introduced, state what it's short for and a one-clause summary of what it
  refers to — not the bare tag alone ("F7: scope-crossing identifier in
  `matchTasks`," not "F7"). When re-citing an existing label, check the gap: if
  more than 10 labels of that same letter have been introduced since it last
  came up, restate a brief reminder alongside the tag. Err toward restating
  when unsure. Claude Code has no native sidebar for tracking these; if the
  session keeps a state file (see "Long-session output management" above), add
  a compact label index (tag → one-line title) to it.
- **Explain formula terms on introduction.** When a mathematical or scientific
  formula appears for the first time in a session, or reappears in a long
  session where you can't be confident the human still has each term in mind,
  spell out every symbol in plain language next to the formula. Do the same
  unconditionally whenever a formula goes into PLAN.md, ARCHITECTURE.md, or any
  other document — never rely on a formula being self-explanatory or defined
  earlier in the conversation.

## Reconciling ARCHITECTURE.md before the plan

If the spec came out of a `centina-session-zero` run, `specs/<system>/ARCHITECTURE.md`
exists alongside it and carries a **contract ledger** and a **hole ledger** for
the whole system (`${CLAUDE_PLUGIN_ROOT}/docs/plan-organization.md`: "a plan-per-boundary-set is
derivable from a frozen contract ledger, and drifts exactly when the ledger
drifts"). Fixes made during this loop routinely make that ledger stale —
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
PLAN.md itself), but call out what changed in the ledger before moving on so
the human isn't surprised by a silently-updated file. If other components in
the system haven't been through `centina-iterate` yet, their ledger entries are
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
  cites is accurate at the moment the plan is written.
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

## What NOT to do

- **Rule 0: never write a Centina spec on a human's behalf.** Not even when
  asked, and not because it's hard or tedious — *because* writing the spec is
  the entire point of Centina. The spec is where a human and a coding model
  reach shared understanding; authoring it for them inserts exactly the layer
  of insulation Centina exists to remove, and hands the thinking back to the
  model. Relatively small, focused snippets in service of a discussion are
  fine (illustrating a syntax point, sketching one door), but do not produce,
  fill in, or "finish" a spec — the human is the architect. If a human asks
  you to write one, decline and redirect to iterating on what *they* write.
- **Rule 0a: don't offer to make spec-file edits, and push back when asked.**
  Even once a fix or a routing decision is fully settled — mechanical or
  not — don't volunteer to be the one who writes it into the file. Surface
  what changes and why, then let the human apply it. If they ask the agent
  to make the edit anyway, push back once (name the risk: they may be
  offloading thinking that's meant to stay theirs), but don't refuse
  outright if they persist after that pushback — comply and move on. This is
  separate from Rule 0 above: Rule 0 is about who decides a spec's meaning,
  Rule 0a is about who holds the pen once meaning is decided. The project's
  author may explicitly invoke a development-purposes override for this
  policy, especially for minor edits — treat that as sufficient to proceed
  without further pushback for the edit in question.
- Don't silently resolve a genuine ambiguity just to make the check pass. A
  diagnostic is a tool for _finding_ underspecified intent, not a target to
  satisfy by any available typing trick (e.g. don't just loosen a param's
  type, or add an `as unknown as X` cast, to make a mismatch disappear unless
  that's actually what the human decides).
- Don't fix diagnostics yourself unless explicitly instructed or given
  approval, and even then, see Rule 0a — push back once before complying.
  They're designed to indicate places where the human developer's intent is
  unclear or underspecified; the human should decide how to resolve those
  ambiguities, not the coding agent.
- Don't fix multiple unrelated diagnostics in one pass without re-checking in
  between.
- If instructed to make spec edits (per Rule 0a), don't add structure to the
  document (new types, enums, casts) beyond what's needed to resolve the
  diagnostic at hand — bigger syntax/structure changes go through the normal
  design discussion, not this loop.
- Don't resolve a `deferred` hole's routing or an `@agent:` stub's intent by
  guessing what the human meant. Ask.

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

Centina's provenance model is bookkeeping, not prohibition (see
`${CLAUDE_PLUGIN_ROOT}/docs/fit-validation.md`): casts are expected and
fine, but they should be recorded once, at the `declare` site where a value
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
