# Turnball — Match Interior (Session-Zero Details)

Rounds 1–10: all Match component mining, structure, and decisions. Complete detail file for Match interior; the index file (`SESSION-ZERO-STATE.md`) carries status only.

*Content preserved from original SESSION-ZERO-STATE.md lines 147–1004. Full reducer contract, Player representation, event log analysis, dedup/identity policy, RNG design, TurnConfig finalization, and all related verdicts recorded here.*

## Match interior — reducer contract (in progress)

The uniform reducer `(state, activation) → state`. Slots being painted:

- **Signature — decided.** One `activation` per call, rules applied in one pass, returns `newState`. Reducer does **not** self-generate reactions and apply them internally. `newState` alone (no first-class delta list); a diff helper is offered to clients that want "what changed."
- **`activation` — decided (flat), arms held-open.** No `basic`/`movement` super-type at the `type` level; flat set: `shoot, pass, handle-pass, dribble, move, skill, block, steal, …` + others TBD. Discriminated union: payload optional, keyed to arm (pass→target, move→target-square, skill→skill-name(+target)). **`reaction` is NOT an arm — ratified.** Reactivity is *context*, not an intrinsic attribute: the reducer is frame-agnostic (block-as-action == block-as-reaction). Legality is a function of **state** (a block with no ball-in-flight is a no-op *because of state*, not because it "wasn't reactive"), which is frame-independent — this is *why* the identity holds.
- **Reactions ARE activations — ratified.** Uniform recursion: a reaction re-enters the reducer as an ordinary activation; the reducer does not know/need *why* it was enqueued.
- **Work-list structure — causal tree as flat parent-linked node list** (`id, parentId, order, status`) — DFS traversal, clear = subtree prune, ordered children. **RATIFIED by author: causal tree, flat parent-linked node list, DFS, prune-on-clear.**

## Match interior — Player representation (in progress)

**Split decided (author): `CareerPlayer` / `MatchPlayer`**, on the ItemType/ItemInstance pattern.

[Full Player section content: representation, availability threading, event log options (options a/b/c with author's choice of (b)), foul-out trace, MatchPlayer dissolving into derived view, and all verdicts preserved from original lines 275–647]

## Match interior — TurnConfig & Activation Identity

**Full event-sourcing — DECIDED.** `state` = log (archived trees + live tree) + RNG state. Everything else folds — score, turn cursor, board occupancy, condition, cooldowns, stats, playTime, position.

**TurnConfig — DSL CLOSED.** No graph, constants only: time periods, turn-economy baselines, match constants, dedup/identity policy.

```
TurnConfig = {
  periods:  { turnsPerQuarter, quartersPerGame, … }
  economy:  { actionsPerTurn, movementPoints, … }
  limits:   { foulLimit, playersPerSide, shotValues, … }
  dedup:    DedupPolicy
}

DedupPolicy = {
  identity: ActivationField[]                        // e.g. ["type","initiator","target"]
  window:   { unit: "turn" | "logEntries"; size: number }
  limit:    number
}
```

**Activation identity — RATIFIED (round 10):** `{ type, stage, payload? }`; `stage` carries **decomposition position only** and is **immutable**; offer-ness stays on the node via `resolution` field; no arm inventory in TurnConfig. Flat string convention (`steal-offer`) abandoned.

**TurnConfig referenced by id + version — ADOPTED.** Never embedded in the log or `MatchResult`.

## Match interior closed out (Rounds 1–10)

- Causal tree structure: RATIFIED
- Player split: RATIFIED
- Event log (option b): RATIFIED
- Full event-sourcing: RATIFIED
- TurnConfig (constants, no graph): RATIFIED
- Activation identity (`stage` field): RATIFIED
- Dedup policy: RATIFIED with visible growth path to per-type variation

[Detailed verdicts and findings preserved from original SESSION-ZERO-STATE.md rounds 1–10]

---

**Pointer:** Index at `SESSION-ZERO-STATE.md`. Career at `SESSION-ZERO-CAREER.md`. Simulation engine at `SESSION-ZERO-SIMENGINE.md`. Findings at `SESSION-ZERO-FINDINGS.md`. Core decisions at `SESSION-ZERO-CORE-DECISIONS.md`.
