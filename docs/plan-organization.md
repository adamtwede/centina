# Plan organization — multi-spec projects

How `PLAN.md` docs relate to a growing set of `.centina.ts` specs joined by
boundaries. Framing settled during a 2026-07 session (affirmed by the author) as
a project grew from one spec to a subsystem of several; one decision is left
open, noted at the end. Internal process design, not a checker feature.

## Specs are a layered DAG, not a flat set of peers

In a real subsystem the specs aren't peers — they're a layered DAG joined by
boundaries. In the founding example, `task-corpus` *declares* a boundary,
`task-matcher` *consumes* it, and `hill-climbing-loop` consumes `task-matcher`.
The thing connecting them is the `@boundary` contract, and that contract is
exactly the seam Centina's boundary design exists to create:
affordances-not-transports means a consumer depends on the door signatures, not
on the implementation behind them. **The boundary is already the unit of
decomposition.**

## Peg plans to boundaries, not one-to-one to spec files

A plan should be scoped to "one side of a set of boundaries," not to "one
`.centina.ts` file." Pegging a plan doc per spec file mistakes the file for the
unit of work; the seam is the unit of work.

This reframes the "mock the unspecified seams and proceed to implementation"
scenario: that's not a workaround being tolerated — it's the designed-in
affordance working as intended. A plan for `hill-climbing-loop` can legitimately
say "`TaskCorpusStore` is consumed through its `@boundary` contract; implement
against a mock that satisfies those door signatures until its own plan lands."
The mock's shape *is* the boundary. If you can plan and implement one spec
against mocked neighbors, your boundaries are load-bearing. If you keep needing
to peek across a seam to write the plan, that's a finding about the boundary
itself — the `fit-validation.md` falsifiability frame applied to the tooling.

## Which specs earn a plan

- A spec earns a plan when you intend to implement it **now**.
- A pure boundary declarator (like `task-corpus`) might get its own plan
  (someone builds the real store) or might stay scaffolded indefinitely while
  consumers mock it.
- So "does every spec get a plan?" is the wrong question. **"Which seams are
  real vs. mocked?"** is the right one.

## File arrangement

Co-locate plans with the spec(s) they cover:

- `specs/<system>/PLAN.md` for a subsystem-wide plan, or
- `*.plan.md` beside each `*.centina.ts` if you go finer-grained.

Co-location keeps the spec↔plan link legible and survives moving the whole
directory (which the namespaced `specs/<system>/` layout already anticipates). A
repo-root `PLAN.md` then stops being per-spec detail and becomes an
index/roadmap across subsystems.

## The state actually worth tracking

Across a growing project the useful bookkeeping isn't "which specs have plans."
It's **per-boundary implementation status**: *specced → planned → mocked →
implemented* — the thing that tells you what is real and what is scaffolding at
any moment. Its natural home is the spec plane (the `@boundary` tag), not a new
plan-doc format: the `@boundary`/`deferred`/`@external` vocabulary already
carries the status of a seam.

(`ARCHITECTURE.md` from a `centina-session-zero` run is the system-level
companion to this: a plan-per-boundary-set is derivable from a frozen contract
ledger, and drifts exactly when the ledger drifts.)

## The one open decision — the author's

Whether Centina should treat a **plan** as a first-class, checkable artifact at
all, or leave `PLAN.md` as a plain-prose deliverable downstream of the checked
spec. Current lean (not settled): keep plans as prose — they're the
implementation thinking, and the spec stays the checked thing — and push any
structure you want (like the per-boundary status above) into the spec plane
where the existing vocabulary already lives.
