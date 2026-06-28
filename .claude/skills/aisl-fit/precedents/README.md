# Canonical fit-case precedents

These are the **canonical pool** for `aisl-fit` — curated reference cases shipped
with AISL, spanning the spectrum from clean fit to clear recusal. They are
priors that let a fit determination start from an expected shape instead of from
zero. A match is always a hypothesis to confirm by descent, never a verdict (see
`../SKILL.md`).

**These files are the AISL authors' to edit.** A user session never mutates them;
project-side cases live in the user's own repo (`specs/**/FIT.md`, or a repo-local
`precedents/`) and match first. Promoting a project case to canonical is an
authoring decision made within the AISL codebase itself.

## Fit-case format

Each case is one markdown file, abstracted to its **shape-determining essence** —
not its project specifics. Too specific and it matches nothing; too general and
it matches everything uselessly. Fields:

- **Descriptor** — the task family in domain-neutral terms (e.g. "a compiler pass
  that adds a validation rule", not "add boundary primitives to AISL").
- **Shape** — boundary-end count (2 / 1 / 0) and where the center of gravity
  sits (structural vs realization, and which sub-axis).
- **Verdict** — `fit` / `partial-fit` / `no-fit`.
- **Deciding factor** — which descent level resolved it, and the smell or
  ambiguity that tipped it.
- **Discriminators** — the shape-level distinguishing features the match keys on.
  These are the "edges" the false-positive revision step adds to or polishes off.
  Only provenance / flow / contract / center-of-gravity features belong here —
  never incidental domain detail.
- **Source** — where the case came from (a session, a spec), for traceability.

## The seed set

- `checker-validation-rule.md` — 1-end reporting shape, fit. (Precedent #1, from
  the `add_boundary_primitives` session.)
- `web-request-handler.md` — 2-end I/O shape, fit. The current ideal use case.
- `lexer-parser-pass.md` — 0-end pure compute, no-fit (serve edges only).
- `algorithm-implementation.md` — realization/algorithm center of gravity,
  partial-fit (contract only).
- `visual-layout.md` — realization/aesthetics center of gravity, no-fit (recuse).
