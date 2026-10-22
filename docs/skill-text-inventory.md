# Skill text inventory

A paragraph-by-paragraph pass over the four Centina skills and the nine docs
they point agents at, asking of each passage whether an agent needs it while a
session runs. It follows from `docs/context-audit.md`, which found that skill
bodies come back in full after every compaction and that the setup docs are
read whole at the start of every run.

Line numbers are as of commit `fc07251`. The history and background passages
marked for moving are copied, word for word, into `docs/skill-history.md`,
which isn't bundled. Step 1 of the proposed order has been applied; see
"Status" at the end.

## What I was sorting for

Each passage is one of these:

- **Keep.** A directive: what to do, or the definition an agent applies.
- **Compress.** A reason that decides edge cases. A rule followed without its
  reason gets followed to the letter, so the reason stays, cut to a clause.
- **History.** Where a rule came from: which run, when, what went wrong. Moves
  to `skill-history.md`, part 1.
- **Background.** Justification or checker internals an agent doesn't act on.
  Moves to `skill-history.md`, part 2.
- **Duplicate.** The same rule in more than one file. One copy stays, and the
  others become a pointer or go.
- **Human-facing.** Instructions for a person outside a session. These move to
  a human doc, not to the history file.
- **Stale.** Wrong now. These get fixed, not moved.

"Saves" is characters out of the file an agent loads. A plain number is a
whole passage leaving. A `~` is an estimate for a compression.

## Where it adds up

| File | Size | When an agent reads it | Saves | Share |
|---|---|---|---|---|
| `docs/plugin-setup-procedure.md` | 9,523 | every run, all four skills | ~4,600 | 48% |
| `docs/ledger.md` | 31,626 | every run, all four skills | ~5,000 | 16% |
| `docs/output-management.md` | 3,690 | every realize and spike run | ~250 | 7% |
| `docs/trail.md` | 13,934 | spike (in practice read whole, repeatedly) | ~4,700 | 34% |
| `docs/realize-conformance.md` | 7,276 | realize, before the first assertion and at step close | ~1,300 | 18% |
| `docs/session-zero-routing.md` | 7,400 | session zero, before classifying any node | ~1,000 | 14% |
| `docs/session-zero-reference.md` | 20,124 | session zero, "the first time one applies" | ~15,000 | 75% |
| `docs/iterate-reference.md` | 12,982 | iterate, at plan time and on demand | ~4,200 | 32% |
| `docs/measurement-methodology.md` | 3,514 | nothing directs a read | see below | |
| `skills/centina-iterate/SKILL.md` | 19,475 | every compaction | ~1,450 | 7% |
| `skills/centina-realize/SKILL.md` | 19,111 | every compaction | ~1,200 | 6% |
| `skills/centina-session-zero/SKILL.md` | 19,892 | every compaction | ~450 | 2% |
| `skills/centina-spike/SKILL.md` | 13,799 | every compaction | ~550 | 4% |

In tokens, at about four characters each:

- **A realize-and-spike run** like Underworld's reads about 66k characters of
  docs at setup. This takes about 16k of them out, roughly 4k tokens per session
  start, and again whenever the agent rereads them after a compaction. The two
  skill bodies shrink by about 1.75k characters, roughly 450 tokens per
  compaction.
- **A session-zero run** reads about 69k characters across the setup doc, the
  ledger doc, the routing lens and the reference doc. This takes out about 25k,
  roughly 6k tokens.

The skills themselves barely move, and that's honest rather than timid. They
were already cut to fit under the 20,000-character re-injection cap (ROADMAP,
"Skills over the post-compaction cap"), and what's left in them is mostly
gates and guardrails. The fat is in the docs. Most of it is
`session-zero-reference.md`, which still holds the long-form copies of
passages the skill already carries in short form.

## Duplicates across files

These are worth settling first, because each one is a rule that can drift: an
edit to one copy leaves the others saying something else. That's the failure
`ledger.md`'s own "Why this format" names, applied to the docs.

1. **Explaining labels and formulas.** Five copies: `ledger.md` "Reading"
   items 5–6, iterate's SKILL.md 214–226, session zero's SKILL.md 236–244,
   `iterate-reference.md` 68–89, `session-zero-reference.md` 152–164. Keep
   the short forms in the two skills, which are re-injected and need it, and
   `ledger.md`'s. Drop both reference-doc copies, except iterate-reference's
   rule for session labels without a ledger, which the skill points to. (Moving
   the formula rule into `ledger.md` would also hand it to realize and spike,
   which don't have it today. That's a behavior change, so it's not proposed.)
2. **A guard cites an `R`.** Three copies: realize's SKILL.md 158–169,
   `ledger.md` 276–283 and `ledger.md` 425–433. Its home is `ledger.md`'s
   "Citations from build code". The second `ledger.md` copy becomes a
   pointer, and the skill keeps two sentences and the pointer.
3. **Which ledger view to read at setup.** `ledger.md` "Reading" 1–2 is the
   home. The skills' setup steps keep their one-line form.
   `output-management.md` 64–71 becomes a pointer, keeping its unique item:
   reread after a compaction.
4. **Dispositioning a closing phase's open items.** Realize's SKILL.md
   301–314 (1,004 characters) restates `ledger.md`'s rule 7, which the
   checker also enforces. The skill keeps the three dispositions and the
   pointer.
5. **The measurement rules.** Spike's "Measuring" and
   `measurement-methodology.md` are the same rules, nearly line for line. See
   that file's entry below.
6. **The conformance example.** Realize's SKILL.md 181–189 and
   `realize-conformance.md` 36–44 carry the same code block. The skill is
   loaded whenever the doc is, so the doc's copy goes. It keeps the error
   output at 46–50, which only it has.
7. **Session zero's long forms.** `session-zero-reference.md` still holds full
   versions of nine passages the skill condenses. Itemized under that file.

## Per file

### `docs/plugin-setup-procedure.md`

Read at the start of every run by all four skills. It's half "what to do" and
half "what the command does and how to run it by hand", and only the first
half is for the agent.

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 3–5 | Keep | Already points its rationale at `plugin-setup-step.md`, which isn't bundled. | 0 |
| 63–94 | Human-facing | What `centina-check setup` does, bullet by bullet. The doc tells the agent not to reproduce that work, so the list is never acted on. Move to `plugin-setup-step.md` and keep one sentence naming what setup writes. | ~1,800 |
| 96–114 | Compress | The config's shape and why its paths are relative. Setup writes the config, not the agent. Keep 115–126, the handling of a refusal, which the agent does act on. | ~500 |
| 149–199 | Human-facing | Running setup from a plain shell, and the tsserver plugin limit. Both are for a person outside a session. Move to `install-claude-code.md` or `plugin-checker-install.md`, after checking what those already say. | 2,299 |

### `docs/ledger.md`

Read at setup by all four skills. Unlike the setup doc, it's mostly directive,
so the cut is modest. The larger lever for this file is the split into a card
and a reference that the context audit proposes, which is a separate decision.

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 3–8 | Compress | The note on who the doc is for. One line. | ~250 |
| 34–56, 65–67 | History | The six failure cases and the provenance of the label scheme, now in part 1. Keep 58–63, the paragraph that draws the lesson (duplication, not file count, was the problem). It's the reason behind append-only bodies and generated views, and it's what an agent should reason from when no rule covers a case. | ~1,400 |
| 120–139 | Background | How the checker grades a bare-looking label, by date comparison, now in part 2. Replace with: qualify every label, and a bare token that matches a real entry is an error, one that matches nothing a warning. | ~1,100 |
| 272–275 | Background | Why a member with no owner is only a warning. | ~300 |
| 276–283 / 425–433 | Duplicate | See duplicate 2. 425–433 becomes a pointer. | ~550 |
| 307–311 | Background | Why ownership citations fail in one direction. Keep its last sentence: the check runs on every ledger write. | ~280 |
| 347–358 | Duplicate | How `hostRoot` and `artifactsRoot` resolve, which `plugin-setup-procedure.md` also covers. Here the agent needs only `buildRoots` and `ledgerHook`. | ~600 |
| 476–477 | History | The clause about provisional axioms once being misfiled as `Kind: limit`. | ~80 |
| 491–498 | Background | Why "depended on by" is computed. Keep one sentence: nothing hand-maintains a reverse pointer, and dependents are found from `Premises` citations. | ~400 |
| 444–504 | Keep (optional compress) | Axioms, the longest section at 3.7k. Every distinction in it gets used when classifying a value. A tightening that keeps the meaning might save ~1,000, but I wouldn't touch it without your read. | (~1,000) |

### `docs/output-management.md`

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 64–71 | Duplicate | See duplicate 3. | ~250 |

The rest is directive, and "Older projects" is three lines.

### `docs/trail.md`

Spike points at it only for the `waive` record, but the transcripts show the
agent reading it whole, several times a run. A third of it describes what the
tracker page draws for the human.

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 1–7 | History | "Step 3 of the work-item progress tracking, agreed by the author". Replace with a line saying what the file specifies. | ~300 |
| 9–18 | Compress | What the trail is for. | ~250 |
| 22–26 | History | The parenthetical about `terrain:W43`. | ~250 |
| 27–33 | Compress | How weights are derived. The agent needs one fact: there's no turn field, because the tracker finds the turn by timestamp. | ~350 |
| 39–40 | History | The parenthetical on where the file lives. | ~70 |
| 84–87 | History | The `terrain:W43` example of a backfilled decision. Keep the rule in 84–85. | ~150 |
| 213–249 | Human-facing | What the page draws, and how weights are stored and committed. The agent's only job here is to tell the human where the page is. There's no human-facing trail page yet, and `ledger-mod.md` is the nearest home. | ~2,500 |
| 251–262 | History | Known weak points of the design, now in part 1. | 756 |

### `docs/realize-conformance.md`

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 3–10 | History | Why the detail left the skill. The skill already lists when to read this. | ~450 |
| 36–44 | Duplicate | See duplicate 6. | ~350 |
| 67–72 | History | The callable that used to be in `conformance.ts`. Keep one line: nothing in it is callable, because an ambient function emits no binding and throws on import. | ~250 |
| 136–138 | Background | Why no generator can produce the assertions. | ~250 |

### `docs/session-zero-routing.md`

Read before classifying any node. It's the lens itself and its worked cases, and
the cases teach the judgment, so nearly all of it stays.

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 3–5 | History | Why this has its own doc. | ~200 |
| 29–34 | History | Routing replaced the old fit gate. | ~460 |
| 96–97 | History | The clause "the verdict-era reflex the jurisdiction reframe retired". The rule around it stays. | ~60 |
| 110–113 | Background | The parenthetical on the whole-DAG view. | ~300 |

### `docs/session-zero-reference.md`

The skill says to read it "the first time one applies", which in practice is
every run. It's mostly the long-form copies left behind when the skill was cut
under the cap, and the skill has carried its own short forms since.

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 3–6 | History | Why the doc exists. | ~280 |
| 8–29 | Background | Why session zero exists. The skill's opening already carries the lineage. | 1,327 |
| 31–42 | Duplicate | The `@external` cases, nearly word for word the skill's "What a skeleton contains". | ~650 |
| 44–57 | Duplicate | Phase 6, the same as the skill's. Its one extra sentence (doubtful nodes are already routed) follows from phases 2–4. | ~1,050 |
| 61–73 | Duplicate | The diagram practice. Keep one point the skill lacks: in a text medium prose often carries the gates, so the diagram is offered when the human needs it, not rendered at every gate. | ~650 |
| 74–86 | Compress + History | Priority elicitation. Keep the failure it prevents (a less experienced spec-writer won't volunteer priorities) in a sentence. The provenance is in part 1. | ~500 |
| 87–110 | Compress + History | Encoding intent in types. Keep why the skill may emit the encoding unasked: choosing the type-level form of a decision already ratified is form, not meaning. That reason is load-bearing, and the skill's short form leaves it out. The provenance is in part 1. | ~900 |
| 111–124 | Duplicate | Keep "be warier the more mature the language feels". "Propose only as a question" is the same as in the skill. | ~550 |
| 125–164 | Duplicate | Memory discipline, ledger location, keeping the ledger current, transcripts, fit check, output management, labels, formulas. All of it is in the skill's short forms or `ledger.md`. | 2,775 |
| 166–201 | Keep | The ARCHITECTURE.md sections, which the skill points to. Drop the history parenthetical at 188–189 and the closing remark at 199–201. | ~350 |
| 203–211 | Duplicate | "Don't manufacture seams" in full. | ~565 |
| 213–270 | History, after extracting three directives | Lessons from use, now in part 1. Three of them are directives the skill doesn't carry and would be lost: a human on the far side of a thin orchestrator can be modelled as a `@boundary` with intent-level doors; cross-seam vocabulary defaults to `shared.centina.ts`, which must keep the `.centina.ts` suffix to be checked; held `deferred<"unimplemented">` holes report as errors until fill, and that's expected. Those three stay as guidance. The phase-3 lesson is already in the skill. | ~3,000 |
| 272–322 | History | Passages in their wording from before the cut, now in part 1. | 2,927 |

What remains is about 5k characters: the encoding rationale, the caution about
conventions, the ARCHITECTURE.md sections and the three directives.

### `docs/iterate-reference.md`

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 3–6 | History | Why the doc exists. | ~200 |
| 8–33 | Duplicate | The two extraction checks are in the skill. Keep why dependency direction matters, cut to a clause. Keep 34–41, the provisional file's header and contents, which the skill points to. | ~1,000 |
| 43–66 | Compress | The skill has the three orderings. Keep "suggest an order, don't pick one" and why it's allowed (it's structure, not meaning). | ~800 |
| 68–89 | Duplicate | See duplicate 1. Keep the session-label scheme for a system without a ledger. | ~1,000 |
| 108–134 | Keep (optional compress) | Reconciling ARCHITECTURE.md without a ledger, for older projects. | (~500) |
| 175–190 | Compress + History | Encoding intent. Keep the contrast with session zero: here the agent only proposes. | ~600 |
| 192–219 | Keep | The remaining lessons are directives. | 0 |
| 221–230 | History | The `prototype.aisl` port story. The directive is in the skill. | ~580 |

### `docs/measurement-methodology.md`

It duplicates spike's "Measuring" nearly rule for rule, and nothing tells an
agent to read it. Spike's setup says it "has the cases behind" the rules, but
it doesn't: it points on to `centina-realize-design.md`, which isn't bundled.
So the pointer misdirects twice.

The proposal is to unbundle it, which means changing `install.mjs`'s
`BUNDLE.docs`, the tree in `plugin-file-layout.md`, and what `bundle.test.mjs`
compares. Then point spike's setup at `centina-realize-design.md` and say that
file lives in the Centina repository. No runtime tokens are saved unless an
agent follows the pointer, but it stops sending one to a file that doesn't
have what it promises.

### `skills/centina-iterate/SKILL.md`

19,475 characters, 525 under the cap.

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 3 | Stale | The description says the skill "runs tsc ... (the interim structural-plane checker, until Centina's own checker exists)". The checker exists. The description goes into the skill listing of every session, in every project with the plugin. | ~100 |
| 36–48 | Compress | What to do when `specs/` is empty. | ~450 |
| 56–67 | Stale + compress | "Current state of the checker" predates the checker. Keep the lens: `tsc` catches names, arity and shape, never the spec-plane gaps, so a clean `tsc` run is a floor. | ~400 |
| 261–268 | Compress (your call) | Rule 0's case for being a bottleneck. It's what an agent reaches for when the human pushes it to write the spec, so I'd keep it, cut to two sentences. | ~300 |
| 295–299 | Duplicate | "Don't fix diagnostics yourself" restates Rule 0a. Fold into that bullet. | ~300 |

### `skills/centina-realize/SKILL.md`

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 158–169 | Duplicate | See duplicate 2. | ~550 |
| 301–314 | Duplicate | See duplicate 4. | ~600 |
| 360–362 | Stale | An empty "Lessons from use" placeholder. New lessons go in the reference docs. | 66 |

### `skills/centina-session-zero/SKILL.md`

19,892 characters, 108 under the cap, so the bundle test fails on the next
sentence anyone adds. Most of its weight is the gates and the guardrails,
which stay.

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 23–31 | Compress | The "Why, in full" pointer goes once that section moves to part 2. | ~150 |
| 226–235 | Duplicate | Where the ledger lives and when to split it, both in `output-management.md`, which the bullet already points to. | ~300 |

### `skills/centina-spike/SKILL.md`

| Lines | Kind | What and where | Saves |
|---|---|---|---|
| 18–21 | Stale | The pointer to `measurement-methodology.md`. See that entry. | ~100 |
| 86–89 | History | How one entry grew to hundreds of kilobytes. Keep it as a clause: it's the reason the one-question rule exists. | ~150 |
| 241–246 | History | Open questions about the skill's own starting numbers. They're notes for Centina's development, now in part 1. ROADMAP would also do. | ~300 |

## What I'm not proposing to touch

Rule 0 and Rule 0a in every skill, over-competence and scribe-not-architect,
the gates, the measurement plan and checkpoints, the trail record formats, the
ledger's header and status tables, "Reading", "When a status changes" (item 6
especially), "Transcripts", the axiom distinctions and the routing lens's
worked cases. These are what the skills are for, and an agent that lost any of
them would behave differently.

## Risks in applying this

- **A long form I misjudged as a duplicate.** When an agent read the
  session-zero reference in full, it got a little more nuance than the
  skill's short form. I've listed every piece I found that only the long form
  carries. Each removal should still be read against the short form at edit
  time, not trusted from this table.
- **Human-facing text needs a home that exists.** The setup material has one.
  The tracker-page description doesn't, unless `ledger-mod.md` takes it or a
  new trail page is written.
- **Nothing checks meaning.** The bundle test keeps each skill under the cap
  and every doc a skill names in the bundle. The site build checks links. No
  test can say a compression kept its meaning, so each edit is a diff for you
  to read.

## Proposed order

1. **No judgment needed:** remove the passages already copied to
   `skill-history.md`, and fix the three stale items (iterate's description and
   checker paragraph, the empty realize placeholder).
2. **Duplicates:** pick each home as listed and turn the other copies into
   pointers.
3. **Human-facing moves:** once the destinations are settled.
4. **Compressions that need your read:** Rule 0's tail, Axioms, the encoding
   rationale, iterate's no-ledger reconciling.
5. **`measurement-methodology.md`:** unbundling it touches the installer and
   its test, so it goes separately.

Each step goes one file at a time. The skill-loaded references get only edits
that keep their meaning, as agreed when the docs site was rewritten.

## Status

**Decided on review:**

- Rule 0's case for being a bottleneck (iterate's SKILL.md 261–268) is cut to
  two sentences, in step 4.
- The tracker-page description (`trail.md` 213–249) moves to `ledger-mod.md`,
  in step 3.
- `measurement-methodology.md` is unbundled, in step 5, which also fixes
  spike's pointer to it.
- Everything else stands as proposed.

**Step 1, applied.** Every passage in `skill-history.md` is out of its
source, and three stale items are fixed: iterate's description now names the
checker, its "Current state of the checker" paragraph is now "Reading `tsc`'s
part of the signal", and realize's empty "Lessons from use" is gone. Where a
removed passage carried a rule, the rule stayed:

- `ledger.md`, "Why this format": the six cases went, and the paragraph that
  draws the lesson now opens with the one case it depends on (a fix landing in
  one copy of a claim while another copy stood wrong), since it used to say
  "case 3".
- `ledger.md`, bare labels: two sentences of the checker's grading reduced to
  one, error when the token matches a real entry and warning when it matches
  nothing. The date comparison is internal.
- `ledger.md`, an ownerless member: the reason it's only a warning became the
  directive it implies, don't silence the warning by citing whichever `W` is
  handy.
- `ledger.md`, ownership citations: one sentence saying a citation goes stale
  when its `W` closes, with no edit to the code, so the check runs on every
  ledger write.
- `realize-conformance.md`: the callable story became one bullet saying an
  ambient `declare function` emits no binding and throws on import.
- `session-zero-routing.md`: "the verdict-era reflex the jurisdiction reframe
  retired" became "don't refuse to engage".
- `session-zero-reference.md`, "Lessons from use": now just the three
  directives the skill doesn't carry. The skill's two pointers into this file
  changed to match: the "Why, in full" pointer went with the section it named,
  and the "Lessons from use" pointer no longer lists the runs.
- Spike's "how one entry grew to hundreds of kilobytes" became a clause giving
  the reason (appended steps are each admitted on their own merits and never
  checked against the question). Its "Lessons from use", which held only those
  open questions, went with them.

**Step 2, applied.** About 10.5k characters. Each duplicate kept its home as
listed, with the second copies cut to what only they carried:

- `session-zero-reference.md` keeps, of its long forms, only the text-medium
  point about diagrams and "be warier the more mature the language feels".
  The skill's pointer now says the first four cross-cutting practices have
  more there, since fit check no longer does.
- `iterate-reference.md` keeps why the extraction checks apply to every inline
  boundary, the meaning of the no-ledger label letters, and re-explaining a
  formula that comes back in a long session (iterate's skill lacks that
  clause; session zero's has it).
- Session zero's ledger-location sentence was trimmed rather than replaced by
  its pointer. Session zero never directs a read of `output-management.md`,
  so the skill's copy is the one its agents actually see.

**Step 3, applied.** About 6.0k characters: 3,844 from
`plugin-setup-procedure.md` (now 5,679) and 2,184 from `trail.md` (now
10,425). The destinations changed on review:

- The setup material went to a new page, `centina-check-setup.md`, not to
  `plugin-setup-step.md` or the install pages. The plain-shell error in
  `checker/setup/command.ts` points a person at it from outside a session, so
  it has to ship, and it is bundled (installer list, layout tree, site
  sidebar) though no skill reads it. It holds the three sections verbatim,
  apart from one "(below)" that became a pointer back to "The config". The
  procedure keeps one paragraph naming what setup writes, the refusal before
  the first write, "copies no docs", and a pointer that tells the agent it
  doesn't need the page. Every link to "Running it without a session" moved
  with it: the three install pages, the installer's closing message, the
  error message and a comment in `setup.ts`.
- The tracker-page description went to `ledger-mod.md`, "The work item
  tracker", reworded into that page's voice with every fact kept. "The ledger
  hook" became "a plugin hook", since the transcript hook does the copy.
  `trail.md` keeps the command, the findings, one paragraph on where weights
  live (gitignored `transcripts/`, committed `weights/`), the resumed-item
  rule, and a pointer.
- Step 1 left `trail.md` saying `trail-missing-decision` covers "the weak
  point named below", after the weak points had moved out. It now names that
  point: options are offered in prose, so capture is up to the agent.

The procedure's config compression (96–114) is still open, with step 4.
