---
name: aisl-iterate
description: Drives the interactive AISL spec-refinement loop. Runs the AISL checker (src/cli.ts) against a .aisl file, walks the human through each diagnostic, distinguishes mechanical fixes from genuine design ambiguities, applies agreed fixes, and re-checks until clean. When the document is clean, derives an implementation plan and writes it to PLAN.md alongside the spec. Use when the user wants to iterate on, check, fix, or resolve errors in an .aisl file, or references AISL checker/linter/type-checker output.
---

# AISL Iterate

This is the primary way a human refines an AISL document: resolve checker
errors, surface ambiguities the pseudocode left implicit, settle them with the
human, repeat until the document is clean and the human is satisfied. The goal
of each loop iteration is not just a passing checker run — it's a more
precisely specified `.aisl` document that's closer to a real implementation
plan.

## How to interpret an AISL spec

AISL is structured pseudocode — read it like conversational prose that has been
organized into typed declarations, not like executable code with precise
semantics. Keep these distinctions in mind when reading a spec:

- **AISL pseudocode itself** is a general description of implementation intent,
  presented in a structured format but semantically equivalent to well-organized
  prose. Interpret it as authorial intent, not a contract. The types, control
  flow, and structure are guides, not specifications to be followed literally.

- **Plain `#` comments** (without a preamble) potentially add context but
  should be treated with some degree of suspicion as to their relevance and
  accuracy. They may reflect an earlier design state, a reminder to the human
  author, or context that has since changed. Don't let them override what the
  pseudocode itself clearly expresses.

- **`@agent:` comments** are direct messages from the human developer to the
  coding agent reading the spec. They are the equivalent of injecting
  conversation into the spec — explicit intent, clarifications, questions, or
  instructions that the human wants the agent to notice. Treat these as authoritative
  context, not as ordinary comments. During `/aisl-iterate`, try to work with the human
  to convert `@agent:` stubs into proper AISL pseudocode where possible — if
  the intent is clear enough to express in the language, it should be. If it
  isn't, flag it as a genuine ambiguity and discuss.

## Process

1. **Run the checker** against the target file:

   ```
   npx tsx src/cli.ts <file.aisl>
   ```

   If no file is specified and there's only one `.aisl` file in the project, use
   that. If there are several, ask which one.

2. **If there are zero diagnostics**, say so plainly and ask whether the human
   wants to keep refining (e.g. tighten a type that's currently `Unspecified`,
   flesh out an `@agent:` stub) or stop here.

3. **If there are diagnostics**, take them one at a time, in the order the CLI
   reports them (lowest line number first). For each one, classify it before
   doing anything:
   - **Mechanical fix** — the diagnostic has one obviously-correct resolution
     given everything already established in the document and the
     conversation (a typo matching an existing identifier, a missing `as`
     cast, a scope reference that clearly meant a different in-scope name).
     Propose the fix in one or two sentences and apply it directly, the same
     way earlier scope bugs in this project were fixed without back-and-forth.

   - **Genuine ambiguity** — the diagnostic reveals that the pseudocode's
     _intent_ isn't actually settled (e.g. a type mismatch that traces back to
     an unresolved question about what a function is supposed to do, not just
     a typo). Do not guess. Lay out the tension plainly — what the checker
     found, why it's not just a mechanical fix — and either ask a direct
     question or use AskUserQuestion if there's a clean multi-way fork. Wait
     for the human's answer before touching the file.

4. **Fix one thing, then re-run the checker before fixing the next.** Types
   cascade — resolving one diagnostic can change, resolve, or newly expose
   others. Only batch multiple diagnostics together if they are obviously
   independent (e.g. two unrelated undefined-identifier typos in different
   functions).

5. **Repeat** from step 1 until the checker is clean or the human says to stop.

6. Warnings are reviewed the same way as errors, but don't block calling the
   loop "done" — confirm with the human whether they want to address open
   warnings now or leave them.

## Writing the implementation plan

When the checker is clean and the human is satisfied with the spec, derive an
implementation plan and write it as a PLAN.md file alongside the spec:

- **Location**: same directory as the `.aisl` file. If a `PLAN.md` already
  exists there, name it `PLAN_<spec_name>.md` (e.g. `PLAN_refactor_external.md`).
  If `PLAN_<spec_name>.md` also already exists, ask the human developer how they
  would like to proceed rather than overwriting existing contents.
- **Provenance**: the first section must name the spec file that produced it,
  e.g. `**Spec source**: specs/refactor_external/refactor_external.aisl`. This
  makes the plan's origin traceable.
- **Completeness**: the plan must be self-contained enough that a capable coding
  agent can implement the feature with little or no additional input from the
  human. It should name every file that changes, describe each change precisely
  (not just "update X"), call out any cascade effects across the pipeline, and
  list concrete completion criteria (commands that should pass, behaviors that
  should be observable).
- **No implementation context in the session**: the implementation plan is the
  deliverable. The agent implementing it works from the plan, not from any
  in-session context — write the plan as if it will be handed to someone who
  wasn't in the room.

## After implementation

Once an implementation plan has been executed and the human approves the
outcome, update the PLAN.md (or whatever name was chosen, see **Location** above)
to reflect the completed status:

- Add `**Status**: Implemented ✓` (or a failure note) near the top.
- Record any deviations from the plan that arose during implementation (e.g.
  an additional message string that needed updating, a fixture file that also
  needed migration). These deviations are signal about where the spec was
  underspecified — useful for improving future specs.

## What NOT to do

- **Rule 0: never write an AISL spec on a human's behalf.** Not even when
  asked, and not because it's hard or tedious — *because* writing the spec is
  the entire point of AISL. The spec is where a human and a coding model reach
  shared understanding; authoring it for them inserts exactly the layer of
  insulation AISL exists to remove, and hands the thinking back to the model.
  Relatively small or focused snippets in service of a discussion are fine
  (illustrating a syntax point, sketching one door), but do not produce, fill
  in, or "finish" a spec — the human is the architect. If a human asks you to
  write one, decline and redirect to iterating on what *they* write.
- Don't silently resolve a genuine ambiguity just to make the checker pass.
  The checker is a tool for _finding_ underspecified intent, not a target to
  satisfy by any available typing trick (e.g. don't just change a param's type
  to `Unspecified` to make a mismatch disappear unless that's actually what
  the human decides).
- Don't fix checker errors or warnings yourself unless explicitly instructed or
  given approval to do so. AISL diagnostics are explicitly designed indicate places
  where the human developer's intent is unclear or underspecified. The human developer
  should be the one to decide how to resolve those ambiguities, not the coding agent.
- Do not ever make edits directly to AISL spec files prior to plan draft without
  explicit instructions from the human developer to do so. The human developer
  should be the primary architect of the spec file in order to ensure they remain
  in the loop and do not rely on the coding agent to do their thinking for them.
- Don't fix multiple unrelated diagnostics in one pass without re-running the
  checker in between.
- If explicitly instructed by the human to make AISL spec file edits, don't add
  structure to the document (new types, enums, casts) beyond what's needed to
  resolve the diagnostic at hand — bigger syntax/structure changes go through
  the normal design discussion, not this loop.

## Lessons from use

### Warning triage is design discussion, not cleanup

Warnings that survive checker cleanup often reveal genuine language design
questions — e.g. a `String → CheckerResult` cast warning exposed the question
of whether `CheckerResult` was a new type or a stand-in for an existing
codebase type. Treat lingering warnings as prompts for design conversation, not
noise to suppress.

### `external type` for stand-in types, `@agent:` for stand-in values

When a spec references a type that already exists in the real codebase but
whose internal structure the author doesn't want to prescribe, use
`external type X from "path/to/real/file"` rather than `type X`. This
communicates intent ("this belongs to the implementation") and types the value
as `Unknown` — honest about what the spec doesn't commit to. Where a function
body needs to construct or return a value of such a type, use an `@agent:`
stub comment instead of a string-literal cast; the stub carries semantic intent
without manufacturing a value of a type the spec doesn't own.

### Inline cast in `match` subject enables exhaustiveness checking

When matching on a property of an opaque type against a known enum, cast the
subject inline: `match statement.type as MY_ENUM:`. This tells the checker
which enum to check exhaustiveness against and eliminates the "match subject
has type Unspecified" warning in a single, readable line.
