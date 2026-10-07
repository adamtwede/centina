---
name: centina-realize
description: Works behind a Centina spec's boundaries while the spec is still being refined. Plans a phase with the human before any code is written, builds contract-backed code against the spec's types into a working slice, and hands each spike (a question the spec can't settle without code) to centina-spike to run. Tracks phases, steps, spikes and change requests as ledger work items and routes every contract change back to the human. Use when the human wants to plan a phase, prototype, test an assumption, build a vertical slice, or implement part of a Centina system before or between centina-iterate cycles.
---

# Centina Realize

## Setup: run first

1. Run `${CLAUDE_PLUGIN_ROOT}/docs/plugin-setup-procedure.md` to resolve the
   project and `artifactsRoot`.
2. Read `${CLAUDE_PLUGIN_ROOT}/docs/ledger.md` and
   `${CLAUDE_PLUGIN_ROOT}/docs/output-management.md`.
3. This session's ID, for the `Session` header, is `${CLAUDE_SESSION_ID}`.
4. Identify the system (`specs/<system>/`). It must have a `LEDGER.md`. If it
   does not, stop: suggest `centina-session-zero` for a new system, or ask
   the human whether to start a ledger for an existing one.
5. Read or create the run frame, `specs/<system>/REALIZE-STATE.md`
   (`output-management.md`). It records the implementation root (where code
   lives), the contracts module path, the path build code uses to import
   `<artifactsRoot>/conformance.ts`, the spike source tree, the label of the
   current phase (not its steps), and session IDs. Ask the human for anything
   not yet recorded, and add this session's ID to its session list now
   (`output-management.md`, "Keep it current").
   If it already names a current phase, read that phase's view
   (`centina-check ledger --phase <label> <dir>`); otherwise (no phase yet,
   or between one closing and the next starting) read the system's
   `LEDGER-INDEX.md`: the standing goals and rules, the affected work items,
   and the open items.
6. Record the build tree in `<artifactsRoot>/.centina/config.json`, under
   `systems["<system directory, relative to artifactsRoot>"].buildRoots` and
   relative to `hostRoot` (`ledger.md`, "Settings"). The checker reads build
   code from there, and reports any system that has a `REALIZE-STATE.md` and
   no entry. The run frame cites this file rather than repeating the paths,
   so the build tree's location has one record.

## What this skill is for

Specs are rarely right before some code exists. This skill does the work
behind a spec's doors while the spec is still being refined:

- **Spikes** answer questions the spec cannot settle without code.
- **Build steps** write code against the spec's types, which exposes contract
  problems early and grows a working slice.

It is not the final implementation of a finished spec. The workflow is
session-zero, then iterate and realize cycles, then a working slice, then the
next phase.

**Rules of engagement:**

1. **The human makes every edit to `.centina.ts` files.** Including comment
   corrections. The skill guides the human through each change instead (see
   "Contract changes"). A human who hands every spec edit to an agent loses
   track of the spec, and drift follows.
2. **Code is the agent's job; meaning is the human's.** Write implementation
   and harness code freely. Stop for the human on anything that decides what
   the system means: a contract's shape, a behavior the spec leaves open, a
   scope change, a standing rule.
3. **Ledger entries are the agent's job** as scribe. The human decides every
   status that means a decision.

## Two kinds of work

|          | Spike                                           | Build                                              |
| -------- | ----------------------------------------------- | -------------------------------------------------- |
| Purpose  | Answer a question                               | Grow the slice                                     |
| Code     | Outside the contracts; may compute ground truth | Implements spec types through the contracts module |
| Produces | Findings (`F`)                                  | Working code, change requests                      |
| Rules    | the `centina-spike` skill                       | "Using spec types" below                           |

Keep them in separate source trees from the start, as recorded in the run
frame. **Never promote spike code into build code.** When a spike's result
is needed in the slice, write it again behind the contracts.

## The planning gate

Before any code, work through these with the human. Do not write code until
the human confirms the plan.

1. **Goal.** What question or capability this phase delivers, and which `G`
   entry it serves. Elicit the definition of done as a **destructive test**:
   a check that fails if the slice cheats (e.g. "delete the renderer's direct
   call to ground truth and the audio still plays").
2. **Inventory.** What already exists and what transfers: code, open `Q`
   entries, spec holes, earlier findings.
3. **Scope.** An in-scope list and an out-of-scope list.
4. **Unknowns, sorted:**
   - blocks a design decision: a **spike**;
   - known work: a **build step**;
   - a known contract problem: a **change request**, raised before any code
     depends on it.
5. **Spike admission.** Admit a spike only if some possible result would
   change a decision. Otherwise drop it and say why.
6. **Steps.** Each step has one closing test, its `Depends-on` and `Premises`
   by label, and covers one door, one question, or one closing test. Split
   anything larger.
7. **Standing risks.** What would invalidate the plan, and what to do when it
   happens.
8. **Constraints.** The `R` entries that bear on this phase.

Record the plan as it is agreed:

- the phase: a `W` entry with `Kind: phase`, `Constraints`, and lettered parts
  for goal, definition of done, in-scope, out-of-scope and standing risks;
- each step, spike and change request: its own `W` entry with `Phase` set.

Scope names: component work uses the spec file's basename; a spike series not
tied to one component gets a named scope such as `spike-propagation`.

Status is `planned` until the human confirms the plan, then the phase becomes
`active`: set the run frame's current phase to its label in the same edit.

## Working a step

1. Set the step `active`.
2. Read only what this step needs: the contracts module, the fill file(s)
   this step touches, their existing conformance assertions, and the
   closing test. Do not read the wider implementation tree to "see what's
   already built" — the run frame and the phase's ledger view already say
   that. Use search (grep, or a code-navigation tool if one is available)
   to locate a specific cross-reference named in the plan; that is a
   targeted lookup, not a re-orientation read.
3. Build steps: write code against spec types (below). Spikes: run them with
   `centina-spike` ("Spikes" below), not here.
4. Run the closing test. It must print. Record findings as they appear.
5. Close the step: `done`, with the evidence in the body or in `F` entries.
   Run the `--contracts` check and the conformance-coverage check
   ("Contract changes").
6. **Review the remaining plan with the human** before starting the next
   step:
   - does anything this step found change a later step, a premise, or the
     definition of done;
   - `LEDGER-INDEX.md`'s affected work items;
   - the phase's `Constraints`.

## Using spec types

1. Build code imports spec types **only through one local contracts module**
   (path in the run frame) that re-exports them.
2. Classes implement spec interfaces in full (`implements`).
3. **`implements` is not enough, so every fill also carries a conformance
   assertion.** See "Conformance" below. This is not optional and not a
   later cleanup: a fill without one is unchecked against its contract, and
   the build will not say so.
4. **Unbuilt members throw an error naming the work item that fills them,**
   and the checker holds that name to an open `W` (`ledger.md`, "Citations
   from build code"). One label, written inline in the member: a shared
   message constant puts it out of the checker's reach, and members sharing
   one owner string usually need different owners anyway. Validating or
   logging ahead of the throw is fine; a path that can return is not, and
   takes the member out of the checked set. Never return zeros
   or empty values from a stub; downstream code would mistake "not built" for
   "nothing there".
5. Writing code against the declared types is itself a check on the spec.
   When a type cannot carry what the code needs, that is a contract problem:
   raise a change request, do not work around it.
6. **A guard in working code cites an `R`. A `Q`, `P` or `W` may sit beside
   it; none may sit there alone.** `answered`, `ratified` and `done` mean the
   entry finished, not that the ruling stopped holding, so a guard citing
   only one of them can never read as stale — `R` is the only letter with
   `retired`. An answered `Q` that leaves a guard behind needs an `R`, and so
   does a `done` step that ruled one; keep the original entry beside the `R`
   as the provenance of the decision. A standing rule is the human's call:
   raise it, do not write one (rules of engagement 2). Use `Kind: limit` when
   the guard is there because something is not built yet, and `provisional`
   with a `Review` while the rule may not last. Name the `W` that would
   remove the guard only when that work is actually scheduled. Put the label
   in the guard's comment: that is the copy the checker reads.

## Conformance

`implements` does not hold a fill to its contract: TypeScript lets a fill
drop a trailing parameter, make a required one optional, return a value for
`void` or widen a parameter, all without a diagnostic, and a free-function
`deferred` hole has no `implements` relation at all. So **every fill carries
a conformance assertion, in its own file, next to the fill, written in the
same edit as the fill.** Nothing detects a missing one. Both imports are
type-only:

```ts
import type { Assert, Conforms } from "<conformance.ts, path in the run frame>"
import type { BodyRegistry } from "<contracts module>"

export class BodyRegistryImpl implements BodyRegistry { ... }

export type BodyRegistryConforms =
  Assert<Conforms<BodyRegistry, BodyRegistryImpl>>
```

A divergence fails the ordinary typecheck and names the member. Write
`Assert<Conforms<...>>` and nothing else: `Conforms` alone, and
`Assert<true & Conforms<...>>`, check nothing. Never add a callable to
`conformance.ts`. It checks shape, never behavior; exactness is the point, so
narrow the impl or raise a change request rather than soften the assertion.

**Read `${CLAUDE_PLUGIN_ROOT}/docs/realize-conformance.md` before writing the
session's first assertion, and again** for a free-function hole (reached
through a type-only namespace import, never a value import), for a contract
that is added, split, renamed or removed, and at step close.

## Contract changes

`implements` only allows changes that stay assignable to the current spec,
and most real contract problems are breaking (an added required parameter, a
different return shape). So:

1. **Record a change request:** a `W` entry with `Kind: change-request`
   containing:
   - the declarations that change, and the proposed shape;
   - the evidence, by label;
   - what the checker should report after the change (the dependents that
     will break), **including the conformance consequence** — see below.
2. **Write an override** in the contracts module so build code can proceed:
   the proposed shape (using `Omit<...> & {...}` where needed), tagged
   `/** @proposal(<scope>:W<n>) */`. Blocked steps elsewhere get
   `Status: blocked` citing it.

   **The override shadows the contract's own name**, replacing the
   re-export rather than sitting beside it under a new one:

   ```ts
   /** @proposal(sensor-door:W45) */
   export type BodyRegistry = Omit<SpecBodyRegistry, "registerBody"> & {
     registerBody(body: MotionBody, zones: readonly Zone[], at: SimTime): void
   }
   ```

   Then every conformance assertion and every consumer follows the override
   without being edited, and deleting it in step 5 re-points them at what
   the human actually wrote. A spec edit that differs from the proposal
   fails at that moment — which nothing else catches.

3. **Guide the human through the spec edit.** Show the change, file by file.
   Do not make it.
4. After the human edits the spec, run the checker. Confirm it reports what
   the change request predicted, and work through the dependents with the
   human (this is `centina-iterate`'s loop).
5. **Delete the override** and set the change request `done`.

### At step close and at a gate

- **Conformance consequence.** Part (c) of a change request names the
  conformance signal to expect: most changes make an untouched assertion fail
  and name the member; adding or splitting a contract is silent and part (c)
  must name the assertions to add. Detail in `realize-conformance.md`.
- **Coverage.** Every fill written or touched in this step has an assertion;
  list them in the step's close. A step that closes with one missing is raised
  for Centina itself: that event promotes the check from process to checker
  rule.
- **Positive controls.** Falsify a check before leaning on it at a gate: break
  one citation or one fill, confirm the error appears, revert. A check that
  fails by staying silent proves nothing when quiet.

## Spikes

**A spike is run by `centina-spike`, not by this skill.** This skill plans the
phase and admits the spike (the planning gate, step 5). When a spike is
admitted, invoke `centina-spike` with the Skill tool before writing its plan,
and again after any resume or `/clear` that dropped it. That skill requires the
human to rule a gate, a budget and a back-out point first, keeps the line to
one question, records the trail, and stops at checkpoints. It carries the
measurement rules.

Offering an idea or a likely outcome in conversation is fine when marked as
such. Recording one as fact is not.

## Revising the plan

1. **Revisions are new entries.** A proposal (`P`) with `Updates:` citing the
   part it changes, e.g. `Updates: task-matcher:W1(c)`. Never rewrite the
   phase entry's body.
2. **Scope, definition of done and standing risks** change only when the
   human ratifies the proposal. Reordering or splitting steps is proposed and
   confirmed.
3. **No unplanned work.** Work not in the plan gets a `W` entry and the
   human's confirmation first.
4. **Moving work into scope** runs the planning gate for that work and
   re-checks the definition of done.
5. **Moving work out of scope:** the scope-change proposal says what happens
   to each affected item:
   - finished build code stays behind the contracts; its steps become
     `deferred`; its tests keep running, and a test that must be skipped cites
     the deferred label;
   - spike findings keep their status;
   - work in progress is finished to a stable point or reverted, as the human
     decides;
   - open change requests stay open, or are withdrawn if they only served the
     removed work, and steps they blocked are re-checked;
   - abandoned code (not deferred) is removed by its own step, closed when the
     build passes and nothing references it.

## Phase close

1. Run the sweep (`ledger.md`, "Sweeps"), `centina-check ledger` (which
   checks the build tree's ownership citations), the `--contracts` check, and
   the conformance-coverage check.
2. Run the definition-of-done test.
3. **Disposition every open item still carrying this phase's `Phase:`
   field** — read this phase's group in `LEDGER-INDEX.md`'s open items (or
   `--phase <label>`). For each one, raise it with the human and, per their
   call: move it forward (edit its `Phase` field to a phase that will own
   it), drop the field if nobody owns it yet, or resolve/withdraw/defer the
   item itself. Do not leave one open under this phase on the assumption
   that a future phase or the index will pick it up — pointing at the index
   in the close record (step 4) is for someone reading the close later, not
   a substitute for this. Nothing else sweeps a closing phase's own
   backlog: an item raised here but owned elsewhere still needs its `Phase`
   moved, even though it was never really this phase's to finish. The
   checker enforces this (`ledger-phase-closed`): it refuses an open item
   whose `Phase` points at a `done`/`withdrawn`/`superseded` phase, so step 5
   will fail if this step is skipped.
4. Record the close as an `F` entry, `Status: measured`, with the
   definition-of-done run as `Evidence`. Its body states:
   - what the slice proves;
   - each boundary's status: specced, planned, mocked, or implemented. This
     is read off the unbuilt members and their owners, so it is only as good
     as step 1: a close record is what gets trusted later, when nobody
     remembers;
   - a pointer to `LEDGER-INDEX.md`'s open items (do not copy them) — by now
     none should still carry this phase.
5. Set the phase `W` entry `done`, and in the same edit change the run
   frame's current phase: to `none` until the next phase is confirmed. Steps
   closed along the way never go in the run frame.

## Implementation plans (provisional)

How PLAN.md fits this workflow is not settled. For now the phase plan lives in
the ledger, and this skill writes no PLAN.md. After the second phase closes on
a project, ask the human what they needed when opening the next phase, and
record the answer as a ledger entry for Centina's own development.

## Exchange with centina-iterate

- **Questions** from iterate (`Q` entries) that need code arrive as spikes in
  this skill's plan.
- **Change requests** from this skill go back through iterate once the human
  applies the spec change.

Both travel as ledger entries; there is no other channel.

## What NOT to do

- Don't edit `.centina.ts` files, even for a one-line fix.
- Don't write code before the human confirms the phase plan.
- Don't record a claim as fact without evidence, or a diagnosis as a cause
  without checking it.
- Don't run a measurement whose result could not change a decision.
- Don't promote spike code into build code.
- Don't work around a contract problem in code; raise a change request.
- Don't write a fill without its conformance assertion, and don't soften an
  assertion that fails — fix the fill or raise a change request.
- Don't do unplanned work, even small work, without a `W` entry.
- Don't tune a model or the world to reproduce an earlier number.
- Don't change `ledgerHook`, and don't open a transcript without asking
  (`ledger.md`).

## Lessons from use

_Accumulate here as the skill is exercised._
