# Session zero reference

Detail `centina-session-zero` reads on demand. Each section was moved here
verbatim from the skill, which keeps a short form of it, so the skill stays
under the post-compaction cap (`ROADMAP.md`, "Skills over the post-compaction
cap"). The routing lens has its own doc, `session-zero-routing.md`.

## Why session zero exists, and where it sits

This skill runs at the very **front of the funnel**, before there is any spec
to iterate. `centina-iterate` refines _one_ spec toward clean; session zero
sits upstream of it: the human has a _system_ in their head — several
components that talk to each other — and needs it turned into a **component
DAG** with frozen seams before any one component is worth filling in. Sorting
those nodes — which earn a filled-in spec, which route away as terminals,
Skills, or held holes — is part of the work here (see "Which nodes earn a
spec" below).

The lineage it feeds: **ARCHITECTURE.md + skeleton spec set** (session zero) →
**`<component>.centina.ts`** filled in (`centina-iterate`) → **PLAN.md** per
boundary-set (the implementation). Session zero's whole job is to make the
_shape_ right early, so the later fill-and-iterate work is isolated by
dependency direction instead of rippling backward.

Why it exists: writing one component fully, _then_ discovering its boundaries,
forces rework on the component when the boundaries turn out to be shaped
differently than imagined. The cheaper path is to resolve the seam contracts
first — the skeleton everything else hangs on — and this skill is that
resolution, formalized into a gated process with an output artifact.

## The `@external` cases

- **`@external "<source>"` declarations** — where the system meets existing
  technology. Two cases land differently: a utility _called directly in visible
  spec code_ (a `randomUUID`, a `timestamp`) is declared in the skeleton at its
  call site; a _terminal behind a component door_ (the database behind a store,
  the model API behind a suggester) has an interface that lives _behind the
  door_ — don't fabricate it, because that is reaching through the door. Record
  it in ARCHITECTURE.md's terminal nodes section and a boundary comment; its concrete
  `@external` declaration is made at fill, where the held logic that calls it is
  written. Call this distinction out during the session whenever a terminal's
  interface turns out to be behind a door.

## Phase 6, handoff in full

6. **Handoff.** The agent recuses from the pen. The human owns every spec file
   from here; the ledger's open questions are live; each component is ready for
   `centina-iterate`. A node whose fit was genuinely in doubt has already been
   routed by the check above (structural → filled component; realization →
   behind a door) before it's handed on. Close by asking the human directly
   whether they want to start a `centina-iterate` session on one of the
   components **right now**, or would rather fill spec content in on their own
   time and come back to `centina-iterate` later — name both as legitimate;
   the skeleton and ARCHITECTURE.md don't go stale waiting. If several
   components came out of this session, ask which one they want to start
   with. If they say "later," the handoff is still complete — don't treat a
   deferred start as unfinished business.

## Cross-cutting practices

- **Diagram as falsification.** A picture surfaces "that's not what I meant" in
  seconds where prose hides it for paragraphs. Offer to render the DAG the human
  has described at each phase boundary, before advancing — and offer it
  _proactively_ if they show persistent confusion over a few exchanges about how
  the pieces relate. (Note: Make sure to always generate the DAG code in a Markdown
  document, _not_ in the session window, and once a DAG is generated, don't delete
  it when revisions are needed or when new ones are generated. Instead, name the DAG
  files with a simple "version" convention so their evolution over time can be easily
  tracked by both the agent and the human.)
  In a text/CLI medium prose often carries the gates fine, so
  treat this as an offered aid keyed to the human's need, not a mandatory render
  at every gate. When you do render, the diagram must show only nodes and edges
  the human stated — never invent a component to make the picture tidier.
- **Priority elicitation on high-stakes forks.** When a fork's cost is high and
  hard to reverse, _solicit the human's priorities before framing options_, then
  present each option's tradeoffs against those priorities (proactively, not only
  when asked) — including which considerations _don't_ apply. The agent supplies
  the tradeoff map; the human's priorities and the verdict stay theirs (Rule 0
  intact). The failure this prevents: barreling into a fork's options without
  ever asking what the human is optimizing for — an experienced spec-writer
  volunteers their priorities, but a less experienced one won't, and then the
  agent frames a tradeoff the human has no basis to weigh. Surfacing what
  _doesn't_ matter (e.g. "rendering doesn't bear on this") is as load-bearing as
  surfacing what does. (Promoted straight to core from the grid-inventory live
  session, 2026-07-21 — the first lesson earned in a live run rather than an
  adversarial trace.)
- **Encode ratified intent into the type system when the seam can carry it.**
  Intent-as-spec is one of Centina's headline concerns, and TypeScript is the
  grammar precisely so a decision about _meaning_ can be made load-bearing and
  checkable instead of left to a prose note an implementer can skip. Whenever you
  confirm a decision with the human — especially a non-trivial one about
  intent/meaning that should flow all the way into implementation — that the spec
  code _isn't_ currently carrying but _easily could_ (a non-empty-array
  precondition as `[T, ...T[]]`, a discriminated-union status that makes an
  illegal state unrepresentable, a branded identity, an exhaustive enum that
  forces every case), **call it out when it arises**, in whatever phase. Choosing
  the type-level form that carries an _already-ratified_ decision is _form, which
  is the agent's job_ (Rule 0's meaning/form split — not an exception to it), so
  session zero grants standing authority to **default to emitting the encoded form
  into the skeleton at phase 5 without a separate confirmation**. The safeguard is
  mandatory and cheap: mention it at the time it comes up, and leave a short
  comment at the encoding site citing the ledger label of the decision it
  enforces (provenance). This
  is a bounded relaxation of "propose-only-as-a-question / mark-provisional" —
  bounded because it applies _only_ to encoding a decision the human already made,
  never to inventing one, and only when the type genuinely carries it (when a
  constraint can't be typed — e.g. array homogeneity — an `@agent:` note is the
  honest fallback, not a forced encoding). (Promoted straight to core from the
  grid-inventory live session, 2026-07-21 — the non-empty comparator-input type
  `[ItemInstance, ...ItemInstance[]]` was the triggering case.)
- **A run may surface language-level conventions, not just app contracts.**
  Occasionally the elicitation kicks up a reusable Centina convention (a
  boundary-door naming scheme, a rule for a recurring door shape) rather than a
  system-specific decision. Surface it _to the human as a candidate_; if they
  adopt it, apply it in the skeleton marked under-test — never fold it into the
  language or this skill unilaterally. Guard two things: don't let this become a
  lever that relaxes the skill's own strictures (Rule 0, scribe-not-architect,
  bias-toward-holes), and be warier the more mature the language feels — a
  settled convention set is a feature, and churn is a cost.
- **Propose only as a question; record it as open.** When you must float a
  candidate component or contract to keep moving, float it _as a question_ and
  record it as a `sz:P` entry with `Status: open` until the human ratifies or
  rejects it at the next gate. A proposal still open at the skeleton write
  ships as a hole citing its label.
- **Memory discipline.** This is a long session that will likely cross context
  windows. The ledger is the load-bearing state: the decided/guessed
  distinction lives in entry statuses, so it survives compaction. Write
  entries when decisions happen, not at the end of a phase. Prose can be
  re-derived; entries cannot.
- **Where the ledger and SESSION-ZERO-STATE.md go.** Both in the same
  `specs/<system>/` location as `ARCHITECTURE.md`, never directly in `specs/`,
  and never at the repo root. `SESSION-ZERO-STATE.md` is only a run frame
  (see `${CLAUDE_PLUGIN_ROOT}/docs/output-management.md`). `<system>` is the
  name of the system this session is about: if the human has already named
  it, use that; if not, ask before the first write to disk rather than
  guessing at a phase gate.
- **Keep the ledger current.** Follow `ledger.md`'s "When a status changes"
  on every change, and its "Sweeps" at every gate. A superseded entry that
  nothing marks stale is the failure the ledger exists to prevent.
- **Transcripts and concurrency.** Never open a session transcript without
  asking first, and warn the human about concurrent sessions, per
  `ledger.md`.
- **Fit check.** When facing a high-stakes, hard-to-reverse fork with complex
  tradeoffs, request a **fit check** (invoke with "fit check" or "fit check on X")
  to get a structured costs/benefits analysis: each option's merits and costs,
  alignment against stated priorities, and alignment against established patterns
  (uniform reducer, event-sourcing, boundaries-as-affordances, etc.). The agent
  supplies the tradeoff matrix; the verdict stays yours (Rule 0 intact).
- **Long-session output management.** Follow
  `${CLAUDE_PLUGIN_ROOT}/docs/output-management.md`. Ledger length is not a
  reason to split it; split only when the human asks.
- **Label references get explained, not just cited.** Labels are ledger labels
  (`sz:P4`). The first time one comes up in conversation, say what it is and
  give a one-clause summary ("sz:P4, cap escalation depth at 3 attempts," not
  "sz:P4"). When re-citing one, restate a brief reminder if more than 10 labels
  of the same letter have come up since. Err toward restating when unsure. The
  label index is `LEDGER-LABELS.md`; don't keep a separate one.
- **Explain formula terms on introduction.** When a mathematical or scientific
  formula appears for the first time in a session, or reappears in a long
  session where you can't be confident the human still has each term in mind,
  spell out every symbol in plain language next to the formula. Do the same
  unconditionally whenever a formula goes into ARCHITECTURE.md, PLAN.md, or any
  other document — never rely on a formula being self-explanatory or defined
  earlier in the conversation.

## Handoff: ARCHITECTURE.md and the skeleton set


The primary artifact is the **skeleton spec set** itself — real `.centina.ts`
files that `centina-iterate` consumes directly. Alongside it, write
`specs/<system>/ARCHITECTURE.md`, which records what the skeleton alone can't
carry:

ARCHITECTURE.md holds structure. Anything with a status (decided, open,
resolved, rejected) lives only in ledger headers; ARCHITECTURE.md cites the
label and never restates the status.

1. **The component DAG** — the diagram, plus each node's one-line
   responsibility. _(Always present.)_
2. **Contracts** — each seam, its door signatures and direction, and the
   ledger label of the decision behind it.
3. **Holes** — the label of each open `sz:Q` entry the skeleton carries. The
   holes themselves live in the spec files, where the checker lists them.
4. **Terminal nodes** — the `@external` edges and the concrete technology named
   for each. An unknown source cites a `sz:Q` label.
5. **Risks / watch-items** — each recorded as a ledger entry (a `sz:F`
   finding, or a `sz:R` rule for conventions adopted under test); this section
   cites the labels. (Added after the first run, where the thin-UI risk needed
   a home the other four sections didn't give it.)
6. **Rejected alternatives** — a pointer to the settled section of
   `LEDGER-INDEX.md`. Rejected proposals stay in the ledger with their
   reasons, which keeps the next session from reopening settled ground.

Because statuses live in the ledger, ARCHITECTURE.md does not go stale when a
decision changes. `centina-iterate` updates it only when a signature, file
location or terminal source changes (see "Reconciling ARCHITECTURE.md before
the plan" in `iterate-reference.md`).

ARCHITECTURE.md is a system-level companion to the per-component PLAN.md
lineage — a plan-per-boundary-set is derivable from a frozen contract
ledger, and drifts exactly when the ledger drifts.

## Don't manufacture seams, in full

- **Don't manufacture seams — and don't refuse either.** If routing the
  realization out leaves one node with little or nothing to freeze, the task is
  one algorithm, not a system. Two opposite failures bracket the right move:
  inventing seams to fake a DAG (over-competence), or bouncing the human with a
  "bad fit" verdict (the retired recuse reflex). The correct output is the
  honest minimal skeleton — signature pinned, body held, labeled "this is one
  node, not a system." Emit that; don't pad and don't refuse.

## Lessons from use


_Accumulate here as the skill is exercised: phases that reliably resolved or
stalled, where the diagram earned its keep, where over-competence crept in past
a gate, whether the "typed seams + routed holes" skeleton got the human to a
better starting shape than a blank set of files._

**First run — Wordboard (a writer's word-tracker app).** Produced a seven-file
skeleton + ARCHITECTURE.md, tsc-clean, across intent → components → seams →
terminals → skeleton.

- _The gates held against over-competence._ The human painted every door name,
  type, and mode; the agent supplied form and flagged ripples. Catching the
  "definition-on-`Suggestion`" seam ripple early — it would have wired the
  suggesters to the definition source and made `DefinitionLookup` vestigial —
  was exactly the rework-avoidance the skill exists for.
- _Boundary-as-user works and is worth reaching for._ Modeling the
  orchestrator's far side — the human user — as a `@boundary` gave intent-level
  doors (`exchangeSuggestion`, not "render a list and read a tap") that guide
  the eventual UI without pinning it. Recognize it as an available pattern when
  a thin orchestrator's far side is a person.
- _A run surfaced language conventions, not just app contracts_ — the
  `read*/write*/exchange*` boundary-door naming and a write-with-receipt door
  heuristic both emerged here, adopted under-test per the cross-cutting note.
- _Terminals behind a component door_ were recorded (ledger + comments) with the
  concrete `@external` deferred to fill, rather than fabricated — folded into
  the `@external` guidance above.
- _Weak spot: the diagram lagged._ The agent narrated the DAG in prose through
  the gates and only rendered mermaid at the skeleton write. Mostly fine in a
  text medium, but it drove the softening of the diagram rule to
  offer-at-each-phase-boundary and proactive-on-confusion (above).
- _Put cross-seam vocabulary in a `shared.centina.ts`, not in a boundary
  declarator file._ The checker confirmed it: wordboard's boundary files pass
  the `boundary-dependency` rule because their contract types live in
  `shared.centina.ts`, whereas a declarator that co-locates its types with the
  boundary trips that rule (the founding `task-corpus` fixture does). It must
  keep the `.centina.ts` suffix — the checker's spec-plane rules (hole
  enumeration, `@agent:` labels) only scan files with that suffix, and a plain
  `shared.ts` is invisible to them even though it can carry real spec content
  (holes included). Default a session-zero skeleton to a `shared.centina.ts`
  for the vocabulary the DAG traffics in across seams.
- _Held internal-processing holes route to `deferred<"unimplemented">`_ — the
  human fills them, in place, at `centina-iterate`. That correctly leaves
  `bin/centina-check` reporting them as errors until fill: the honest "work
  remaining" signal for a pre-fill, pre-plan handoff, not a defect.\*

**Test-case traces (2026-07, fit-as-jurisdiction thread).** From adversarial
test-case traces run during this skill's own development:

- _Phase 3's failure/empty/not-found question is the highest-yield step in the
  phase._ Across crafting-recipes, url-shortener, pricing-request-handler, and
  oauth-callback it was reliably what converted a vague seed into real contracts
  — forcing `CraftResult`, collision/idempotency, the itemized `PricedCart`
  breakdown, and the OAuth trust branches (state mismatch, unverified email,
  first-login provision-vs-reject) respectively, none visible in the seed prose.
  Ask "what happens on the empty/failure case" first at every seam, not as a
  cleanup pass.

## Passages the skill condenses, in their original wording

The skill keeps a shorter form of each of these; this is the text as it stood
before the skill was cut under the post-compaction cap.

### Over-competence (under "The one sanctioned write")

The failure mode this rule exists to stop is not agent incompetence — it's
agent **over-competence**. An agent handed a scattered description will
happily produce a clean, plausible, well-shaped architecture, and the
cleanliness _disguises_ which parts are the human's conviction and which are
the agent's confabulation. The human then ratifies a coherent-looking picture
half of which they never actually decided. The entire skill is built to keep
"decided" and "guessed" separated, continuously, so that by the skeleton write
there is nothing left for the agent to invent. **The agent is a scribe here,
not an architect.** Bias toward holes: an over-complete skeleton is the bug,
not the feature.

### What "complete" means (under "What a skeleton contains")

"Complete" for a component means **every gap routed, not every gap resolved**.
Centina's definition of done is "no _unrouted_ holes," not "no holes." A
component is ready to hand to `centina-iterate` with plenty of open questions,
as long as each is deferred to the human, delegated to a Skill, externalized,
or quarantined behind a boundary. That's what lets a consumer be filled against
a mocked seam in parallel with the seam's own build.

### Phase 4, terminal-node closure

4. **Terminal-node closure.** Confirm which nodes are edges that meet existing
   technology — naming concrete tech is fine and useful here, because it is
   what becomes `@external`. Confirm the DAG is _closed_: every seam
   terminates, either at another component or at a terminal node. This is also
   the realizability check — a door that a real database or model API cannot
   actually satisfy is caught here, at the contract, not after both sides are
   written. A terminal whose interface sits behind a component door is
   _recorded, not fabricated_ (see the `@external` note above): name the concrete
   tech if known, leave the source TBD if not, and route the unknowns as holes.
   _Gate: the human confirms the DAG closes._

### Don't recall a canonical design and present it as elicited

- **Don't recall a canonical design and present it as elicited.** The more
  famous the task — a URL shortener, a todo app, an auth flow — the more the
  agent already _knows_ the standard architecture, and the stronger the pull to
  name the store, the code scheme, the door shapes before the human does. A
  _correct_ recalled answer is over-competence at its purest: it looks exactly
  like elicitation and isn't. Scale the draw-it-out discipline _up_ on canonical
  tasks, not down; the tell is any concrete tech or shape the agent introduced
  that the human never said. (Surfaced by the url-shortener control trace.)
