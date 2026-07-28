# Turnball — Findings (Session-Zero Details)

All findings from the scope-limit run. Index file (`SESSION-ZERO-STATE.md`) carries only a pointer.

## Findings (cont.)

- **F1 — phase-2 altitude ambiguity.** "Name the components" presumes a flat cut; a whole game is layered. Drove decision 8.
- **F2 — descent-only tree vs start-mid-stack method.** Author starts at a sensible middle layer and relocates as we go; drove decision 9 (re-root, mono-directional).
- **F3 — placement resolving via seam, not declaration.** `MatchPersist` surfaced as a Match collaborator through phase-3 interrogation, not by being declared.
- **F4 — presentation carve leaking.** `kit: Kit` (presentation data) rides inside the core `Team` spine; complicates the "presentation = clean downstream consumer" hypothesis.
- **F5 — partial-freeze.** Match descends with its Career door frozen but its Presentation + MatchPersist edges only provisional (blocked on unsettled neighbors). "Start descending before the layer's seams are pinned" is only partly possible.

## Findings (round 6+)

- **F6 — configurable turn-machinery is a rules-vs-computation straddle (positive fit).** Author wants the turn *arrangement* tweakable in the prototype. That's a latent rule-set contract → **structural, pinnable**: TurnConfig shape + a turn-component contract (uniform iface floated, open) + reaction-timing contract (own/opp/both). The turn *engine* that reads config and executes, plus ball-physics, route as REALIZATION doors. The specific turn sequence becomes a *value* of TurnConfig, not spec structure. Tweak-surface is intra-activation; the fixed frame is one-Player + alternating (core decisions above).

- **F7 — framing slip caught (over-competence-adjacent).** The "walk me through a single turn" nudge baked in a fixed-sequence assumption the author's design rejects; author caught it. Not confabulated content, but a framing lean in the watched direction. Right elicitation = "shape of TurnConfig + component contract," not "the sequence." **Tempered by author feedback:** framing assumptions are near-the-line and the experienced audience is the *designed* backstop; the quarry is *content* assumptions (unstated concretes). Distinction folded into the skill's `🔬 Debug` section (content-vs-framing).

- **F8 — the turn-mechanism fork resolved into two orthogonal axes, not three rival options.** The three floated options ((a) uniform component contract, (b) heterogeneous + arrangement graph, (c) rules DSL) collapsed under a tradeoff-with-priorities aside into: **Axis A — component *interface*** (uniform vs heterogeneous) and **Axis B — how the *arrangement* is expressed** (hardcoded / config-data / DSL). Option (a) answered A; (b)+(c) answered B. The "uniform-contract ≈ state machine" guess was corrected: uniform contract = a **reducer** signature; the *arrangement* is what's naturally a state machine/graph. Author's decisions:
  - **Axis A = uniform reducer** — familiar pattern; god-interface risk judged acceptable (mitigable via thin shared seam + discriminated inner payload).
  - **Axis B = config-data** (declarative phase/transition graph), DSL deferred as premature (AISL-pivot lesson: don't build a language before the simpler tool strains).
  - **Flip-conditions on watch** (author-endorsed): flip A→heterogeneous only if the component set proves small+stable enough that per-component type precision is nearly free; flip B→DSL only if config-data *visibly strains* under combinatorial trigger/precondition logic. Watch, don't pre-pay.
  - **UPDATE (round 7): the B→DSL flip-condition is CLOSED by the author.** TurnConfig resolved into constants + one dedup/identity policy, with no graph left in it, so there is nothing for a DSL to express. Watch item retired.

- **F9 — the A/B/C reaction-resolution fork untangled into two orthogonal axes + a rejected strategy** (see "Match interior — reducer contract"). Author's A/B/C framing crossed *queue-location* (contract) with *enqueue-timing* (realization) and treated dynamism as opposed to purity. Untangling: queue-in-state (B) is a contract choice; precompute-vs-JIT is engine-internal (held behind the TurnEngine door); **B + JIT recovers C's dynamism without a contract commitment**. Rewind rejected in favor of causal-ordered transient states. This is a clean case of the **session-zero stop-heuristic doing work**: the resolution *strategy* stayed routed behind the realization door while only the *contract shape* (queue field, activation status, newState-alone, reactions-as-activations) got pinned. The author explicitly invited option-mapping here ("present would-be confabulations as options"); verdicts (B?, reaction type-vs-context, undecided-status) left open.

---

**Pointer:** Index at `SESSION-ZERO-STATE.md`. Match at `SESSION-ZERO-MATCH.md`. Career at `SESSION-ZERO-CAREER.md`. Simulation engine at `SESSION-ZERO-SIMENGINE.md`. Core decisions at `SESSION-ZERO-CORE-DECISIONS.md`.
