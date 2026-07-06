---
name: centina-fit
description: Helps a human decide whether what they want to model is a good fit for a Centina spec before they invest in writing one. Runs a structured descent (prose inventory → signatures → thin slice) to locate the task's structural plane and realization plane and draw the line between them, classifies fit/partial-fit/no-fit, matches against a corpus of prior cases to go faster, and on a conclusive session emits a FIT.md handoff for centina-iterate. Use when the human asks "is this a good fit for Centina", "should I write a Centina spec for this", "does this belong in Centina", or is otherwise sizing up a task before specing it.
---

# Centina Fit

This skill runs **before** `centina-iterate`, and answers a different
question. `centina-iterate` assumes a spec is worth writing and refines it;
`centina-fit` asks *should this be a Centina spec at all, and if so, where do
I slice it?* Its output, on a conclusive session, is a `FIT.md` handoff that
`centina-iterate` consumes, so the human starts the actual spec from a seed
instead of a blank `.centina.ts` file.

The goal is not to gatekeep. It's to spend a few cheap minutes locating where
a task's center of gravity sits, so the human doesn't burn a long spec session
on something Centina was never going to serve — or, just as often, to discover
the *part* of a task Centina serves well and scope a spec to it.

## Lens: two planes

Every task can be read on two planes. The fit question is where its **center
of gravity** sits.

- **The structural plane** — what Centina describes. *Relationships between
  named data*: **provenance** (where data enters, from whom), **flow** (how it
  moves between seams), **contract** (what shape must hold). All describable
  as "X comes from Y, in shape Z, connects to W."
- **The realization plane** — what Centina stays out of. *Carrying-out*:
  **algorithm** (how it's computed), **dynamics** (how it behaves over time),
  **aesthetics** (how it's perceived). None of these reduces to a data
  relationship you can name and check.

The grammatical mismatch between the two planes is deliberate and
load-bearing: *structural* names a static property of data; *realization*
names a process done to data over time. The two planes aren't symmetric, and
the lens shouldn't pretend they are.

The orienting question is always:

> **Where does the task's center of gravity sit — in a data relationship, or
> in realization?** Structural → spec it. Realization → Centina can frame the
> edges, but the heart of the task is out of scope.

This lens is unchanged from AISL v0 and carries the same weight post-pivot.
What *did* change in the pivot is how hard the line is enforced — see
"Provenance is bookkeeping, not prohibition" below.

### Provenance is bookkeeping, not prohibition

AISL v0 treated "never manufactures data" as an axiom enforced by a type
(`Unprivileged`) that made ad hoc values structurally unusable. Real
spec-writing overturned that: authors routinely and legitimately construct
records inside structural code (`LoopRun()`, `attempt.timestamp = ...`), and
forbidding it produced friction without a matching gain in signal (see
`docs/fit-validation.md`). Centina keeps the *descriptive* claim — a spec
should describe relationships, not encode how a value is computed — but
enforces it as **bookkeeping**, not prohibition: every `deferred` hole is
enumerable, every external reference is a marked `@external` declaration,
every cast is a recorded `as` at a `declare` site. Nothing is structurally
disallowed; everything unresolved is visible instead.

This matters for fit classification: don't reject a task just because it
constructs a value somewhere. Ask whether its *center of gravity* — the part
worth pinning down — is a relationship (fit) or a computation (not fit, or
only the edges are).

### Supporting heuristic: count boundary-ends

How many ends of a slice face a *real external actor at runtime* (a user, a
file, a socket, a model, a downstream service — not the developer, not
another function in the same program)?

- **2 ends (ingress + egress both boundaries)** — I/O-shaped. The current
  ideal fit (web handler, ETL). Boundaries carry the spec.
- **1 end (usually egress)** — *reporting/effect*-shaped. Internal logic
  surfaces outward (a checker, a logger, a metrics emitter): one real seam,
  one privileged-internal input (a function parameter). Fit, but lighter.
- **0 ends** — pure compute (token-stream → AST, sort). No external seam, so
  little spec-worthy provenance. Adopt a skeptical default here.

The single sharpest test for whether something is a boundary: **what's on the
other side of this door, at runtime?** If the answer is "the developer
building this," it's build-time work, not a data seam.

**Known limitation (fit-validation Phase 1):** boundary-end count is
*slice-relative*, not a stable per-task property — the same task can read as
2-end or 0-end depending on where you draw the slice (turn-based movement was
the clearest case: the "next turn" boundary can be modeled as an external
actor, or folded into the same loop). Treat a count as a hypothesis about one
candidate slice, not a verdict on the task — confirm with descent below, and
if a count feels unstable, name that instability explicitly in the FIT.md
writeup rather than picking whichever count arrived first.

## Descent: stop at the highest level that draws the line

Fit cannot always be determined a priori. This is an *attempt* at a
diagnostic: either you uncover a real provenance ambiguity worth pinning down
(fit), or the seams keep coming out looking like implementation steps you
find nothing to wrestle with (no-fit — you sliced wrong; re-slice and retry).
This is not a questionnaire. It's a descent through three levels of
increasing formality. **Push the human to stop at the highest level that
resolves the question** — the depth you descend to is itself a fit signal.

**Level 0 — Inventory in Centina's vocabulary, in prose.** No syntax. The
human names candidate data nouns and sorts them into categories: provenance
(what enters, from whom), flow (how it moves), contract (what shape it must
hold) — on the other side, algorithm / dynamics / aesthetics for the hard
part. For many tasks, just naming the nouns makes the center of gravity
obvious. If so, conclude here.

**Level 1 — Signatures only, no bodies.** If Level 0 is ambiguous, the human
writes *only* boundary/door signatures — function headers, e.g. a
`/** @datasource */`-tagged class method `read(): Shape`, or a bare
`function f(a: A): B` with no body. This applies Centina's real primitives
(direction inferred from return type, `@external` for outside references,
`Noun<>` for opaque data) but not yet pseudocode. This is where the
**tasks-as-doors smell** becomes visible: a door that can't be named without
an implementation verb, or doors that keep collapsing into a vague
`getData()`, means the seam is fake and the task is realization-dominated.
Rich, specific signatures → fit.

**Level 2 — A thin slice with bodies.** Only if 0 and 1 still haven't
resolved it. Write *one* representative flow — a single piece of data's entry
and exit — as a real `.centina.ts` fragment and run it through `tsc`
(`npx tsc --noEmit`, or the Centina checker once it exists — see
ROADMAP.md). The human *must* cast, *must* say where a value came from (a
door, an `@external`, an `Agent` cast), and *must* commit to a direction — or
it conspicuously fails (everything resolves trivially, nothing needs
bookkeeping). Reaching Level 2 at all is a *strong* fit signal: the ambiguity
was real enough to need pseudocode to expose it.

The descent terminates when: a line is drawable (**fit** → write FIT.md, hand
to `centina-iterate`); or it reveals the center of gravity is realization
(**no-fit** → recuse, or **partial-fit** → carve off only the structural
edge); or a couple of representative re-slices all fail to surface structural
ambiguity (**no-fit, for now**). Bound the recursion on re-slicing attempts;
do not spiral.

### How much help to give: form, not meaning

This is Rule 0 (see below) at micro-scale. The agent supplies **form**; the
human supplies **meaning**. Concretely, the agent may:

- name *which* slice to attempt ("the single most representative flow — one
  datum, entry to exit"),
- hand over an empty skeleton (a boundary/door with the shape filled in and
  the nouns, shapes, directions left as blanks),
- ask pinning questions ("where does this value come from?", "what shape
  must it hold?", "what's on the other side of this door, at runtime?").

The agent **never** fills in a data noun, shape, or direction — those *are*
the thinking. The bright line is mechanical: the agent writes syntax and
holes; the human fills the holes. If the agent ever fills a hole with a
domain term, it has done the human's job. Give a stuck human a scaffold to
push against, never an answer.

## Precedent matching

Before descending from scratch, check whether the task resembles a known
case. Precedents are the **volatile experience layer** of the skill — read
them live, unlike the durable lens/descent layer above which rarely changes.

- **Project pool** — `specs/**/FIT.md` in the user's own repo. Match these
  first; they're closest to the work at hand.
- **Canonical pool** — `.claude/skills/centina-fit/precedents/`, shipped with
  Centina. Curated reference cases spanning the spectrum.

A precedent supplies a **prior, not a verdict.** If a case matches ("this
looks like a 1-end checker-rule case → probably fit, resolves at Level 1"),
start the descent *from* the expected shape and confirm it holds, rather than
rediscovering it from zero. A precedent never replaces the descent — since
fit can't be known a priori, you still verify. If the task matches, you get a
fast confirmation; if it deviates, fall back to the full descent. It's an
accelerator with a verification gate — it tells you where to look, never what
to conclude.

See `precedents/README.md` for the fit-case format. What's matchable is the
essence of a small set of **discriminators** (shape-level distinguishing
features), not project specifics — abstract a case to its shape-determining
essence and drop the domain detail. Too specific and it matches nothing; too
general and it matches everything uselessly.

### Revising the matcher on a false positive

When verification contradicts a match, the contradiction is signal — capture
it back into the matcher so it doesn't recur. A **false positive** (a
precedent matched but did not hold on descent) and a **false negative** (the
descent found a shape a precedent should have caught) are the same event from
two sides: two shapes the matcher had wrongly connected, or wrongly kept
apart.

The revision is a concrete **edge edit** on the cases' discriminators —
"polish an edge off one, add an edge to the other":

- Ask: *what shape-level feature did the task have that the precedent
  lacked (or vice versa)* that should have decided the match?
- Add that discriminator to the case that needs to *exclude* this shape;
  where appropriate, widen the other (remove an over-specific
  discriminator).

Discriminators must be **shape-level** to earn an edge — something about
provenance, flow, contract, or center of gravity. Never incidental domain
detail; that route degenerates the matcher into memorized instances.

Respect the pools. In a user session, revisions land in the **project pool**.
The canonical precedents are never mutated from a user session — if a
canonical case is implicated, record the correction project-side and flag it
as a *promotion/correction candidate*. Folding project cases into the
canonical pool is the Centina authors' prerogative alone.

## Handoff: FIT.md

On a conclusive session, write `specs/<name>/FIT.md` alongside where the spec
will live. It **crystallizes the descent** — its richness scales with how
deep you went — and gives `centina-iterate` a seed instead of a blank page.
The per-feature lineage: **FIT.md** (*should* we, where's the line?) →
**`<name>.centina.ts`** (the spec) → **PLAN.md** (the implementation).

Lightweight structured markdown, with named sections (no rigid machine
schema):

1. **Verdict + reasoning** — fit / partial-fit / no-fit, and the
   center-of-gravity call that produced it (the boundary-end count is a
   supporting note, not the verdict itself). *(Always present.)*
2. **Structural inventory** (Level 0) — the data nouns and their
   provenance/flow/contract accounting. Becomes the spec's seed vocabulary,
   so naming consistency starts here.
3. **Boundary sketch** (Level 1, if reached) — door signatures and
   directions, liftable almost directly into the spec scaffold.
4. **Thin slice** (Level 2, if reached) — the actual `.centina.ts` fragment
   written, and its `tsc` result. Literal starter code.
5. **Scope decision** — which slice was chosen, *which slices were rejected
   and why* (the realization-dominated parts to leave out). Sets the spec's
   in-scope / out-of-scope line so `centina-iterate` doesn't relitigate it.

If the verdict is `no-fit`, still write the FIT.md — the question was asked
and answered, and it feeds the precedent corpus even without a downstream
spec.

After a conclusive session, offer to capture it as a precedent (project pool)
if its shape is reusable — abstracted to discriminators, not specifics.

## What NOT to do

- **Rule 0: never write the Centina spec, or the thin slice's *meaning*, on
  the human's behalf.** This skill writes *form* — skeletons and holes —
  never the data nouns, shapes, or directions that fill them. Producing a
  slice's content for the human defeats the entire purpose: the slice is a
  probe of what the human pushes into their own idea; if the agent fills it
  in, the probe reads the agent's understanding, not the human's. Decline and
  hand back the skeleton.
- **Rule 0a: don't offer to make spec-file edits, and push back when asked.**
  Even a settled decision (a discriminator, an in/out-of-scope line) is the
  human's to write into the file — don't volunteer to do it. If asked
  directly, push back once (name the risk: they may be offloading thinking
  meant to stay theirs), then comply if they persist. Separate from Rule 0
  above: Rule 0 is about who decides meaning, Rule 0a is about who holds the
  pen once meaning is decided. Lifted for internal language-design work same
  as Rule 0, and the project author may explicitly invoke a
  development-purposes override, especially for minor edits.
- **Don't let precedent short-circuit descent.** A match is a hypothesis to
  confirm, not a conclusion. Skipping verification because "it looks like the
  checker-rule case" is exactly how false positives calcify.
- **Don't force fit.** If the center of gravity is realization, say so
  plainly and recuse (or scope to the structural edge). Talking a
  realization-dominated task into a Centina spec produces the tasks-as-doors
  specs this skill exists to prevent.
- **Don't over-descend.** Stop at the highest level that resolves the
  question. Reaching for a thin slice when the prose inventory already
  settled it wastes the human's effort and muddies the signal descent depth
  carries.
- **Don't mutate canonical precedents from a user session.** Project pool
  only; canonical promotion is the authors' call.

## Lessons from use

### Boundary-end count is slice-relative

Confirmed during the AISL fit-validation sweep (Phase 1): the same task
(turn-based movement) classified as both 2-end and 0-end depending on where
the "next turn" boundary was drawn. Treat the count as a hypothesis about
*one* candidate slice, not a stable property of the task — if re-slicing
flips the count, name that instability explicitly in the FIT.md rather than
picking whichever count arrived first.

*(Continue accumulating here as the skill is used post-pivot — e.g. shapes
that resisted classification, discriminators that turned out incidental
rather than structural, descent levels that reliably resolved a given family
of tasks.)*
