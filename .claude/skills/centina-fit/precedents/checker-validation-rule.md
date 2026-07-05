# Fit-case: checker / validation rule

**Descriptor:** A pass over an already-parsed structure that inspects it and
reports violations — a type-checker rule, a linter rule, a validator. Operates
inside an existing pipeline whose input and output seams already exist.

**Shape:** 1 boundary-end (egress only). Center of gravity is structural, on the
**contract** axis — the rule is "what shape must this structure hold to be
valid." Ingress is a privileged parameter (the structure to check), not a
boundary, because the producer is internal to the same program.

**Verdict:** `fit` (light).

**Deciding factor:** Resolves at **Level 1**. The egress is a real seam — a
diagnostics sink — and the rule's logic is genuinely describable (classify the
structure, emit a message when it violates the contract). The give-away that it
is *not* 2-end: there is no external actor on the ingress side; the rest of the
pipeline hands the rule its input.

**Discriminators:**
- Ingress is a function parameter, not an external actor → not 2-end.
- Egress is "emit a diagnostic / report a result" → a genuine `datasink`, the one
  real seam.
- The described logic is *classification against a contract*, not *manufacturing*
  → stays on the structural plane.
- Watch for the inverse error: modeling the *act of building the rule* (read the
  design doc, create the primitive) as doors → tasks-as-doors, a different
  (no-fit) shape. If that smell appears, this precedent does **not** hold.

**Source:** `add_boundary_primitives` design session (AISL v0 era; shape
carries over unchanged). The spec collapsed to a single `/** @datasink */`
diagnostics door plus the classifier function; build-time "boundaries"
(`BoundaryDiscussion`, `AISLSource`) were the tasks-as-doors smell and were
dropped.
