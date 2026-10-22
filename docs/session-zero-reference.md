# Session zero reference

Detail `centina-session-zero` reads on demand. The skill keeps a short form of
each section. The routing lens has its own doc, `session-zero-routing.md`.

## Cross-cutting practices

- **Diagram as falsification.** A picture surfaces "that's not what I meant" in
  seconds where prose hides it for paragraphs. In a text/CLI medium prose often
  carries the gates fine, so treat the diagram as an offered aid keyed to the
  human's need, not a mandatory render at every gate.
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
- **A run may surface language-level conventions, not just app contracts.** Be
  warier of adopting one the more mature the language feels — a settled
  convention set is a feature, and churn is a cost.

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
