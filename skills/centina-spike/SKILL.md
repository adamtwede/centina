---
name: centina-spike
description: Runs one spike, a line of experiments that answers a question a Centina spec cannot settle without code, so that it stays bounded and steerable. Requires the human to rule a gate (the result that settles the question, with its tolerance), a step budget and a back-out point before measuring; keeps the line to one question, so a follow-up question becomes its own work item instead of another step; records every offered choice and every reading against the gate in the system's trail file; and stops for the human at a checkpoint when the budget is spent, a return condition fires, or steps stop reading the gate. Use when centina-realize's plan reaches a spike, when the human wants to run an experiment or measurement to settle a question, or when a spike is dragging on and needs reviewing.
---

# Centina Spike

A spike is one question, one gate, a budget and a way out. It ends when the
question is answered, the budget is spent or the human closes it, not when the
agent runs out of ideas. Long spikes are where effort disappears: each step
looks reasonable on its own, and no one compares the whole run with the
question it began with. This skill exists to keep that comparison alive.

## Setup: run first

1. Run `${CLAUDE_PLUGIN_ROOT}/docs/plugin-setup-procedure.md` to resolve the
   project and `artifactsRoot`.
2. Read `${CLAUDE_PLUGIN_ROOT}/docs/ledger.md` and
   `${CLAUDE_PLUGIN_ROOT}/docs/output-management.md`. The measurement rules
   are in this skill, condensed; `measurement-methodology.md` has the cases
   behind them.
3. This session's ID, for the `Session` header and the trail, is
   `${CLAUDE_SESSION_ID}`.
4. Identify the system (`specs/<system>/`) and the spike's `W` entry
   (`Kind: spike`). `centina-realize`'s planning gate creates it; if there is
   none, write the opening plan below as a new entry under the human's
   confirmation, and tell them it sits outside a phase if it does.
5. Read the tail of `specs/<system>/TRAIL.jsonl` if it exists: the last
   decisions and gates of this item say where the line stands, which options
   were never taken, and what the human ruled.

**Rules of engagement:**

1. **The human sets every gate, tolerance and budget.** The agent drafts them
   from the plan; the human rules them, which may take several turns. A
   number the human has not ruled is labelled "agent's proposal" wherever it
   appears. An unruled gate is a hole routed to the human, not something to
   fill in.
2. **Code is the agent's job; meaning is the human's.** Spike code stays
   outside the contracts and never becomes build code. The human makes every
   edit to `.centina.ts` files.
3. **Ledger entries and the trail are the agent's job** as scribe. The human
   decides every status that means a decision.

## The opening plan

Before any code or measurement, write these as lettered parts of the spike's
entry, and get the human's confirmation. Part (c) may take several turns.

- **(a) Question.** One sentence: the item's own question.
- **(b) Why admitted.** The decision a possible result would change. If none
  would, drop the spike and say why.
- **(c) Gate.** The result that settles (a), in the unit and tolerance the
  human rules: for example, "no more than 3 dB step through the birth, at all
  three b steps, on both scenes". Record it as a `gate` record in the trail
  once ruled, with the ledger part and the human's words. A question with no
  threshold gets a stated test and a pass or fail verdict the human gives;
  say that it is qualitative.
- **(d) Steps and budget.** The planned steps, each with its closing test, and
  the budget: the planned steps plus at most N more before a checkpoint. The
  human sets N; if they do not, N is 2. Give cost estimates as the agent's.
- **(e) Back-out.** Where the line returns to if the gate cannot be reached:
  an earlier work item or trail option by label, or "close and record the
  negative result". State the **return conditions** in advance, as results
  that send the line back (for example, "if step 1's gate fails at ramp, the
  item returns to `terrain:W42(d)`").
- **(f) Not in this item.** The questions this spike will not chase, named, so
  that a follow-up has somewhere to go.

Then the measurement plan for the first step, below.

## One question per entry

A step's result usually raises a follow-up question. Before planning the next
step, sort it:

- **It bears directly on (c):** the next step of this spike, if it is in
  the plan or inside the budget.
- **Anything else:** a diagnosis of a side observation, an apparatus effect,
  a candidate from (f), a question the result made interesting. It is **a new
  `W` entry** (`Depends-on` this one) with its own (a) to (f), confirmed by
  the human, and a `branch` option in the trail. It is not another step here.

A step not in the confirmed plan is unplanned work (`centina-realize`,
"Revising the plan"): a `W` entry and the human's confirmation first, never a
paragraph appended to this entry. Appending is how one entry grew to hundreds
of kilobytes and twenty steps, each admitted on its own merits and none
checked against the original question.

**A fired return condition ends the line.** Propose the return; do not
diagnose why it fired and carry on. Continuing is a new plan with its own
gate, ruled by the human, as a new `W` entry.

## Decisions: the trail

The trail, `specs/<system>/TRAIL.jsonl`, records what was offered, not just
what was decided. Append one JSON object per line, never edit a line, and
correct with a later record carrying `"corrects":"<id>"`. Take times from
`date -u +%Y-%m-%dT%H:%M:%SZ`. The first line of a new file is
`{"type":"trail","version":1,"system":"<system>"}`. Follow the formats exactly,
then run `${CLAUDE_PLUGIN_ROOT}/bin/centina-check trail specs/<system>` at every
checkpoint and when closing the spike: it reports what is malformed, unresolved,
unanswered or missing (a close option, a ruled gate) and writes `TRACKER.html`
beside the trail, the picture the human reads. Fix its errors, and tell the
human where the page is. When the human decides a warning on older work is
not worth chasing, record it as a `waive` (`docs/trail.md`) with their words;
never write one on your own.

**When you end a turn offering the human two or more options that lead to
different work, record it first.** A plain confirmation of one plan is not a
decision. Take the next number in the item's scope from the file
(`terrain/d41`), append the record, then offer the options in your reply with
their ids (`d41.2`) so the human can cite them:

```json
{"type":"decision","id":"terrain/d41","at":"…","session":"<id>","from":"terrain/d40.1","item":"terrain:W43","question":"…","options":[{"n":1,"label":"…","kind":"refine","cites":["terrain:F58"]},{"n":2,"label":"…","kind":"branch","revives":"terrain/d9.3"},{"n":3,"label":"Close this item and record the negative result","kind":"close"}],"recommended":1}
```

- `from`: the option whose work led here; absent at a root.
- `kind`: `refine` continues the current line; `branch` is a different
  approach or a new line (`revives` names an earlier option that was offered
  and not taken); `close` parks, abandons or finishes the line.
- **Always offer a `close` option, and the nearest unexplored earlier option
  as a `branch` when one exists**, whenever the decision follows a result.
  A menu of only ways to continue is how a line never ends.
- `recommended` is the agent's own choice among them; give it.

**At the start of the turn after the human answers, first append their
choice,** quoting them:

```json
{"type":"choice","decision":"terrain/d41","chose":[1],"at":"…","quote":"…"}
```

`chose` is `[]` with `"other":"<their words>"` when they took none, and may
hold several when the options were not exclusive. Park, abandon or finish a
branch with `{"type":"mark","option":"terrain/d9.3","state":"parked|abandoned|done","at":"…","why":"…"}`;
closing a whole subtree is the `choice` of a `close` option at its root.

**Gates and readings.** When the human rules a gate, append
`{"type":"gate","id":"terrain/g3","item":"terrain:W43","statement":"…","metric":"…","unit":"dB","tolerance":3.0,"direction":"max","ruled":"terrain:W43","quote":"…","at":"…"}`.
After each step that read it, append
`{"type":"reading","gate":"terrain/g3","after":"terrain/d41.1","value":4.7,"unit":"dB","verdict":"pass|fail|inconclusive","evidence":"terrain:F48","at":"…"}`.
Report the verdict in the item's own number against its tolerance. **Never say
a line is "getting closer"; give the readings and let them be compared.** A
step that read no gate writes no reading and says so in its result: "this step
read no gate; it …".

## Checkpoints

**Stop and review with the human, and do not start the next step,** when any
of these is true:

1. the budget in (d) is spent;
2. a return condition in (e) has fired;
3. two steps in a row read no gate;
4. a gate's readings moved away from its tolerance twice in a row;
5. the human asks.

These numbers are starting values; the human adjusts them in (d), and "Lessons
from use" below records what they learn. At a checkpoint, give the human one
screen: the question and gate; the readings in order against the tolerance;
how many steps read the gate and how many did not; the budget used; the
earlier options never taken, with how far back they are; and the options,
including the return and a close, with a `recommended`. Record it as a
decision. Wait for the ruling. Add
`"checkpoint":"budget|return|no-reading|moving-away|asked"` (the reason) to that
decision. A line the human lets continue gets a new budget in a revised plan
(`centina-realize`, "Revising the plan").

## Measuring

For every measurement whose result will be recorded or decide a design. Unit
tests of behavior already known are exempt. If unsure whether a result will be
recorded, assume it will. The human confirms each plan before it runs.

**The measurement plan, in the step's part of the entry before any code:**

1. **Question** in one sentence, and the prediction as an `F` entry with
   `Status: predicted`, with the reasoning and the numbers expected.
2. **Premises:** each cited to the `F` that measured it or marked assumed. An
   assumed premise that would change the conclusion if false is measured
   first, as its own step.
3. **Reference:** what the result is compared against, shown valid on its own
   (a known limit, a closed form, an independent method) and converged.
4. **Configuration:** the settings under test are the ones that ship, or why
   the difference cannot matter.
5. **Controls:** one factor at a time; interacting factors together and apart.
6. **Sample:** its size and why it is enough; spread, not only a centre.
7. **Refutation:** the result that would refute the hypothesis. A check that
   cannot fail is a regression test; record it as one.
8. **Stopping rule:** which decision the result feeds, and which gate it reads
   or that it reads none.

**While running:** every section prints, and a section that printed nothing
did not pass; confirm each row and column label names what the code computes;
never tune a model, a constant or the world to reproduce an earlier number,
since a disagreement with it is the finding.

**After running:** update the prediction to `measured` or `measured-false`
with `Evidence` (harness file, command, commit); the prediction's text stays.
For `measured-false`, record which premise or inference failed. Follow
`ledger.md`, "When a status changes". Quote every number with its conditions.
Say `measured` only with the evidence in hand.

**A diagnosis is a claim.** "The cause is X" is a hypothesis until measured:
check it before reporting it as the cause or building a fix on it.

## Closing a spike

1. Record the answer as an `F` entry, `Status: measured` (or
   `measured-false`), with the gate's final reading as its evidence.
2. Set the `W` entry `done` when the gate is met or (a) is answered, `deferred`
   with its condition when the human parks it, or `withdrawn`. Those statuses
   are the human's to decide.
3. Trail: the `choice` of the close option, and a `mark` on any branch left
   unexplored that the human parks or abandons.
4. Hand back to `centina-realize`'s step-close review: does the result change a
   later step, a premise or the definition of done?

## What NOT to do

- Don't append a step the confirmed plan did not contain; that is a new `W`
  and the human's confirmation first.
- Don't chase a side observation inside the item; give it its own `W`.
- Don't carry on past a fired return condition without the human's ruling.
- Don't offer options that are all ways to continue; offer the close, and the
  nearest unexplored branch.
- Don't invent a gate or a tolerance, and don't say a line is converging.
- Don't run a measurement whose result could not change a decision, or whose
  gate has not been ruled.
- Don't record a claim as fact without evidence, or a diagnosis as a cause
  without checking it.
- Don't promote spike code into build code, and don't edit `.centina.ts`
  files.
- Don't change `ledgerHook`, and don't open a transcript without asking
  (`ledger.md`).

## Lessons from use

_Accumulate here as the skill is exercised. Open: the starting values of N = 2
and of "two steps" at checkpoints are guesses; whether recording a decision
every turn holds up over a long session or drops records; whether a
qualitative gate needs more than a stated test and a verdict._
