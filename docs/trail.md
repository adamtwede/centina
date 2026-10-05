# The trail (DRAFT, step 3 of the work-item progress tracking)

Not built. This is the schema the tracker (step 5) and the `centina-realize`
change (step 4) are designed against, for the author to react to first.

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
  derivation needs: when, and in which session and turn.
- **Not spec content, and not the human's decisions.** The agent writes it as
  scribe, like the ledger. What it records as chosen is what the human said.

## Shape

One file per system, `TRAIL.jsonl` beside `LEDGER.md` (its place follows the
ledger folder refactor, ROADMAP "Open"). JSON Lines: append-only, one record
per line, so two sessions merge cleanly and a half-written record damages one
line. Never edit a line; correct with a later record (`corrects`).

**Ids are qualified by scope, like ledger labels:** `terrain/d41`, option
`terrain/d41.2`. The scope is the scope of the item the decision is about.
Splitting the trail by scope later needs no renumbering, and an edge that
crosses files is just an id in another file's scope. A `link` record says
which file holds a scope.

### `decision`: written in the turn the agent offers a choice

```json
{"type":"decision","id":"terrain/d41","at":"2026-10-04T16:02:11Z",
 "session":"b787868d-…","turn":"<message uuid>",
 "from":"terrain/d40.1","item":"terrain:W43",
 "question":"Step 2m found the Hessian step is not the cause. What next?",
 "options":[
  {"n":1,"label":"Overlap test (step 2n)","kind":"refine","cites":["terrain:F58"]},
  {"n":2,"label":"Return to terrain:W42(d) candidate 2","kind":"branch","revives":"terrain/d9.3"},
  {"n":3,"label":"Close terrain:W43, record the negative result","kind":"close"}],
 "recommended":1}
```

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
 "at":"2026-10-04T16:20:40Z","turn":"<message uuid>","quote":"plan route option 1"}
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

### `link`: a split trail

```json
{"type":"link","scope":"sensor-door","file":"TRAIL-sensor-door.jsonl"}
```

### First line

```json
{"type":"trail","version":1,"system":"underworld"}
```

## What the tracker derives

- **Tree:** decisions as nodes, options as edges, `from` as parent. Through-
  lines are chains of chosen `refine` options; `branch` and unchosen options
  hang off as stubs, styled by state (taken, unexplored, parked, abandoned).
- **Weights:** between a `choice` and the next decision `from` it, the active
  time (gaps between messages capped) and output tokens in the transcript of
  that session. Cache-read tokens are not counted: they dominate the total and
  mean nothing here.
- **Gate line:** the readings of each gate in order, with the tolerance.
- **Back-out:** every unexplored or parked option with its distance (how many
  decisions and how much time and tokens since it was offered).

## What the checker would verify

- every `from`, `revives`, `decision`, `gate`, `after` and `option` resolves,
  and every ledger label in `cites`/`ruled` resolves;
- ids are unique and sequential per scope; `chose` names options that exist;
- a decision followed by later work with no `choice` (`trail-unanswered`);
- a `W` entry confirmed (status moved to `active`) or a plan confirmed with no
  decision record in the turn before it (`trail-missing-decision`), the
  counterpart of the missing-conformance-assertion check, and with the same
  caveat: nothing but the agent's discipline writes the record, so this is the
  rule that is expected to fail first and the reason for the warning.

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
