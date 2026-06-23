---
name: aisl-iterate
description: Drives the interactive AISL spec-refinement loop. Runs the AISL checker (src/cli.ts) against a .aisl file, walks the human through each diagnostic, distinguishes mechanical fixes from genuine design ambiguities, applies agreed fixes, and re-checks until clean. Use when the user wants to iterate on, check, fix, or resolve errors in an .aisl file, or references AISL checker/linter/type-checker output.
---

# AISL Iterate

This is the primary way a human refines an AISL document: resolve checker
errors, surface ambiguities the pseudocode left implicit, settle them with the
human, repeat until the document is clean and the human is satisfied. The goal
of each loop iteration is not just a passing checker run — it's a more
precisely specified `.aisl` document that's closer to a real implementation
plan.

## Process

1. **Run the checker** against the target file:
   ```
   npx tsx src/cli.ts <file.aisl>
   ```
   If no file is specified and there's only one `.aisl` file in the project, use
   that. If there are several, ask which one.

2. **If there are zero diagnostics**, say so plainly and ask whether the human
   wants to keep refining (e.g. tighten a type that's currently `Unspecified`,
   flesh out a `@prompt:` stub) or stop here.

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
     *intent* isn't actually settled (e.g. a type mismatch that traces back to
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

## What NOT to do

- Don't silently resolve a genuine ambiguity just to make the checker pass.
  The checker is a tool for *finding* underspecified intent, not a target to
  satisfy by any available typing trick (e.g. don't just change a param's type
  to `Unspecified` to make a mismatch disappear unless that's actually what
  the human decides).
- Don't fix multiple unrelated diagnostics in one pass without re-running the
  checker in between.
- Don't add structure to the document (new types, enums, casts) beyond what's
  needed to resolve the diagnostic at hand — bigger syntax/structure changes go
  through the normal design discussion, not this loop.
