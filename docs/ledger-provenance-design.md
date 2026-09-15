# Ledger provenance: supersession, labels, and transcripts

**Status:** agreed in the 2026-09-15 improvement session. **Not implemented.**
Amended the same day after the `centina-realize` discussion (see
`docs/centina-realize-design.md`), which added work items, claim statuses,
one ledger per system, and generated views. Nothing here is operational in
either skill yet.

Covers two items:

- **Item A.** Session logs record a new proposal that supersedes an older one,
  but the older entry, and anything that depends on it, is never amended.
- **Item B.** Session content gets lost or muddled, and there is no way to
  trace provenance back to the original conversation.

## Evidence

Drawn from the Chrysalis Underworld project (`chrysalis/prototype/` and
`chrysalis/centina/specs/underworld/`, including `archive/`). Each case below
is a way a supersession was missed. Most had no cross-reference to follow at
the time the new decision was recorded, so a rule that fires only when a new
proposal is recorded would not have caught them.

1. **Unlabeled claim.** A Phase 2 prose line, "Bathymetry is 2.5D", had no
   label. P18 rejected 2.5D by name a day later, but nothing pointed back to
   the line. It stood unstruck for eleven days and a terrain generator was
   designed against it.
2. **Status change without a new proposal.** P10 and P18 still read `OPEN` in
   their proposal tables after ratification, because ratification was written
   in a separate block.
3. **Only one copy amended.** The `bandStationDb` interface gap was fixed at
   P72 and marked DONE in one row of REVIEW §11n. A second, unstruck row in
   the same table still said it blocked the re-run. That row was carried
   forward through a doc migration and still stood in `prototype/LEDGER.md`
   as of 2026-09-15, though the code had been fixed.
4. **Dependency on a value, not a decision.** A spec comment quoted bearing
   figures for a 3 m aperture. P60 moved the baseline to 5 m; nothing tied the
   comment to P60 and it stayed wrong for a week.
5. **Implicit contradiction.** P48 contradicted P35 without naming it. Found a
   week later, during implementation.
6. **Stale reference.** Risk 14 pointed to "risk 16" as its successor; after
   renumbering, risk 16 was unrelated content.

Restructuring the Chrysalis docs into separate current-state and history
files did not fix case 3: the stale line survived because carrying items
forward meant copying their text. The underlying problem was **duplication**
(the same claim restated in several places), not the number of files.

## Item A: supersession and labels

### One ledger per system

1. **System** means one `specs/<system>/` directory: what a single
   `centina-session-zero` run stood up, with its own DAG and ARCHITECTURE.md.
   In Chrysalis, `specs/underworld/` and `specs/chrysalis/` are separate
   systems. Component-level working notes such as
   `specs/physical-simulation/NOTES.md` would be entries in the owning
   system's ledger under a component scope, not a separate document.
2. The ledger lives in `specs/<system>/`, even when implementation code lives
   elsewhere.
3. Not split per component or per phase. Scope is in the label prefix and
   phase is a header field, so an item that later spawns a new component
   needs no new home.
4. A long ledger is split into partitions under the ~1500-line rule in
   `docs/output-management.md`. Each entry lives in exactly one partition and
   the tooling reads all of them, so partitioning does not create copies.

### Entry body and header

1. **Body: append-only.** Entry text is never rewritten.
2. **Header: editable, and the single source of an entry's status.** Status
   and reverse supersession markers are updated in place. (The RFC model: RFC
   text never changes; the RFC index metadata does.)
3. Nothing else restates an entry's status by hand. Lists of statuses, open
   items and settled items are generated (see "Generated views").
4. Agent-made digests that restate claims are discouraged. If one exists, it
   carries a date stamp and a "derived, not authoritative" header.

### Entry grammar

Ledger files are `LEDGER.md` plus optional partitions `LEDGER-<part>.md` at
the top of the system directory. `LEDGER-INDEX.md` is generated and is not a
partition.

```
### sz:P12: cap escalation depth at 3 attempts
- Date: 2026-05-14
- Session: 882b1094
- Phase: sz:W1
- Status: superseded
- Obsoletes: sz:P2
- Updates: matcher:P5(b), matcher:P6
- Obsoleted-by: sz:P19

Body text, append-only.

(a) First decidable part.
(b) Second decidable part.
```

1. **Heading:** `### <scope>:<letter><number>: <title>`, always fully
   qualified. Any other `###` heading in a ledger file is an error. `#` and
   `##` headings are free-form section titles and end the current entry.
2. **Header:** `- Field: value` lines immediately after the heading. The
   first line that is not a field ends the header.
3. **Label lists:** comma-separated qualified labels.
4. **Parts:** body lines starting with `(a) `, `(b) `, and so on.
5. Fenced code blocks are not scanned for citations.

### Labels

Based on legislative drafting (pinpoint citation, amendments as separate
instruments, no renumbering) and IETF RFCs (`Obsoletes` / `Updates`, with the
reverse links recorded on the old document).

1. **What gets a label.** Anything something else could depend on, recorded
   at the time it is written: proposals, questions, findings, options, work
   items, and decided values.
2. **Type letters:**
   - `P` proposal
   - `Q` question
   - `F` finding
   - `O` option within a fork
   - `W` work item, with a `Kind:` header: `phase`, `step`, `spike`,
     `change-request`, `other`
   - `G` goal: theses and phase-independent project goals
   - `R` standing rule, with a `Kind:` header: `structural`, `design`,
     `method`, `process`
3. **Number.** Plain sequential integer, no zero-padding. IDs carry no dates,
   counts or history; that lives in the header, because it can change after
   the entry is written and IDs must not.
4. **Scope prefix.**
   - The component's spec file basename for component work:
     `task-matcher.centina.ts` gives `task-matcher:P12`. No alias list, so
     the lint resolves a bare label in a spec file from its filename.
   - `sz` for `centina-session-zero`: `sz:P12`.
   - A named scope for work not tied to one component, such as an auditor or
     a spike series: `audit:F3`, `spike-propagation:F4`.
   - A bare label (`P12`) is used inside its own scope: that scope's files,
     comments and conversation. The qualified form is used everywhere else.
     A bare label in a system-level doc such as ARCHITECTURE.md is an error.
   - Citing across systems qualifies with the system: `chrysalis/physsim:P4`.
     Rare; the lint does not need to resolve these until someone uses them.
5. **Pinpoint citation.** Lettered parts: `P12(b)`. An entry with more than
   one decidable part is lettered when written, never afterwards, so a
   pinpoint always refers to the same text.
6. **No reuse or renumbering.** The one exception: a duplicate label found at
   merge time is renumbered on the side that has not merged, and the entry
   records `Renumbered-from:`.
7. **`@agent` notes use the same format.** `@agent(matcher:Q3): ...` in a spec
   and the ledger entry `matcher:Q3` share one ID. The free-text labels
   `centina-iterate` currently allows are replaced.

### Header fields

Fields where they apply:

| Field | Applies to | Meaning |
|---|---|---|
| `Date` | all | Date recorded |
| `Session` | all | Session ID (see Item B) |
| `Phase` | all | Label of the phase work item, e.g. `W1` |
| `Status` | all | See "Status values" |
| `Kind` | `W`, `R` | `W`: `phase`, `step`, `spike`, `change-request`, `other`. `R`: `structural`, `design`, `method`, `process` |
| `Depends-on` | `W` | Labels this work item needs resolved first |
| `Premises` | `W` | Labels this work item assumes are true |
| `Constraints` | `W` with `Kind: phase` | `R` labels that bear on the phase |
| `Review` | `R` with `provisional` | When the rule is reconsidered: a work item or a condition |
| `Enforced-by` | `R` | The type or test that enforces the rule, if any |
| `Evidence` | `F` with `measured` or `measured-false` | Harness file, command, and commit |
| `Obsoletes` | all | Labels this entry fully replaces |
| `Updates` | all | Labels or pinpoints this entry partly changes |
| `Obsoleted-by` | all | Reverse of `Obsoletes`; required |
| `Updated-by` | all | Reverse of `Updates`; required |
| `Renumbered-from` | all | Previous label, after a merge-time fix |

Example:

```
### P12: cap escalation depth at 3 attempts
- Date: 2026-05-14
- Session: 882b1094
- Phase: W1
- Status: superseded
- Obsoletes: P2
- Updates: sz:P5(b)
- Obsoleted-by: P19
```

### Status values

| Letter | Values |
|---|---|
| `P` | `open`, `ratified`, `rejected`, `withdrawn`, `superseded` |
| `Q` | `open`, `answered`, `withdrawn` |
| `F` | `hypothesis`, `predicted`, `measured`, `measured-false`, `withdrawn` |
| `O` | `open`, `chosen`, `declined` |
| `W` | `planned`, `active`, `blocked`, `deferred`, `done`, `withdrawn` |
| `G` | `active`, `deferred`, `retired` |
| `R` | `provisional`, `ratified`, `retired` |

- `deferred` (`W`) means still intended but not in the current phase;
  `withdrawn` means abandoned.
- Only the human promotes or retires an `R` entry.

- A prediction is recorded as `predicted`, with its reasoning and numbers,
  before the measurement runs. Measuring it changes the header status and
  adds `Evidence`; the prediction text stays in the body. This is
  pre-registration: a refuted prediction with stated arithmetic shows where
  the reasoning failed.
- `measured` and `measured-false` require `Evidence`.
- `superseded` is valid for every letter and applies exactly when
  `Obsoleted-by` is set.
- `Obsoletes` / `Updates` and their reverse markers are written when the
  change takes effect (ratified, measured), not when it is first proposed.
  An open proposal names what it would replace in its body.
- A `blocked` work item cites the blocking label in `Depends-on`.

### Dependents

Docs and `.centina.ts` comments that depend on a labeled claim cite the label.

### When to check for stale entries

1. **On any status change,** search the spec directory, comments included,
   for:
   - the label;
   - the old claim's key terms and values (e.g. "2.5D", "3 m"), to catch
     dependents that never cited the label.
2. **Sweep** the generated views (not the ledger body) at each phase gate and
   before writing any derived doc (ARCHITECTURE.md, the skeleton, PLAN.md, a
   phase close record, a migration or digest). Check every open item against
   later closures, and each entry against later decisions.

The sweep improves the odds on implicit contradictions (case 5) but does not
guarantee them; spotting one is still a judgment.

### Generated views

1. **Tool.** The ledger mode of `bin/centina-check`. One pass parses headers,
   validates them (see "Lint checks"), and writes the views. Not a separate
   script: validation and generation need the same parse.
2. **Output.** `specs/<system>/LEDGER-INDEX.md`, committed, headed "generated,
   do not edit". Contents:
   - standing section, first: active `G` and non-retired `R` entries, one
     line each. The title has to state the goal or rule on its own; full text
     is looked up by label;
   - label index: label, one-line title, status;
   - open items, filterable by phase and scope;
   - settled items: `rejected`, `withdrawn`, `measured-false`, `superseded`,
     each with its `Evidence` or superseding label;
   - affected work items: open `W` entries (`planned`, `active`, `blocked`)
     whose `Depends-on` or `Premises` cite an entry that no longer holds
     (`superseded`, `withdrawn`, `rejected`, `measured-false`, `retired`,
     `declined`), and `blocked` entries whose `Depends-on` is resolved
     (`done`, `answered`, `ratified`, `chosen`, `measured`). Computed from
     current headers; no status history is needed.
3. **`specs/<system>/STANDING.md`**, also generated: the standing section
   alone. The project's CLAUDE.md (or AGENTS.md) imports it, so goals and
   rules are in context in every session, not only skill runs. Accepted cost:
   for Underworld, roughly 20–30 lines per session.
4. **When it runs.**
   - Claude Code: the same `PostToolUse` hook that runs the lint after ledger
     writes regenerates the index.
   - At skill setup, so a session never starts from a stale index (e.g. after
     the human edited the ledger by hand).
   - At the named trigger points (status change, phase gate, before a
     derived-doc write), which covers other harnesses.
   - Check-only mode reports an out-of-date index without writing, for CI or
     manual runs.

Carrying open items forward between phases is replaced by the open-items
view. Nothing is copied, so nothing is left behind to go stale.

### Lint checks

A mode of `bin/centina-check`: `centina-check ledger [--check] <system-dir>...`
(`npm run check -- ledger <dir>` in this repo). Without `--check` it validates
and writes the generated files.

**Files scanned for citations:** the ledger files, and every other `.md` file
and every `.ts` file's comments in the system directory. `archive/`,
`transcripts/` and dot-directories are skipped, as are the generated files.

1. **Checks:**
   - labels or parts cited but never defined;
   - duplicate labels;
   - malformed headings, header values, and fields that do not apply to the
     entry's letter;
   - one-way supersession markers, and `superseded` without `Obsoleted-by`
     (or the reverse);
   - a label that no longer holds, cited from a non-ledger file, unless the
     same line also cites its successor. Citing an updated part requires the
     updating label on the same line. Ledger bodies are history and exempt;
   - bare labels anywhere except comments in a `<scope>.centina.ts` file,
     where they resolve to that scope;
   - status values invalid for the label's letter;
   - `measured` / `measured-false` without `Evidence`;
   - `blocked` without a `Depends-on`;
   - `provisional` `R` without a `Review`;
   - `LEDGER-INDEX.md` or `STANDING.md` out of date (check-only mode).
2. **Scope of each run:** the whole system directory, not only the file just
   written. Two agents on different components can conflict through a
   cross-scope citation, and only a directory-wide scan catches it on the
   next write by either one.
3. **Claude Code:** `scripts/ledger-hook.mjs` runs on `PostToolUse` for
   `Write|Edit|MultiEdit`. When the written file is under a directory
   containing `LEDGER.md`, it runs `centina-check ledger` on that directory.
   Errors block (exit 2, findings shown to Claude). The override is
   `"ledgerHook": "block" | "warn" | "off"` in the project's
   `.centina/config.json`, read on every run so a change applies immediately;
   `warn` passes the findings to Claude as context without blocking. Only the
   human changes this setting. If the plugin's checker is not installed yet,
   the hook does nothing.
4. **Other harnesses:** the skills name explicit trigger points.
5. **Not caught:** implicit contradictions and uncited dependents. Those rely
   on the term search and the sweep.

The lint requires the strict entry format above; loosely formatted prose logs
will not parse. Accepted as the cost of consistent results.

### ARCHITECTURE.md

What remains hand-written is structure. Anything with a lifecycle lives only
in ledger headers.

| Section | Before | After |
|---|---|---|
| 1. DAG + responsibilities | Hand-written | Unchanged |
| 2. Contract ledger | Signatures, direction, status column | Signatures and direction stay; status column replaced by a label citation, status read from the index |
| 3. Hole ledger | Hand-written list with routing | Label citations only; holes live in spec code and the checker enumerates them |
| 4. Terminal nodes | Hand-written | Unchanged; unknown sources cite a `Q` label |
| 5. Risks / watch-items | Hand-written prose | Each risk is a ledger entry; section cites labels |
| 6. Rejected alternatives | Hand-written | Pointer to the settled view in `LEDGER-INDEX.md` |

### Changes required elsewhere

1. **`centina-session-zero`:**
   - handoff section: ARCHITECTURE.md contents per the table above;
   - memory discipline: SESSION-ZERO-STATE.md shrinks to a run frame and
     cursor; entries go to the system ledger under `sz`.
2. **`centina-iterate`:**
   - "Reconciling ARCHITECTURE.md before the plan" shrinks to signature
     changes and new file locations, since statuses change in headers when
     decisions are made;
   - `@agent` labels move to the scoped format.
3. **`docs/output-management.md`:** its split strategy assumes the old
   state-file layout; it becomes "partition the ledger when long".
4. **Checker:** the existing labeled-`@agent`-note conflict rule adopts the
   scoped format.
5. **Project setup:** the project's CLAUDE.md (or AGENTS.md) imports
   `STANDING.md`. The skills' setup step checks for the import and offers to
   add it.

### Existing fixtures

Wordboard, grid-inventory and turnball stay in the old format. Underworld is
migrated as the first live test of `centina-realize`. Its existing theses and
standing rules come in as `ratified` (`R`) and `active` or `deferred` (`G`),
including rules never formally ratified, such as "measure the premise before
building the fix".

### Placement

A shared doc beside `docs/output-management.md`, referenced by all skills.

## Item B: session transcripts

1. **(a) Session pointer.** Every run records its full session ID in the
   `Session` header of each entry it writes, and in the run frame of its state
   file. In Claude Code the skill text uses the documented
   `${CLAUDE_SESSION_ID}` substitution. Applies on all harnesses.
2. **(b) Copy hook, Claude Code only.** `scripts/transcript-hook.mjs` runs on
   `PreCompact` and `SessionEnd`:
   - candidates are `specs/<system>/` directories containing `LEDGER.md`,
     under the session's `cwd` and under any registered project
     (`${CLAUDE_PLUGIN_DATA}/known-projects.json`) that contains the `cwd` or
     sits inside it;
   - a candidate matches when any of its top-level markdown files (generated
     files excluded) contains the session ID;
   - the transcript is copied to `transcripts/<session-id>.jsonl` in each
     match, overwriting earlier copies from the same session;
   - the hook writes `transcripts/.gitignore` containing `*`, so the host
     project's `.gitignore` needs no change;
   - it never blocks and never fails the session.
3. **Deferred:** a redaction step, and transcript support for non-Claude
   installs.

The agent does not write its own transcript: it would be a paraphrase, it
cannot copy text lost to compaction, and it roughly doubles output tokens.

### Access rule

1. The agent **always asks the human before accessing a transcript**, in
   every case, including the ones listed next. Transcripts run to hundreds of
   KB and reading one can fill the context window.
2. The agent only proposes accessing a transcript when:
   - the human directs it; or
   - a label's origin cannot be traced from the ledger, ARCHITECTURE.md or
     spec comments, and a pending decision depends on it; or
   - two current-state entries conflict and the ledger does not settle which
     one wins.
3. When asking, the agent says which case applies and what it will search
   for.
4. Once approved, it searches the transcript for the label or key terms. It
   does not read the file whole.
5. A transcript is evidence, not authority. If it contradicts the ledger, the
   agent raises it with the human and does not correct the ledger on its
   own.

## Documentation warnings to add

1. Do not run concurrent `centina-session-zero` sessions in the same project.
2. Do not run concurrent edits to the same file.
3. Do not have two people work on the same component at the same time.
