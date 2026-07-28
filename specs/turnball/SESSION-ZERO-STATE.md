# Turnball — Session-Zero State (interim index)

> **Not the skeleton.** This is the load-bearing session-zero state for the
> Turnball scope-limit run on `experimental/decomp`, persisted per the skill's
> memory-discipline note so the mining tree, ledgers, and cursor survive a
> compaction. The sanctioned skeleton write happens later, at phase 5.
> Started 2026-07-23.
>
> **Split into detail files (round 11b) to keep context tokens low.** Index stays
> here (~250 lines); details in @file references below. Load detail files on demand.
> Last update: 2026-07-28, cursor at League node (round 11c), awaiting author input
> on League's ownership/responsibilities.

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
│    League node ....... mining ⟵ CURSOR (round 11c). What owns League?
│                        How does Career ask it? Does it talk to Match?
│                        Full node or boundary/coordinator?
│    MVP/NTH interior: drafts/free-agency/trades need League; financial system
│                      (caliber cap, simplistic funds, realistic) undecided
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

Shapes:
- `Team = { roster: Player[]; name: string; kit: Kit; stats: Stats }` — **decided** (member shapes held).
- `MatchResult` — stored form = `Complete | Unfinished-partial`; `Abandoned` is ephemeral (`{ status: "abandoned" }`).

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
| League node (pool for acquisitions) | named hole | open |

Resolved this session: never-started-vs-unfinished status modeling (→ derived from result presence/shape, no enum).

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
