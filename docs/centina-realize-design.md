# centina-realize: design

**Status:** agreed and built in the 2026-09-15 improvement session
(`skills/centina-realize/`, `docs/measurement-methodology.md`,
`centina-check ledger --contracts`). Not yet used on a project. Depends on
`docs/ledger-provenance-design.md` (labels, entry headers, generated views,
lint), which should be built first.

## Purpose

A spec can rarely be written with confidence before some code exists. The
original workflow (session-zero, iterate, implementation plan,
implementation, product) assumes the spec can be settled first and built in
one pass. For most real projects the scope is too large for that, and specs
written without evidence carry untested assumptions that later force rework.

`centina-realize` covers the work that happens behind a spec's boundaries
while the spec is still being refined: experiments that answer questions the
spec cannot, and contract-backed code that proves the design in a working
slice. The name follows session-zero's split between structural concerns
(what the spec decides) and realization concerns (what sits behind a door).

"Prototype" is deliberately not in the name: the same loop applies to one
component of a production system.

### Workflow

```
session-zero
  -> iterate / realize cycles
  -> working slice
  -> (next phase: repeat)
  -> final product
```

Within a cycle, iterate and realize exchange labeled entries (see
"Exchange with centina-iterate"). The role of PLAN.md in this workflow is not
settled (see "Implementation plans").

## Evidence from Chrysalis Underworld

**What worked:**

1. **Implementation code used spec types directly.** `src/sim/` imports types
   from the specs and declares `AcousticFieldImpl implements AcousticField`
   in full. Stubs throw and name the step that fills them. Writing code
   against the declared types exposed four real contract problems that the
   physics rig had hidden (LEDGER Item 5), one of which blocked the
   floor-bounce path entirely.
2. **Rig code was kept apart from contract-backed code.** The phase-1 physics
   rig (`src/audio/`) computes ground truth and bypasses every contract.
   LEDGER records that it "cannot become the vertical slice by accretion".
   Phase 2 started a separate tree behind the contracts.
3. **Each phase and step had a test that closed it.** Phase 2's definition of
   done is destructive: delete the renderer's direct call to the diffraction
   function and the audio still works.
4. **Explicit scope lists.** LEDGER's "What transfers from phase 1" and
   "Explicitly not in this phase" sections.
5. **Controlled measurements.** P70 compared two terrain presets identical
   except for one feature. P78 tested two suspected causes together and
   separately (2×2), which showed the failure needs both.
6. **A stopping rule for experiments.** Phase 1 closed when "no pending
   measurement would change a design decision". P74 dropped a measurement
   because "knowing the law without a route is a fact with no consequence".

**What went wrong:**

1. **Unmeasured premises.** P74's fix rested on a false premise; three
   refuted fixes in two entries each rested on one unmeasured premise.
2. **Asserted results.** P67 section D crashed and its conclusion was
   recorded anyway.
3. **Moving targets.** P69: P68's "truth" at a 2 m grid was itself
   unconverged.
4. **Wrong configuration tested.** P77: the shipping settings had never been
   scored. P65's table labeled a row `worst` that computed the centreline.
5. **Small samples.** P73: 8 paths gave 0.29 dB where 20 gave 2.56.
6. **A check mistaken for validation.** A single-ridge agreement check only
   proved the method degenerates correctly.
7. **Unchecked diagnoses.** P75: two diagnoses reported before they were
   checked, both wrong.
8. **Spec edits inside implementation commits.** Commit `5f31283` changed 95
   lines of `shared.ts` and 49 of `physical-simulation.centina.ts` alongside
   code, with no review step between them.
9. **Unplanned growth.** LEDGER Item 2 grew into six sub-items (2a–2f) and
   seven proposals (P79–P85) inside one open item, none weighed against the
   phase plan.

## Two kinds of work

1. **Spike.** Answers a question. Code sits outside the contracts and may
   compute ground truth. The methodology checklist applies. Produces
   findings, never product code.
2. **Build.** Contract-backed code that implements spec types through the
   contracts module. Produces a working slice and change requests.

The two live in separate source trees from the start. Spike code is never
promoted into build code by accretion.

## Using spec types

1. Build code imports spec types **only through one local contracts module**
   that re-exports them. No direct imports from `.centina.ts` files elsewhere.
2. Classes implement spec interfaces in full. **This is necessary and not
   sufficient** — see "Conformance" below; it was written here originally as
   though `implements` alone stopped drift, which real-world use disproves.
3. Every fill also carries a conformance assertion pairing it with its
   contract.
4. Unbuilt members throw and name the work item that fills them. A stub that
   returns zeros lets downstream code mistake "not built" for "nothing there".

## Contract changes

`implements` and `extends` only allow changes that stay assignable to the
current spec. A breaking change (an added required parameter, a different
return shape) will not compile that way, and most important contract problems
are breaking. So:

1. **A proposed change is an override in the contracts module**, using
   `Omit<...> & {...}` where needed, tagged with a JSDoc label:
   `@proposal(physsim:W7)`. Build code compiles against the override.
2. **The checker enumerates open overrides**, the same way it enumerates
   holes: `centina-check ledger <system> --contracts <file>`. It also reports
   an override whose change request is `done`, `withdrawn` or `superseded`,
   since that override should have been deleted.
3. **The human makes every edit to `.centina.ts` files.** The skill does not
   edit specs, including comment-only corrections. Keeping the human in the
   code is deliberate: a human who hands every spec edit to the agent loses
   track of the spec, and drift follows.
4. **The skill guides the human through the edit.** A change request gives:
   - the declarations that change, and the proposed shape (the override);
   - the evidence, by label;
   - what the checker should report afterwards (the dependents that will
     break), so the human can confirm the edit landed as intended.
5. **After the human applies the change,** the agent deletes the override.
   That is code, not spec.

**Overrides shadow the contract's own name** rather than taking a new one.
An override under a new name would require editing every consumer and every
conformance assertion twice per change request, once to point at the
override and once to point back. Shadowing means neither is touched, and it
buys a check nothing else provides: when the override is deleted, the
assertions re-point at what the human actually wrote, so a spec edit that
diverges from the proposal fails at that moment instead of passing quietly.

## Conformance

Added 2026-09-20, from `sensor-door:W45(d)` in Chrysalis Underworld.

### The finding

A change request added a required trailing parameter to two `BodyRegistry`
doors. Part (c) of the entry predicted 15 too-few-arguments errors across
five files. The build reported **none of them** — no weaker signal, no
signal. Three mechanisms, since confirmed against `tsc` directly:

1. **A fill may satisfy an interface with fewer parameters.** Function
   assignability, no compiler flag changes it. An added trailing parameter
   is invisible; an added middle parameter collides and is caught, which is
   the only reason a sibling change request did error.
2. **Consumers name the fill, not the contract.** Call sites did
   `new BodyRegistryImpl()`, so the inferred type was the class, and the
   class still declared the old arity. Nothing in the tree was typed against
   `BodyRegistry` at all.
3. **A free-function `deferred` hole has no `implements` relation.** Its
   fill is not checked against the declaration in any way; the signature
   travels in a comment, which is how one went stale.

A fourth turned up while building the fix: **a `void` return accepts
anything**, so a fill returning a value the contract never promised also
passes `implements`. Making a required parameter optional is a fifth.

### The mechanism chosen

An `Assert<Conforms<Contract, Fill>>` assertion, one line per pairing, in
the fill's own file. It compares parameter tuples and return types in both
directions, which is exact — tuples of different length or element type are
not mutually assignable.

Three things decided the choice over the alternatives considered (a checker
rule over the build tree; a factory convention forcing consumers to name the
contract; folding pairings into the contracts module as a manifest):

1. **It needs no new toolchain.** The claim that "no invocation loads both
   trees" turned out to be false: the contracts module imports the spec
   files by relative path, and the build tsconfig sets
   `allowImportingTsExtensions`, so `tsc --listFiles` over the build tree
   already lists every spec the contracts module routes. An assertion in the
   build tree is checked by the typecheck command that already runs at every
   step close. Every alternative needed a new CLI mode first.
2. **It covers all three mechanisms.** Directly for 1, 4 and 5. For 3,
   because `deferred<Kind, F>()` returns `F`, so an exported hole is already
   a nameable type and needs no spec change — which is why the proposal to
   name hole types in the spec, touching every existing hole, was dropped.
   And transitively for 2: mechanism 2 only did damage because mechanism 1
   let the fill keep its old arity. Hold the fill exact and the fill class
   gains the parameter, at which point every consumer typed against the
   class breaks anyway. The 15 errors come back without a factory.
3. **Exactness is a feature, not a false-positive problem.** A fill widening
   a parameter is describing a door the spec does not have. Deliberate
   divergence already has a home — a `@proposal` override, which is tracked
   and goes stale on its own — so a second escape hatch would only be a hole
   in the thing being bought.

### What it does not cover

- **A fill's extra public members.** A consumer typed against the class can
  use a method the spec never declared, so build code depends on something
  the spec does not describe. The factory convention would fix it. It is not
  what bit, and impl-local helpers are ordinary during realize.
- **Coverage.** A fill with no assertion is unchecked and the build passes.
  This is the one irreducibly agent-dependent bit, and no generator removes
  it: deriving pairings from `implements` clauses has the same blind spot,
  and a free-function fill has no clause to derive from. Naming the pairing
  is the work. Handled as a step-close check, with a named promotion
  trigger — the first step that closes with a missing assertion — rather
  than a checker rule built on speculation.
- **Behavior.** A fill that accepts the parameter and ignores it conforms.
  `sensor-door:W45(b)`'s real requirement — that the time is when the state
  was true, and that the door throws below the clock — is a test's job. The
  enforcement story ends at "the parameter exists and every caller passes
  something."

### Why it is type-only

Corrected 2026-09-20, the day after it shipped, on evidence from the same
Underworld session.

The first version exported `declare function conforms()` and documented a
`const ...: true = conforms<C, I>()` assertion. It type-checked, and the
build's first test to import a fill died on `SyntaxError: Export named
'conforms' not found in module '.../conformance.ts'`. An ambient
declaration emits no binding, so the module had no exports at all.

The habit is correct in `centina.ts`, where `deferred` and the boundary
declarations are ambient because a spec never runs. It is wrong in a module
that build code imports, and the same mistake had already appeared one
level up: a spec's `deferred` hole reached by a value import resolves to
`undefined` for the same reason, which is why a hole's type must be taken
through `import type * as Spec` in the contracts module.

Two repairs worked. A real `function conforms()` returning
`true as unknown as ...` runs and keeps the documented call site. The
type-only form — `Conforms` computing a verdict, `Assert<T extends true>`
turning a divergence into an error — was taken instead, on three grounds:

1. **It cannot reach runtime by construction.** The bug being fixed is a
   compile-time construct that failed at execution. The function repairs
   that instance; erasure removes the category.
2. **It creates no runtime dependency from build code into the artifacts
   tree.** Measured, not argued: `bun build` on a fill carrying an
   assertion contains no reference to the module. That matters because the
   artifacts tree is not necessarily resolvable wherever build code
   eventually runs — Underworld already bundles a web spike — and a module
   whose whole purpose is to be checked and discarded should not ship.
3. **It needs no cast.** The function form has to launder `true` through
   `unknown` to return a type it cannot construct.

The cost is that the assertion is two names rather than one, and that
`Conforms` alone is a valid type alias that checks nothing. A one-name form
was tried — `Conforms<C, I, _D extends true = Conformance<C, I>>`, putting
the failure in a constrained default — and does not work: TypeScript checks
the default against its constraint at the declaration site, with the
generics unresolved, so the module itself fails to compile.

### Three no-op spellings

All three type-check and none of them checks anything. They share one
misreading — that `Conforms` is the assertion, when `Assert` is:

```ts
type X = Conforms<C, I>                 // equals the label
type X = Assert<true & Conforms<C, I>>  // `true & "diverges: m"` is `never`,
                                        // and `never` satisfies `true`
const x = conforms<C, I>()              // no such export; SyntaxError on load
```

The second is the dangerous one: it reads as a strengthening and passes
silently against a genuinely stale fill. Found by the Underworld session
while repairing the first.

### Where it lives

`conformance.ts`, beside `centina.ts` at the plugin root, copied into
`artifactsRoot` by Step 3 of the setup procedure and into
`${CLAUDE_PLUGIN_DATA}` by the install hook. Deliberately **not** part of
`centina.ts`: nothing in it belongs in a `.centina.ts` file, and the spec
plane and the build plane are worth keeping apart in the vocabulary as well
as in the rules. Build code importing it directly is not a breach of the
one-contracts-module rule, since it exports no spec types.

## Exchange with centina-iterate

Uses the ledger machinery from `docs/ledger-provenance-design.md`; no separate
channel.

1. **Question** (`Q`, iterate → realize): the spec cannot settle something
   without code. Realize answers with a finding (`F`) or a spike (`W`,
   `Kind: spike`).
2. **Change request** (`W`, `Kind: change-request`, realize → iterate): an
   override plus evidence. Once the human applies the change, the checker
   reports every dependent, and iterate walks through those diagnostics.

## Claims and evidence

1. **No unqualified assertions.** A claim not backed by a measurement is
   recorded as `hypothesis` or `predicted`, never stated as fact.
2. **Predictions are recorded before measuring,** with reasoning and numbers
   (`Status: predicted`). Measuring updates the status and adds `Evidence`;
   the prediction text stays. Offering an idea or a likely outcome in
   conversation is fine; recording one without its status is not.
3. **`measured` requires `Evidence`:** harness file, command, commit.
4. **Diagnoses count as claims.** A diagnosis is checked before it is reported
   as the cause.

## Methodology checklist

**Trigger:** any measurement whose result will be recorded, or will decide a
design. Trivial unit tests of known behavior are exempt.

Before running, the agent writes a measurement plan (in the spike's `W`
entry) covering:

1. **Question:** the hypothesis, and the prediction with its arithmetic.
2. **Premises:** each one measured, or listed as assumed.
3. **Reference:** validated on its own, and converged.
4. **Configuration:** the one tested is the one that ships.
5. **Controls:** vary one factor, or use a factorial design when factors may
   interact.
6. **Sample:** the size is stated, and no conclusion is drawn from a small
   one.
7. **Refutation:** the result that would refute the hypothesis is stated. A
   check that cannot fail is a regression test, not validation.
8. **Output:** every section prints. A section that did not print did not
   pass.
9. **Labels:** harness labels match what is computed.
10. **No tuning to old numbers:** never adjust a model to reproduce an
    earlier result.

**Placement:** a shared doc beside `docs/output-management.md`, so the skill
file stays short.

## Planning

### The planning gate

Before any code is written, the agent works through these with the human. The
human ratifies the result.

1. **Goal.** What question or capability the phase delivers, and which project
   goal it serves. The definition of done is a destructive test, elicited from
   the human.
2. **Inventory.** What exists and what transfers: rig code, open `Q` entries
   from the index, spec holes.
3. **Out of scope.** An explicit list.
4. **Sort the unknowns:**
   - an unknown that blocks a design decision becomes a **spike**;
   - known work becomes a **build step**;
   - a known contract problem becomes a **change request**, raised before any
     code depends on it.
5. **Spike admission.** A spike is admitted only if some possible result would
   change a decision.
6. **Steps.** Each step has:
   - one closing test;
   - `Depends-on` and `Premises`, by label;
   - a size limit of one door, one question, or one closing test. Larger steps
     are split.
7. **Standing risks.** What would invalidate the plan, and the rule for when it
   happens.

### Work items

All labeled `W` with a `Kind:` header (`phase`, `step`, `spike`,
`change-request`, `other`). Entries reference their phase through
`Phase: W1`.

### Revising the plan

1. **Affected work items are generated.** When an entry's status changes, the
   index lists every open work item that depends on it or uses it as a
   premise. A `measured-false` premise under a planned step flags that step
   without relying on the agent to notice.
2. **Revisions are new entries,** using `Updates: W3(b)`; the plan entry is
   never rewritten.
   - Changes to the definition of done or scope need human ratification.
   - Reordering or splitting steps is proposed and confirmed.
3. **Review at each step close.** The agent checks whether the remaining plan
   still holds given what the step found, and presents that to the human
   before starting the next step.
4. **No unplanned work.** Work not in the plan gets a `W` entry first, not done
   on the side.
5. **Blocked steps say so:** `Status: blocked`, with the blocking label in
   `Depends-on`.

### Phase close

Closing a phase counts as writing a derived doc, so the sweep runs first. The
close record is an `F` entry (`Status: measured`, with the definition-of-done
run as `Evidence`), after which the phase `W` entry is set `done`. The close
record contains:

1. what the slice proves;
2. each boundary's status: specced → planned → mocked → implemented (from
   `docs/plan-organization.md`);
3. a pointer to the generated open-items view, not a copied list.

## Implementation plans

**Provisional.** How PLAN.md fits this workflow is not settled.

1. `centina-iterate` keeps writing PLAN.md as it does today.
2. In realize, the phase plan lives in the ledger (the phase and step `W`
   entries). No separate plan file.
3. **Review trigger:** after the second phase closes on Underworld, look at
   what the human actually needed when opening the next phase, and decide from
   that whether PLAN.md has a role.

## First live test

Underworld. Its existing docs (BRIEF.md, LEDGER.md, SETTLED.md, and
ARCHITECTURE.md's ledgers) migrate to the system ledger format. Existing
theses and standing rules come in as `active`/`deferred` goals and `ratified`
rules, including rules never formally ratified. Other fixtures stay as they
are.

## Scope changes

1. **Scope lives in the phase entry** as lettered parts (in-scope and
   out-of-scope lists), so a change can cite `W1(c)`.
2. **A scope change is a proposal** (`P`, `Updates: W1(c)`) that the human
   ratifies. It is never made by editing the phase entry or by simply doing
   the work.
3. **Moving work in** runs the planning-gate steps for the new work: sort the
   unknowns, admit spikes, define steps with closing tests. It also re-checks
   whether the definition of done still holds.
4. **Moving work out** requires the scope-change entry to record what happens
   to each affected item:
   - **Finished build code** stays behind the contracts. Its steps get
     `Status: deferred`, with a later phase or "unscheduled". Its tests keep
     running; a test that must be skipped cites the deferred label.
   - **Spike findings** keep their status. A measured fact stays true when the
     work that produced it leaves scope.
   - **Work in progress** is finished to a stable checkpoint or reverted; the
     human decides. Half-finished code is not left in the tree without a
     label.
   - **Open change requests** stay open, or are withdrawn if they only served
     the removed work. Steps elsewhere that they blocked are re-checked.
   - **Abandoned code** (as opposed to deferred) is removed by its own step,
     with a closing test: the build passes and nothing references it.
5. **Status value** for `W`: `deferred` (still intended, not in this phase),
   distinct from `withdrawn` (abandoned).

## Goals and standing rules

Underworld mixes several kinds of standing content: theses (central and
secondary), structural rules (ARCHITECTURE §2), design principles ("difficulty
adjusts interpretation, never truth"), method rules ("measure the premise
before building the fix"), and setting prose.

1. **Two new label letters:**
   - `G` goal, for theses and phase-independent project goals. "Which project
     goal the phase serves" in the planning gate means these. (Not to be
     confused with the goals in Centina's own README, which govern Centina
     itself.)
   - `R` rule, with `Kind:` `structural`, `design`, `method`, or `process`.
2. **Status values:**
   - `G`: `active`, `deferred`, `retired` (Underworld's secondary thesis 2 is
     deferred).
   - `R`: `provisional`, `ratified`, `retired`. A provisional rule carries a
     `Review:` header naming when it is reconsidered (a work item or a
     condition). Only the human promotes or retires a rule.
3. **Enforced where possible.** A rule that can become a type or a test does,
   and its entry cites it: `Enforced-by: test/...`. Underworld's phase-2
   destructive test is structural rule 1 enforced this way.
4. **Kept in context:**
   - `LEDGER-INDEX.md` opens with a standing section: active `G` and
     non-retired `R` entries, one line each. The one-line title has to carry
     the rule on its own ("Difficulty adjusts interpretation, never truth"),
     with full text looked up by label.
   - The generator also writes the standing section to a small
     `STANDING.md`, which the project's CLAUDE.md (or AGENTS.md) imports. The
     rules are then in context in every session, not only skill runs.
     Accepted cost: roughly 20–30 lines per session for Underworld.
   - The planning gate lists the rules that bear on the phase, recorded in the
     phase entry as `Constraints:`. The step-close review checks them.
5. **Setting prose** (Underworld's BRIEF §2, emergent properties) stays
   hand-written. Anything in it that constrains work becomes an `R` entry.
   Same principle as ARCHITECTURE.md: prose and structure by hand, anything
   with a lifecycle in the ledger.
