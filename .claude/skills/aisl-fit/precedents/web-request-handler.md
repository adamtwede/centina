# Fit-case: web request handler

**Descriptor:** A unit of server-side logic that receives an external request,
does some work, possibly consults downstream resources, and returns a response —
an endpoint, a handler, a reducer driven by user events.

**Shape:** 2 boundary-ends (ingress + egress), often a third for downstream
resources. Center of gravity is structural across all three sub-axes:
**provenance** (the request and its payload shape), **flow** (request → work →
response, plus any store reads/writes), **contract** (the response shape, the
stored shape).

**Verdict:** `fit` (the current ideal use case).

**Deciding factor:** Often resolves at **Level 0** — naming the nouns
(request in, response out, store) immediately shows real external actors on both
ends. Any genuine compute core (pricing, validation) is a *separable* plain
function inside the structural frame, not a reason to reclassify.

**Discriminators:**
- A real external actor on *both* ends (a user/client at ingress, the same or a
  downstream service at egress) → 2-end I/O shape.
- The hard questions are "where does state live, what mutates it, what's
  persisted, what shape crosses the wire" → provenance/flow/contract.
- Compute-heavy core does **not** flip this to realization as long as the I/O
  seams are the point; the core is a plain function the boundaries frame.

**Source:** `specs/todo/todo.aisl` and the boundaries design discussion — the
motivating domain for the boundary primitives.
