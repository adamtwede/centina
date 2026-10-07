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
   - the system name, and `artifactsRoot` if you record it, as a path relative
     to the host root (`.centina/config.json` holds the real one; an absolute
     path in a committed file goes stale on another machine);
   - the session IDs of runs so far: one line each, with the start date and a
     few words on what the session was for. The `Session` header on each
     ledger entry records what the session did, so never narrate it here;
   - where the run is: the label of the current phase or gate, or the current
     component, and nothing else. Not the steps done, the earlier phases or any
     status: read those from `centina-check ledger --phase <label> <dir>` or
     `LEDGER-INDEX.md`;
   - pointers: DAG files, and open threads by label.

   Keep it under ~100 lines. Never copy entry content or status into it.

   **Keep it current.** Nothing generates the run frame, so it changes only
   when the skill edits it: add this session's ID line at setup, and update
   where the run is whenever the current phase or gate changes (a phase becomes
   active; a phase closes). A run frame that names a closed phase sends the next
   session to the wrong phase view.
3. **Generated views:** `LEDGER-INDEX.md`, `LEDGER-LABELS.md`,
   `LEDGER.json` and `STANDING.md`.

Ask the human for the system name before the first write to disk, if they
have not given one.

## Ledger length

Length is not a reason to split. Reading is by phase view, index and label
lookup, never the whole file (below), so a long ledger costs no more context
than a short one. Do not split it on your own initiative. Split only when the
human asks, for example to cut merge conflicts between concurrent sessions or
to make the file easier to browse.

To split:

1. Move whole entries into `LEDGER-<part>.md` files. Choose parts by how the
   work is looked up: one per scope (`LEDGER-sz.md`,
   `LEDGER-task-matcher.md`) or one per phase.
2. Each entry lives in exactly one file. Move, never copy.
3. A moved entry keeps its label.
4. `LEDGER.md` stays, with its title, a list of the partitions, and any
   entries not moved. The checker and hooks look for it.
5. Once split, keep adding entries to the matching partition. Do not merge
   back.
6. Verify mechanically before moving on: parse entries out of the backup and
   out of the new files, then compare the label sets and each body's text. A
   split that drops or mangles one entry is invisible to the checker, which
   only sees what is there.

## Reading in a long session

1. Read the run frame, and the phase view (`centina-check ledger --phase
   <label> <dir>`) if a current phase is set, or `LEDGER-INDEX.md` if not —
   not the ledger. See `ledger.md`, "Reading".
2. Look up entries by label as needed (`### <label>:`).
3. After a compaction, reread the run frame and the same phase view or index
   before continuing.

## Older projects

Projects that used the earlier split (`SESSION-ZERO-STATE.md` as an index
plus `SESSION-ZERO-<node>.md` detail files) keep that layout until migrated
to a ledger. The checker and hooks ignore systems without a `LEDGER.md`.
