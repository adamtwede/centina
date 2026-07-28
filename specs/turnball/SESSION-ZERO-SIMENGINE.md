# Turnball — Simulation Engine (Session-Zero Details)

Round 11b: Simulation engine architecture and decisions. Complete detail file for simulation engine interior; the index file (`SESSION-ZERO-STATE.md`) carries status only.

## Round 11b — simulation engine architecture

**CPU answerer:** A simple statistical heuristic. If `successProbability > 50%`, answer "accept"; else "decline". Built now to receive `successProbability` as a parameter (even though simple) so plays/schemes can later plug in a more complex analysis without restructuring.

**Answering Service (boundary node):**
- Takes: `offer: Activation`, `policy: AnsweringPolicy`, `onNeedsHumanInput: (offer) => Promise<"accept" | "decline">`
- Returns: `Promise<"accept" | "decline">`
- Logic: if policy routes player to CPU, apply heuristic; if to human, call callback
- Consequence: boundary is pure in logic, async in execution; doesn't know about Presentation

**Policy ownership (Option A):** Engine is mode-aware and selects the policy to pass. Policies are data-only (routing rules); callbacks stay in Engine.

**Example policies:**
- **Coach mode:** team-level offers → human, player-level offers → CPU
- **Spectator mode:** all offers → CPU
- **Background sim:** all offers → CPU (no UI)
- Data-only; routing is procedural (`policy.decideRoute(offer)`), not embedded

**Callback embedding deferred.** Current pattern (policy + callback separate) is strong enough. Policy manager is a future thing; if it emerges, a data-only interpreter can map symbolic callback names to implementations later. Don't pre-pay for policy authoring or composition now.

### Three decisions closed (round 11b):

- **Answering Service placement: Standalone node (Option 1).** Focused responsibility; testable; doesn't grow Engine; matches pattern of Match/Presentation/Archive. Engine calls it with (offer, policy, onNeedsHumanInput).
- **Success probability:** Computed in reducer at offer production time, attached to activation payload. Assumption: match state + rules sufficient (MVP). Additive if later needs more.
- **Offer suspension/resumption (Option A):** Offer stays in live tree (not snapshotted). Resume re-evaluates (re-runs reducer to produce offer deterministically). Tree drains at commit as designed. RNG cursor is in snapshot and replays identically, so re-production is deterministic re-derivation, not a replay violation.

### Remaining for simulation engine (open):

1. **Reactive offers (multi-sub-step) — SETTLED.** Use `DedupPolicy` identity projection to check if the same defender is offered the same activation type/initiator/target during two sub-steps. If dedup window/limit say "block this," the second offer doesn't enqueue. Direct reuse of existing decision.

2. **Integration with Match event log — SETTLED.** Log the offer activation + its resolution. **Unresolved offer re-entering reducer (pathological):** apply Option C — resolve internally with the active policy's CPU heuristic (same as if it were offered fresh). Also log it as a debug error-event in the log (separate from normal play-by-play) so it's visible in audit trails without breaking replay logic.

3. **Three modes (coach/spectator/background) — SETTLED.** 
   - **Coach mode:** Player can perform career-level actions during the match (e.g. substitute players), in addition to the match-level play decisions (offers). Other career actions (trades, training) are mode-specific—open.
   - **Spectator mode:** Observer only; all offers go to CPU, no player input.
   - **Background sim:** Observer only, no UI; all offers go to CPU, logs accumulate.
   Other mode-specific differences possible but unknown for now; surfaced during implementation.

---

**Pointer:** Index at `SESSION-ZERO-STATE.md`. Match at `SESSION-ZERO-MATCH.md`. Career at `SESSION-ZERO-CAREER.md`. Findings at `SESSION-ZERO-FINDINGS.md`. Core decisions at `SESSION-ZERO-CORE-DECISIONS.md`.
