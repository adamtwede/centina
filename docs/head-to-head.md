# Head-to-head validation — design

**Status:** frame, draft. Nothing has run. Fixed before any run so the
experiment can't rubber-stamp itself, in the manner of `fit-validation.md`'s
falsifiability frame. Design decisions settled by the author on 2026-10-24
are marked as such. A prediction counts only once the author has ratified
it; the task table shows which have been.

Supersedes the two-arm plan in `fit-validation.md` ("prose-vs-Centina, still
pending") and the ROADMAP item that carried it.

## What's on trial

Whether Centina meets its own goals (`why.md`, "The goals") on distilled
tasks, and which of its means are earning their keep. The goals stay
comparative against conversational prose. The means are tested against a
version of Centina without them (the ablation). That is the same move
`fit-validation.md` made with provenance: a means stays only if it pays its
way.

- **G2** (unknowns caught during spec-writing) — tested by every task.
- **G3** (the plan reflects the spec-writer's intent) — tested by every task.
- **G4** (a foundation to iterate on) — tested by T4 and by T5's cold
  hand-off to a fresh implementer.
- **G1** (easier for a human to describe and understand) — **out of scope.**
  A simulated human can't report what a human finds easier. A later, cheap
  probe: the author rates artifacts blind to arm.

**Cost is not a goal.** It is the price each means pays. A mechanism earns its
place if its gain over the ablation justifies its added cost, judged by the
author with gain and cost reported side by side, never collapsed into one
score.

This is a direction-finding experiment, not a proof. Its job is to say where
further effort should go (elicitation, the typed artifact, the checker, the
ledger), and the sample sizes below are sized for that, not for significance.

## Arms

- **A — prose.** A planning-mode conversation between the operator agent and
  the persona, ending in an implementation plan. No skill, no spec file.
- **B — ablation.** Centina's elicitation without its machinery: the same
  gated phases and the same Rule 0 as `centina-session-zero` and
  `centina-iterate`, but the artifact is a markdown spec (`SPEC.md`) with an
  explicit open-questions list and an acceptance-test file. No TypeScript, no
  checker, no ledger, no routing vocabulary. Ends in a plan.
- **C — Centina.** The plugin as shipped: skills, checker, ledger. Ends in
  `PLAN.md`.

**The treatment is frozen at a git tag** (settled 2026-10-24). Arm C's
plugin, the C-nofill instruction and the ablation skill are all built from one
tag, cut from `main` once the ablation skill and the C-nofill instruction are
written, and before any code for behavioral obligations
(`behavioral-obligations.md`) or the grounding check (`grounding-check.md`)
lands. Development after the tag never reaches the runs. Obligations and the
grounding check each get their own arm in a later round.

B isolates the claim only Centina makes: that a typed artifact the checker
holds to account catches what disciplined conversation alone misses. If B
matches C, the effect is elicitation, and the skills' conversation rules are
where the value lives.

**Strawman guard.** B is designed, written and frozen before any run, and the
author reviews it specifically for weakness. A B that loses because it was
built to lose tells us nothing. The opposite failure is a B that drifts back
into Centina (typed holes and routing labels in markdown); that is a
legitimate arm but tests something narrower, and it is not this one.

**B may use free-form pseudocode** (settled 2026-10-24). A diligent engineer
writing a markdown spec for a loop like T5's would likely reach for a fenced
pseudocode block, so forbidding it would weaken B toward a strawman. Allowing
it changes what T5 tests from "code versus prose" to "checked, typed code
versus unchecked code."

**So T5 varies the flow's form in both B and C, a 2×2** (settled
2026-10-24):

| | Flow in prose or comments | Flow as code |
| --- | --- | --- |
| **Markdown** | B-prose (pseudocode forbidden) | B-pseudo (pseudocode allowed) |
| **Centina** | C-nofill | C-fill |

**C-nofill** is the Centina skeleton without human-written bodies: the
signatures, types, enums, boundaries and the call structure between them,
with each body a `deferred<"open">` hole whose comment describes the flow it
should carry. It asks whether a spec without bodies, in effect a DAG with
comments, carries the flow as well as filled bodies do. Filled bodies carry a
cost of their own: the author's logic errors (see "Separate probe: authoring
error in the hill-climbing loop"). **C-fill** is C as shipped. Outside T5,
"C" means C-fill.

Reading the 2×2:

- **code beats comments in both rows:** expressing the flow as code matters;
- **Centina beats markdown in both columns:** the skeleton, types and
  checker matter, with or without bodies;
- **Centina beats markdown only in the code column:** the checker's value
  lies in holding bodies to account;
- **C-nofill ≥ C-fill:** at this size, the bodies cost more in introduced
  errors than they gain;
- **all four equal:** markdown carries the flow fine, and the core claim is
  refuted for flows of this size.

## The simulated human

An agent plays the human in every arm. It is the measuring instrument, not a
stand-in, and is designed as carefully as the tasks. Its main advantage over a
real human is **ground truth**: its intent is written down before the run, so
an unauthorized decision is a count rather than a judgment call.

**Intent document, per task:**

- **Decided items.** The persona holds a view and gives it when asked.
- **Undecided items.** The persona has no view until a question forces one,
  then answers from a hidden tiebreaker sheet so the answer is the same across
  arms ("I hadn't thought about that. Let's say ...").
- **Delegated items.** Legitimately the implementer's call, the analogue of
  `deferred<"open">`. Asked about one, the persona says so ("your call").

**Failure modes, fixed as parameters, identical across arms** (settled
2026-10-24). Without these the persona checks every proposal against its
document, never rubber-stamps, and Centina's target failure never happens in
any arm:

1. Answers direct questions only; volunteers nothing.
2. Accepts a plausible proposal touching an undecided item it wasn't asked
   about (the rubber stamp).
3. Rejects a proposal contradicting a decided item only when the proposal
   states the contradiction; doesn't trace implications.
4. In C, applies spec edits it is handed verbatim (Rule 0a's cost lands here).
   Only the cost: Rule 0a's benefit lives in a human's attention while
   typing, which a persona pasting an edit doesn't have, so this experiment
   can't measure it (`grounding-check.md`, "Testing").
   In B, writes the markdown itself. In every arm, writes any function bodies
   or flow itself (Rule 0); in C-nofill, as comments on open holes.
5. **In T4 only, forgets.** The persona sees its intent document and only
   the most recent turns of the conversation. The window is set per run so
   that, by the time the requirement change arrives, the turns where the
   original decisions were made have fallen out of it. Without forgetting
   somewhere, the ledger can show no value at all; T4 is the longest task and
   the one where earlier decisions matter most. The window is mechanical (a
   truncated transcript), not a prompt asking the persona to forget.

Not modeled: fatigue, forgetting outside T4, context rot over a long session.
See "Threats".

**Leak audit.** A persona holding its full intent will mention things nobody
asked about. The prompt discourages it but can't guarantee it, so every
transcript is audited for unprompted disclosure of an intent item, and the
leak rate is reported per arm. A leaked item is scored separately, never as
caught.

**Model-family check.** The persona and the operator sharing a model may share
blind spots: the operator asks the questions that model finds natural. At
least one task is re-run with the persona on a different model family.

**Calibration.** Before the main runs, the persona and the author each take
the same task in arm C. Compare the pattern of answers, acceptances and
rejections. If the persona doesn't behave like the author, everything
downstream measures a fictional user, and the parameters get revised first.

## Tasks

Each task isolates one claimed advantage. Distilled: small enough to run many
times, shaped like a problem that recurs in real design work. Every task has a
seed prompt, an intent document, a **decision-point list** (every decision the
plan must make, each tagged decided, undecided or delegated), and a
prediction. Orderings are on the task's primary score; the expected numbers
are added in Phase 1, once each decision-point list is fixed.

| | Task | Claim under test | Prediction | Status |
| --- | --- | --- | --- | --- |
| T1 | **Hidden decisions in a sentence** (the dashboard kind) | G2, elicitation | B ≈ C > A | ratified |
| T2 | **A shape two components must agree on, then changed** | The checker across a seam | C ≥ B > A | ratified |
| T3 | **A missing step** (a value used but never produced) | Structural omission | C > B ≥ A | ratified |
| T4 | **A requirement change mid-task** | G4, rework, the ledger | C ≥ B > A | ratified |
| T5 | **Flow** (implemented; see below) | The flow survives into code | C-fill ≥ C-nofill > B-pseudo > B-prose > A | ratified |
| T6 | **Mostly realization** (a pricing algorithm behind one door) | Negative control | A ≈ B ≈ C | ratified |

**T2 must be big enough to fail.** At distilled size the whole spec fits in
the operator's context, and a strong model will likely keep a two-component
shape consistent just by reading it. So the shape is used at enough sites
(six or more) and the change touches a subtle enough field that consistency
by reading is error-prone. A T2 small enough for reading to cover it is
designed to come out null.

**T3 and unchecked pseudocode.** B may write the missing step's surroundings
as pseudocode, and a strong operator may notice the undefined value by
reading it. Hence B ≥ A rather than B ≈ A.

T3 could fold into T5 (T5's intent can carry an easily omitted step), at the
cost of muddier attribution. Kept separate by default.

### T5 — flow

The one task carried through to implementation, and the case the ablation is
most expected to fail: carrying a non-trivial logical flow from intent into an
implementation. In C-fill that flow lives in filled-in spec function bodies;
in C-nofill, in comments on open holes; in B, in markdown, with or without
pseudocode. Its primary score is the trace suite's pass rate (stage 3 below).

**Shape.** Isomorphic to `hill-climbing-loop.centina.ts`'s
`implementationLoop` and `escalate`, transplanted to a fresh domain: a retry
loop with in-loop feedback, decomposition into recursive sub-runs, an
escalation chain ending in a human hand-off, precedence between two sources
of feedback, a lookup that always runs whether or not its result is used, and
record-keeping on each branch. Not the hill-climbing loop itself: agents in
the runs must not have seen the answer.

**Domain: a translation pipeline** (settled 2026-10-24). The mapping:

- an implementation step → a section of a document to translate;
- the target model → a machine-translation engine, on a tier;
- the supervisor → the reviewer, which scores each translation and decides:
  send it back with feedback, split the section into smaller segments (each
  a recursive sub-run), escalate to the next engine tier, or accept;
- the top of the chain → in autonomous mode the reviewer translates the
  section itself; otherwise the pipeline pauses for a human translator;
- the task matcher → the translation memory, looked up on every attempt;
  in-loop feedback takes precedence over a memory match in the prompt;
- encoding on completion → writing the accepted segment and its feedback
  history back to the translation memory, tagged with the engines that
  attempted it.

**Intent is held as scenario traces**, not as code or prose steps. A trace is
a situation and the sequence of events that should follow it ("the first
attempt scores low and feedback is given; the retry carries that feedback and
scores high; the step completes and its record holds both attempts"). Code
would favor C and prose would favor B; traces favor neither. The persona
synthesizes the flow from them, in its arm's format.

**Hand-off.** A fresh implementer agent receives the spec (and, in C, the
plan) only, never the transcript. That also tests `why.md`'s claim that a
fresh agent can pick a spec up cold.

**Scoring, in three stages, so the loss can be located:**

1. **Spec against intent.** The judge walks each trace through the written
   flow and records the outcome the spec produces. Where does the spec already
   diverge from what the persona meant? In the code cells, a divergence here
   is often an error the persona introduced writing the flow. That is the
   instrument's error rate, not an author's: reported as such, and never read
   as evidence about human authors (that is the separate probe's job).
2. **Implementation against spec.** The implementation's actual outcome on
   each trace, set against the outcome stage 1 recorded for the spec.
3. **Implementation against intent.** A hidden suite of executable traces runs
   against the implementation, with model calls mocked. Pass rate per trace,
   and which kinds of trace fail (straight-line, loop-and-recursion
   interaction, precedence, record-keeping).

Each trace then has three outcomes (intended, specified, implemented) and
falls into one class:

- **carried** — all three agree;
- **propagated** — the spec diverged from intent and the implementation
  followed the spec;
- **corrected** — the spec diverged from intent and the implementation went
  back to intent on its own;
- **lost** — the spec matched intent and the implementation diverged;
- **compounded** — the spec diverged, and the implementation diverged from
  both.

**Divergence flags.** For each run, count where the operator (while the spec
was written) or the implementer raised a divergence or a doubt about the flow,
rather than resolving it. A **corrected** trace the implementer didn't raise
counts as an unauthorized decision, even though the outcome matches intent:
it is the same over-competence Centina exists to catch, and it was right only
by luck.

**The trace seam** (settled 2026-10-25). An executable suite needs one fixed
interface to call, and implementers working from different sources would
otherwise produce differently shaped programs. Every implementer, in every
cell and in the probe, is given the same minimal I/O contract word for word: a
language, an entry point, and the external calls the flow may make (prompting
an engine, the reviewer's verdict, the memory lookup, the human hand-off,
writing the record), each with its signature. It names what can happen at the
system's edge, never when, how often or in what order. The mocks script those
calls and log every one, so a trace is a mock script, the expected call log,
and the expected final record. The call names and the record's shape are
chosen so they reveal no more of the flow than the prose header does.

The contract hands the prose source structure it wouldn't otherwise have, and
the prose source gains most from it. That cuts against the ratified
predictions, so the bias is conservative. It is also close to what an author
would hand an agent in a prose-only workflow anyway. The alternatives are
weaker: an adapter agent wiring each implementation to the suite could quietly
fix the bugs being measured, and a judge walking traces through code loses
the objective pass rate.

**Positive control for the trace suite.** Before any run, the suite runs
against a reference implementation (must pass) and against a deliberately
broken one, for example one where a recursive retry returns into an outer loop
that then re-attempts the same step (must fail). A suite that has never failed
proves nothing (`realize-conformance.md`, "Positive controls").

## Scoring

**Decision points.** For each plan, the judge places every item on the
task's list in exactly one bucket:

- **correct** — a decided item, committed as the intent says;
- **contradicted** — a decided item, committed otherwise;
- **caught** — an undecided item the persona was asked about;
- **routed** — an undecided item the plan leaves explicitly open;
- **unauthorized** — an undecided item the plan commits to without anyone
  asking the persona;
- **delegated** — an item left to the implementer. Committing to it and
  leaving it open both count as fine; it is never unauthorized, and routing
  it earns nothing. Without this bucket, an arm that routes everything would
  win T6 through bookkeeping alone;
- **leaked** — any item the persona disclosed unprompted (from the audit).

Decisions the judge finds that aren't on the list are flagged as **unlisted**
and reviewed by the author: either the plan invented structure, or the
intent document was incomplete.

**Blinding.** The judge sees only the plans and the intent document, never the
specs: a `.centina.ts` file or a ledger citation gives the arm away. A
normalizer pass rewrites every plan into one format and strips arm-specific
vocabulary; the author audits a sample of its output for distortion.

**Judge calibration.** The author scores a sample of plans by hand; the
judge's agreement rate is reported before its other results are read.

**Cost, per arm.** Tokens, wall-clock time, and the persona's workload as a
stand-in for human effort: questions answered, proposals accepted and
rejected, edits applied, words written.

## Isolation

Settled 2026-10-24. Running each agent in its own directory isolates nothing.
A Claude Code agent can read any path the OS user can, run `curl`, and fetch
web pages. The known leaks:

- **The public repo.** `origin` is `github.com/adamtwede/centina`; one fetch
  returns the filled spec. Keeping a doc out of the site build doesn't keep
  it off GitHub.
- **The author's home directory.** `~/.claude/CLAUDE.md` loads in every
  session on the machine, and auto-memory loads by project path. Either would
  shape the operator in every arm, unrealistically.
- **Absolute paths and history.** Any file on the machine is one `Read` away,
  and a `.git` in a run directory carries every version of every file.

Not a leak: the installed plugin. `install.mjs` bundles the skills, checker,
hooks, scripts and nine reference docs, with no `specs/` and not this
document. Its only mentions of the loop are a ledger example about escalation
depth and a filename in `iterate-reference.md`; neither gives away the flow.

**The controls:**

1. **One container per agent per run.** A fresh, empty home directory, so no
   user `CLAUDE.md`, memory or other plugins load. Only that run's input
   directory is mounted, built fresh from a manifest, with no `.git`. Arm C's
   image carries the plugin as bundled; the others carry none.
2. **Network blocked except the Anthropic API.** Each run container sits on
   an internal Docker network whose only exit is a proxy container with an
   allowlist; the allowlist is the smallest set of hosts a logged pilot run
   needed (see "Authentication"). This is the control that holds for
   anything run in the container, since `Bash` can reach the network
   whatever the tool settings say, and it stops `WebFetch`, which runs in the
   container. It does not stop `WebSearch`, which runs on Anthropic's side
   over the allowed API host: for search, the settings denial is the only
   control, and the tool-call audit below is its check. The checker's
   dependencies are installed when the image is built.
3. **Each role in its own container.** The persona's intent exists only in the
   persona's container. The operator sees only what the relay passes it. The
   judge sees the intent and the normalized plans, never the specs. The relay
   runs on the host.
4. **Hidden materials stay out of the public repo:** intent documents,
   traces, tiebreaker sheets, reference implementations, the trace suite.
   They live in a separate private repo (settled 2026-10-25). Anything public
   can be fetched if control 2 fails, and can reach a later model's training
   data. The harness itself isn't hidden and lives in this repo, in
   `experiments/head-to-head/`, which `install.mjs` never bundles.
5. **Record each run's model and its training cutoff.** The hill-climbing
   spec appears to postdate Opus 5.5's cutoff, so it is clean now. A rerun on
   a later model may not be.

**Proof that it holds.** Isolation reports by staying quiet, so it gets a
positive control like any other check:

- once per image build, try to escape from inside a container on purpose (read
  a host path, `curl` GitHub) and confirm both fail;
- plant a unique canary string in every hidden file, and search every
  transcript and output for the canaries;
- audit every tool call for a path outside the mount or a network attempt.

A run that leaked is discarded, and the leak is logged.

**Authentication** (settled 2026-10-25). The runs use the author's Claude
subscription, not an API key. A long-lived token from `claude setup-token`,
created and held by the author outside every repo, is passed into each
container; no agent in the experiment, including the one building it, sees
its value, and every transcript is scrubbed for it. `--bare` is unavailable,
since it accepts only an API key; the fresh home directory does its job.
Which hosts subscription authentication needs besides the API is found by one
pilot run with the proxy logging every request, and the allowlist is cut to
that set. The remaining risk, accepted: whatever the allowed host can carry.

**Usage limits.** Every role runs Opus on one subscription, so the runs are
scheduled around the plan's usage windows rather than run in one sitting. A
run cut off by a limit is discarded or resumed cleanly, never scored as
finished; the runner detects it. Cost is reported in tokens.

## Sample and stopping rule

- **Runs.** Five per task per arm (settled 2026-10-24), with five cells for
  T5 (A and the 2×2). 100 sessions, plus T5's implementation runs.
  Five shows spread, not significance; report spread with every central
  value.
- **Models** (settled 2026-10-24). Opus 5.5 in every role: operator,
  persona, T5 implementer, judge and normalizer. Realistic for the operator
  and implementer, and the strongest choice for the instrument and the judge.
  The cost is that every role shares one model, so the model-family check
  (persona on another family, for at least one task) carries more weight, and
  the judge is the same model as the operator whose plans it scores. Blinding
  and the judge's calibration against the author are the defenses against
  it favoring its own kind of output. The second family is chosen in Phase 1.
- **Decision fed.** Where further effort goes: elicitation (the skills), the
  typed artifact and checker, the ledger, or none of them. If no possible
  result would change that, the run is not worth doing.

## Falsifiability frame

Read in this order. An instrument failure is not a result.

1. **Instrument check (T1).** If A ≈ B ≈ C, the persona is too attentive to
   produce the target failure in any arm. Fix the persona; read nothing else.
2. **Negative control (T6).** If C beats A by more than the spread, the
   scoring favors Centina. Stop and find out why.
3. **The machinery (T2, T3, T5 against B).** If C doesn't beat B by more than
   the spread on any of them, the typed artifact and checker aren't paying at
   this scale. Effort goes to elicitation, and the checker becomes a
   hypothesis on trial, as provenance was.
4. **The flow (T5).** Read through the 2×2 above, C-nofill against C-fill
   first: that comparison decides whether the bodies pay their way. Then the
   trace classes: if a code cell's lead comes from having few stage-1
   divergences, it rests on the persona writing code well, which a human
   author may not (see the separate probe).
5. **Cost.** For every mechanism that shows a gain over B, its added cost, set
   beside the gain, for the author to judge.

## Threats to validity

- **Persona realism**, above all on rubber-stamping, the failure Centina
  targets. Mitigated by fixed parameters and calibration, not removed.
- **Correlated blind spots** between operator and persona. Mitigated by the
  model-family check.
- **Distillation.** Small tasks can't exercise context rot over a long
  session, one of the mechanisms `why.md` names. A null result here doesn't
  speak to large systems. Underworld remains the only evidence at scale.
- **The ledger is tested once.** Only T4's forgetting persona gives it
  anything to do, and the operator agent doesn't forget at this scale in any
  arm. A null for the ledger here is weak evidence.
- **Contamination.** No arm sees this repo, its specs, or this document. See
  "Isolation" for the controls and their positive control.
- **Ablation strength.** See the strawman guard. It applies to C-nofill too:
  a skeleton whose comments are thinner than an author would write loses for
  the wrong reason.
- **The persona's code isn't an author's.** Opus writing a flow from traces
  makes different mistakes, and probably fewer, than a human writing the same
  flow. T5 therefore understates the cost of bodies. The separate probe is
  the counterweight.
- **Experimenter bias.** The tasks and B are designed by an agent working with
  the author, both of whom expect C to win. Ratified predictions, the negative
  control and the instrument check are the defenses.

## Build list

1. **Harness.** Headless sessions with two agents per run (operator and
   persona), a turn relay on the host, transcript capture, and token and time
   accounting. The container images, the network block, per-run input
   manifests, and the escape test, canaries and tool-call audit from
   "Isolation".
2. **Ablation skill.** Derived from `centina-session-zero` and
   `centina-iterate`'s gating and Rule 0 text, with `SPEC.md` as its artifact.
   Frozen and reviewed before any run.
3. **C-nofill instruction.** The shipped skills plus one standing instruction:
   every body is routed as `deferred<"open">`, with the flow it should carry
   in its comment. Frozen and reviewed before any run, like B.
4. **Per task.** Seed prompt, intent document with tiebreaker sheet,
   decision-point list, prediction. For T5: reference implementation, trace
   suite, broken reference.
5. **Judge and normalizer** prompts.
6. **Persona** prompt with its parameters.

## Phases

0. **Frame** — this document.
1. **Build** — the list above, plus the trace suite's positive control.
   Ends by cutting the tag the treatment is frozen at (see "Arms").
2. **Calibrate** — persona against the author; judge against the author.
3. **Run.**
4. **Synthesize** — findings in the log below; what changes, in `ROADMAP.md`.

## Separate probe: authoring error in the hill-climbing loop

Settled 2026-10-24 as its own probe, outside the main runs.

**Why separate.** The risk of over-specifying is the product of two factors:
how often an author introduces logic errors writing a flow as code, and how
often those errors survive into the implementation. T5 measures the second
with a simulated human. It can't measure the first, because the persona's
error rate is the instrument's, not an author's. This probe measures the
first, with the author, on the real case.

**What prompted it.** `hill-climbing-loop.centina.ts`, as ratified. In
`implementationLoop`, the `FEEDBACK_REQUIRED` and `DECOMPOSE_STEP` cases
recurse and then `break`, which exits only the `switch`. The enclosing
`do/while` tests `implementationStepComplete`, still `false` in the outer
call, so the outer loop re-attempts the step after the recursive call has
already handled it. The header's prose describes one retry mechanism; the body
has two. The checker passes it. The author's account: the loop's intent and
design couldn't be expressed in prose, and writing it as pseudocode brought
the risk of logic errors with it. Whether the bodies are worth that risk, or
whether a skeleton with comments would have carried the same flow, is the
open question.

**Method.**

1. **Intent as traces.** The author writes what the loop is meant to do as
   scenario traces, in the same form as T5's, including the cases the
   double-run touches. Written before step 2, so the traces aren't tailored
   to either form.
2. **A no-fill version.** The author writes the C-nofill form of the loop:
   the same header and skeleton, each body a `deferred<"open">` hole with the
   flow in its comment. The comments describe the loop as the author would
   have before writing the fill, not as the author understands it now
   (settled 2026-10-25). Written that way, the no-fill and filled sources
   start from the same knowledge, and only the form differs, which is what
   the claim needs. The clarifications the author made while writing the
   traces go in neither, so both pass those traces only by inference. The
   version is `specs/hill-climbing-loop/hill-climbing-loop.nofill.centina.ts`,
   frozen at 96264f6 (see below).
3. **Three nested sources, fresh implementers.** Each source adds exactly one
   layer to the one before it, so each comparison isolates one layer:
   1. **prose** — the header comment alone, extracted to its own file;
   2. **no-fill** — the header, the skeleton, and the flow as comments;
   3. **filled** — the header, the skeleton, and the bodies, as ratified,
      defect included.

   Opus 5.5 implements the loop from each, given only that source (with its
   sibling specs `shared`, `task-matcher` and `task-corpus` for the two spec
   sources), under the isolation below. Five runs per source.

   The header's opening provenance note ("ported 1:1 … iterated on in
   centina-iterate sessions") is dropped from all three (settled
   2026-10-25), so every source's header starts at "loop:". The sources are
   built by `experiments/head-to-head/probe/sources.mjs`, which reads every
   file from git at the freeze commit (96264f6) and the contract at its own
   commit, never from the working tree. Each source carries the I/O contract,
   and each spec source's loop file is named `hill-climbing-loop.centina.ts`,
   so no filename says which source it is.
4. **Scoring.** T5's three stages and trace classes, and its divergence
   flags. The same trace suite, with model calls mocked, and the same
   positive control. How a doubt is raised and counted is below.

**The filled spec is frozen as ratified.** It is the treatment, defect and
all, so it isn't fixed until the probe has run. The probe uses it from a tag
or a pinned commit.

**The no-fill version is frozen too,** at 96264f6, so the two spec sources
are treated alike: errors found while drafting a source are fixed, and
anything found after its freeze stays, as the double-run did. Before the
freeze, the no-fill draft had one agent review, against the header and the
traces. The rule for what it could fix:

- **a comment that contradicted the header was fixed,** since the header
  predates the fill. One did: `escalate`'s comment had the autonomous and
  non-autonomous cases reversed. Separately, the draft had moved the header
  into `implementationLoop`'s comment, which broke the one-layer-per-source
  nesting, so the header was restored at the top, line for line;
- **a gap that only knowledge of the defect would close was left.**
  `implementationLoop`'s comment says it repeats "until the implementation
  step is marked complete", and nothing says a step that was broken down or
  escalated counts as complete once its sub-steps, or the more capable model,
  finish it. Read literally, with 5b's recursive call, that re-attempts the
  parent step: the double-run, in prose. The ambiguity is already in the
  header, so the prose source carries it too. Left open, it lets the probe
  ask whether the defect comes from how the intent was described or only
  from the act of filling.

**How an implementer raises a doubt** (settled 2026-10-26). Every implementer
gets the same prompt (`experiments/head-to-head/probe/prompt.md`), whatever
its source. It says to write anything in the source that is unclear,
contradicts itself or looks wrong to `/work/NOTES.md` before deciding how to
handle it, saying where it is, what the problem is, which choice was made and
why, and then to make that choice and carry on: there is no one to ask. The
prompt says nothing about an experiment, traces or scoring, and never names
the source.

It asks for doubts about the source, not about the contract. The filled
source's shapes differ from the contract's in many places (its
`taskMatcher(step, model)` against `lookup(step)`, for one), and the contract
already settles those: it wins on shape, the source on behavior. Asking for
contract conflicts would fill the filled source's notes with shape mismatches
and inflate its count for reasons that have nothing to do with the flow.

The divergence flags count a note only if both hold:

- **it is about what the loop does.** A note about names, types or how a call
  is split doesn't count, since some implementers will log shape mismatches
  anyway;
- **it was written before the code it covers.** The run directory keeps the
  transcript and `/work`, so the order of the writes to `NOTES.md` and
  `loop.ts` can be checked. A note added after the matching code was written
  records a decision already made rather than raising a doubt.

A doubt voiced only in the transcript or in a code comment isn't raised:
the prompt names one channel, and the count holds every source to it.

**Bias, stated.** One author, one flow. The author now knows the defect and
has spent many sessions with the loop. Writing the no-fill comments as the
author would have before the fill narrows that gap but can't close it: the
reconstruction can't be checked, and small fixes (the reversed condition,
the clarified wording) drew on what the author knows now. Whatever leaks in
favors no-fill, by an unknown amount, so a no-fill win is still weaker
evidence than a filled win. The no-fill draft also had a review the filled
spec's bodies didn't have in that form, though the filled spec had many
iterate sessions of its own.

**What it answers.** For this author on this loop: whether the no-fill form
carries the flow as well as the filled one; whether the filled form's defect
propagates, is corrected silently, or is raised; and whether the prose header
carries less than either (the author's account says it does).

**Prediction** (ratified 2026-10-24). Filled > no-fill > prose header.

**Cost and timing.** Fifteen implementation runs, plus the author's time on
the traces and the no-fill version. It needs no two-agent harness, only
single headless runs in isolation and the trace suite, so it can run first
and serve as a pilot for T5's trace tooling and for the isolation controls.

## Log

- **2026-10-25 — Phase 1 begun, with the probe.** The probe needs only
  single headless runs, so it goes first and pilots the isolation controls
  and the trace tooling for T5. Settled the same day: the trace seam, the
  private repo for hidden materials, `experiments/head-to-head/` for the
  harness, and subscription authentication.
- **2026-10-25 — The probe's no-fill version written and frozen** (96264f6).
  The author wrote the flow comments into an agent-made skeleton (header,
  imports, types and signatures copied; each body an empty open hole). The
  author first meant the comments to describe the loop as now understood,
  then settled on as it would have been described before the fill, so the two
  spec sources share a knowledge state. One agent review before the freeze;
  what it fixed and what it deliberately left is under "The no-fill version
  is frozen too". The I/O contract
  (`experiments/head-to-head/probe/contract.ts`) and traces draft 3 (private
  repo) were settled the same day.
- **2026-10-25 — The probe's sources and trace suite built.** The three
  sources drop the provenance note and are generated from the freeze commit
  (`probe/sources.mjs`). The trace suite (private repo) runs every trace in a
  container with no network. Its positive control passes: the reference
  implementation passes every required check, 25 mutants each fail the
  traces they name (the double-run among them), and every required check is
  failed by at least one mutant. The first control run found 12 required
  checks that nothing failed, and eight mutants were added to cover them.
  Building it also fixed three trace scenarios that couldn't run as written;
  one of them (H19) contradicted H13. Still open before any run: how an
  implementer raises a doubt, which the divergence flags count.
- **2026-10-26 — The probe's implementer prompt written.** One prompt for all
  three sources (`probe/prompt.md`). Doubts go to `/work/NOTES.md`, written
  before deciding; the flags count only notes about what the loop does,
  written before the code they cover. See "How an implementer raises a
  doubt".
