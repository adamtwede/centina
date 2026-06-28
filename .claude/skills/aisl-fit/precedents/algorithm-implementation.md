# Fit-case: algorithm implementation

**Descriptor:** A task whose substance *is* the computation — a faster sort, a
numerical method, a scheduling heuristic, a parsing algorithm. The "how" is the
"what."

**Shape:** Boundary-ends vary (often 0, sometimes 1–2 at the edges), but
irrelevant to the verdict: the center of gravity is squarely realization on the
**algorithm** axis. The whole content is the manufacturing of a result.

**Verdict:** `partial-fit` — contract only. AISL can state the interface (what
goes in, what shape comes out) and must stay silent on the body, because the body
is exactly the data-manufacturing "never manufactures data" forbids.

**Deciding factor:** Resolves at **Level 0 or 1**. The inventory shows the
inputs and output are easy to name, but every attempt to say something
*spec-worthy* lands in the body — the steps — which AISL cannot and should not
express. The signature is writable; the meaningful part is not.

**Discriminators:**
- The hard part is the *steps that produce the result*, not where data comes from
  or what shape it must hold → realization/algorithm.
- The contract (signature) is easy and stable; all the difficulty is interior →
  AISL serves only the edge.
- A spec here would be all header and no honest body, or a body full of
  manufacturing → the recusal signal.

**Source:** Boundaries design discussion, the recuse/iterate criterion ("never
manufactures data" is the domain boundary; algorithmic substance sits outside
it).
