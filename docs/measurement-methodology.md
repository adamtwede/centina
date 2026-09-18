# Measurement methodology

Used by `centina-realize`. Imperative on purpose. Every rule below comes from
a failure in a real project; see `docs/centina-realize-design.md` in the
Centina repository (not bundled) for the cases.

## When it applies

Any measurement whose result will be recorded in the ledger, or will decide a
design. Unit tests of behavior already known are exempt.

If you are unsure whether a result will be recorded, assume it will.

## Before running: the measurement plan

Write the plan into the spike's `W` entry body before any measurement code
runs. Letter the parts so later entries can cite them.

1. **Question.** The hypothesis in one sentence. Record the prediction as an
   `F` entry with `Status: predicted`, including the reasoning and the
   numbers you expect.
2. **Premises.** List every premise the prediction or the planned fix rests
   on. For each: cite the `F` entry that measured it, or mark it assumed. An
   assumed premise that would change the conclusion if false gets measured
   first, as its own step.
3. **Reference.** What the result is compared against. Show it is valid on its
   own (known limits, a closed form, an independent method) and converged
   (refining it no longer moves the answer) before trusting it as truth.
4. **Configuration.** State the settings under test and confirm they are the
   ones that ship. If they are not, say why the difference cannot matter.
5. **Controls.** Vary one factor at a time. When two factors may interact,
   test them together and separately (a factorial design).
6. **Sample.** State the sample size and why it is enough. Report spread, not
   only a central value. Do not draw a conclusion from a small sample.
7. **Refutation.** State the result that would refute the hypothesis. A check
   that cannot fail is a regression test, not validation; record it as one.
8. **Stopping rule.** State which decision the result feeds. If no possible
   result would change a decision, do not run it.

The human confirms the plan before the measurement runs.

## While running

1. **Every section prints.** A section that crashed or printed nothing did not
   pass. Never record a conclusion from output you did not see.
2. **Labels match computation.** Before reading a table, confirm each row and
   column label names what the code actually computes.
3. **Never tune to an old number.** Do not adjust a model, a constant or the
   world to reproduce an earlier result. If the new result disagrees, the
   disagreement is the finding.

## After running

1. Update the prediction's `F` entry: `measured` or `measured-false`, with
   `Evidence` (harness file, command, commit). The prediction text stays.
2. If `measured-false`, record where the reasoning failed: which premise or
   which inference.
3. Follow `ledger.md`'s "When a status changes". Check "Affected work items"
   in `LEDGER-INDEX.md`.

## Diagnoses are claims

A diagnosis ("the cause is X") is a hypothesis until measured. Check it before
reporting it as the cause, and before writing a fix or a guard based on it. A
fix built on an unchecked diagnosis can pass its tests and still miss the
failure it was written for.

## Stating results

- Say `measured` only with evidence in hand.
- An idea or a likely outcome is fine in conversation, marked as such
  ("likely", "untested"). Never record one as fact.
- Quote numbers with the conditions they were measured under (sample,
  configuration, reference). A number without its conditions is not a result.
