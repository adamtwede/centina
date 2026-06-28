# FIT — Add Boundary Primitives

*Produced by `aisl-fit` (worked retroactively from the design session that also
produced the skill). This is the first project-pool fit-case and the worked
example behind canonical precedent `checker-validation-rule`.*

## Verdict + reasoning

**Partial-fit**, sliced down to a **1-boundary-end (reporting) shape**.

The task "add boundary primitives to the AISL checker" is, as a whole, a compiler
feature: lexer learns three keywords, parser grows a declaration node, checker
grows a direction rule. Counting boundary-ends:

- The *parsing* half (token-stream → AST for the new syntax) is **0-end** pure
  compute — no external actor on either side, input and output are internal
  representations. Not spec-worthy in AISL; build it directly. **Out of scope.**
- The *rule-enforcement* half is **1-end**: ingress is a privileged parameter (the
  declaration to check, handed over by the rest of the pipeline — internal, so a
  param, not a boundary), egress is a real seam (diagnostics surfaced outward).
  Center of gravity is structural, on the **contract** axis ("what shape must a
  boundary declaration hold to be valid"). **In scope.**

The split between the two halves is not arbitrary — it is a *shape* cut. The spec
naturally shed the half with no described intent and kept the half with a real
egress seam and genuine described logic.

## Structural inventory (Level 0)

- **Provenance** — the declaration under check enters as a function parameter
  (`declaration: AISLDeclarationStatement`), privileged source #1. The real AST
  node type already exists in the codebase, so it can be referenced via `external`
  rather than re-stubbed (grounds existence; types as `Unknown`).
- **Flow** — declaration in → classify by statement type → on a direction
  violation, emit a diagnostic. No data manufactured; the rule only inspects and
  routes.
- **Contract** — the rule *is* a contract check: a `datasource`'s doors must all
  return data; a `datasink`'s doors must all be void. Direction is read
  structurally from each door's signature (returns data = read; returns nothing =
  write), never from its name.

Realization-plane content present but out of scope: the mechanical token→AST
transform (algorithm), and the existing CLI/file plumbing (already built).

## Boundary sketch (Level 1)

The one genuine seam is the **egress**:

```
datasink Diagnostics():
    report_error(message: String)
```

`report_error` is a void write door — a textbook `datasink`. The message string is
legitimately-sourced data (a literal), so emitting it manufactures nothing. This
is the clean answer to "how do I connect AISL to real diagnostics without doing
implementation detail": the diagnostic is data crossing the egress seam, not a
`CheckerResult` the spec has to conjure.

## Thin slice (Level 2)

The representative flow — classify one declaration, report on violation — written
as real AISL (the current `add_boundary_primitives.aisl`, modulo the
not-yet-implemented boundary syntax it can't be checked against yet):

```
function boundary_declaration_syntax_checker(declaration: AISLDeclarationStatement):
    match declaration.statement_type as DECLARATION_STATEMENT_TYPES:
        case DATASOURCE:
            if declaration.door_methods.any().returns_void():
                diagnostics.report_error("All door methods of datasource boundary types must return a value. Use 'boundary' if you need read and write.")
        case DATASINK:
            if declaration.door_methods.any().declares_return_type():
                diagnostics.report_error("Door methods of datasink boundary types cannot return a value. Use 'boundary' if you need to read and write on a boundary type.")
        case BOUNDARY:
            # @agent: valid; no diagnostic emitted
        case EVERYTHING_ELSE:
            # @agent: valid; not a boundary declaration, no diagnostic emitted
```

The ad-hoc method calls (`door_methods.any().returns_void()`) type as
`Unprivileged` and are used only in `if` conditions — legitimate descriptive use,
manufacturing nothing. The exhaustive-match cases for `BOUNDARY`/`EVERYTHING_ELSE`
carry `@agent:` no-op bodies: "do nothing" is a positive claim worth stating, not
an absence.

## Scope decision

- **In:** the direction-enforcement rule, expressed as the classifier function
  plus the `Diagnostics` egress sink.
- **Out (rejected slices):**
  - `BoundaryDiscussion` (a `datasource` over `docs/boundaries.md`) and
    `AISLSource` (`create_primitive`/`set_primitive_syntax`) — both modeled the
    *act of building the feature* as doors. The actor on the other side was *the
    developer*, not a runtime actor → tasks-as-doors, build-time work, not data
    seams.
  - The lexer/parser expansion — 0-end pure compute, no spec-worthy provenance.

## Open ambiguities (for `aisl-iterate`)

- `diagnostics` instance must be constructed (`diagnostics = Diagnostics()`) before
  use — trivial once boundaries parse.
- Whether an intentional no-op match case should stay an `@agent:` comment or earn
  a first-class `pass`/`noop` keyword — a small language question surfaced by this
  exercise; logged to backlog, not decided here.
- Whether `boundary_declaration_syntax_checker` should return anything at all once
  it reports via the sink (currently void).

## Discriminators (for the precedent corpus)

Abstracted to the canonical `checker-validation-rule` case: ingress is a parameter
(not an external actor) → not 2-end; egress is "emit a diagnostic" → a genuine
`datasink`, the one real seam; described logic is classification against a
contract, not manufacturing. Inverse-error edge: if the candidate boundaries model
*building the feature* rather than *data crossing a runtime seam*, this shape does
not hold — drop them and re-slice.
