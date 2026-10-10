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

**If the spec's system directory (`specs/<system>/`) has a `LEDGER.md`,** read
`${CLAUDE_PLUGIN_ROOT}/docs/ledger.md` before the first check. If the run
frame (`ITERATE-STATE.md`, or `REALIZE-STATE.md` if this system also has a
`centina-realize` phase in progress) names a current phase, read that phase's
view (`centina-check ledger --phase <label> <dir>`) instead of the full
index; otherwise read the system's `LEDGER-INDEX.md`: the standing goals and
rules, the affected work items, and the open items for this component.
Entries from this loop use the
spec file's basename as their scope (`task-matcher.centina.ts` gives
`task-matcher`) **only when the entry is actually about that component.** A
decision or rule that reaches beyond the one spec being iterated (e.g. a
naming convention, a cross-seam invariant) is not a `task-matcher` entry and
is not an `sz` entry either — `sz` names session-zero's own entries, not
"applies everywhere." Give it a named cross-cutting scope instead (see
`ledger.md`, "Scopes": "a named scope for work not tied to one component"),
and say so to the human so the scope name is agreed, not assumed. This
session's ID, for the `Session` header, is `${CLAUDE_SESSION_ID}`. If there is
no ledger, the loop works as before; don't create one unless the human asks.

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
  genuine ambiguity and discuss. A note may carry a label giving it a stable
  name to reference later, instead of an ephemeral line number. In a system
  with a ledger, the label is the ledger entry the note belongs to:
  `@agent(Q3): ...` in `task-matcher.centina.ts` means `task-matcher:Q3`, and
  the checker requires that entry to exist. Without a ledger, labels are free
  text the human assigns (`@agent(C1): ...`). Either way, never renumber one.

- **`deferred<F>()` calls** are marker functions: a typed hole whose _routing_
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

Any `@datasource`/`@datasink`/`@boundary` declared inline in a spec is a
candidate for extraction into its own provisional file, whether or not the
author left an `@agent:` note; writing it inline first is fine. Two checks in a
normal pass:

- **Dependency direction.** A door's parameters and return types must not
  resolve to a type declared in the _consuming_ spec (a local interface, or an
  object-shaped alias): that is the boundary depending on its caller. Primitives,
  `unknown`, opaque `Unshaped<...>` brands and closed enums are fine. A real
  structured payload is better as `unknown` at the door than as the caller's own
  record type.
- **Whether it's ready to move out.** If it is stable and reusable, offer to
  extract it, stating the cross-file move plainly rather than doing it silently.

The provisional file's header, its contents and the shared-singleton convention
are in `${CLAUDE_PLUGIN_ROOT}/docs/iterate-reference.md`, "Boundary
declarations as extraction candidates".

## Starting from a fresh session-zero skeleton

If this is the first pass on a component whose holes are untouched since
`centina-session-zero` emitted it, say so plainly and offer **starting-point
suggestions** before diagnostics: holes with the most downstream dependents,
then holes on the most-traveled path, else the simplest hole. Suggest an
order; the human picks the start (an order is structure, not meaning, so
Rule 0 allows it). Detail: the reference doc, "Starting from a fresh skeleton".

## Process

1. **Run the check** against the target file:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/centina-check" --project <artifactsRoot>/tsconfig.json <file>
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
     meant a different in-scope name). Give the fix verbatim (see "Hand
     edits over verbatim" below) and let the human apply it — see Rule 0a
     below on why the agent doesn't reach for the edit itself, even for a
     fix this small.

   - **Genuine ambiguity** — the diagnostic reveals that the pseudocode's
     _intent_ isn't actually settled (e.g. an undefined identifier that
     traces back to a missing step no one has designed yet — not a typo, a
     gap). Do not guess. Lay out the tension plainly — what the diagnostic
     found, why it's not just a mechanical fix — and either ask a direct
     question or use AskUserQuestion if there's a clean multi-way fork. Wait
     for the human's answer before touching the file. If the system has a
     ledger, record the question as an entry when it's raised and the
     decision when it's made, following `ledger.md`'s "When a status changes".

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

7. Warnings (if the checker distinguishes them from errors) are reviewed the
   same way, but don't block calling the loop "done" — confirm with the human
   whether they want to address open warnings now or leave them.

## Long-session output management

Follow `${CLAUDE_PLUGIN_ROOT}/docs/output-management.md`: decisions go in the
ledger, `ITERATE-STATE.md` is only a run frame, and ledger length is not a
reason to split it: split only when the human asks.

## Reference labels and formula explanations

These apply throughout this loop. Explain a label the first time it comes up,
in one clause ("task-matcher:F7, the scope-crossing identifier in
`matchTasks`"), and restate a reminder when more than 10 labels of the same
letter have come up since, erring toward restating. Spell out every symbol of
a formula on introduction, and always when it goes into PLAN.md,
ARCHITECTURE.md or any other document. Never open a session transcript
without asking, and warn about concurrent sessions (`ledger.md`). Without a
ledger, use session labels (`P`/`Q`/`F`/`O<n>`) and a compact index in the
state file; the full rule is in the reference doc.

## Once the spec is clean: reconcile, then plan

When the check is clean and the human is satisfied, read
`${CLAUDE_PLUGIN_ROOT}/docs/iterate-reference.md` ("Reconciling ARCHITECTURE.md
before the plan", "Writing the implementation plan", "After implementation"),
then, in this order:

1. **Reconcile ARCHITECTURE.md** if the spec came out of `centina-session-zero`.
   With a ledger, run the ledger sweep (`ledger.md`, "Sweeps") and update it
   where this loop changed a door signature, a file location, a terminal's
   `@external` source or a cited label; without one, reread its contract, hole,
   terminal and risk entries against the clean spec. This is mechanical, so you
   may write it, but say what changed.
2. **Write PLAN.md** beside the spec (`PLAN_<spec_name>.md` if one exists; ask
   before overwriting). It names the spec source (and ARCHITECTURE.md), cites
   the ledger labels each step depends on, names every file that changes and
   how, lists concrete completion criteria, and is written for someone who
   wasn't in the room.
3. **After implementation**, once the human approves the outcome, add
   `**Status**: Implemented ✓` (or a failure note) near the top, and record the
   deviations from the plan, which show where the spec was underspecified.

## What NOT to do

- **Rule 0: never write a Centina spec on a human's behalf.** Not even when
  asked, and not because it's hard or tedious — _because_ writing the spec is
  the entire point of Centina. The spec is where a human and a coding model
  reach shared understanding; authoring it for them inserts exactly the layer
  of insulation Centina exists to remove, and hands the thinking back to the
  model. Relatively small, focused snippets in service of a discussion are
  fine (illustrating a syntax point, sketching one door), but do not produce,
  fill in, or "finish" a spec — the human is the architect. If a human asks
  you to write one, decline and redirect to iterating on what _they_ write.
  If this seems like a bottleneck, it is, deliberately. The purpose of pushing
  the human to make code edits to a spec — even if given step-by-step instructions
  on exactly how in some cases — is to ensure the spec can't get away from them,
  that each edit is done with their knowledge. This is a calculated tradeoff: more
  time now for less risk later. If this process starts to become truly onerous,
  it may indicate a gap in the spec large enough to justify a full skeleton spec of
  its own, which means breaking that part out into its own system and kicking off
  a session-zero for it.
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
- **Hand edits over verbatim.** When the human is to make an edit to a
  `.centina.ts` file, give them the edit itself, not a description of it:
  the file, an anchor (the nearest existing declaration or line), and the
  exact text to remove and to add, in a code fence, in the file's own
  formatting (`semi: false`). "Change `f` to take a `Y`" is a description;
  the changed signature is the edit. This is the default; the human can ask
  for prose instead. It applies only once the decision behind the edit is
  settled — verbatim text for an open fork is the agent authoring meaning
  (Rule 0), so an unsettled fork stays a question, not a snippet.
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

In full, with where each came from, in
`${CLAUDE_PLUGIN_ROOT}/docs/iterate-reference.md`, "Lessons from use":

- **Encode ratified intent into the type system** (`[T, ...T[]]`, a
  discriminated union, a branded identity, an exhaustive enum): call it out and
  show a concrete example, then stop. The human holds the pen; here the agent
  only proposes (session zero may emit it). If it can't be typed, an `@agent:`
  note is the fallback.
- **Warning triage is design discussion, not cleanup.**
- **`@external` for stand-in types, `deferred`/`@agent:` for stand-in values**,
  never a cast that pretends the value exists.
- **A cast at the `declare` site** records the assumption once, not at every
  use.
- **Scope-crossing identifiers are a common real finding:** ask whether the
  missing construction is itself the finding before hoisting a declaration.
