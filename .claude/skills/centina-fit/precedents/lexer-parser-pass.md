# Fit-case: lexer / parser pass (pure transform)

**Descriptor:** A mechanical transform from one internal representation to
another — tokens → AST, AST → IR, source text → token stream. Adding or
extending such a pass (e.g. teaching the grammar a new keyword).

**Shape:** 0 boundary-ends. No external actor on either side at runtime — input
is an internal representation, output is another internal representation, both
consumed by the next stage of the same program. Center of gravity is realization
on the **algorithm** axis (the transform itself).

**Verdict:** `no-fit` (serve the edges only — usually nothing to serve).

**Deciding factor:** Resolves at **Level 0**. The inventory turns up no
provenance ambiguity: the input shape is fixed and known, the output shape is
fixed and known, and the interesting content is entirely the mechanical mapping
between them — which is realization, not a relationship Centina has anything
to say about. There is no contract to *discover*, only one to implement.

**Discriminators:**
- Both ends are internal representations consumed by the same program → 0-end.
- Input and output shapes are already well-defined and stable; the feature does
  not introduce or reshape a seam → operates *within* existing seams.
- The novelty is a mechanical mapping, not a data relationship to pin down → no
  spec-worthy ambiguity.
- If a diagnostics/error egress is genuinely part of the work, the relevant slice
  may be the 1-end `checker-validation-rule` shape instead — re-slice and check
  that precedent.

**Source:** The "expand the language to accept new syntax" half of the
`add_boundary_primitives` work (AISL v0 era; shape carries over unchanged),
which the design discussion identified as compute-shaped and not spec-worthy.
