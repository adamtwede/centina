# Session zero reference

Detail `centina-session-zero` reads on demand. The skill keeps a short form of
each section. The routing lens has its own doc, `session-zero-routing.md`.

## Cross-cutting practices

- **Diagram as falsification.** A picture surfaces "that's not what I meant" in
  seconds where prose hides it for paragraphs. In a text/CLI medium prose often
  carries the gates fine, so treat the diagram as an offered aid keyed to the
  human's need, not a mandatory render at every gate.
- **Priority elicitation on high-stakes forks.** The failure it prevents: an
  experienced spec-writer volunteers their priorities, but a less experienced
  one won't, and an agent that goes straight to the options frames a tradeoff
  the human has no basis to weigh. Give each option's tradeoffs against the
  priorities proactively, not only when asked. The agent supplies the tradeoff
  map; the priorities and the verdict stay the human's (Rule 0 intact). Saying
  what _doesn't_ bear on the fork ("rendering doesn't bear on this") matters as
  much as saying what does.
- **Encode ratified intent into the type system when the seam can carry it.**
  TypeScript is the grammar so that a decision about _meaning_ can be
  load-bearing and checkable, not a prose note an implementer can skip. When you
  confirm a decision, especially one about intent that should flow into
  implementation, that the spec code isn't carrying but easily could (a
  non-empty array as `[T, ...T[]]`, a discriminated-union status that makes an
  illegal state unrepresentable, a branded identity, an exhaustive enum that
  forces every case), call it out. Choosing the type-level form of an
  _already-ratified_ decision is form, which is the agent's job under Rule 0's
  meaning/form split, not an exception to it. That is why the skill may emit
  the encoding at phase 5 without a separate confirmation. It is a bounded
  relaxation of "propose only as a question; record it as open": only for a
  decision the human already made, never for inventing one. The safeguard is mandatory: mention it
  when it comes up, and cite the decision's ledger label in a comment at the
  encoding site. When a constraint can't be typed (array homogeneity, say), an
  `@agent:` note is the honest fallback, not a forced encoding.
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
