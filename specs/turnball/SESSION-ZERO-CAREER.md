# Turnball — Career Interior (Session-Zero Details)

Round 11: Career component mining and enumeration. Complete detail file for Career interior; the index file (`SESSION-ZERO-STATE.md`) carries status only.

## Career interior (round 11 — cursor here)

**Established already, before mining** (carried from the Match rounds — facts, not guesses):

- Career **orchestrates** Match; owns the **finish-first** rule and **reset-on-abandon**.
- Door: `Match.playMatch(home: Team, away: Team, …): MatchResult` — return union `Complete | Unfinished(partial) | Abandoned` (decided).
- `CareerPlayer` is Career-owned, referenced from match state by **uuid** through a read-only boundary; carries the listed position (kept current by the heuristic) and career-scoped statuses (**injury, suspension**).
- **Match → Career write-back** at match end: stat rollup, position heuristic, new injuries. Payload = the `MatchLog`.
- **`Archive`** (new node, round 4): rolls old match logs into stat rollups on a configurable schedule; rollup schema = what a career can permanently know. Career↔Archive agreement deferred.
- **`CareerPersist`** — placement (inside Career vs separate) still open.
- `Team = { roster: Player[]; name: string; kit: Kit; stats: Stats }` — decided, members held. `roster` term-collision watch.
- **Re-root candidate still pending:** Shell / Mode-Select above Career (decision-9).

### Round 11 — author's enumeration (interior opened)

Agent did **not** enumerate; the author supplied the list unprompted. Two lists: **MVP** (matches, non-player match simulation, lineups, positions, simplistic training, drafts/free-agency/trades, a financial/resource system) and **NTH** (in-match simulation mode, plays/schemes, involved training).

- **What makes it a career rather than a series of matches — author's word: *affinity*.** Shepherding a team toward success, testing strategies, acquiring players, cutting or trading underperformers. *Agent note (form):* this is a **design-intent invariant**, not a component — worth carrying as the tiebreaker when Career-level forks come up, the way "anti-save-scum" served the Match rounds.
- **End condition — NONE. DECIDED.** The player quits when they want. A win-condition system is possible later, low priority.
- **Career state model — STATEFUL** (author's starting position; "could go either way, but stateful seems slightly more likely").
- **Re-root — FIRED. Mode-Select adopted provisionally.** Career is not the top node.

### The event-sourcing fork, resolved by the no-end-condition decision

The fork the agent posed (career-level log vs genuinely stateful) is **no longer balanced** — "no end condition" settles it, and for a reason worth recording:

- Match's event-sourcing works because a match is **bounded** (thousands of activations, a guaranteed end). A career is **explicitly unbounded**. A source-of-truth log that never terminates has no scale ceiling, and every derived read gets slower forever.
- `Archive` was already specified as **lossy by design** — it *destroys* log detail on a schedule. That is flatly incompatible with "the log is the source of truth."
- So: **Career state is authoritative; match logs are a discardable tail.** Archive is therefore **load-bearing, not an optimization** — it is the mechanism that keeps an unbounded career finite. Promote it accordingly.
- *Non-obvious consequence:* the Match↔Career asymmetry is now principled rather than accidental — **bounded scopes event-source, unbounded scopes accumulate state.** That is a reusable test, and worth watching as a candidate finding.

### ⚠ The biggest fork in the list: simulating non-player matches

Author named two *different* simulation things; they may share one axis or may not:

1. **MVP — non-player match simulation.** Described as "a simplistic simulation layer." The rest of the league has to play games while you play yours.
2. **NTH — in-match simulation mode.** Semi-interactive; a CPU drives *your* side, you observe or act as coach.

**The unifying observation (form, not meaning):** Match already has **offer nodes** — `resolution: optional | mandatory` produces a node awaiting an answer. Everything about "who is playing" reduces to **who answers the offer node**. If the answerer is a pluggable policy (human / CPU), then (2) is nearly free and (1) is the same reducer with both sides on CPU. That would be a very high-leverage collapse.

**But the author's word "simplistic" cuts against it,** and this is the real tradeoff:

| | Pluggable answerer (one engine) | Separate cheap sim (two paths) |
|---|---|---|
| Fidelity | League games resolve by the *same* rules as yours | League results may diverge from what the real rules would produce |
| Cost | Full reducer run × every league game, every match-day | Cheap — a stat-vs-stat roll |
| Logs | Every league game produces a full `MatchLog` | League games produce a **result only**, no log |
| Derivation module | Serves league games for free | League stats need a **second** shape — Archive/rollups now have two sources |
| Rules drift | Impossible by construction | Two definitions of "how basketball works" that can silently disagree |

**The decisive question is not cost — it is whether a league game has a `MatchLog`.** That single answer determines whether `Archive`, the derivation module, and stat rollups have one shape or two. **Author content. Open.**

*Hybrid worth naming before it is ruled out:* one engine, two **answerer** policies, plus a separate cheap **resolver** used only for games nobody will ever inspect — with the option to "promote" a game to full simulation. Keeps one rules definition; still two result shapes.

### Named hole: acquisitions imply something outside your roster

Drafts, free agency and trades all require Players who are **not on your team** — and trades require *other teams* that own them. Nothing in the tree currently holds those. This is a **missing node**, not a missing field. What it is, what it holds, and whether it is one thing or several is **author content**. Recorded as a hole, not proposed.

Related: **all three transactions share a shape** — a proposed roster change, validated against a constraint, then applied. Whether that becomes one seam or three is open, but the constraint slot is the same slot the financial system fills (below).

### Financial / resource system — three candidates, structurally different

Author is undecided on form and asked all three be recorded. They are *not* variations of one design; they differ in **what is stored**:

1. **Simplistic funds** — performance awards money, with balancing nuance. Stores a **balance**, mutated by events over career time.
2. **Involved / league-realistic** — contracts, caps, luxury tax, etc. Stores a balance **plus a contract per player**, plus their time evolution. Largest surface by far.
3. **"NASCAR" caliber cap** — a universal cap measured against roster *caliber* (expected strength from total Player stats). **Author leans here** — simplest, and closer to the intended experience.

**Agent note (structural, no verdict):** (3) is categorically different from (1) and (2) because it **stores nothing**. Caliber is a *fold over the current roster's stats* — a derived check evaluated at transaction time, exactly the derived-view pattern used throughout the Match rounds. (1) and (2) introduce Career's first genuinely **accumulated resource**. So this choice is not just "how complex" — it decides whether Career gains a stored economy at all. Reversibility: (3) → (1) is additive and cheap; (2) is the one that is expensive to reach later.

### ⚠ Tripwire: plays / schemes (NTH) vs F8's closed DSL condition

F8's B→DSL flip-condition was **closed** in round 7 on the grounds that TurnConfig had no graph left to express. **Plays and schemes are exactly the kind of content that would reopen it** — a pick-and-roll or a zone defense is conditional, multi-actor, sequenced behavior. It is NTH and undeveloped, so nothing to do now, but F8 should be treated as *conditionally* closed rather than retired. Flagged, not acted on.

### New open seam created by the re-root

Mode-Select invoking Career means **Career needs a top door**, symmetric to `playMatch`: what Mode-Select passes in, and what comes back (Career is open-ended, so "returns when finished" does not apply the way it did for Match). Also unresolved: whether the earlier **what-if mode** and the NTH **simulation mode** are Mode-Select's business or Career's. Open.

## Round 11c — League node mining (cursor here)

**Named hole from MVP acquisitions:** drafts, free agency, trades all need a player pool and other teams. **League is the missing node.**

**Open questions for author (Rule 0 — no enumeration):**

1. **What does League own?** Not a placeholder list — what is it responsible for, orchestrates, or tracks?
2. **What does Career ask League for?** What are the door shapes (invoke signatures, payloads)?
3. **Does League talk to Match directly, or only through Career?** If non-player matches simulate, does League invoke Match, or is there a separate path?
4. **Node or boundary?** Does League earn its own spec, or is it more of a coordinator/utility living elsewhere?

**Related:** All three acquisition transactions (draft/free-agency/trade) share one shape (propose → validate → apply), and the constraint slot is where the **financial system** lives. Three candidates recorded in round 11: (1) simplistic funds, (2) realistic contracts/caps, (3) caliber cap (author leans here). Choice is open.

---

**Pointer:** Index at `SESSION-ZERO-STATE.md`. Match at `SESSION-ZERO-MATCH.md`. Simulation engine at `SESSION-ZERO-SIMENGINE.md`. Findings at `SESSION-ZERO-FINDINGS.md`. Core decisions at `SESSION-ZERO-CORE-DECISIONS.md`.
