# The system ledger

Working rules for `centina-session-zero`, `centina-iterate` and
`centina-realize`. Imperative on purpose; see "Why this format" below for the
evidence behind it. This document's intended audience is a coding
agent running a Centina session, but a curious human is welcome to read it
to better understand the ledger system, and make any changes they
need.

## What it is

One ledger per system, in `<artifactsRoot>/specs/<system>/`:

- `LEDGER.md`, plus `LEDGER-<part>.md` partitions if the human splits it (see
  `output-management.md`).
- `LEDGER-INDEX.md`, `LEDGER-LABELS.md`, `LEDGER.json` and `STANDING.md`:
  generated. Never edit them. `LEDGER.json` is the machine-readable view
  (label, title, status, date, size, file and heading line, parts, park
  condition, successor, depends-on and premises keys); the plugin's Claude Code mod reads it to show cited entries.
- `TRAIL.jsonl` (written by `centina-spike`) and `TRACKER.html` (generated from
  it by `centina-check trail`; never edit): the options offered at each
  decision and the picture of them. Format: `docs/trail.md`.
- `transcripts/`: session transcript copies. See "Transcripts".

The ledger records decisions, questions, findings, options, work items, goals
and standing rules. It is not spec content: the agent writes ledger entries
as the scribe, including during sessions where Rule 0a keeps it out of spec
files. The human decides every status that means a decision (ratified,
rejected, chosen, and so on).

The agent creates `LEDGER.md` at the first decision worth recording, once the system
name is known, and starts it with a one-line title (`# Ledger: <system>`).

## Why this format

In real use, a fix landed in one copy of a claim while a second copy of the
same claim stood wrong for months. Restructuring the docs into separate
current-state and history files did not fix it — the stale line survived
because carrying items forward meant copying their text. The problem was
**duplication** (the same claim restated in several places), not the number
of files. Hence: entries are append-only, status lives in exactly one place
(the header), and every derived view (`LEDGER-INDEX.md`, `STANDING.md`) is
generated, never hand-copied.

## Entry format

```
### sz:P12: cap escalation depth at 3 attempts
- Date: 2026-05-14
- Session: ${CLAUDE_SESSION_ID}
- Phase: sz:W1
- Status: superseded
- Obsoletes: sz:P2
- Updates: task-matcher:P5(b), task-matcher:P6
- Obsoleted-by: sz:P19

Body text. Never rewritten once written.

(a) First decidable part.
(b) Second decidable part.
```

1. **Heading:** `### <scope>:<letter><number>: <title>`, always qualified.
   Make the title state the claim on its own; it is what the index shows.
2. **Header:** `- Field: value` lines right after the heading. Label lists are
   comma-separated.
3. **Body:** append-only. Headers are the only part you edit later.
4. **Parts:** when an entry has more than one decidable part, letter them
   `(a)`, `(b)` as you write it. Never add letters afterwards. Addressing
   goes one level deep: `Updates`/`Updated-by`/`Premises` can cite a part
   (`sz:A17(a)`) but not a numbered item inside one's prose (there's no
   `sz:A17(a)2`). If a later entry only narrows one item of an enumerated
   part, cite the whole part and say which item in your own body text —
   or, if items need to be citable on their own going forward, give them
   their own letters when you write them, rather than nesting numbers
   under a letter after the fact.
5. **Session:** the full session ID. Each skill states the current ID in its
   setup section (in Claude Code, from `${CLAUDE_SESSION_ID}`). On a harness
   without one, ask the human for a session identifier and use it
   consistently.
6. `#` and `##` headings are free-form section titles.

### Scopes

- `sz` for session-zero entries.
- The component's spec file basename for component work:
  `task-matcher.centina.ts` gives `task-matcher`.
- A named scope for work not tied to one component: `audit`,
  `spike-propagation`.

Inside a `<scope>.centina.ts` file's comments, a bare label (`P12`) means that
file's scope. Everywhere else, including this ledger and ARCHITECTURE.md,
always write the qualified label. Cite another system's label as
`<system>/<scope>:<label>`.

A bare-looking token (`A2`, `R1`, ...) found in prose is `ledger-bare-label`:
an `error` when its letter and number match a real entry somewhere in this
system, under whatever scope (almost certainly a citation that lost its scope
prefix), and a `warning` when it matches nothing.

### Letters and statuses

| Letter | For                                                                          | Statuses                                                             |
| ------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `A`    | axiom: an authored, external-provenance given (see "Axioms")                 | `provisional`, `ratified`, `retired`                                 |
| `P`    | proposal                                                                     | `open`, `ratified`, `rejected`, `withdrawn`                          |
| `Q`    | question                                                                     | `open`, `answered`, `withdrawn`                                      |
| `F`    | finding                                                                      | `hypothesis`, `predicted`, `measured`, `measured-false`, `withdrawn` |
| `O`    | option within a fork                                                         | `open`, `chosen`, `declined`                                         |
| `W`    | work item (`Kind`: `phase`, `step`, `spike`, `change-request`, `other`)      | `planned`, `active`, `blocked`, `deferred`, `done`, `withdrawn`      |
| `G`    | goal or thesis                                                               | `active`, `deferred`, `retired`                                      |
| `R`    | standing rule (`Kind`: `structural`, `design`, `method`, `process`, `limit`) | `provisional`, `ratified`, `retired`                                 |

Every letter can also be `superseded`, which requires `Obsoleted-by`.

### Header fields

| Field                        | On        | Meaning                                                                                                                                                   |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Date`                       | any       | Date recorded, `YYYY-MM-DD`                                                                                                                               |
| `Session`                    | any       | Session ID that recorded it                                                                                                                               |
| `Phase`                      | any       | The phase work item, e.g. `task-matcher:W1`                                                                                                               |
| `Status`                     | any       | Required                                                                                                                                                  |
| `Kind`                       | `W`, `R`  | Required on those letters; not re-validated once an entry is no longer holding (see rule 8)                                                               |
| `Depends-on`                 | `W`       | Labels that must be resolved first; required when `blocked`                                                                                               |
| `Premises`                   | any       | Labels assumed true; an `A` may only cite other `A` entries                                                                                               |
| `Constraints`                | phase `W` | `R` labels that bear on the phase                                                                                                                         |
| `Review`                     | `R`       | When a `provisional` rule is reconsidered; required when `provisional`                                                                                    |
| `Parked`                     | `Q`, `P`  | `YYYY-MM-DD, until <condition>`; set aside but still open. Only on `open` items; the condition is required free text. The index shows it beside the title |
| `Enforced-by`                | `R`       | The type or test enforcing the rule                                                                                                                       |
| `Evidence`                   | `F`       | Harness, command, commit; required when `measured` or `measured-false`                                                                                    |
| `Tags`                       | `A`       | Free-text, comma-separated categories for grouping (e.g. `world, vessel`)                                                                                 |
| `Obsoletes` / `Obsoleted-by` | any       | Full replacement, recorded on both entries                                                                                                                |
| `Updates` / `Updated-by`     | any       | Partial change (usually a part), recorded on both entries                                                                                                 |
| `Renumbered-from`            | any       | Old label after fixing a duplicate                                                                                                                        |

## Rules for writing

1. **Label anything something else could depend on, when you record it:**
   proposals, questions, findings, options, work items, goals, rules, and
   decided values (as parts of the entry that decided them).
2. **Take the next number** in the scope from `LEDGER-LABELS.md`. Never reuse
   or renumber a label. If two sessions created the same
   label, renumber the one not yet merged and add `Renumbered-from`.
3. **Record predictions before measuring,** as `F` with `Status: predicted`,
   including the reasoning and numbers. A claim not backed by evidence is
   `hypothesis` or `predicted`, never stated as fact.
4. **Write supersession markers when the change takes effect** (ratified,
   measured), on both entries. An open proposal names what it would replace
   in its body only.
5. **Do not restate status anywhere else.** ARCHITECTURE.md, spec comments
   and state files cite labels; the index shows status.
6. **Cite labels from what depends on them:** spec comments, ARCHITECTURE.md
   rows, PLAN.md steps.
7. **Disposition every open item still on a phase before that phase closes.**
   `Phase` marks a work item as belonging to that phase's scope, not just
   where it happened to surface; a still-open entry whose `Phase` points at a
   phase that has gone `done`, `withdrawn` or `superseded` is a checker error
   (`ledger-phase-closed`), because nothing else re-reads a closed phase's
   scope afterward. Before setting the phase `done`, move each of its still-
   open items to the phase that will own it, drop the `Phase` field if
   nobody does yet, or resolve/withdraw/defer the item itself — never leave
   one for "the index" to catch.
8. **A vocabulary change (a `Kind` retired, renamed, or split) is not
   retroactive.** The checker only validates `Kind` on entries that still
   hold; an entry already `superseded`/`retired`/etc. keeps whatever `Kind`
   it was written with, even if that value no longer appears in the current
   list. If existing entries are using a value you're retiring, supersede
   them into the replacement shape (new entries, `Obsoletes`/`Obsoleted-by`
   both ways) rather than rewriting or renumbering them in place — labels
   are never reused or renumbered (rule 2) even when the vocabulary under
   them moves.

## When a status changes

Any change: ratified, rejected, withdrawn, superseded, amended, measured,
measured false, done, retired.

1. Update the header, and the reverse marker on any entry it supersedes or
   updates.
2. Search `specs/<system>/` and every path in `buildRoots`, comments and
   thrown messages included, for:
   - the label;
   - the old claim's key terms and values (e.g. `2.5D`, `3 m`), which finds
     dependents that never cited the label.
3. Fix each dependent, or raise it with the human if the fix is a decision.
4. Run the checker (below) and fix what it reports.
5. Check `LEDGER-INDEX.md`'s "Affected work items" section. A blocked `W`
   reads "may unblock" only when every `Depends-on` is resolved; one still
   naming a status that is neither resolved nor stale reads "still blocked
   on" the rest, so it does not send you looking for an unblock that can't
   happen yet.
6. The checker only confirms a citation *resolves*, not that it still says
   what the citing text claims — a valid label pointing at the wrong entry
   (mis-cited, not stale) passes every check. When you re-examine a premise
   or decision, open the entry any code comment or spec cites for it and
   confirm the entry actually says what's claimed, rather than trusting the
   label alone.

## Sweeps

At each phase gate, and before writing any derived doc (the skeleton,
ARCHITECTURE.md, PLAN.md, a phase close record, a migration or digest):

1. Read `LEDGER-INDEX.md`, not the ledger.
2. For each open item, check whether a later entry already closed or
   contradicted it.
3. Raise anything found with the human before writing.

## Citations from build code

`centina-realize` build code cites the ledger two ways. Record the build tree
in `buildRoots` (below) or nothing in it is checked.

**Ownership citations** name the work item that will fill an unbuilt member.
They sit in the message thrown by an unbuilt member: a member of a class
implementing a spec contract that cannot return (`centina-realize`, "Using
spec types" rule 4). Its body ends in an unconditional `throw`, and nothing
before that throw can complete normally — validating an argument or binding a
local is fine, a `return` anywhere is not. Such a member is unbuilt by
construction, so a label in its final `throw` names an owner. Two
requirements:

- Exactly one resolvable label, in that final `throw`. A shared constant
  holding the message puts the label out of reach, so write it inline. Four
  members sharing one owner string are usually four members that need four
  different owners.
- It resolves to a `W` whose status is `planned`, `active`, `blocked` or
  `deferred`. Not a `Q`, not a `P`, not a phase's out-of-scope part, and not
  a `W` that is `done`.

A member that names **nobody** is a warning. Don't silence it by citing
whichever `W` is handy: a citation nobody means is the thing this check exists
to catch. A label that is **wrong** — unresolvable, not a `W`, or a `W` that
closed — is an error.

**Rule citations** name what a guard in working code enforces: a rejected
input, a clamp, a refusal. **The rule is always an `R`.** A `Q`, a `P` or a
`W` may sit beside it as the provenance of the ruling — the question that
settled it, the step that ruled it — but never alone. Their terminal statuses
(`answered`, `ratified`, `done`) mean the entry finished, not that the ruling
stopped holding, so a guard citing only one of them can never read as stale.
`R` is the only letter with `retired`. See "Goals and standing rules".

The checker reports a citation only when its entry stopped holding, which is
`superseded`, `withdrawn`, `rejected`, `measured-false`, `retired` or
`declined`.

What the checker reads inside a build root:

- every comment, for rule citations;
- the final `throw` of an unbuilt member, for its ownership citation;
- no other string literal. **A guard's label belongs in its comment**, which
  is the copy the checker reads. Repeating it in the thrown message is for
  whoever meets the error and is not checked, and nothing reports a label
  that appears only there.

Qualify every label. Build code is not a component spec, so a bare `W12` there
is an error rather than a label in the file's own scope.

Which kind a citation is follows from where it sits, never from how it is
worded. A `throw` in a member that can still return is a guard, not an owner,
however it reads, and so is any throw an unbuilt member reaches before its
last. A guard refusing a capability because nobody built it yet
is still a guard: give it an `R` to cite (see "Goals and standing rules").

An ownership citation goes stale with no edit to the code, when its `W`
closes, so the check runs on every ledger write, which is when a status moves.

## The checker

```
node "${CLAUDE_PLUGIN_ROOT}/bin/centina-check" ledger <artifactsRoot>/specs/<system>
```

It validates entries and every label citation in the system directory
(markdown files and `.ts` comments; `archive/` and `transcripts/` are
skipped), then regenerates `LEDGER-INDEX.md` and `STANDING.md`. `--check`
reports stale generated files without writing; CRLF line endings, as a Windows
checkout produces, do not count as stale. `--contracts <file>` also
lists the `@proposal` overrides in a `centina-realize` contracts module and
reports any whose change request is closed.

It also reads every build tree named by `buildRoots`, on every run. See
"Citations from build code".

### Settings

`<artifactsRoot>/.centina/config.json` holds the project's settings, with one
entry per system:

```json
{
  "hostRoot": "..",
  "artifactsRoot": ".",
  "pluginVersion": "<version>",
  "ledgerHook": "block",
  "systems": {
    "specs/sensor-door": { "buildRoots": ["prototype/src/sim"] }
  }
}
```

`hostRoot` and `artifactsRoot` are relative to the directory holding
`.centina/` (which is the artifacts root), so the committed file is right on
every machine; `hostRoot` is the host project root, `..` when artifacts live in
a `centina/` folder at its top. An absolute path still works on the machine that
has it and draws a warning; one that machine lacks is an error when the system
names `buildRoots` (they cannot be found, so build code is not being checked).
The checker keys systems from where the config sits and does not read
`artifactsRoot`.

A system is keyed by its directory's path relative to the artifacts root, not by
its name: a system lives wherever a `LEDGER.md` sits, spec trees nest, and two
systems can share a basename.

`buildRoots` paths are relative to `hostRoot`. `centina-realize` writes them
when it first establishes a build tree, and `REALIZE-STATE.md` cites this file
instead of repeating the paths, so the location has one record. A system whose
directory holds a `REALIZE-STATE.md` with no `buildRoots` entry is an error:
build code exists and nothing is checking it.

In Claude Code a hook runs the checker after every write inside the system
directory and blocks on errors. The human controls this with `ledgerHook`.
**Never change `ledgerHook` yourself**, and never edit a file to get past the
hook without fixing the finding. On other harnesses, run the checker after
every status change, at every gate, and before every derived-doc write.

## Reading

1. **At setup, if the run frame (`ITERATE-STATE.md`/`REALIZE-STATE.md`) names
   a current phase, run**
   `node "${CLAUDE_PLUGIN_ROOT}/bin/centina-check" ledger --phase <label> <dir>`
   **and read that instead of the full index.** It prints the phase's own
   items plus what their `Depends-on`/`Premises`/`Constraints` reach —
   computed on demand from the ledger's citation graph, never written to
   disk. It is not exhaustive: an entry that's genuinely relevant to the
   phase but was never cited by anything in it will not appear. That gap is
   closed by the phase-gate sweep (below), not by reading more here — the
   point of this view is to stay small on every routine setup.
2. **If there is no current phase yet** (before phase 1 starts, or between a
   phase closing and the next one starting), read `LEDGER-INDEX.md` whole
   instead: the standing section, the affected work items, and the open
   items for your scope.
3. Consult `LEDGER-LABELS.md` only to look up a label's file and status, or
   to take the next number in a scope. Look up an entry's full text by
   searching the ledger for `### <label>:`.
4. Do not read the whole ledger into context.
5. The first time you mention a label to the human in a session, say what it
   is ("sz:P4, the escalation-depth cap"). Restate that reminder whenever
   more than 10 labels of the same letter have come up since.
6. **Write a label in full the first time you use it in each turn.** A turn is
   everything you write between one human message and the next, tool calls
   included. The first time a label appears in a turn, write its qualified
   form (`terrain:W6`), even if you qualified it in an earlier turn, and even
   in a list or a passing mention. After that, in the same turn, the short form
   (`W6`) is fine. The next turn starts over. The ledger mod finds citations
   only by their qualified form, so a bare first use gets no row and no ELI5
   button, and with several scopes in context a bare `W6` can name more than
   one entry. This is about what you say to the human; the rule for ledger
   entries, ARCHITECTURE.md and the other documents is still to qualify every
   label.

## Goals and standing rules

- Record theses and project goals as `G`, standing rules as `R`. The human
  ratifies, promotes and retires them.
- A rule that can be enforced by a type or test should be; cite it in
  `Enforced-by`. A guard in build code counts as enforcement.
- `Kind: limit` is for a rule that holds because something is not built: a
  guard refusing a capability, an unsupported case, a hard-coded
  simplification. It is the one Kind whose ordinary end is `retired`, once
  somebody builds the thing. The other four record decisions meant to last.
- **Ratify an `R` against what it must stay consistent with, not in
  isolation.** The standard for a rule is "we decided, consistent with
  existing rules and axioms" — cite the `R` and `A` entries it must hold
  alongside in `Premises` (any letter can carry `Premises`; see "Axioms" for
  why an `A` can show up there). The citation can't verify the reasoning
  itself, but it means the existing stale-citation check catches it
  automatically the moment one of those cited entries is later superseded —
  the rule's claimed context stops being silently taken for granted.
- **A guard in build code cites an `R`. Whatever settled the rule may sit
  beside it; nothing may sit there alone.** `answered`, `ratified` and `done`
  all mean the entry finished, not that the ruling stopped holding, so a
  guard citing only a `Q`, a `P` or a `W` can never read as stale. `R` is the
  only letter with `retired`. So an answered `Q` that leaves a guard behind
  produces an `R`, and so does a `done` step that ruled one; keep the
  original entry beside the `R` as the provenance of the decision. A guard
  citing a phase's out-of-scope part is the same case with less to recommend
  it, since phase scope expires with the phase.
- A rule that may not survive is `provisional` with a `Review`, which is a
  fine thing for a guard to cite. Only `retired` and `superseded` make a
  citation stale.
- Add a `W` beside the `R` only when the work is actually scheduled. A
  `deferred` `W` nobody intends to start is one more entry that quietly stops
  meaning what it says.
- `STANDING.md` lists active goals and current rules. Offer once per project
  to import it from the host project's CLAUDE.md (or AGENTS.md) with an
  `@<path to STANDING.md>` line, so the rules load in every session.

## Axioms

An `A` records an authored, quantitative given about the thing being
specified — an ice-shell thickness, an ambient noise floor, a power-scaling
law — not a rule about how the project must behave. What tells the two
apart:

- **Provenance runs the opposite way from a rule's.** A rule's authority is
  "we decided" (see above). An axiom's authority comes from outside the
  project's own decisions — real-world science and source material, but
  also an authored engineering given bounded by a plausible external range
  (a hull length bounded by what fits through the ice, a sensing length
  bounded by what's physically deliverable) — chosen from within that
  range, not derived and not decided from scratch.
- **A rule is categorical; an axiom is a value picked from a range.** There's
  no "why this number and not a nearby one" for a rule beyond a design
  tradeoff. For an axiom there always is: record the range and its source in
  the body (as lettered parts), and whether the value was selected
  deliberately or only inherited from an earlier axiom — later axioms are
  constrained by ones already chosen, unless there's a strong
  project-goal-level reason otherwise.
- **A rule is `Enforced-by` a guard; an axiom is instantiated, not
  enforced.** Code reads an axiom's value; nothing refuses a violation of
  it. A guard that keeps some *derived* value inside an axiom's range is
  itself an `R`, layered on top — the axiom being right isn't something code
  checks.
- **A value that's derived from an axiom, not authored, is not itself an
  axiom** — even if it's quantitative (a detection range, a speed penalty).
  Record it as an `F` (`predicted`/`measured`, with `Evidence`) that cites
  the axiom it derives from via `Premises`, so it's findable the same way
  any other dependent is when the axiom moves.

Statuses: `provisional` (not yet sourced), `ratified` (a sourced value in
effect), `superseded` when the authored value changes. `retired` is for the
rare case where the axiom stops applying at all (the thing it described was
cut), not for a value that changed — ending at `retired` is not an axiom's
ordinary outcome the way it is for `Kind: limit`; an axiom normally keeps
getting superseded as the authored value moves.

**Dependency direction is locked one way, mechanically.** An axiom's
`Premises` may only cite other axioms — the checker rejects any other letter
there (`ledger-malformed`). Everything else cites `Premises` freely,
including axioms (see the `R` bullet above). This is deliberate: letting an
axiom cite a rule would let authored ground truth start quietly depending on
an internal decision, the reverse of what an axiom is for.

**"Depended on by" is a computed view, not a field.** Nothing hand-maintains
a reverse pointer on the axiom itself. What depends on an axiom is found by
scanning for `Premises` citations that resolve to it, the same way
`LEDGER-INDEX.md`'s "Affected work items" is generated from
`Depends-on`/`Premises` today.

**`Tags`** groups axioms into project-defined categories (e.g. `world`,
`vessel`) for `STANDING.md` and human readability: free text,
comma-separated, `A`-only, no fixed vocabulary, and an axiom can carry more
than one. If a project wants axioms restricted to a single tag, record that
as the project's own `R`; the checker doesn't enforce it.

## Transcripts

In Claude Code, a hook copies the session transcript into
`specs/<system>/transcripts/<session-id>.jsonl` for any system whose ledger
or state file records the session ID. The agent never writes its own
transcript: it would be a paraphrase, it cannot recover text lost to
compaction, and it roughly doubles output tokens.

1. **Always ask the human before opening a transcript,** in every case.
   Transcripts are large enough to fill the context window.
2. Only propose it when the human directs it; or a label's origin cannot be
   traced from the ledger, ARCHITECTURE.md or spec comments and a pending
   decision depends on it; or two current-state entries conflict and the
   ledger does not settle which wins.
3. When asking, say which case applies and what you will search for.
4. Once approved, search the transcript for the label or key terms. Never
   read it whole.
5. A transcript is evidence, not authority. If it contradicts the ledger,
   raise it with the human; do not correct the ledger yourself.

## Concurrency

Warn the human if you notice any of these:

1. Two `centina-session-zero` sessions running in the same project.
2. Two sessions editing the same file.
3. Two people working on the same component at once.
