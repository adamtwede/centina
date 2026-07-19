# Session-Zero Test Cases — exercising fit-as-jurisdiction

## What this document is

A pick-up-and-go harness for pressure-testing the `centina-session-zero` skill,
specifically the **fit-as-jurisdiction** reframe currently under refinement.
Each case is a small, realistic design proposal chosen to stress one facet of
the reframe. A fresh agent session can start any case **by name** and needs
nothing explained — to pick up a case:

1. Read this document top to bottom.
2. Read the **"⚗️ Under refinement — NOT yet operational (fit-as-jurisdiction
   thread)"** section of `.claude/skills/centina-session-zero/SKILL.md` — the
   enumerated decisions under test, which are the source of truth.
3. Skim `docs/fit-validation.md` for the project goals, the falsifiability
   frame, and the original candidate set these cases draw from.
4. Run the named case (below) and log findings in its **Log**.

Rule 0 / 0a are **lifted** for this work — it is internal language-design (the
subject is Centina itself, not a task being specced), so the agent may draft
skeletons and thin slices here as instruments and play the human. The author
keeps every verdict.

## Why these tests exist (the goal)

The pivot dissolved fit-as-a-verdict; we are proving out fit-as-a-**jurisdiction
map**. Session-zero never recuses — it produces a skeleton for *any* idea and
labels, honestly and saliently, what it **pinned** (structural), what it
**holds and won't subdivide** (realization, routed behind a door), what's
**`@external`**, and what's left to **agent discretion**. The value on a
realization-heavy idea is that gap-hunting *localizes* the realization into a
named, bounded hole; refusing to produce that is the only real failure.

We are testing the **skill**, not producing real specs — the specs are
throwaway instruments. Cover two directions deliberately:

- **Don't over-recuse.** Realization-heavy ideas (markdown, asteroids, pricing)
  should still yield a useful skeleton that localizes the realization, not a
  refusal.
- **Don't under-find.** Sleeper ideas (crafting recipes) that look
  realization-shaped but hide a structural core should have that core surfaced
  via the genesis re-slice, not sealed behind a lazy recusal.

The load-bearing responsibility split: Centina owns the **honesty and salience
of the label**, not the **value of the idea**.

## How to run a case

Primarily an **analytical adversarial trace**, the way markdown→HTML and
asteroids were run:

1. Take the case **seed** as the prose a human brings to intent capture.
2. Walk session-zero's phases (intent → components → seams → terminals →
   skeleton) *as the skill directs*, playing a plausible human — but
   **adversarially**: try to make the skill misbehave (produce a hollow or a
   deceptively-healthy skeleton; mislabel realization as structural or vice
   versa; drag the human into over-elicitation).
3. At each gate, check the behavior the reframe predicts (see each case's
   **Predicted map**) against what the skill's text actually produces. Where
   they diverge, that's a finding.
4. When a realization hole appears, exercise the **genesis re-slice** (decision
   5): offer a nested session-zero seeded with the parent door's frozen
   contract, and see whether it surfaces structural core or bottoms out on
   verb-doors returning opaque answers.
5. Log findings under the case with a date, which decision/risk they touch, and
   any candidate lesson.

The author may instead drive a live session; the trace is the default because
it lets the agent be adversarial in ways a cooperative session can't.

## Promoting lessons (author-gated)

A finding becomes a durable lesson only with the author's approval, and lands in
one of two places in `centina-session-zero/SKILL.md`:

- **Probationary** — the "⚗️ Under refinement" section: a decision ratified in
  principle but not yet proven operationally. Most lessons start here.
- **Core** — the operational body: a decision proven across enough cases to
  become a standing directive. Promoting to core usually means *retiring* the
  probationary entry it came from and rewriting the operational text it
  supersedes (e.g. the "Don't architect a hollow skeleton" bullet, and parts of
  "Which nodes earn a spec").

The agent never promotes unilaterally — promotion is a standing-instruction
change the author signs off on. The agent's job: surface the candidate lesson,
name which decision it confirms or contradicts, propose probationary-vs-core,
and let the author rule. Record each promotion in the relevant case Log so the
lineage stays traceable.

## When a case log outgrows this doc

Most case logs are a few dated bullets and stay inline. A case that runs a deep
genesis recursion (crafting-recipes is the first likely candidate) can generate
a long mining trace — the tree, its per-hole statuses, the cursor, the diagram.
When a single case's Log starts crowding out the rest of this document, move it
to a dedicated file (`docs/session-zero-cases/<case>.md`) and leave a **pointer**
in its place here: the seed, the one-line status, and a link. This doc stays the
index a cold agent reads first; the dedicated file holds the depth.

The mining tree, cursor, and resume-by-default mechanics a deep case exercises
are **decision 7** in the skill's "⚗️ Under refinement" section — that's the
source of truth for how to track position and unwind. This doc only says *when*
to spill a bloated log; the skill says *how* the recursion is run.

## Cases

Status legend: `not-started` · `in-progress` · `closed`. A `closed` case is not
frozen — it may be **reopened** (e.g. for a live interactive pass, or when a
parent system it hangs off of takes shape), continued from where it stands or
restarted from scratch, decided at the time.

### markdown-to-html — `closed`

- **Seed:** "a CLI that reads a Markdown file and writes the equivalent HTML."
- **Pressures:** pure compute wrapped in real I/O; the empty-ledger detector.
- **Predicted map:** two filesystem terminals; one dominant realization hole
  (the parse/render), which is the point; near-zero structural core.
- **Log:**
  - 2026-07 — Empty-ledger detector **misfired**: free I/O terminals give a
    non-empty ledger. The real tell was the tasks-as-doors smell on the
    *interior* AST seam (`parse(): AST` = `getData(): Answer`). Drove decision 1
    (the axis is coverage, not structural absence) plus the "discount free
    outer-I/O terminals, test the interior seams" refinement.

### asteroids-game — `closed`

- **Seed:** "a real-time browser game: fly a ship with the arrow keys, dodge
  moving asteroids; collision ends the run."
- **Pressures:** dynamics behind a genuinely-real data store; the
  deceptively-healthy skeleton.
- **Predicted map:** input + render terminals; a real `WorldState` shape that
  pins; the `update(state, input, dt)` loop as the dominant held hole (the
  point).
- **Log:**
  - 2026-07 — Both detectors stayed silent (WorldState is a real shape → no
    tasks-as-doors smell; ledger non-empty). The skeleton looked healthy while
    the whole point sat in one held hole. Established the axis is
    coverage/proportionality, and that the agent maps **topology** while the
    **human** assigns gravity. Drove decisions 1 & 3.

### crafting-recipes — `closed` (reopenable)

- **Seed:** "a crafting system for a game: combine ingredients per recipes to
  produce new items."
- **Pressures:** the **sleeper** — looks realization/game-shaped, but recipes
  are input→output data relationships with real provenance and contract. Tests
  the over-recusal guard and the genesis re-slice from the *find-structure*
  side (does mining rescue a core a lazy recusal would discard?).
- **Predicted map:** the recipe set is a structural contract (valid-recipe
  shape, ingredient provenance, match flow); the *combination/resolution
  algorithm* is the realization hole. A genesis pass on "crafting is
  realization" should crack out the recipe graph.
- **Watch:** the empty/failure case (partial or no ingredient match) — the most
  expensive question to skip; does phase-3 seam elicitation force it?
- **Context:** crafting-recipes is really a *use case* bolted onto a larger
  "mass-energy exchange" system idea the author has in mind. Running it before
  that parent case has had real work bounds how deep it's worth going here —
  closed on the trace below, but expected to **reopen** as a live interactive
  pass (from where it stands or from scratch) once the parent system and the
  intended crafting behavior are clearer.
- **Log:**
  - 2026-07-18 — Adversarial trace (agent + a played evasive human who tried to
    collapse everything to one "crafting engine" and to describe the doors as
    algorithm verbs). **Predicted map held:** the recipe set pinned as a
    structural contract, the subset-match / consume-produce bodies were the held
    sliver, and a forced-collapse genesis pass cracked the
    Inventory/RecipeSet/resolver split back out. Four findings:
    1. **Decision 5 amended (persisted).** Its terminator only described exit (a)
       — verb-doors returning opaque "the-answer" types → mark realization. The
       sleeper exercises exit (b): mining an *illusory* realization hole
       terminates by exhausting into pinned structural leaves, with nothing to
       mark. An agent watching only for (a)'s verb-door smell reads "no smell
       yet, keep going" and over-elicits.
    2. **Decision 5 reframed (persisted).** The genesis re-slice is the
       *backstop* guard against over-recusal, not the first line; phase-2's
       provenance questions are the cheaper first-line guard that decomposes the
       "engine" before routing is even considered.
    3. **Confirms phase-3's failure-case question earns "most expensive to
       skip."** It forced the `CraftResult` shape (success/failure, and whether a
       partial match reports what's missing) and a *quantified* inventory
       (item→count) — both invisible in the "figures out what you can make" seed
       prose. No skill change; the operational text already prescribes the
       question.
    4. **Intent fork logged.** "Combine ingredients *per recipes*" is the
       structural variant; emergent/discovery crafting (combine any two, system
       decides the result) is either a bigger authored map (still structural) or
       a similarity/rule algorithm (genuine realization). Where — and whether —
       the realization sliver sits depends on this fork, so intent capture should
       surface it rather than assume. **Promoted 2026-07-18** (with
       pricing-request-handler supplying the second instance) into the "Which
       nodes earn a spec" rules-vs-computation fork note.

### url-shortener — `closed` (reopenable)

- **Seed:** "a web service where I paste a long URL and get back a short code;
  visiting the short code redirects to the original."
- **Pressures:** the bread-and-butter good-fit case Centina exists for — real
  boundaries, genuine structural core, minimal realization. A **control**: does
  session-zero produce a clean high-coverage skeleton without over-labeling
  anything as realization?
- **Predicted map:** a store terminal; a web boundary (create + resolve doors);
  the create/resolve seams pin cleanly; short-code *generation* is the only
  realization sliver (agent-discretion or `@external`); the collision and
  not-found cases pin as contract.
- **Log:**
  - 2026-07-18 — Adversarial trace. **Control passed:** the predicted map held
    exactly — WebBoundary / Shortener / MappingStore, both seams and both
    failure branches pinned, and code generation routed as a small
    agent-discretion/`@external` sliver (algorithm *not* pinned, per Rule 0), not
    inflated into a mined region. The reframe does not over-label a clean case.
    Findings:
    1. **Canonical-task over-competence (persisted → "What NOT to do").** Because
       the shortener is a famous design, the agent can recall the whole
       architecture (KV store, base62, put-if-absent) and present it as elicited
       — over-competence at its purest, hardest to see because the recalled
       answer is *correct*. The control's real value is testing whether phase-2's
       draw-it-out discipline holds against a design the agent already knows.
       Placed as an operational bullet (refines the already-core over-competence
       concept; orthogonal to the fit-as-jurisdiction thread, so not
       probationary).
    2. **Confirms decision 1 (don't over-label):** high-structural coverage with
       one named sliver, no invented realization. No change.
    3. **Confirms decision 5's "offer scaled to topological weight":** code-gen
       is a trivial leaf with no downstream, correctly *not* offered for a
       genesis pass — positive confirmation we don't mine everything. No change.
    4. **Re-confirms the phase-3 failure question** (second case after crafting):
       forced collision + idempotency, and sorted collision *detection* (a
       structural store contract — pushes a `putIfAbsent(code,url): boolean`
       door) from collision *response* (a small control decision the human owns).
       No change.

### rank-dedup-list — `closed` (reopenable)

- **Seed:** "a function that takes a list of items and returns them ranked and
  de-duplicated."
- **Pressures:** the **bare** degenerate case (no I/O wrapping) — the one place
  the empty-ledger tell legitimately fires. Tests the honest-minimal-skeleton
  output under the no-recusal rule.
- **Predicted map:** one node; signature pinned; entire body a held hole. The
  coverage statement should read, honestly, "signature pinned; everything of
  interest is the held body" — a valid output, not a recusal.
- **Log:**
  - 2026-07-18 — Adversarial trace. **Predicted map held, with a bonus:** one
    node, no seams — and the agent correctly declined to manufacture a fake
    store/reader. But phase-3 shape interrogation surfaced two structural
    contracts the seed hid — the **ranking key/criteria** and the
    **dedup-identity** — so the "bare function" ledger is thin-but-non-empty
    unless the items are primitives (intrinsic order + intrinsic equality). This
    is the case that reconciled the operational text with decision 1:
    1. **Decision 1 promoted to core (2026-07-18).** rank-dedup sits on the seam
       between the operational "empty ledger → recuse" text and decision 1's
       no-recusal rule. Rewrote the degenerate-case paragraph and the
       hollow-skeleton bullet (now "Don't manufacture seams — and don't refuse
       either") to embody it: emit the honest minimal skeleton labeled "one node,
       not a system," never refuse. Decision 1 marked promoted-in-place in the
       probationary list (kept for stable numbering of decisions 2–7 and these
       logs).
    2. **Empty-ledger definition sharpened (persisted).** "Empty" requires
       intrinsic ordering *and* equality; domain items carry a key/identity
       contract even with zero seams, so interrogation almost always finds *some*
       contract before the floor. Folded into the rewritten degenerate paragraph.
    3. **"This isn't a system" is a valid jurisdiction output, not a recusal.**
       Crystallized in the rewrite — the thin honest map delivered, not a refusal.
    4. **Rules-vs-computation fork, third instance** ("ranked" is a
       domain-judgment verb) — confirms the fork note generalizes to a seam-less
       function. No change.

### pricing-request-handler — `closed` (reopenable)

- **Seed:** "an HTTP endpoint that takes a cart and returns the total price
  with discounts applied."
- **Pressures:** textbook 2-end shape, value all in realization — the
  deceptively-healthy case in request/response clothing (vs. asteroids' game
  clothing). Does the coverage map honestly flag the pricing hole as the point?
- **Predicted map:** request/response seams and the cart/price shapes pin; the
  discount/pricing computation is the dominant held hole; genesis offered on it.
- **Log:**
  - 2026-07-18 — Adversarial trace, played human insisting the discount logic is
    opaque/proprietary (branch B). **Predicted map held:** `price(cart):
    PricedCart` and the cart/price shapes pinned, the discount computation held
    as one interior hole; the skeleton reads healthy while the point is the hole
    (asteroids in request/response clothing). Findings:
    1. **Confirms decision 1 (don't under-find)** in a second costume —
       coverage/proportionality is the axis, not structural absence. No change.
    2. **Salience mechanism — first computable form (persisted).** A held hole's
       structural weight as *interior-fraction + downstream-dominance* ("the
       entire interior of the sole orchestrator; every non-boundary node is
       downstream of it") — gravity-free, but converges with gravity on a
       deceptively-healthy case. Advanced the open "salience mechanism" bullet,
       with an explicit note to keep hunting for other such signals.
    3. **Phase-3 failure question now 3-for-3 (persisted → "Lessons from use").**
       Forced the itemized `PricedCart` breakdown + empty/invalid branches;
       joins `CraftResult` and collision/idempotency as evidence it's the
       highest-yield step in the phase.
    4. **Genesis offer doubles as a diagnostic (persisted → decision 5).** Offered
       on "pricing," it forces the human to reveal rule-set (exit b, structure
       recovered — branch A) vs. proprietary algorithm (exit a, mark realization)
       — both terminator exits in one case, and the offer's value even when not
       mining.
    5. **Rules-vs-computation fork — second instance, promoted (persisted →
       "Which nodes earn a spec").** Pricing's "configurable rules vs. proprietary
       logic" is crafting's "per recipes vs. emergent." Two instances justified
       promoting the fork to an operational tell, with its trigger spelled out
       (a domain-judgment verb whose governing knowledge the seed leaves
       unlocated; counter-tell = nobody authors/tunes an intrinsic computation).

### oauth-callback — `closed` (reopenable)

- **Seed:** "handle the OAuth redirect: the provider sends us back a code, we
  turn it into a session for the right user."
- **Pressures:** provenance-heavy — Centina's strongest wheelhouse. The real
  ambiguity is *what's trusted and where identity enters*, not an algorithm.
  Tests that the reframe doesn't **over**-label provenance work as realization.
- **Predicted map:** high coverage; provider + session-store terminals; the
  trust / identity-entry seams are the substance and pin as contract;
  realization minimal. A "clean fit" control from the provenance side.
- **Log:**
  - 2026-07-19 — Adversarial trace. **Control passed:** the trust chain pinned as
    structural contract (state consumption/CSRF, single-use replay, claim
    validation, identity key `sub`, first-login provision-vs-reject, session
    establishment); only the crypto signature primitive routed `@external`. The
    reframe does **not** over-label security/crypto-flavored work as realization.
    Findings:
    1. **Rules-vs-computation fork, fourth instance + refinement (persisted).**
       The fork's two halves can **co-occur in a single verb**: "verify the
       token" bundles a trust-rules contract (which claims from which source must
       match what — structural, pins) *and* an opaque crypto primitive (routes
       `@external`). Collapsing both into one realization hole loses the
       provenance substance behind a door. Added validation/"verify" verbs to the
       fork note as the canonical co-occurrence case, with the two-halves
       interrogation ("verified *against what*, establishing *what trust*?").
    2. **Confirms decision 1's precision from the provenance side** (the control's
       point): trust decisions are named-data relationships, so Centina pins them
       — no over-labeling. No change.
    3. **Canonical-task over-competence re-confirmed** against the hardest case
       (OAuth is maximally famous): "where does the state come from?" is the
       elicitation that must beat recall. Validates the existing "What NOT to do"
       bullet. No change.
    4. **Phase-3 failure question, fourth instance** — forced the trust branches;
       bumped the "Lessons from use" evidence to four cases.

### metrics-emitter — `closed` (reopenable)

- **Seed:** "collect metrics from the app and flush them to a sink every N
  seconds."
- **Pressures:** egress/dynamics overlap — the metric *shape* is structural but
  "every N seconds" is dynamics. Does session-zero pin the metric contract and
  route the *cadence* out?
- **Predicted map:** a metric contract + sink terminal pin; the flush cadence
  routes to `@external`/dynamics; partial coverage, cleanly split.
- **Log:**
  - 2026-07-19 — Adversarial trace. **Predicted map held:** `record(metric)`
    ingress and `flush(batch)` egress pinned (Metric shape, sink-loss policy),
    the every-N-seconds cadence routed `@external` as dynamics — a clean split of
    a genuinely mixed node. Findings:
    1. **Generalized principle persisted — "a node can straddle both planes."**
       "Flush every N seconds" bundles a structural egress action + a dynamics
       cadence, the same shape as oauth's "verify the token" (trust contract +
       crypto primitive) on a different plane-pair. Lifted the co-occurrence idea
       out of the fork note into the two-planes lens as a standalone principle
       (split on the seam, don't collapse), with both cases as examples; the fork
       note now points at it.
    2. **Confirms the coverage-not-binary axis on a genuinely mixed node** (prior
       cases were dominantly one plane). No change.
    3. **Provenance sub-finding:** "who assigns the metric timestamp — caller or
       collector?" is a provenance decision the seed hides. Log-only.
    4. **Phase-3 failure question, fifth instance** (the sink-loss policy: drop /
       retry / grow the buffer). Lesson already established at four; logged here,
       *not* re-bumped in the skill to avoid churn.
- **Predicted map:** a metric contract + sink terminal pin; the flush cadence
  routes to `@external`/realization; partial coverage, cleanly split.

## Backlog (heavier / lower-priority candidates)

Run these once the simple set has exercised the reframe; they carry more
minutiae, or are real anchors rather than clean probes.

- **turn-based vs free-form movement** — the slice-relativity case (same system
  reads 2-end or 0-end depending on where you slice). Good for the
  topology/slice caveat, but subtler than the simple set.
- **monorepo dependency-impact tool** — adversarial real: looks 2-end, center of
  gravity is dependency-graph traversal (algorithm). The original
  classified-fit-but-no-value probe; now a coverage-honesty probe.
- **feedback pair** (`encode_feedback` + `task_matcher`) — the real anchor from
  `fit-validation.md`; partial-fit with a matching core. Heavier, and also the
  head-to-head (prose vs Centina) baseline candidate.
