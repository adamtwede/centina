# Session-zero and iterate: managing long-running output

When a `centina-session-zero` or `centina-iterate` session produces a ledger or
state file (e.g., `SESSION-ZERO-STATE.md`) that grows beyond ~1500 lines,
**split it automatically** into an index file + detail files. This keeps context
tokens manageable across compactions while preserving resumability.

**Strategy (Option A — split by mining node):**

- **Index file** — `SESSION-ZERO-STATE.md` (kept < 300 lines, always in context):
  - Run frame (purpose, operating mode, Rule 0 status)
  - Mining tree (statuses only; "Match: MINED (see SESSION-ZERO-MATCH.md)")
  - Contract ledger (summary table, links to detail)
  - Hole ledger (summary table, links to detail)
  - Findings list (titles and `@file` links)
  - Pointers to detail files

- **Detail files** — one per mining-tree node, holds full interior content:
  - `SESSION-ZERO-MATCH.md` — all Match interior (rounds 1–10)
  - `SESSION-ZERO-CAREER.md` — all Career interior (round 11+)
  - `SESSION-ZERO-SIMENGINE.md` — all Simulation engine (round 11b+)
  - `SESSION-ZERO-FINDINGS.md` — all findings with full text (F1–F9+)
  - `SESSION-ZERO-CORE-DECISIONS.md` — core/non-switchable decisions

**In-conversation:** Only the index file stays in context every turn (~ 90%
token savings). Agents read detail files on demand when diving into a specific
node's rounds. On compaction, index carries cursor position and status; resuming
agent loads index + the relevant detail file.

**Trigger:** Split when the main file reaches ~1500 lines. Once split, maintain
the strategy for all subsequent rounds (don't merge back).

**For iterate sessions:** Same strategy applies if the session produces a
similarly sized ledger (e.g., a complex component with many rounds of
refinement). Name detail files `ITERATE-<component>-*.md` and keep the index
as `ITERATE-STATE.md`.

This is automatic — no special permission or human involvement needed. Agents
implementing it should note the split in the session conversation so the human
knows it happened and can navigate if needed.
