# Session zero reference

Detail `centina-session-zero` reads on demand. The skill keeps a short form of
each section. The routing lens has its own doc, `session-zero-routing.md`.

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
  surfacing what does.
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
  honest fallback, not a forced encoding).
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
   cites the labels.
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

- **A human user can be a boundary.** When a thin orchestrator's far side is a
  person, model it as a `@boundary` with intent-level doors
  (`exchangeSuggestion`, not "render a list and read a tap"). That guides the
  eventual UI without pinning it.
- **Put cross-seam vocabulary in a `shared.centina.ts`, not in a boundary
  declarator file.** A declarator that co-locates its types with the boundary
  trips the `boundary-dependency` rule. The file must keep the `.centina.ts`
  suffix: the checker's spec-plane rules (hole enumeration, `@agent:` labels)
  only scan files with that suffix, and a plain `shared.ts` is invisible to
  them even though it can carry real spec content (holes included). Default a
  session-zero skeleton to a `shared.centina.ts` for the vocabulary the DAG
  traffics in across seams.
- **Held internal-processing holes route to `deferred<"unimplemented">`**, and
  the human fills them, in place, at `centina-iterate`. That correctly leaves
  `bin/centina-check` reporting them as errors until fill: the honest "work
  remaining" signal for a pre-fill, pre-plan handoff, not a defect.
