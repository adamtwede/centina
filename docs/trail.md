# The trail (step 3 of the work-item progress tracking)

Agreed by the author (what counts as a decision, agent-drafted gates ruled by
the human over several turns, JSONL, one file per system). `centina-check
trail <system-dir>` validates it and writes `TRACKER.html` (see "The checker
and the tracker" below). `skills/centina-spike/SKILL.md` writes it, by
appending lines in the formats below.

## What it is for

The ledger records what was decided. It does not record what was *offered*:
the options the agent put to the human each time it asked "what next", the
ones not taken, and where the work forked. Those live only in chat, and are
what the human needs to see to choose between continuing a line, backing out
to an earlier alternative, or closing a whole branch.

The trail records exactly that, and nothing the ledger already holds. It
cites ledger labels instead of restating them (`ledger.md`, rule 5).

## What it is not

- **Not the work tree.** Steps and spikes are ledger `W` entries with
  `Depends-on`; the trail points at them. (`centina-realize` already asks for
  one `W` entry per step and for no unplanned work; `terrain:W43` kept about
  twenty sub-steps as paragraphs of one entry instead. Making that rule bite
  is step 4's job, not the trail's.)
- **Not a store of weights.** Time and tokens between two decisions are
  derived by the tracker from the session transcripts (`transcripts/`, each
  message has a timestamp and usage). The trail records the anchors the
  derivation needs: when (`at`, UTC) and in which session. The agent cannot
  see a message's id, so there is no turn field; the tracker finds the turn
  from the timestamp.
- **Not spec content, and not the human's decisions.** The agent writes it as
  scribe, like the ledger. What it records as chosen is what the human said.

## Shape

One file per system, `TRAIL.jsonl` beside `LEDGER.md` (its place follows the
ledger folder refactor, ROADMAP "Open"). JSON Lines: append-only, one record
per line, so two sessions merge cleanly and a half-written record damages one
line. Never edit a line. A `decision` or `gate` is corrected by a later record with
a new id and `"corrects":"<old id>"` (the old one is then hidden); for a
`choice`, `mark` or `reading` the latest record for the same decision, option
or (gate, `after`) is the one in effect.

**Ids are qualified by scope, like ledger labels:** `terrain/d41`, option
`terrain/d41.2`. The scope is the scope of the item the decision is about.
Splitting the trail by scope later needs no renumbering, and an edge that
crosses files is just an id in another file's scope. A `link` record says
which file holds a scope.

### `decision`: written in the turn the agent offers a choice

```json
{"type":"decision","id":"terrain/d41","at":"2026-10-04T16:02:11Z",
 "session":"b787868d-…",
 "from":"terrain/d40.1","item":"terrain:W43",
 "question":"Step 2m found the Hessian step is not the cause. What next?",
 "options":[
  {"n":1,"label":"Overlap test (step 2n)","kind":"refine","cites":["terrain:F58"]},
  {"n":2,"label":"Return to terrain:W42(d) candidate 2","kind":"branch","revives":"terrain/d9.3"},
  {"n":3,"label":"Close terrain:W43, record the negative result","kind":"close"}],
 "recommended":1}
```

An optional `"checkpoint":"budget|return|no-reading|moving-away|asked"` marks a
decision written at a `centina-spike` checkpoint; the tracker draws it as a
diamond.

- `from`: the option whose chosen work led here. Absent on a root. Edges of
  the tree are `from` pointers, so the through-line is a chain of `from`.
- `item`: the work item the line of inquiry is under.
- `kind`, per option:
  - `refine`: continues the current line (the next step on the same
    question). Draws as through-line.
  - `branch`: a different approach to the same question, or a new line; it
    excludes the others in the sense that taking it means not taking them
    now. `revives` points at an earlier option offered and not taken.
  - `close`: park, abandon or finish the line (or, from an earlier node,
    everything below it).
- `cites`: ledger labels the option rests on or would produce, for the
  tracker's links and the checker's resolution test.
- `options` may be omitted on a record written after the fact
  (`"backfilled":true`), when only the choice is known. This is what
  `terrain:W43` looks like: the ledger quotes the human's pick
  (`"route option 1"`) and the unchosen options are gone.

### `choice`: written when the human answers

```json
{"type":"choice","decision":"terrain/d41","chose":[1],
 "at":"2026-10-04T16:20:40Z","quote":"plan route option 1"}
```

`chose` is empty when the human took none (`"other":"free text"` carries what
they said instead). More than one entry means the options were not exclusive
and all were taken. A decision with no `choice` is **pending**; one the work
has moved past without a `choice` is **unanswered** (the checker warns).

### `mark`: a branch's state, when it is not just "taken or not"

```json
{"type":"mark","option":"terrain/d9.3","state":"parked","at":"…",
 "why":"waits on the c > 0 reference runs","cites":["terrain:Q7"]}
```

`state`: `parked` (set aside, may come back), `abandoned` (the human ruled it
out), `done`. An option that was offered, never chosen and never marked is
**unexplored**. Closing a whole subtree is a `choice` of a `close` option at
its root, not a mark on every leaf.

### `gate`: what the line is trying to reach, set by the human

```json
{"type":"gate","id":"terrain/g3","item":"terrain:W43",
 "statement":"Model 3's coherent amplitude steps no more than 3 dB through a mirror-pair birth, at all three b steps on both scenes",
 "metric":"step through the birth","unit":"dB","tolerance":3.0,"direction":"max",
 "ruled":"terrain:W43","quote":"the 3 dB tolerance stands","at":"…"}
```

The pass bar is the human's to set, so a gate record carries where they ruled
it (`ruled`: the ledger label, `quote`: their words). The agent drafts, the
human confirms, as with a plan. A line may have several gates; a gate may be
revised by a later `gate` record that `corrects` it.

### `reading`: a step's result against a gate

```json
{"type":"reading","gate":"terrain/g3","after":"terrain/d41.1",
 "value":4.7,"unit":"dB","verdict":"fail","evidence":"terrain:F48","at":"…"}
```

Many steps read no gate (a diagnosis, a control). They write no `reading`,
and that is information: the share of a line's time and tokens spent on
steps that touched none of its gates is the clearest drift signal this scheme
can give. `verdict` is `pass`, `fail` or `inconclusive`; "closer or further"
is computed by the tracker from consecutive readings of one gate, never
asserted by the agent. A step's headline number must be a reading of a
declared gate or a new gate record, not a free-floating figure.

### `waive`: a warning the human has ruled out

```json
{"type":"waive","rule":"trail-spike-no-gate","subject":"terrain:W43",
 "why":"retrofitted after the fact; not revisiting","quote":"leave W43 alone","at":"…"}
```

For work the human has decided not to bring under the trail, such as a spike
that began before it existed. The checker stops raising `rule` for `subject`,
which is the item label or decision id the warning is about. Scope is the
point: one rule for one subject, never a rule for the whole trail, so a
spike that starts later is checked in full.

- Only **warnings** can be waived. Parse, id, reference, label and ruling
  errors are faults in the file; the fix is to correct them.
- The human rules it, like a gate: no `quote` is an error (`trail-waive`), and
  the warning stands.
- It is not hidden. The command prints "N waived" with each reason, and the
  page lists them in a collapsed panel with the human's words.
- A waiver that matches no warning now (the item closed, or the fault was
  fixed) warns, so stale ones are removed: append the same record with
  `"lifted":true`. The latest record for a rule and subject is the one in
  effect.

### `link`: a split trail

```json
{"type":"link","scope":"sensor-door","file":"TRAIL-sensor-door.jsonl"}
```

### First line

```json
{"type":"trail","version":1,"system":"underworld"}
```

## The checker and the tracker

`centina-check trail [--check] [--out <file>] <system-dir>` reads
`TRAIL.jsonl` and the ledger, prints findings, and writes `TRACKER.html` beside
the trail (generated; never edit it). `--check` validates without writing. A
system with no trail is not an error. Run it at a checkpoint, when closing a
spike, and whenever the human wants the picture; the page is one
self-contained file for a browser.

**Findings** (`checker/trail/check.ts`):

| Rule | Severity | Fires when |
|---|---|---|
| `trail-parse` | error; warning for a missing header | a line is not JSON or has the wrong shape |
| `trail-id` | error; warning for a skipped number | an id repeats, or is not the next in its scope |
| `trail-ref` | error | `from`, `revives`, `after`, `option`, `gate`, `decision`, `corrects` or a chosen number names nothing |
| `trail-label` | error | an item, cite, `ruled` or `evidence` label is not in the ledger |
| `trail-time` | warning | a choice is dated before its decision, or an option revives one offered later |
| `trail-gate-ruling` | error | a `gate` has no `ruled` and `quote` (the human rules it) |
| `trail-no-close` | warning | a decision offers no `close` option |
| `trail-unanswered` | warning | a decision has no `choice` and later records exist |
| `trail-spike-no-gate` | warning | an active `Kind: spike` item has no ruled gate |
| `trail-missing-decision` | warning | an active spike with two or more findings has no decision: capture was dropped |
| `trail-waive` | error with no `quote`; warning when it matches nothing | a `waive` record is not ruled by the human, or has gone stale |

`trail-missing-decision` is the check for the weak point named below. It cannot
see a plan confirmed with no decision record (that needs the ledger's history),
so it catches the pattern, not the instance.

**The page** shows, per decision, what was taken (the line) and what was
offered and not (stubs: grey, orange for a stop or return, blue when taken up
later, dashed with a label when parked, struck through when abandoned, a tick
when done); a diamond for a checkpoint; a ring for a decision still awaiting an
answer; an arc where the work returned to an earlier option; and the cited
ledger entries as links that open in VS Code. Segment length is the weight of
the work after a decision, switchable between active time and output tokens.
Collapsed below it: **standing alternatives** (options offered and never taken,
merged across decisions by `revives` or by their words, with how often, when,
how much work has gone by since the first offer, and their state) and **gates**
(each gate's readings against its tolerance, and whether the latest moved
toward or away from it). The tiles include "steps that read a gate" and "steps
since a gate was last read".

**Weights** come from the session transcripts the ledger hook copies to
`<system-dir>/transcripts/<session-id>.jsonl`, for the sessions the trail names.
The checker reads only each message's time and output-token count, never its
text: an assistant message is counted once, and a gap of over ten minutes is the
human away. The work after a decision runs from the human's answer to their
answer to the next. With no transcript copy the page says so and draws
unweighted segments.

## Known weak points

1. **Capture depends on the agent.** Options are offered in prose, so there is
   nothing to hook. The rule goes in `centina-realize`, and the checker's
   warning is the only backstop. If it drops records in long sessions, the
   fallback is the mod extracting offered options from the reply with a cheap
   model call, which is a cost and an accuracy trade, not a free fix.
2. **Backfilling is partial.** For existing work the ledger gives the chosen
   path and rough anchors, not the unchosen options.
3. **A gate is a number, and not every step has one.** That is stated, not
   hidden, but a line whose goal is not a threshold needs a different kind of
   `gate` (a qualitative statement with `verdict` only); not designed yet.
