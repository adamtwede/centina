# Turnball — Session-Zero State (interim index)

> **Not the skeleton.** This is the load-bearing session-zero state for the
> Turnball scope-limit run on `experimental/decomp`, persisted per the skill's
> memory-discipline note so the mining tree, ledgers, and cursor survive a
> compaction. The sanctioned skeleton write happens later, at phase 5.
> Started 2026-07-23.
>
> **Split into detail files (round 11b) to keep context tokens low.** Index stays
> here (~250 lines); details in @file references below. Load detail files on demand.
> Last update: 2026-07-29, cursor at League node (round 11c), trades interior.
> Corrected round 11: **League, not Career, holds roster/stat data for every
> team.** Trade-value machinery floor decided (Caliber as common unit,
> asymptotic success-chance, structured `TradeFeedback`). Weighting formulas
> and free agency/draft interiors not yet started. See detail file.

## Run frame

- **Purpose:** scope-limit test of `centina-session-zero` — how far it degrades
  when the subject is a whole video game brought in as a few sentences.
- **Operating mode:** recursive descent. Depth-intent **declared** by the author,
  so decisions 8 + 9 (⚗️ section of the skill) are active: every node is a nested
  session-zero; genesis re-slice is the primary descent engine; the tree is
  mono-directional with re-root (decision 9), not an ascent phase.
- **Rule 0 / 0a:** LIVE for all game content (per CLAUDE.md clarification). Lifted
  only for the meta layer (skill/language edits, findings, this ledger).

## Mining tree (statuses + cursor)

Legend: `held` · `mining` (cursor) · `mined` · `declined` · `provisional`

```
[top layer — HEADLESS, knowingly incomplete]
├─ Match ............... MINED (rounds 1–10)  @file SESSION-ZERO-MATCH.md
│    door: Career seam pinned; Presentation + MatchPersist edges provisional
│    Decisions: causal tree, Player split, event log (b), full event-sourcing,
│              TurnConfig (constants), activation identity (stage field), dedup
├─ Career ............. interior open (round 11)  @file SESSION-ZERO-CAREER.md
│    Decisions: stateful, no end condition, re-root fired (Mode-Select above)
│    Simulation Engine (11b): CLOSED. See @file SESSION-ZERO-SIMENGINE.md
│    League node ....... mining ⟵ CURSOR (round 11c). CONFIRMED as its own
│                        node (two independent Career separations: calendar
│                        ownership; league-wide roster/rights + acquisitions).
│                        Schedule seam DECIDED: League keeps
│                        the live calendar (League-as-factory retired —
│                        dual-source-of-truth risk); Career drives via
│                        advanceCalendar()/updateCalendar(), runs all Match
│                        invocation itself (League-gatekeeps-Match alternative
│                        considered + declined). Interval = whole days,
│                        Matchup carries time-of-day; one-outstanding-interval
│                        sequencing rule. Presentation reads only via Career
│                        relay in career mode. Acquisitions self-containment
│                        CONFIRMED (propose door in, human-decision door back
│                        out; non-player decision logic League-internal).
│                        Open: non-player decision mechanism (Skill vs rules).
│    Trades interior .... shapes DECIDED (TradeProposal/TradeSwap/
│                        TradeableGood<T>/TradeProposalResult, notes as
│                        structured TradeFeedback codes). Value-machinery
│                        FLOOR decided: Caliber is the common unit (Cash/
│                        DraftPosition convert to it, CareerPlayer direct);
│                        successChance asymptotic (~95-99% cap, no floor);
│                        all of it tunable. Weighting formulas, conversion
│                        functions, curve shape, TradeFeedback taxonomy: not
│                        started. Free agency + draft interiors not yet mined.
│    CORRECTION (r11) ... League, not Career, holds roster/stat data for
│                        every team — Matchup now carries full Team data.
│    MVP/NTH interior: drafts/free-agency/trades need League; financial system
│                      (caliber cap, simplistic funds, realistic) undecided —
│                      Player contract shape now decided (team + duration)
├─ Mode-Select ........ ADOPTED provisionally (r11) — re-root FIRED
│    Sits above Career; Career is no longer the top node.
├─ Presentation ....... held   — consumes Match/Career output
├─ MatchPersist ....... held   — write(partial) from Match
├─ CareerPersist ...... held   — persists career state
├─ Archive ............ held   — rolls old logs into stat rollups
└─ (root hole) ........ "other top-level concerns TBD"
```

## Contract ledger

| Seam | Direction | Content | Status |
|---|---|---|---|
| Career → Match (invoke) | Career orchestrates; invokes Match | in: two `Team`; out: return channel | provisional-leaning-decided |
| Match → Career (return) | non-void | `Complete` \| `Unfinished(partial)` \| `Abandoned` | **decided** |
| Match → MatchPersist | void (write) | partial `MatchResult` on unfinished branch | **decided** |
| Career → League (invoke) | advance the calendar | `advanceCalendar(interval): Matchups`; interval = whole days min; one outstanding interval at a time (sequencing invariant, not typeable); `Matchup` carries full `Team` data (League holds it) | **decided** |
| Career → League (invoke) | write results back | `updateCalendar(results): MatchupCalendar` | **decided** |
| Career → Presentation | relay calendar state (career mode only) | Career is sole upstream; nothing else reaches Presentation outside an active Match | **decided** |
| Career → League (invoke) | player-initiated trade proposal | `proposeTrade(TradeProposal): TradeProposalResult`, `analyzeTrade(TradeProposal): TradeProposalAnalysis` | **decided** |
| League → Career (invoke) | respond to a counter-offer | `acceptCounter(CounterProposal): TradeProposalResult` | **decided** |

Shapes:
- `Team = { roster: Player[]; name: string; kit: Kit; stats: Stats }` — **decided** (member shapes held). **Ownership corrected:** League, not Career, is the authoritative holder for every team's data — see round-11 correction note in `SESSION-ZERO-CAREER.md`.
- `MatchResult` — stored form = `Complete | Unfinished-partial`; `Abandoned` is ephemeral (`{ status: "abandoned" }`).
- `Player` contract — **decided**: minimally `{ team: Team; duration: … }` (rights holder + duration). Required for free agency; corrects round-11 claim that caliber-cap "stores nothing."
- `Matchup` — **decided** member added: a time-of-day field, ordering same-day simulations. Rest of shape held.
- `TradeProposal` / `TradeSwap` / `TradeableGood<T>` / `CounterProposal` / `TradeProposalAnalysis` / `TradeProposalResult` — **decided**, full shapes in `SESSION-ZERO-CAREER.md`. `TradeProposalResult` is a 3-way discriminated union (`accepted | rejected | countered`); goods are homogeneous per-item, packages heterogeneous. `notes` field typed `TradeFeedback[]` — reason codes mapping to configurable messages + remediation hints, taxonomy held.
- Caliber — **decided as the common trade-valuation unit**: a weighted, non-additive rollup of `CareerPlayer` stats. `Cash`/`DraftPosition` convert to it; `CareerPlayer` compares directly. Reinforces the caliber-cap financial-model lean from round 11. Weighting formula itself held.

## Hole ledger

| Hole | Route | Status |
|---|---|---|
| `Player` shape | split → `CareerPlayer` / `MatchPlayer` | in progress |
| `Position` shape + listed-position heuristic | heuristic → realization door | open |
| `Condition` shape | held | open |
| `Synergy` shape + ownership | held | open |
| Game clock / timing mechanism | held | open |
| Match → Career write-back | seam | open |
| `Kit` shape | held | open |
| `Stats` shape | held | open |
| `MatchResult` internals | held | open |
| `MatchPersist` terminal-vs-node | held | open |
| `CareerPersist` placement | held | open |
| Presentation carve | held | open |
| Career top door (symmetric to `playMatch`) | new seam | open |
| League node (pool for acquisitions) | named hole | mining (r11c) |
| Matchup-generation algorithm | realization → `deferred` | open |
| Standings tiebreaker criteria | policy | open |
| Non-player trade/free-agency/draft decision logic (League-internal) | Skill vs `deferred` rule-set | open |
| `advanceCalendar` sequencing-invariant encoding (typed error vs discriminated return) | held | open |
| Stat→Caliber weighting formula | held | mining ⟵ CURSOR |
| Cash↔Caliber, DraftPosition↔Caliber conversion functions | held | open |
| successChance divergence-to-chance curve (exact shape/constants) | held, tunable | open |
| `TradeFeedback` reason-code taxonomy + remediation-action shape | held | open |
| Save-scum mitigation for RNG'd trade decisions (persist-and-replay-within-window) | candidate, not committed | open |
| Free agency + draft interiors | not yet mined | open |

Resolved this session: never-started-vs-unfinished status modeling (→ derived from result presence/shape, no enum). League↔Match relationship (dissolved — Career invokes Match with a CPU-side answerer for non-player sides; League never talks to Match). Schedule-generation config ownership (League owns a baked-in/persisted league-structure description). Acquisitions self-containment (confirmed: propose-door in, human-decision-door back out; non-player decision mechanism is League-internal and opaque to Career, symmetric to the human's own decision being opaque to League). `advanceCalendar` interval semantics + sequencing invariant. Presentation's calendar read (Career-relay only, career mode). League-gatekeeps-all-Match-invocation alternative — considered, declined (no duplication removed; breaks League's player-agnosticism). **League confirmed as a distinct node** — two independent, load-bearing separations of concern from Career (schedule/calendar ownership; league-wide roster/rights + acquisitions visibility) judged sufficient. **Roster/stat data ownership corrected** — League, not Career, is authoritative for every team (round-11 claim revised). `acceptCounter` parameter (just `CounterProposal`). `notes` structured as `TradeFeedback` codes, not raw strings. `successChance` curve shape: asymptotic high end (~95–99% cap, never 100%), no floor on the low end.

**Recognized pattern (not a decision):** the offer-node shape (paused, awaiting an answer from a pluggable answerer) and Match's turn-like reducer loop both rhyme with Career's synchronous calendar-interval loop and trade-proposal-pending-human-decision. Noted as recurring system-level design vocabulary, not literal cross-node reuse.

## Findings & Core Decisions

@file SESSION-ZERO-FINDINGS.md — F1–F9 complete.

@file SESSION-ZERO-CORE-DECISIONS.md — core/non-switchable (Match only).

## Meta — Session Governance

**"fit check" keyword** — invoked as "fit check" or "fit check on X" for structured costs/benefits analysis of architectural forks. Added to core directives in both `centina-session-zero` and `centina-iterate` SKILL.md files (r11b).

**Session-log splitting** — implemented per CLAUDE.md strategy. Index file (`SESSION-ZERO-STATE.md`, this file) stays in context (~200 lines). Detail files loaded on demand:
- @file SESSION-ZERO-MATCH.md — Match interior (rounds 1–10)
- @file SESSION-ZERO-CAREER.md — Career interior (round 11)
- @file SESSION-ZERO-SIMENGINE.md — Simulation engine (round 11b)
- @file SESSION-ZERO-FINDINGS.md — All findings (F1–F9+)
- @file SESSION-ZERO-CORE-DECISIONS.md — Core/non-switchable decisions

## Pointers

- Session-zero skill provisionally promoted decisions 8 & 9: see `.claude/skills/centina-session-zero/SKILL.md` ⚗️ section.
- Debug self-monitoring section: same file, `🔬 Debug` (experimental-branch only).
- For full round-by-round details, read the @file references above.
