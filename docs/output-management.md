# Managing long-running session output

Applies to `centina-session-zero`, `centina-iterate` and `centina-realize`.

## What goes where

All in `<artifactsRoot>/specs/<system>/`:

1. **The ledger** (`LEDGER.md` and partitions): every decision, question,
   finding, option, work item, goal and rule. See `ledger.md`.
2. **The run frame:** `SESSION-ZERO-STATE.md` for session-zero,
   `ITERATE-STATE.md` for iterate, `REALIZE-STATE.md` for realize (which also
   records the implementation root, the contracts module, and the spike and
   build source trees). It holds only:
   - the system name and `artifactsRoot`;
   - the session IDs of runs so far;
   - where the run is: current phase or gate, or current component;
   - pointers: DAG files, and open threads by label.

   Keep it under ~100 lines. Never copy entry content or status into it.
3. **Generated views:** `LEDGER-INDEX.md` and `STANDING.md`.

Ask the human for the system name before the first write to disk, if they
have not given one.

## Splitting the ledger

When `LEDGER.md` passes ~1500 lines, split it without asking, and tell the
human.

1. Move whole entries into `LEDGER-<part>.md` files. Choose parts by how the
   work is looked up: one per scope (`LEDGER-sz.md`,
   `LEDGER-task-matcher.md`) or one per phase.
2. Each entry lives in exactly one file. Move, never copy.
3. A moved entry keeps its label.
4. `LEDGER.md` stays, with its title, a list of the partitions, and any
   entries not moved. The checker and hooks look for it.
5. Once split, keep adding entries to the matching partition. Do not merge
   back.

## Reading in a long session

1. Read `LEDGER-INDEX.md` and the run frame, not the ledger.
2. Look up entries by label as needed (`### <label>:`).
3. After a compaction, reread the run frame and `LEDGER-INDEX.md` before
   continuing.

## Older projects

Projects that used the earlier split (`SESSION-ZERO-STATE.md` as an index
plus `SESSION-ZERO-<node>.md` detail files) keep that layout until migrated
to a ledger. The checker and hooks ignore systems without a `LEDGER.md`.
