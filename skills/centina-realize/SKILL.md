---
name: centina-realize
description: Works behind a Centina spec's boundaries while the spec is still being refined. Plans a phase with the human before any code is written, then runs spikes that answer questions the spec can't settle without code and builds contract-backed code against the spec's types into a working slice. Tracks phases, steps, spikes and change requests as ledger work items, requires a written measurement plan before any measurement that will be recorded or decide a design, and routes every contract change back to the human. Use when the human wants to prototype, spike, test an assumption, build a vertical slice, or implement part of a Centina system before or between centina-iterate cycles.
---

# Centina Realize

## Setup: run first

1. Run `${CLAUDE_PLUGIN_ROOT}/docs/plugin-setup-procedure.md` to resolve the
   project and `artifactsRoot`.
2. Read `${CLAUDE_PLUGIN_ROOT}/docs/ledger.md`,
   `${CLAUDE_PLUGIN_ROOT}/docs/output-management.md` and
   `${CLAUDE_PLUGIN_ROOT}/docs/measurement-methodology.md`.
3. This session's ID, for the `Session` header, is `${CLAUDE_SESSION_ID}`.
4. Identify the system (`specs/<system>/`). It must have a `LEDGER.md`. If it
   does not, stop: suggest `centina-session-zero` for a new system, or ask
   the human whether to start a ledger for an existing one.
5. Read the system's `LEDGER-INDEX.md`: the standing goals and rules, the
   affected work items, and the open items.
6. Read or create the run frame, `specs/<system>/REALIZE-STATE.md`
   (`output-management.md`). It records the implementation root (where code
   lives), the contracts module path, the path build code uses to import
   `<artifactsRoot>/conformance.ts`, the source trees for spikes and build
   code, the current phase and step, and session IDs. Ask the human for
   anything not yet recorded.

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
| Rules    | `measurement-methodology.md`                    | "Using spec types" below                           |

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
`active`.

## Working a step

1. Set the step `active`.
2. Build steps: write code against spec types (below). Spikes: write the
   measurement plan first and get it confirmed.
3. Run the closing test. It must print. Record findings as they appear.
4. Close the step: `done`, with the evidence in the body or in `F` entries.
   Run the `--contracts` check and the conformance-coverage check
   ("Contract changes").
5. **Review the remaining plan with the human** before starting the next
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
4. Unbuilt members throw an error naming the work item that fills them. Never
   return zeros or empty values from a stub; downstream code would mistake
   "not built" for "nothing there".
5. Writing code against the declared types is itself a check on the spec.
   When a type cannot carry what the code needs, that is a contract problem:
   raise a change request, do not work around it.

## Conformance

`implements` does not hold a fill to its contract. TypeScript's function
assignability lets a fill satisfy a spec interface while diverging from it
four ways, none of which produces a diagnostic:

1. dropping a trailing parameter;
2. making a required parameter optional;
3. returning a value where the contract declares `void`;
4. widening a parameter type.

A free-function `deferred` hole is worse: its fill has no `implements`
relation at all, so nothing checks it even in principle.

The consequence, observed rather than theorized: a change request that adds
a required parameter to a door can produce **no build signal whatsoever** —
not a weaker one. The fill keeps compiling because fewer parameters are
assignable, and the call sites keep compiling because they are typed against
the fill class (`new BodyRegistryImpl()`), never against the contract.

So pair each contract with its fill, in the fill's own file, next to the
fill:

```ts
import { conforms } from "<conformance.ts, path in the run frame>"
import type { BodyRegistry } from "<contracts module>"

export class BodyRegistryImpl implements BodyRegistry { ... }

export const bodyRegistryConforms: true =
  conforms<BodyRegistry, BodyRegistryImpl>()
```

A divergence fails the ordinary typecheck and names the member:

```
error TS2322: Type '"diverges: registerBody"' is not assignable to type 'true'.
```

Notes on using it:

- **Importing `conformance.ts` directly is not a breach of rule 1.** It
  exports no spec types, only the comparison. Spec types still come through
  the contracts module.
- **A free-function hole is its own contract.** `deferred<Kind, F>()`
  returns `F`, so an exported hole is already a nameable type. Re-export it
  from the contracts module as `export type DelayAndSum = typeof
  delayAndSum` and pair the fill the same way. No spec change is needed.
- **Write the assertion in the same edit as the fill.** Nothing detects a
  missing one (see "Coverage" below).
- **Exactness is the point; do not soften it.** An impl that widens a
  parameter is describing a door the spec does not have. Either narrow the
  impl or raise a change request — deliberate divergence belongs in a
  `@proposal` override, which is already tracked and already goes stale on
  its own. Do not add an escape hatch.
- **It checks shape, never behavior.** A fill that accepts a parameter and
  ignores it conforms. A closing test per step still carries the rest.

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

### The conformance consequence, for part (c)

Most changes need no edit to a conformance assertion. The assertion names
two types, not their members, and walks the contract at check time — so a
change to a door's parameters makes an existing, untouched assertion start
failing and name the member. Write that in part (c) as the expected signal.

The changes that do touch an assertion are changes to a contract's
*identity*:

- **rename, remove, merge** — the contract's name stops resolving, the
  contracts module breaks, and the assertion breaks with it. Loud.
- **add a contract, or split one in two** — silent. A new contract with no
  assertion is unchecked, and a split leaves the old assertion passing
  against a smaller interface while the members that moved go unwatched.
  Part (c) must name the assertions to add.

List open overrides and catch stale ones with:

```
${CLAUDE_PLUGIN_ROOT}/bin/centina-check ledger <artifactsRoot>/specs/<system> --contracts <contracts module>
```

An override whose change request is `done`, `withdrawn` or `superseded` is an
error until removed. Run this at every step close.

### Coverage

Once an assertion exists, everything it checks is the compiler's work — no
judgment, no heuristic. The one thing that depends on the agent is whether
the line got written at all, and a missing one fails silently: the build
passes.

No generator fixes this. Deriving pairings by scanning for `implements`
inherits the same blind spot, and a free-function fill has no `implements`
to scan for — naming the pairing is the work, not a by-product of it.

So it is a step-close check, alongside the `--contracts` run: **every fill
written or touched in this step has a conformance assertion.** List them in
the step's close.

If a step ever closes with a fill whose assertion is missing, say so and
raise it for Centina itself — that is the event that promotes this from a
process step to a checker rule, and if it never happens the rule was never
needed.

## Spikes and claims

Follow `measurement-methodology.md` for every measurement whose result will
be recorded or decide a design. In short:

- record the prediction (`F`, `predicted`) before measuring;
- write the measurement plan into the spike entry and get it confirmed;
- a result is `measured` only with `Evidence`;
- a diagnosis is a claim, checked before it is reported as the cause.

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

1. Run the sweep (`ledger.md`, "Sweeps"), the `--contracts` check, and the
   conformance-coverage check.
2. Run the definition-of-done test.
3. Record the close as an `F` entry, `Status: measured`, with the
   definition-of-done run as `Evidence`. Its body states:
   - what the slice proves;
   - each boundary's status: specced, planned, mocked, or implemented;
   - a pointer to `LEDGER-INDEX.md`'s open items (do not copy them).
4. Set the phase `W` entry `done`.

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
