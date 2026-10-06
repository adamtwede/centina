# Session zero: which nodes earn a spec

Read by `centina-session-zero` before it classifies any node (phases 2 to 4).
Moved here verbatim from the skill so the skill stays under the post-compaction
cap (`ROADMAP.md`, "Skills over the post-compaction cap").

## Which nodes earn a spec: routing, not gatekeeping

Not every responsibility the human names wants to become a filled-in component.
Some are **terminals** (they meet existing technology — route to `@external`),
some are **Skills** (they turn on a runtime agent's judgment), and some are
held **internal processing** (an algorithm the human writes at fill, routed as
a `deferred<"unimplemented">` hole behind a door). Deciding which is which _is_
the classification work of phases 2–4, and it has a lens.

**The two planes.** Read every node on two planes and ask where its center of
gravity sits:

- **Structural** — _relationships between named data_: provenance (where data
  enters, from whom), flow (how it moves between seams), contract (what shape
  must hold). All describable as "X comes from Y, in shape Z, connects to W."
  This is what a spec captures, so a structural node earns a filled component.
- **Realization** — _carrying-out_: algorithm (how it's computed), dynamics
  (how it behaves over time), aesthetics (how it's perceived). None reduces to
  a nameable data relationship. A realization-dominated node is **not
  rejected** — it is **routed behind a door** (terminal, Skill, or held hole),
  and the spec keeps only the seam around it.

That "routed, not rejected" is the post-pivot shift, and it's why session zero
carries this judgment rather than a separate gate owning it. Before Centina had
routing primitives a realization-heavy task had nowhere to go, so fit was a
binary admit/reject asked before any spec was written. Now the routing
primitives _are_ the answer: realization goes behind a door, and the only thing
left to decide per node is whether anything structural remains once it does.

**A node can straddle both planes — split on the seam, don't collapse it.**
"Center of gravity" isn't always a whole-node verdict: one responsibility often
bundles a structural half and a routed (realization / dynamics / external) half,
and the move is to split it at the seam between them rather than label the whole
node one way. Two seen in the test cases, on different plane-pairs:

- _verify the token_ (oauth-callback) = a **trust-rules contract** — which
  claims, from which source, must match what (structural, pins) — plus an opaque
  **crypto primitive** (the signature math, routes `@external`).
- _flush every N seconds_ (metrics-emitter) = a **drain-to-sink egress action**
  (a structural seam) plus a **cadence** (the every-N-seconds trigger — dynamics,
  routed `@external`; N itself is a config parameter).

The failure is collapsing both halves into one hole: route the structural half
behind a realization door and you lose the substance (the trust contract, the
egress contract); pin the routed half and you over-reach into algorithm or
dynamics. Interrogate the seam — "what part of this is a named-data relationship,
and what part is the carrying-out?" — and route each half on its own plane.

**The tell that a node is realization all the way down** is the
**tasks-as-doors smell**: a door you can't name without an implementation verb
(`computeLayout()`, `stepPhysics()`, `rankResults()`), or a door that keeps
collapsing to `getData(): Answer` where the return shape _is_ the whole problem
restated. A real seam names a data affordance and a shape; a fake one names a
step in an algorithm. It surfaces in phase 3, when the human tries to say what
crosses a door and can only describe how the far side computes.

**The complement — the rules-vs-computation fork (a sleeper's trigger).** Before
you route a domain-judgment verb as realization, locate the knowledge that
governs it. The trigger to ask is exactly this shape: a verb that _applies /
matches / resolves / selects over domain items_ (`applyDiscounts`,
`combinePerRecipes`, `matchTasks`, `selectPlan`) whose governing criteria the
seed leaves implicit inside the verb. Ask: **is that knowledge configurable
data/rules the system reads (a rule set, a recipe table, a policy config —
provenance you can point at), or a fixed computation?** Domain-authored
knowledge — even if currently hardcoded — carries a latent rule-set contract,
which is structural and mineable via the genesis re-slice (the crafting and
pricing sleepers both hid one here). A fixed _intrinsic_ computation — a sort
comparator, a physics step, a hash, rendering — has no author and no latent
contract; that's genuine realization. The counter-tell that it's genuine
computation: nobody would author or tune the rule (you don't configure gravity).
Surface the fork the moment such a verb appears; the answer decides whether
there's structure to pin or a realization leaf to mark.

The rules-vs-computation split isn't always _either/or_: a validation / "verify"
verb typically carries **both** halves — a trust-rules contract (structural, it
pins) and an opaque crypto primitive (`@external`). That's an instance of the
straddle-both-planes principle above; "verify the token" is the canonical case
(`iss`/`aud`/`nonce`/`exp` and the identity key are the contract; the signature
math is the primitive). Interrogate the verb into its two halves — "verified
_against what_, establishing _what trust_?" — and route each on its own plane
rather than letting the crypto flavor drag the provenance substance behind a door.

**The degenerate case — a whole "system" that's really one node.** Pure compute
(a parser, a sort, a pricing calc), a real-time/dynamics core (a physics or
animation loop), or an aesthetics-dominated task (visual design, copy tone) can
_each_ be routed behind a single door. When routing it leaves nothing else,
there was no system to architect — but that is **not a recusal**. You still emit
a skeleton: the one node's signature pinned, its body held, and an honest label
saying "this is one function/algorithm, not a system — you likely didn't need
session zero for it." Producing the thin honest map _is_ the output; refusing to
engage is the verdict-era reflex the jurisdiction reframe retired. Deliver the
map and let the human decide whether it was worth the trip.

The tell that you're at this floor is a near-**empty contract set** — but
"empty" is rarer than it looks, and interrogation almost always finds _some_
contract before the floor. A "bare function" like rank-and-dedupe hides a
**ranking-key** and a **dedup-identity** decision; those are named-data
contracts even with zero seams. The contract set is _truly_ empty only when the
items' **ordering and equality are both intrinsic** (primitives — numeric sort,
value equality). Otherwise phase 3's shape interrogation yields the key/identity
contracts and the skeleton is thin-but-non-empty, not hollow. Either way the
move is identical: pin what interrogation surfaces, hold the algorithm, label
the coverage honestly — never manufacture seams to fake a DAG, and never bounce
the human with a "bad fit" verdict. (The whole-DAG view is more robust than
counting boundary-ends on a single slice, which flips with where you draw the
slice; it turns the 0-end case into a structural fact rather than a
slice-relative guess.)
