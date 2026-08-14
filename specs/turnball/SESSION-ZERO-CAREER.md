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

### Round 11c continued — Player contracts; schedule-advance interior; League-as-factory proposal

**Decided:**
- `Player` contract — minimally `{ team: Team (rights holder); duration: … }`. Required for free agency to function at all; author judged doing without it would also hamper trading/drafting/cap enforcement in ways hard to retrofit later. **Corrects a round-11 SIMENGINE claim:** the caliber-cap financial candidate was described as "stores nothing" — no longer accurate as stated, since all three financial candidates (funds / realistic contracts / caliber cap) now sit atop this required contract ledger regardless of which governs cap *enforcement*. Caliber-cap can still be how spending against the cap is computed; it just isn't storage-free anymore.
- Standings tiebreaker criteria — routes to a **policy**, same pattern as Match's offer-activation/dedup policies (round 1–10). Shape-only; no material rule needed yet.
- League structure: divisions of 3–6 teams (soft bounds, ±1–2 slop for expansion/reorganization) — a starting point, not hard numbers.
- Season boundary: calendar advancement disables once no matches remain after the cursor. Season-to-season transition explicitly **deferred** — out of scope for single-season advancement.
- Playoffs: deferred in detail (qualification rule, bracket mechanics). Structurally a **second schedule phase** — its own generation + elimination rules layered on the same cursor-advance mechanism — so the deferral doesn't require redesigning the regular-season mechanism later.

**Design-intent note (non-binding, parallel to Career's "affinity" note from round 11):** contract length may factor into team caliber — a duration cost mirroring real-world cap treatment of long-term deals, meant to discourage locking up high-caliber players cost-free. Explicitly optional; to weigh in whichever cap formula gets designed, not resolved now.

**Structural/realization split, schedule-advance interior (from the author's operation sketch):**
- Structural (pins): `League = { divisions: Division[] }`, `Division = { teams: Team[] }`; `SeasonCalendar` (day → matchup mapping) with a `cursor: currentDay`; `Matchup` (members held); `Standings` as a **derived view** (fold over completed results, not stored state — consistent with the project's existing derived-read pattern); playoff qualification as a selection rule over teams (structural even though undeveloped).
- Realization (routed, held/`deferred` candidate): the **matchup-generation algorithm** — satisfying "everyone plays everyone at least once, rivals maybe twice, evenly spread" is a scheduling/constraint-satisfaction algorithm. The constraints themselves are structural parameters; producing a valid calendar from them is compute. One real realization pocket in an otherwise structural interior.

**~~Proposal (superseded): League-as-factory.~~** League hands off a `Schedule` value; Career owns/drives it thereafter. **Retired by the author in the same round** — a private Career-held copy of the schedule creates a dual-source-of-truth problem (either Career has to keep League updated on every result, or League has to track its own stale reference to what it handed off). Kept here for the record only; superseded by the live-service design below.

**Decided — League-as-live-service (supersedes the factory proposal).**
- League **retains** the live calendar/`Schedule` as its own state — never handed off as an owned value. Same discipline already established for Match/Archive (one authoritative holder; everyone else interacts by request/response, never a private copy).
- Confirmed collapse survives this revision: Career still runs all match simulation itself, through its existing Match relationship, using a CPU-side answerer for non-player sides (round 11's pluggable-answerer idea). No League↔Match edge; no shadow-Career node.
- Author's sketch of the door pair (Career-side pseudocode):
  ```
  matchups = League.advanceCalendar(interval): Matchups
  results  = simMatches(matchups)              // Career, via Match
  updatedCalendar = League.updateCalendar(results): MatchupCalendar
  ```
- League owns the schedule-generation source data (a league-structure description — baked-in default and/or persisted config, read by League). This is *also* why League earns separation from Career even though the calendar-building step alone wouldn't justify a node: it's not League's only responsibility.
- Trades/free-agency/draft: **confirmed** self-contained-leaning — a player-initiated trade proposal needs a `Career → League` door; a non-player team's accept/reject decision machinery is League-internal and opaque to Career (League may report likelihood/rationale, never the mechanism). Symmetrically, when the human's own decision is needed (e.g. a counter-offer), League hands back to Career — the human's decision is equally opaque to League. Same boundary-as-a-person shape as the Career↔player edge elsewhere.
- **Decided — `advanceCalendar`'s `interval` semantics:** calendar granularity is whole days, minimum one-day advance. `Matchup` carries a **time-of-day** member — the same-day simulation order when a day holds multiple matchups (new structural detail on the held `Matchup` shape). Halting at the player's own match is **entirely Career's responsibility** — League never needs "the player" as a concept, reinforcing the boundary. **Sequencing invariant:** League should refuse a further `advanceCalendar` call until Career has `updateCalendar`'d every result from the prior interval — synchronous, one outstanding interval at a time, closing a sync-drift edge case. Not expressible in a single door's type signature (it's a cross-call sequencing constraint); needs an explicit note at fill rather than a type.
- **Decided — Presentation's calendar read:** Career relays `updateCalendar`'s return to Presentation; nothing else talks to Presentation while in career mode (outside an active Match). Sharpens Presentation's edge: its career-mode upstream is Career alone.
- **Decided — League survives as a node:** reaffirmed by both author and agent — draft player-generation and league-wide roster/rights visibility are naturally League-scoped regardless of the schedule-ownership design.
- **Corrects round 11: League, not Career, is the authoritative holder of roster/stat data for every team in the league** (surfaced via the Caliber discussion below — League needs every team's stats to value trades, and Career needs every team's full roster to run `simMatches` for non-player matchups, not just its own). `Matchup` (returned by `advanceCalendar`) therefore carries full `Team` data, not just identifiers — no new door, just a shape clarification on an existing one. The chain: League (holds) → Career (reads per-matchup batch via `advanceCalendar`, passes to Match) → Match (still reads `CareerPlayer` read-only by uuid, per the original round 1–10 boundary) → results → Career → `updateCalendar` → League.
- **Confirmed — offer-node resemblance is a recognized pattern, not literal reuse.** A human-decision-pending trade rhymes with Match's offer-node shape (something paused, awaiting an answer from a pluggable answerer); more broadly, Career's synchronous turn-like calendar-interval loop rhymes with Match's reducer loop. Recorded as system-level design vocabulary worth recognizing when it recurs, not a mechanism to be shared across nodes.
- **Considered and declined — routing all Match invocation through League instead of Career.** Would make League the sole gatekeeper for every match, player and non-player. No advantage found: Career is already the *only* caller of Match under the current design, so there's no duplication to remove. The cost is real — League would need to learn about "the player" to know when to halt and hand back control (undoing the exact cleanliness that justifies the current boundary), or League would need a mid-loop callback to Career for mode selection, reopening a League↔Match-adjacent edge structurally close to the shadow-Career node already dissolved. Declined; not to be relitigated absent new information.
- **Still fully open (League's own interior, not this seam):** how a non-player team's trade/free-agency/draft decisions actually get computed (Skill vs. deferred rule-set) — to pin when League's interior is mined directly.

### League interior — trades (author-sketched, form refined by agent)

**Decided shapes:**
```
type Team = Unshaped<"Team">
type CareerPlayer = Unshaped<"CareerPlayer">
type Cash = Unshaped<"Cash">
type DraftPosition = Unshaped<"DraftPosition">

type TradeableGoodType = CareerPlayer | Cash | DraftPosition

type TradeableGood<T extends TradeableGoodType> = {
  payload: T[]
  owner: Team
}

type AnyTradeableGood =
  | TradeableGood<CareerPlayer>
  | TradeableGood<Cash>
  | TradeableGood<DraftPosition>

type TradeSwap = {
  these: AnyTradeableGood[]
  for: AnyTradeableGood[]
}

type TradeProposal = {
  swaps: TradeSwap[]
}

type CounterProposal = {
  original: TradeProposal
  counter: TradeProposal
}

type TradeFeedback = Unshaped<"TradeFeedback"> // reason code -> configurable human-readable string + remediation-action hint; held

type TradeProposalAnalysis = {
  original: TradeProposal
  successChance: number
  notes: TradeFeedback[]
}

type TradeProposalResult =
  | { status: "accepted"; original: TradeProposal; notes: TradeFeedback[] }
  | { status: "rejected"; original: TradeProposal; notes: TradeFeedback[] }
  | { status: "countered"; original: TradeProposal; counterProposal: CounterProposal; notes: TradeFeedback[] }

// League trade-relevant doors:
analyzeTrade(tradeProposal: TradeProposal): TradeProposalAnalysis
proposeTrade(tradeProposal: TradeProposal): TradeProposalResult
acceptCounter(counterProposal: CounterProposal): TradeProposalResult  // decided — takes just the CounterProposal
```

- **`TradeableGood` generic parametrized per-good, not per-swap** — each good is homogeneous (one `TradeableGoodType` per good), while `TradeSwap.these`/`for` (typed over `AnyTradeableGood[]`) can freely mix goods of different kinds in one package. Per-good `owner` field is deliberate: it's the extensibility hook for multi-team trades later without an interface change.
- **`TradeProposalResult` is a 3-way discriminated union** (`accepted | rejected | countered`), with `notes` present (possibly empty) in every branch rather than a 4th branch. Matches the `MatchResult`-style discriminated-union convention already used for Match.
- **`notes` is `TradeFeedback[]`, not raw strings — decided.** Each entry is a reason code that maps to a configurable, human-readable message *and* a potential remediation-action hint (e.g. distinguishing "not enough value" — actionable, the player could sweeten the offer — from pure-variance rejection — not actionable, nothing to fix). Taxonomy of codes, the message-config mapping, and the remediation-action shape are all **held**, not designed now — only the structural decision (codes-with-mappings, not free text) is decided.
- **Trade sessions are NOT stateful.** Full referential-equality tracking dropped; an id-equality approach would work but isn't required as a hard mechanism — a **privileged door** can force a counter through regardless, since the counter's *receiver* (not its original offerer) is the one with standing to decide on it. **`acceptCounter` decided: takes just the `CounterProposal`**, not the full prior `TradeProposalResult`.
- **`analyzeTrade` and `proposeTrade` are independently rolled, not required to agree exactly.** Confirmed design direction (not yet the decision machinery itself, but needed context): net trade value is computed deterministically (weighted, normalized goods per side), then RNG is layered on top of that static analysis to avoid rigid all-or-nothing acceptance and to leave room for a later goals/priorities-based sway. `successChance` is therefore inherently probabilistic; `analyzeTrade` and `proposeTrade` should agree in the aggregate but are allowed to diverge run-to-run since neither shares a session/seed. **Confirmed: this does open a save-scum surface** (RNG-driven accept/reject), same shape as Match's "anti-save-scum" invariant. Author isn't worried enough to block on it now, but named a **candidate mitigation** for later: persist a rejected trade to disk and, if an identical trade is re-attempted within some window, return the same outcome rather than re-rolling. Not committed — a candidate, to revisit at persistence/fill.
- **Empty-sided swaps are legal on one side (a gift/salary dump); empty-to-empty is an error condition**, left as a runtime precondition rather than a type constraint — "at least one side non-empty" doesn't cleanly type as a single-field rule.

**Decided — trade-value machinery, floor version:**
- **Caliber is the common unit trade valuation reduces to.** Caliber itself is a weighted, non-additive rollup of `CareerPlayer` stats (the "god stat" — a measure of win-contributing ability everything else refers back to). Reinforces (doesn't finalize) the caliber-cap lean from round 11: Caliber is now required infrastructure for trade valuation regardless of the cap-model choice, so reusing it for cap enforcement avoids building a second metric.
  - `CareerPlayer` → Caliber directly (no conversion).
  - `Cash` → an expected-Player-value-in-Caliber, via salary.
  - `DraftPosition` → Caliber as a function of pick number (+ projected draft class/order, if modeled).
- **Everything in this machinery is tunable** — config constants, not hardcoded numbers, because this is all game-balance/trial-and-error territory. Same pattern as Match's `TurnConfig`; worth treating as a standing principle for League's balance-sensitive logic generally, not just trades.
- **`successChance` is asymptotic, never literally 100% or literally capped-low on the reject side.** Scales inversely with signed divergence between the two sides' Caliber totals (favoring one side lowers the other's chance). High end: approaches but never reaches 100% (candidate cap ~95–99%, tunable) — deliberately, so a player can't reliably engineer a guaranteed-accept trade once they learn the margin threshold, which would undercut the reason RNG exists at all. Low end: **no floor** — a sufficiently bad trade can be a certain rejection; no exploit risk on that side to guard against.
- **Still open, League's decision machinery interior:** the actual stat→Caliber weighting formula, the Cash↔Caliber and DraftPosition↔Caliber conversion functions, the tolerance/divergence-to-successChance curve's exact shape, the `TradeFeedback` code taxonomy, Skill vs. `deferred` rule-set for all of the above. None of this has started; the above are structural/design-intent decisions the interior itself will be built against.

---

**Pointer:** Index at `SESSION-ZERO-STATE.md`. Match at `SESSION-ZERO-MATCH.md`. Simulation engine at `SESSION-ZERO-SIMENGINE.md`. Findings at `SESSION-ZERO-FINDINGS.md`. Core decisions at `SESSION-ZERO-CORE-DECISIONS.md`.
