# Grounding check: design

**Status:** agreed in a design session on 2026-10-24. Not built. Rule 0a
stays live in `CLAUDE.md` and the skills until the grounding check is built
and tested (see "Testing"). Sequenced behind the head-to-head's frozen tag,
the same as `behavioral-obligations.md`.

Origin: an outside architecture review of Centina (2026-10-23) proposed
replacing Rule 0a with "semantic-diff approval": the agent prepares a precise
patch and the human approves the meaningful differences. We rejected that as
stated, since approving a coherent patch is the rubber stamp `why.md` is
written against. But the review was right that Rule 0a is a means under
test, not an axiom, and working out what it is a means *to* led here.

## What Rule 0a does and doesn't do

Rule 0a keeps the pen with the human: the agent hands a settled edit over
verbatim and the human applies it. That succeeds at one thing. An agent can't
make invisible spec changes, and so can't introduce error at a high rate. That
part is worth keeping.

What it doesn't do is check that the human understands what an edit means for
the intent the spec was written to carry. Some edits correct misses in the
original writing and can go in without concern. Others diverge from the
original intent. Telling which is which is the hard part, and holding the pen
doesn't help with it. Once "hand edits over verbatim" gives the human exact
text in a code fence, applying it is a copy-paste, which is no more engaging
than approving a diff.

Air traffic control has a name for this: *read-back*. The pilot repeats the
clearance and the controller checks it, which catches mishearing but not
misunderstanding. Medicine uses *teach-back*: the patient explains the
instructions in their own words, which catches misunderstanding. Rule 0a with
verbatim edits is read-back. In `why.md`'s terms, a pasted snippet is another
model run; it can't pull anything back toward what the human meant.

## Purpose

The grounding check moves the gate from the pen to understanding. If the human
can show they understand what an edit means, and has no objection, the edit is
safe to make, whoever applies it. If they can't or won't, the edit isn't
forbidden, but it goes in as a recorded assumption, the same kind of record as
an `as` cast: something asserted and not verified.

That splits what Rule 0a does into two parts:

- **Visibility.** Every edit the agent applies is shown as a diff identical to
  the one agreed. This is the part of Rule 0a that already works, and it can
  be enforced mechanically.
- **Understanding.** A grounding check on every edit that could change
  meaning.

Rule 0 doesn't change. The agent never decides meaning, and an unsettled fork
stays a question, never a snippet.

## What triggers a check

The ledger and the spec itself are the record of every decision made. Whether
a given decision is meaningful or a detail can't ever be considered settled;
people mostly don't know which parts they care about until a concrete case
breaks one. So asking the human "is this meaningful to you?" is not the
trigger. Every decision is recorded, and every later edit that appears to
violate one is flagged.

The agent flags an apparent violation however the edit originated: proposed by
the agent, written by the human, or carried in from elsewhere. An edit the
human originates carries a different risk (contradicting an earlier decision
they've forgotten, the failure the head-to-head's T4 plants), but it's flagged
the same way.

Since everything in the spec is a decision, "touches a decision" alone would
flag every edit, and a gate that fires on everything gets rubber-stamped. The
line falls by kind of edit:

| Edit | Why | Check |
| --- | --- | --- |
| Adding, removing or changing a Centina JSDoc tag (`@datasource`, `@datasink`, `@boundary`, `@external "<source>"`), anywhere and by anyone | These are the spec's boundary and provenance declarations: a new one is a new seam or a new outside dependency in the DAG | always |
| A modification or deletion of existing spec content | It revises an earlier decision by definition | always, except the visibility-only edits below |
| A comment edit, a pure rename, or a pure move | Proven to leave every relationship as it was (see below) | visibility only |
| A fill of a routed hole, written by the human | It resolves a decision deliberately left open; the hole is the record that it was open | visibility only |
| A fill drafted by the agent, beyond a declaration | The meaning is the human's, but the encoding is the agent's | always |
| An addition outside any hole | A new decision, which can contradict an old one without touching its text (a door that bypasses an `R`, a union variant that breaks an exhaustive decision) | when the agent judges it appears to violate a recorded decision |

**Comment edits** are diff-confirmed, except where a comment is the only place
a piece of meaning lives, or where it is Centina vocabulary. These always get
a check:

- the comment on a `deferred` hole. In the C-nofill style (`head-to-head.md`)
  the flow lives there and nowhere else, so a reworded hole comment is a
  rewritten flow whose diff looks like a wording fix;
- the spec's purpose header, the one `specExplanation` requires;
- a removed ledger citation, which cuts the link the trigger reads to see
  which decision a line belongs to;
- any change to a Centina JSDoc tag. That's the table's first row, which
  applies wherever a tag appears: on an existing declaration, on a new
  declaration added outside a hole, or in a fill the human wrote. The tags are
  comments to tsc, but they are the spec's boundary and provenance
  declarations, and the checker's rules read them.

`@agent:` notes are not in that list. They are spec-authoring metadata between
the human and the agent, never the spec's domain content (`CLAUDE.md`, "Two
different 'agent' concepts").

**A pure rename** is the same symbol under a new name, every reference
updated, and nothing else in the diff, all of which the checker can verify. It
still carries a risk the proof doesn't cover: Rule 0 counts data nouns as
meaning, and a new name can quietly answer a question (`Order` to `Purchase`
may settle whether a draft counts). So the diff presents a rename as one line,
`Order → Purchase`, not as every reference it touched, so the human actually
reads the new word. A rename bundled with any other change isn't pure.

**A pure move** relocates code without changing the component DAG: no new
dependency between specs, no change to which boundary a declaration belongs
to, and every reference resolving to the same symbol as before. The checker
verifies it by comparing the dependency graph before and after. A move that
changes an edge is a structural change and gets a check.

A proof that relationships are preserved is not a proof that meaning is.
Names are where the two come apart, which is why a rename is shown as one
line rather than buried in its references.

### Ledger content doesn't trigger a check

The ledger exists in service of the spec, which is the artifact that survives
into implementation. `centina-iterate` and `centina-realize` write dozens of
related entries (questions, options, findings, open proposals, work items)
before a decision settles, and none of it matters except as measured against
the spec. Gating that churn would charge for the same thing twice, on the
noisiest part of the system: a ledger change that matters already reaches the
spec, since `ledger.md` ("When a status changes") has every status change
search the spec for its label and the old claim's terms, and fix or raise each
dependent. That spec edit is what triggers the check.

The ledger is still what the check reads. It is the record the trigger uses to
find the decisions an edit touches, and the record the human's account is
compared against. For that comparison the check uses each entry **as it read
when ratified** (git has it), and shows any later rewording alongside, so a
clarification made in place afterward, by the agent or the human, can't
quietly move what the account is compared to.

The hill-climbing loop's double-run (`head-to-head.md`) shows the kind of
error the third row is for: a body that reads fine and carries a flow nobody
meant. That one was the author's own, so the trigger wouldn't have fired on it;
an agent's encoding of a body can fail the same way. A prediction question
about the `FEEDBACK_REQUIRED` path would likely have surfaced it either way.

The first three rows are mechanical. The fourth depends on the agent noticing a
contradiction, so the rule there runs one way: **the agent's judgment can add a
flag but never remove one.** A mechanical flag is never talked away because the
agent thinks the change is harmless. Contradictions the agent misses in the
fourth row are the remaining risk, and this design doesn't claim to close it.

A decision that was made but never recorded is invisible to the check. That's
a real hole, but it pushes toward recording decisions, which is the habit
Centina wants anyway.

## The check

The agent that proposes a change keeps explaining its reasoning, as it does
now. That explanation is valuable, and it's also why an open question ("what
does this change for you?") fails as a demonstration: the human can paraphrase
the agent's reasoning back and pass. The check works by asking for what only
the human has. The agent's reasoning explains why the change is good. It
doesn't contain what the human meant when the current text was written, or
what they've learned since. Those exist only in the human and in the record.

A proposed change, by existing, implies that the spec and the human's intent
have come apart. The check has the human reconcile their intent as the spec
records it with their intent as it is now, and that reconciliation, once
articulated, is the demonstration.

**It opens with the motive.** Is this change being made because the spec is
wrong, because it's out of date, or because the human never actually decided
this? The third is the failure `why.md` describes: a guess, the human's or the
agent's, that got signed off without being decided. The answer is multiple
choice, so picking one proves nothing. It decides which follow-up comes next,
and the agent's reasoning presuming a motive does no harm, for the same reason.

| Motive | The agent asks | Checked against |
| --- | --- | --- |
| **Wrong:** the spec never matched what the human meant | What did you mean when this was written? Where does the current text fail to say it? Does the proposed change say it? | The original ledger entry |
| **Out of date:** the intent has changed | What did you learn? What was the old decision protecting against, and does that still matter? | The old entry's rationale, and what depends on it |
| **Never decided** | Then decide it now: a short elicitation, as in session zero | What was built on the entry |

"What was the old decision protecting against" is the Chesterton's-fence
question, and it's the step most likely to be skipped, because the new
information makes the old decision look obviously obsolete.

**The record keeps the answer honest.** The ledger entry holds what the human
said at the time. If their account of what they meant doesn't match it, the
mismatch is a finding in its own right: either they've forgotten, or the entry
was badly recorded.

**When the human can't reconcile without the history,** the check walks back
through the decision chain that produced the entry: the question, the options
weighed, the proposal ratified. This is a branch inside the check, not a
trigger of its own. The agent may offer it, since offering more thoroughness is
fine; offering less is what it never does.

**It closes with a prediction.** The agent finds a concrete case where the
current spec and the edited one behave differently, and the human says what
should happen before the agent shows which version does what. Choosing that
case doesn't steer meaning, because it only locates where the two versions
differ. The agent writes down its own prediction first, so it can neither
anchor the human nor quietly adjust its own.

**Neither side grades the other.** Agreement means the edit is grounded.
Disagreement is the finding, whoever turns out to be wrong, and a failed
prediction has two possible causes: the human misread the edit, or the spec
doesn't say what the human thinks it says. The second is a legibility (G1)
failure in the spec, and arguably the more valuable catch.

## Verdicts

The human decides every verdict, as with every ledger status that means a
decision (`ledger.md`). The agent running the check records it.

- **Confirmed.** The spec was wrong and the edit restores the intent. The
  touched entry stands.
- **Superseded.** The new decision replaces the old one, recorded with
  `Obsoletes`/`Obsoleted-by` (or `Updates`/`Updated-by` for a partial
  change). The old entry is marked, not deleted.
- **Dropped.** The edit is wrong, and it doesn't go in.
- **No conflict.** The violation was only apparent. The ledger records why both
  hold, so the same flag doesn't come back next session.
- **Unconfirmed.** The edit went in without a demonstration (see "Recording an
  unconfirmed edit").

**"Never decided" on a ratified entry reaches downstream.** Everything that
rests on that entry (entries that cite it in `Premises` or `Depends-on`, spec
content that cites its label, work items in its "Affected work items") is
marked for review, because it was built on something that was never a
decision. The human may skip that review, but only of their own volition. The
agent respects a skip once asked, records it, and never offers one.

## Recording an unconfirmed edit

On the entry the edit touches, not as a new letter, so the decision and its
unconfirmed revision stay in one place. The form is a header field,
`Unconfirmed` (the date, the edit and the work item that ran the check),
rather than a status. Statuses are each letter's own lifecycle, and an edit
can touch an entry of any letter; `Parked` is the precedent for a field that
cuts across letters. The ledger index lists every `Unconfirmed` entry until a
later check confirms it or the entry is superseded.

## Where the check runs

**Not in the session that proposed the edit.** The agent that argued for a
change has a stake in the answer and will tend to accept a weak demonstration.
A fresh agent with no investment in the edit is the right one to run the check,
the same reason an author doesn't review their own work. It also keeps the
check's conversation out of the main session's context.

**Not in a subagent.** A subagent runs and returns without anyone talking to
it, and the check is a conversation with the human. It has to run in a session
the human can talk to.

**The ledger is the channel.** A flagged edit becomes a `W` work item of a new
`Kind`, `grounding-check`. The item holds the edit, the decisions it touches
and the proposing agent's reasoning, word for word. A new skill (working name
`centina-ground`) reads the item, holds the conversation and writes the
verdict, and the main session reads the verdict from the ledger. That is the
same hand-off `centina-realize` uses to give a spike to `centina-spike`. In the
Claude desktop app the check can be spawned as a side session that reports
back; in a plain CLI the human runs the skill in another session, and the work
item is the hand-off. Either way nothing depends on the host.

The fresh agent lacks the conversation the edit came out of. The reasoning
carried word for word covers most of that, and anything it doesn't cover shows
up in the check as a question for the human, which is the point of the check.

**While a check is pending,** edits touching the same decision wait on it (the
existing blocked `W`, its `Depends-on`, and the index's "Affected work items").
Edits touching other decisions go ahead.

**One check per decision.** Several flagged edits touching one decision share a
single check. Edits touching different decisions get separate checks, and an
edit touching two decisions waits on both. A check that spans several decisions
turns back into the form everyone rubber-stamps.

## Testing

Rule 0a's benefit can't be measured with a simulated human, since it lives in
the human's attention while they type, and a persona pasting a verbatim edit
has none to lose (`head-to-head.md` measures only its cost). The grounding
check can be tested. A persona has an intent document, so edits that diverge
from it can be planted and the catch rate measured, against a control that
shows the diff and nothing more.

It fails if:

- it catches planted divergences no more often than the diff-only control;
- it fires often enough that the human skips it. The skip rate is the
  measurable sign of fatigue.

It runs as its own arm in a later head-to-head round, after the frozen tag,
with predictions written and ratified by the author before that round. Until
it has passed, Rule 0a stays as it is.

## Open items

- **Ratified `R` and `A` entries.** A status change searches `buildRoots` as
  well as the spec (`ledger.md`), so superseding a ratified rule or axiom can
  change what the system does with no spec text changing: the change lands in
  build code, in guards or values. The intent is for those entries to reach
  the spec one way or another before implementation, and until then
  `centina-realize`'s change requests route every contract change to the
  human. Left open, to watch: if a superseded `R` or `A` changes meaning
  without a spec edit in real use, it gets a trigger of its own.
- **Computing what an edit touches** (build list, item 2).

## Build list

1. Ledger: the `grounding-check` `Kind`, the `Unconfirmed` field, lint for
   both, and an index section listing unconfirmed entries.
2. Checker: classify an edit against the previous version of the file
   (modification or deletion, fill, addition, comment edit, Centina JSDoc tag
   change), prove a rename or a move pure (same symbol and every reference
   updated; the dependency graph unchanged), and find the decisions an edit
   touches. Spec comments cite ledger labels and decided obligations cite a
   `P`, but computing what an edit touches is open design work, not yet
   settled.
3. The `centina-ground` skill.
4. `centina-iterate`, `centina-session-zero` and `centina-realize`: flag,
   create the work item, hand off. Rule 0a's text is replaced only once the
   check has passed testing.
5. Docs: `ledger.md`, `concepts.md`'s "Keeping the agent in its lane", and the
   skills' references.
6. Tests, including positive controls: a planted modification of settled
   content, a reworded hole comment, a changed JSDoc tag and a new
   declaration carrying one (including inside a human-written fill) must each
   trigger a check, and a rename bundled with another change must not pass as pure.

## Risks

- **Fatigue.** If the check fires too often, the human starts skipping it or
  answering by rote. Defenses: the trigger table, one check per decision, and
  the skip rate as a measure.
- **Missed contradictions.** An addition that contradicts a decision without
  touching its text is caught only if the agent notices.
- **Unrecorded decisions** are invisible to the check.
- **Exempt edits that carry meaning.** A comment edit outside the listed
  exceptions, or a pure rename, can still shift meaning. Defenses: the
  one-directional rule (the agent's judgment can still flag one), and a rename
  shown as one line.
- **A fluent but wrong account.** A human can articulate a reconciliation that
  sounds right and isn't. Defenses: comparison against the record, and the
  prediction.
- **Cost.** A session per check is real overhead. The trigger table exists to
  keep that overhead on the edits that warrant it.
- **Under-reporting.** If the checker's computation of what an edit touches
  misses a decision, the check never fires. The positive control exists for
  that.
