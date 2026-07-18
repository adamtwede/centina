# Fit validation — testing AISL's premise and its fit classifier

**Status:** Active design session (opened 2026-06-30). Internal language-design
exercise, not a feature. **Rule 0 is lifted for this work by the author** — the
judgment under test is AISL's *suitability for a task*, which is a subjective
authorial call, not task meaning; so the agent may draft specs and thin slices
here as instruments, while the author keeps the suitability verdict.

## Why this exists

Stop theorizing about the language and start *using* it. Two things are on trial,
and they are different:

- **The gate** — the `aisl-fit` classifier. Does the 2/1/0 boundary-end heuristic
  sort real tasks correctly?
- **What's behind the gate** — AISL's *premise*. For tasks that pass as "fit,"
  does writing them as structured pseudocode actually pay off?

A working gate that admits worthless specs is no better than a broken one. The
exercise has to test both, and keep them separate.

`Unprivileged` enforcement (currently inconsistent in the checker) is the
*precipitating* concern, but it is downstream of this: see "Provenance is a
hypothesis" below.

## The invariant: AISL's goals

These are the **only** invariant. Everything else — including "AISL never
manufactures data" — is a *means* under test, kept only insofar as it serves
these. AISL produces structured, rule-checked pseudocode that:

1. makes it easier for a human to describe and understand a complex coding task
   (a relative measure), at a given level of detail, **to himself and other
   humans, than conversational prose**.
2. makes it **more likely** that during spec-writing and spec-review sessions,
   unknowns / ambiguities / oversights that would have been missed in
   conversational planning are identified, discussed, and remediated.
3. makes it **more likely** a coding agent reviewing the spec produces an
   implementation plan (or other artifact) that accurately reflects the human
   spec-writer's intention, than it would from conversational prose.
4. provides a foundation to iterate on, both before and after the planning and
   implementation phases.

Bonus: the spec file is a self-documenting record for later reference.

Note every one of 1–3 is **comparative** ("...than conversational prose"). A spec
we like in isolation tests nothing — an honest test needs a **prose baseline**.

## Provenance is a hypothesis, not an axiom

"AISL never manufactures data" was demoted this session from axiom to hypothesis.
Stated precisely:

> "Never manufactures data" (and its enforcement arm — privileged sources,
> `Unprivileged`, casts-at-seams) is a **hypothesized mechanism**, believed to
> serve **G2** (forcing "where does this come from?" surfaces oversights) and
> **G3** (provenance gives the agent firmer guardrails). It must pay its way
> *against* **G1** and **G4**, where it plausibly *costs*: cast friction and
> `Unprivileged` strictness can make a spec less legible to a human and harder to
> iterate. The test is whether the G2/G3 gain exceeds the G1/G4 tax.

Consequence: **G2 is the cheapest goal to test solo, and it is exactly where
provenance lives.** "Did writing this in AISL force a question prose let me skate
past?" *is* the provenance experiment. So there is no separate provenance phase —
it is measured inside every deep-dive of a provenance-heavy task. The
`Unprivileged`-enforcement decision (enforce consistently / rethink) is an
*output* of this exercise, not an input.

## Falsifiability frame

Fixed before looking, so the exercise can't rubber-stamp itself.

**The classifier (Q1) holds iff:** on a set that *includes adversarial cases*, the
snap 2/1/0 verdict matches the descent verdict — *and* every mismatch is
explainable by a shape-level discriminator we can name and fold back into
precedents. Frequent or inexplicable mismatches ⇒ the heuristic is decorative;
replace, don't patch.

**The premise (Q3) holds iff:** at least one fit-classified task *also* clears a
harder bar — writing it as AISL surfaced a provenance/flow/contract ambiguity that
**prose or free-form pseudocode would have let the author skate past.**
Transcription does not count.

**The four quadrants** (gate verdict × actual value):

| | passes gate | fails gate |
|---|---|---|
| **has value** | reinforcing (gate + premise agree) | gate too strict — *missed fit* |
| **no value** | **premise on trial — the prize** | correct recusal |

The **classified-fit-but-no-value** cell is the one that decides everything. If
it's empty, gate and premise reinforce each other. If it's well-populated, the
gate is admitting tasks the premise can't justify — the most important finding the
session could produce.

## Method

- **Corpus-bias caveat.** The 2/1/0 criteria were back-derived from a thin,
  self-selected corpus (`prototype.aisl`, the todo app, the checker watching
  itself). Testing them with friendly exemplars is circular. We deliberately
  stress the **seams between buckets**, not the interiors.
- **Breadth then depth.** Snap-classify the whole candidate set on paper, then
  full descent (signatures → thin slice → checker) only on the contested ones.
- **Head-to-head baseline on the primary anchor.** For the feedback pair, write
  *both* a prose/free-form version and the AISL spec, hand both to a fresh agent,
  and compare the implementation plans — real evidence for G3, with author
  introspection of G1/G2 alongside.
- **Findings land here** (running log below) and feed the corpus
  (`specs/**/FIT.md`, `aisl-fit` precedents, and the skill's "Lessons from use").

## Candidate set

Snap verdict = mechanical boundary-end count. "Contested" = the snap verdict and
the predicted descent verdict diverge, or the case sits on a bucket seam → goes to
the deep-dive queue.

### Real anchors

- **Feedback pair** (`encode_feedback_into_loop` + `task_matcher`, deferred in
  `prototype.aisl`) — **primary anchor.** `encode` = 1-end **egress** (privileged
  param in; fan-out writes to several *different* affordances: editable docs,
  model system prompt, skill, harness config, task-type map). `task_matcher` =
  1-end **ingress** (reads those same stores back; return-to-loop is internal).
  Inverse operations over a **shared store-set + shared `Feedback` contract** —
  the factoring argument for their own spec referenced from `prototype.aisl`.
  Exercises: provenance (the G2 probe), boundaries (next feature, road-tested on a
  real case), cross-`.aisl` `external` (built). Live risk: `task_matcher`'s
  matching core is realization → would push the pair to **partial-fit**. Gets the
  head-to-head baseline.
- **Monorepo dependency-impact tool** — **adversarial real.** Two reads
  (changeset from a skill; consuming app's actual dep usage) + one summary egress
  read as 2-end "fit," but center of gravity is **dependency-graph traversal**
  (algorithm). Predicted **classified-fit-but-no-value** — kept *because* it's
  risky.

### Game systems

- **2D movement — turn-based vs free-form.** Same system, opposite sides of the
  line: turn-based is occupancy/legal-move *state* (possible fit); free-form is
  real-time *dynamics* (poor fit). Best single test of the classifier's
  discrimination.
- **Crafting / alchemy recipes.** Recipes are input→output data relationships;
  smells like game code but may hide a real structural core. Sleeper-fit probe.

### Synthetic seam cases (fill, used where the real anchors don't cover a seam)

- **markdown → AST** — canonical 0-end compute, wrapped in I/O (file in, renderer
  out). Does the heuristic recuse from the compute core even when bracketed by
  real seams?
- **request → response handler whose substance is a pricing algorithm** — textbook
  2-end shape, value all in realization. Direct classified-fit-but-no-value probe.
- **metrics emitter, periodic flush** — clean 1-end egress, but "periodic" is
  dynamics. Egress/dynamics overlap.
- **OAuth callback handler** — 2-end, but the real ambiguity is *provenance* (what
  is trusted, where identity enters), not shape. Heaviest `Unprivileged`/cast
  exerciser.
- **rank / dedup a list** — pure 0-end compute people will *want* to spec anyway.
  Do the criteria hold under temptation?

## Phases

0. **Frame** — this document. ✅
1. **Stress the classifier (Q1)** — snap-classify all candidates; deep-dive the
   contested ones; record every snap-vs-descent divergence and the discriminator
   that explains it.
2. **Stress the premise (Q2)** — take the fit / partial-fit tasks, write them as
   AISL (thin slice → checker); head-to-head on the primary anchor. Hunt the
   classified-fit-but-no-value quadrant.
3. **Synthesis (Q3)** — does the premise hold, for *which* cases, characterized
   *how* (positively, beyond "it has 2 boundaries")? What changes are needed?
   Provenance verdict falls out here.
4. **Scope decision (Q4)** — expand scope / deepen current good-fit cases / both,
   justified by Phase 3.

Provenance (G2 tax-vs-gain) is woven through Phases 1–2, not a separate phase.

## Log / findings

*(Per-candidate, filled as we go. Snap verdict → descent verdict → divergence/
discriminator → premise verdict → provenance notes.)*

- **2026-07 — DD1 (feedback pair), executed by the author directly.** Rather
  than descending via the skill, the author rewrote `prototype.aisl`
  wholesale. Findings:
  - **Fit verdict:** the pair specced naturally; the task-matcher subsystem
    quarantined itself behind a `boundary` with two doors and an explicit
    "probably a separate spec" note — answering the factoring question
    organically, in the affirmative, with the boundary primitive as the
    reference mechanism.
  - **Premise (G2) evidence, strongest of the session:** the structured form
    omitted the step where the target model is actually prompted
    (`target_model_output` used but never produced) — while the *prose header
    of the same file* states that step explicitly. A bare
    undefined-identifier check catches it mechanically. Structure surfaced
    what prose hid, same author, same document, same day.
  - **Two founding prohibitions overturned by usage:** the author's own hand
    reached for typed property lists (`ImplementationAttempt`, `LoopRun`) and
    record construction (`LoopRun()`) — both previously rejected on
    "never manufactures data" grounds. **Provenance verdict: prohibition is
    dead; bookkeeping survives** (names must resolve + casts mark
    assumptions). `Unprivileged` retired rather than enforced.
  - **Two primitives invented by need:** `deferred` (a typed hole whose
    *routing* — this spec / separate spec / runtime agent — is deliberately
    unresolved) and inline decision points with alternatives held open. Plus
    demand for optional params, `do/while`, member assignment — all things TS
    already has.
- **2026-07 — The pivot.** Consequence of the above: the base structural
  language was re-deriving TypeScript, while the novel value (holes, routing,
  boundaries, bookkeeping) needs a *checker*, not a grammar. Decision:
  **spec-flavored TypeScript** — TS as grammar, spec-plane checker as
  arbiter. Project renamed **Centina**; AISL v0 preserved at tag
  `aisl-v0-standalone-language`. The planned three-arm head-to-head collapses
  to prose-vs-Centina (still pending, still the right G3 test).
- **2026-07 — First Centina artifact confirms the pipeline.** The 1:1 port
  (`prototype.centina.ts`, later renamed/relocated to
  `specs/hill-climbing-loop/hill-climbing-loop.centina.ts`) + permissive tsc
  produced exactly 6 diagnostics,
  all genuine spec findings (the missing prompt step ×2; branch-scoped
  `attempt`/`step_prompt_output` used outside their branch ×4), zero false
  positives, zero custom checker code. Phase-2 candidate work (monorepo tool,
  game systems, seam cases) paused during the pivot; resume once the checker
  can participate.
- **2026-07 — The classifier (Q1) retired as a standalone gate.** Following
  from the pivot: the fit question was framed as a binary admit/reject asked
  *before* a spec exists, which only made sense while realization-dominated
  work had nowhere to go. With routing primitives (`@external`, `Skill`,
  boundaries, `deferred<"unimplemented">`), realization is no longer rejected —
  it is routed behind a door, and the residual question is per-node ("does
  anything structural remain once the realization is routed out?"), not
  per-task. So the `centina-fit` skill was retired and its lens folded into
  `centina-session-zero`, where node routing actually happens. The surviving
  no-fit case is the degenerate one: a "system" whose DAG won't decompose —
  detected as an **empty contract ledger** (one node, no interior seam),
  the mirror of the over-competence failure. This also settles the Phase-1
  finding that the boundary-end count was slice-relative and unstable: the
  whole-DAG view converts the 0-end degeneracy into a structural fact rather
  than a slice-relative guess, so the count stops being the primary tell. The
  remaining candidate set (monorepo tool, game systems, seam cases) is now best
  exercised *through* a session-zero run, not a separate classifier pass.
