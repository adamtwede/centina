---
name: aisl-fit
description: Helps a human decide whether what they want to model is a good fit for an AISL spec before they invest in writing one. Runs a structured descent (prose inventory → signatures → thin slice) to locate the task's structural plane and realization plane and draw the line between them, classifies fit/partial-fit/no-fit, matches against a corpus of prior cases to go faster, and on a conclusive session emits a FIT.md handoff for aisl-iterate. Use when the human asks "is this a good fit for AISL", "should I write an AISL spec for this", "does this belong in AISL", or is otherwise sizing up a task before specing it.
---

# AISL Fit

This skill runs **before** `aisl-iterate`, and answers a different question.
`aisl-iterate` assumes a spec is worth writing and refines it; `aisl-fit` asks
*should this be an AISL spec at all, and if so, where do I slice it?* The output
of a conclusive session is a `FIT.md` handoff that `aisl-iterate` consumes, so
the human starts the actual spec from a seed instead of a blank file.

The goal is not to gatekeep. It's to spend a few cheap minutes locating where a
task's center of gravity sits, so the human doesn't burn a long spec session on
something AISL was never going to serve — or, just as often, so they discover
the *part* of a task that AISL serves well and scope to it.

## The lens: two planes

Every task can be read on two planes. Fit is a question of where its **center of
gravity** sits.

- **The structural plane** — what AISL owns. The *relationships between named
  data*: **provenance** (where data enters, and from whom), **flow** (how it
  moves between seams), **contract** (what shape it must hold). All of this is
  describable as "X comes from Y, in shape Z, and connects to W."
- **The realization plane** — what AISL recuses from. The *carrying-out*:
  **algorithm** (how it's computed), **dynamics** (how it behaves over time),
  **aesthetics** (how it's perceived). None of this reduces to a data
  relationship you can name and check.

The grammatical mismatch is deliberate and load-bearing: *structural* names a
static property of data; *realization* names a process done to data over time.
The two planes are not symmetric, and the names shouldn't pretend they are.

The dividing line is AISL's core invariant seen from two angles: **AISL
describes relationships; it never manufactures data.** "Never manufactures data"
and "structural plane only" are the same statement. So the orienting question
is always:

> **Where is this task's center of gravity — in a data relationship, or in a
> realization?** Structural → spec it. Realization → AISL can frame the edges,
> but the heart is out of scope.

### Supporting heuristic: count the boundary-ends

How many ends of the slice face a *real external actor at runtime* (a user, a
file, a socket, a model, a downstream service — not the developer, and not
another function in the same program)?

- **2 ends (ingress + egress are both boundaries)** — I/O-shaped. The current
  ideal fit (web handler, ETL). Boundaries carry the spec.
- **1 end (usually egress)** — *reporting/effect*-shaped. Internal logic that
  surfaces outward (a checker, a logger, a metrics emitter): one real seam, one
  privileged-internal input (a function parameter). Fit, but lighter.
- **0 ends** — pure compute (token-stream → AST, a sort). No external seam, so
  little spec-worthy provenance. Adopt a skeptical default here until the
  language is more mature.

The single sharpest test for whether something is a boundary: **what is on the
other side of this door, at runtime?** If the answer is "the developer building
this" it's build-time work, not a data seam; if it's "another function in the
same program" it's internal compute, not a boundary.

## The descent: stop at the highest level that draws the line

Fit cannot always be determined a priori. The *attempt* is the diagnostic:
either you uncover real provenance ambiguity worth pinning (fit), or the seams
keep coming out looking like implementation steps and you find nothing to
wrestle (unfit — or you sliced wrong; re-slice and retry). So this is not a
questionnaire. It is a descent through three levels of increasing formality.
**Push the human to stop at the highest level that resolves the question** — the
depth you must descend to is itself a fit signal.

**Level 0 — Inventory in AISL's vocabulary, in prose.** No syntax. Have the
human name the candidate data nouns and sort them into the categories:
provenance (what enters, from whom), flow (how it moves), contract (what shape
it must hold) — and, on the other side, what algorithm / dynamics / aesthetics
is the hard part. For many tasks, just naming the nouns makes the center of
gravity obvious. If so, conclude here.

**Level 1 — Signatures only, no bodies.** If Level 0 is ambiguous, have the
human write *only* boundary/door signatures and function headers — e.g.
`datasource X(): read() -> Shape`, `function f(a: A) -> B:` with no body. This
applies AISL's real rules (direction enforcement, privileged sources,
contract-via-return) but is not yet pseudocode. This is where the
**tasks-as-doors smell** becomes visible: if a door can't be named without it
being an implementation verb, or the doors keep collapsing into a vague
`get_data()`, the seam is fake and the task is realization-dominated. Rich,
specific signatures → fit.

**Level 2 — A thin slice with bodies.** Only if 0 and 1 still haven't resolved
it. *One* representative flow — a single piece of data from entry to exit —
written as real AISL and run through the checker (`npx tsx src/cli.ts
<file.aisl>`). Genuine provenance ambiguity either surfaces (a point where the
human *must* cast, *must* say where a value came from, *must* commit a
direction) or conspicuously fails to (everything resolves trivially, or
everything is manufacturing). Reaching Level 2 at all is a *strong* fit signal:
the ambiguity was real enough to need pseudocode to expose it.

The descent terminates when: the line is drawable (**fit** → write FIT.md, hand
to `aisl-iterate`); or it reveals the center of gravity is realization
(**no-fit** → recuse, or **partial-fit** → carve off only the structural edge);
or a couple of representative re-slices all fail to surface structural ambiguity
(**no-fit, for now**). Bound the recursion by re-slicing attempts; do not spiral.

### How much help to give: form, not meaning

This is Rule 0 (see below) at micro-scale. The agent supplies the **form**; the
human supplies the **meaning**. Concretely, the agent may:

- name *which* slice to attempt ("the single most representative flow — one
  datum, entry to exit"),
- hand over an empty skeleton (boundary/header shape with **blanks** for the
  nouns, shapes, and directions),
- ask the pinning questions ("where does this value come from?", "what shape
  must it hold?", "what's on the other side of this door, at runtime?").

The agent **never** fills a data noun, a shape, or a direction — those *are* the
thinking. The bright line is mechanical: the agent writes syntax with holes; the
human fills the holes. If the agent ever fills a hole with a domain term, it has
done the human's job. Give a stuck human a scaffold to push against, never the
answer.

## Precedent matching

Before descending from scratch, check whether this task resembles a known case.
Precedents are the **volatile experience layer** of this skill — read them live,
the same way the lens and descent above are the durable layer that rarely
changes.

- **Project pool** — `specs/**/FIT.md` and any `precedents/` in the user's repo.
  Match these first; they're closest to the work at hand.
- **Canonical pool** — `.claude/skills/aisl-fit/precedents/`, shipped with AISL.
  Curated reference cases spanning the spectrum.

A precedent supplies a **prior, not a verdict.** If a case matches ("this looks
like the 1-end checker-rule case → probably fit, resolves at Level 1"), start
the descent *from that expected shape and confirm it holds*, rather than
rediscovering from zero. The precedent never replaces the descent — honoring
that fit can't be known a priori, you still verify. If the task matches, you get
fast confirmation; if it deviates, fall back to the full descent. Accelerator
with a verification gate — it tells you where to look, never what to conclude.

See `precedents/README.md` for the fit-case format. The matchable essence is a
small set of **discriminators** (shape-level distinguishing features), not the
project specifics — abstract a case to its shape-determining essence and drop
the domain detail. Too specific and it matches nothing; too general and it
matches everything uselessly.

### Revising the matcher on a false positive

When verification contradicts a match, that contradiction is signal — capture it
back into the matcher so it doesn't recur. A **false positive** (a precedent
matched but did not hold on descent) and a **false negative** (the descent found
a shape a precedent should have caught) are the same event from two sides: two
shapes the matcher had wrongly connected, or wrongly kept apart.

The revision is a concrete **edge edit** on the cases' discriminators — "polish
an edge off one, add an edge to the other":

- Ask: *what shape-level feature did the task have that the precedent lacked (or
  vice versa)* that should have decided the match?
- Add that discriminator to the case that needs to *exclude* this shape; where
  appropriate, widen (remove an over-specific discriminator from) the case that
  should have *included* it.
- Only genuine **shape-level** discriminators earn an edge — something about
  provenance, flow, contract, or center of gravity. Never incidental domain
  detail; that route degenerates the matcher into memorized instances.

Respect the pools. In a user session, revisions land in the **project pool**. A
canonical precedent is never mutated from user space — if a canonical case is
implicated, record the correction project-side and flag it as a
*promotion/correction candidate*. Folding project cases into the canonical pool
is the AISL authors' prerogative alone.

## The handoff: FIT.md

On a conclusive session, write `specs/<name>/FIT.md` alongside where the spec
will live. It is the **crystallized descent** — its richness scales with how
deep you went — and it gives `aisl-iterate` a seed instead of a blank page. This
is the per-feature lineage: **FIT.md** (*should* we, and where's the line?) →
**`<name>.aisl`** (the spec) → **PLAN.md** (the implementation).

Lightweight structured markdown, named sections (no rigid machine schema):

1. **Verdict + reasoning** — fit / partial-fit / no-fit, with the
   center-of-gravity call and boundary-end count that produced it. *(Always
   present.)*
2. **Structural inventory** (Level 0) — the data nouns and their
   provenance/flow/contract accounting. Becomes the spec's seed vocabulary, so
   naming consistency starts here.
3. **Boundary sketch** (Level 1, if reached) — door signatures and directions,
   liftable almost directly into the spec scaffold.
4. **Thin slice** (Level 2, if reached) — the actual AISL fragment written, and
   its checker result if run. Literal starter code.
5. **Scope decision** — which slice was chosen, and *which slices were rejected
   and why* (the realization-dominated parts to leave out). Sets the spec's
   in-scope / out-of-scope line so `aisl-iterate` doesn't drift back into
   territory fit already ruled out.
6. **Open ambiguities** — surfaced during fit but not resolved; these go
   straight into the `aisl-iterate` loop.

A `no-fit` session still writes a short FIT.md (verdict + reasoning + the
rejected scope) — it records that the question was asked and answered, and feeds
the precedent corpus.

After a conclusive session, offer to capture it as a precedent (project pool) if
its shape is reusable — abstracted to discriminators, not specifics.

## What NOT to do

- **Rule 0: never write an AISL spec, or a thin slice's *meaning*, on a human's
  behalf.** This skill writes *form* — skeletons with holes — never the data
  nouns, shapes, or directions that fill them. Producing the slice's content for
  the human defeats the entire purpose: the slice is a probe the human pushes
  into their own idea, and if the agent fills it in, the probe reads the agent's
  understanding, not the human's. Decline and hand back the skeleton.
- **Don't let a precedent short-circuit the descent.** A match is a hypothesis to
  confirm, not a conclusion. Skipping verification because "it looks like the
  checker-rule case" is exactly how false positives calcify.
- **Don't force a fit.** If the center of gravity is realization, say so plainly
  and recuse (or scope to the structural edge). Talking a realization-dominated
  task into an AISL spec produces the tasks-as-doors specs this skill exists to
  prevent.
- **Don't over-descend.** Stop at the highest level that resolves the question.
  Reaching for a thin slice when a prose inventory already settled it wastes the
  human's effort and muddies the signal that descent depth carries.
- **Don't mutate canonical precedents from a user session.** Project pool only;
  canonical promotion is the authors' call.

## Lessons from use

*(Accumulate here as the skill is used — e.g. shapes that resisted
classification, discriminators that turned out to be incidental rather than
structural, descent levels that reliably resolved a given family of tasks.)*
