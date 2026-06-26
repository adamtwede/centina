# Agent-Interpreted Specification Language

AISL is a domain specific language (DSL) designed specifically for use with agentic (LLM-assisted) coding, specifically for high-level planning and architecture. It is concerned more with the *what* rather than the *how*. In the fewest words I can manage, it's **type-checked  pseudocode**.

## It's what now?

Stick with me a minute. I promise it'll make sense. (I can't promise it'll make sense to *you*, but it does to me.)

Have you ever struggled to explain to your coding agent of choice what you want it to do with the masterful clarity you need? Have you shaken your head in dismay as you burn precious tokens going back and forth trying to articulate what you want it to do? No? Well, I have. Here is my story.

Recently, I wanted a moderately complex process implemented that included escalation paths, loops, recursion, etc. I started typing out my initial prompt and within a few minutes became frustrated that I couldn't explain clearly what I wanted without laborious, tedious back-references, ambiguous terms, and constant parentheticals even to *myself*. After a handful of false starts, I thought to myself, "There has to be a better way!" So, I went looking for one. 

I'm a latecomer to the agentic coding world. A holdout. A rebel turncoat. As such, I figured surely someone smarter than me (many people qualify) had already solved this very obvious problem. Naturally, I first asked some chat agents. They all gave me the same few unsatisfying answers ("Goodness! Nobody has thought of this! You're probably a genius!" shut up, baby, I know it). So I tried an actual search engine, looking for a way to approach my agent's "planning mode" with something more structured, something less haphazardly free-form than \*ugh\* *organic conversation* (I already get enough of this with my kids, you knoe?) but, to my surprise, found nothing I liked. There were some diagramming tools, some hot tips and tricks, and a whole bunch of agent skills that promised to take my confusing, meandering, resignedly self-conscious prose and turn it into an implementation plan good enough to make John Carmack weep with joy. Spoiler: No joy.

I gave up the search and decided that the best way forward was to simply try and sketch the idea out for myself. I thought if I could get a better handle on exactly what I was planning to ask for, maybe I could write a usable prompt to get things started. Almost without thinking, I started writing psuedocode. I know people are always bullying poor psuedocode, but it's actually pretty great. You can use familiar, structured programming conventions without being hobbled by the requirements of actually producing executable code (totally unreasonable in 2026). However, as I wrote and my pseudocode became more complex, making sure I was maintaining consistency in spelling, local conventions, proposed control flow, etc., started becoming really tedious.

After a handful of false starts, I thought to myself, "There has to be a better way!" So, I went looking for one. Just kidding. I already did that. I decided to just make one. The result of that is AISL.

## Example

This is a (somewhat truncated and edited for clarity) example of an actual AISL spec written to implement a small feature in this codebase.

```

```

## PLAN.md

The intended result of an AISL spec is a PLAN.md with more detail, less ambiguity, and an easier path toward revision. Here is the PLAN.md that resulted from the above spec:

---

### Implementation Plan: Refactor External Symbols Syntax

**Spec source**: `specs/refactor_external/refactor_external.aisl`

**Status**: Implemented ✓

### Summary

Splits the single `external` keyword into two distinct keywords:
- `import` — for symbols from other `.aisl` files (full nominal typing via `resolveLocalExternals.ts`)
- `external` — for symbols from real-code/library targets (Unknown typing via `resolveExternals.ts`)

No behavioral changes. Purely syntactic. Each keyword is now validated against its target path, and mismatches are hard errors.

---

### Changes

#### `src/lexer.ts`
- Added `"IMPORT"` to the `TokenType` union.
- Added `import: "IMPORT"` to the keyword-to-token map.

#### `src/ast.ts`
- Added `keyword: "external" | "import"` field to `ExternalDecl`. Updated JSDoc to note that routing is now determined by `keyword`, not solely by path extension.

#### `src/parser.ts`
- Added `"IMPORT"` to `PROPERTY_NAME_TOKENS`.
- Top-level dispatch: now triggers on both `EXTERNAL` and `IMPORT` tokens.
- `parseExternalDecl()`: consumes whichever token was present and sets `keyword` on the returned `ExternalDecl`.

#### `src/resolveLocalExternals.ts`
- Validates keyword/path consistency up front (before any resolution):
  - `external ... from "*.aisl"` → hard error: "must use the 'import' keyword"
  - `import ... from "non-aisl-path"` → hard error: "must use the 'external' keyword"
- Routing changed from path-extension-based to keyword-based:
  - `import` + `.aisl` path → existing AISL resolution logic (unchanged)
  - `external` + non-`.aisl` → passed through to `resolveExternals.ts` (unchanged)
  - Mismatched entries are excluded from both paths (already errored)
- Updated diagnostic messages that previously hardcoded `"external"`:
  - Kind-mismatch warning now uses `ext.keyword` (e.g. "declared as import 'function'")
  - Forwarding-chain error now uses `target.keyword` (e.g. "declared as 'import', pointing at...")
- Updated missing-dependency-type suggestion strings from `external type ...` to `import type ...` (these suggestions always point to `.aisl` files)

#### `src/resolveExternals.ts`
- No changes required. Receives only `external`-keyword non-`.aisl` entries from the pre-filtered `resolved.externals`.

#### Tests
- `tests/resolveLocalExternals.test.ts`: All test source strings migrated from `external ... from "*.aisl"` to `import ... from "*.aisl"`. Assertion regexes updated to match new message text. Three new test cases added for keyword/path validation.
- `tests/fixtures/shared.aisl`, `reexport.aisl`, `broken2.aisl`: `.aisl`-targeting `external` declarations migrated to `import`.

#### Spec file
- `specs/refactor_external/refactor_external.aisl`: Updated to reflect implemented state (the before-example `external function ... from "*.aisl"` is now a comment; the `import function ...` form is active).
---

## Enabling syntax highlighting (development phase)

1. In VS Code: File > Open Folder... (or Cmd+O)
2. Navigate to and select ./editors/vscode — open it as its own window (it'll ask "open in new window," say yes if prompted, or just let it replace if you don't mind closing the current one).
3. In that new window, press F5. It should now find the Run AISL Extension config and launch a separate "Extension Development Host" window — that's a sandboxed VS Code instance with your unpublished extension active.
4. In that Extension Development Host window, open any .aisl file (e.g. File > Open Folder... and pick the current project, then open a .aisl file) — it should now show syntax highlighting.

If F5 still shows a config picker instead of going straight to "Run AISL Extension," that just means VS Code found multiple/no matching configs — pick "Run AISL Extension" from the dropdown, or check the Run and Debug panel (Cmd+Shift+D) to confirm launch.json was picked up under that window.

# Documentation

## Property Access vs. Method Calls in AISL

AISL distinguishes between two ways of navigating an object with dot notation: bare property access (`obj.prop`) and method calls (`obj.method()`). Both are "ad hoc" — AISL doesn't require you to declare properties or methods on custom types ahead of using them — but they carry different type-level meaning, which the checker uses to guide you toward clear pseudocode.

**The distinction**

`obj.prop` — describes *reading* a data attribute.

When you write `obj.prop`, you're describing the act of reading a value that exists on the object — a field, a discriminant, an attribute whose type you haven't pinned down yet. The checker types it as `Unspecified`, the designed gradual-typing escape hatch: you can cast it to a concrete type (with a warning if the object is from an external source) and use it in match exhaustiveness checking.

```
type Statement

enum Kind = EXPR | DECL | RETURN

function classify(s: Statement) -> Kind:
    match s.kind as Kind:   # bare prop → Unspecified → castable → exhaustiveness works
        case EXPR:  return EXPR
        case DECL:  return DECL
        case RETURN: return RETURN
```

`obj.method()` — describes the execution of a computation (with an *unverifiable* result).

When you write `obj.method()`, you're describing a computation that produces a "new" value. The checker rigidly types the result as `Unprivileged` — a special mode of `Unspecified` that blocks casting and assignment into concrete slots. This exists to enforce AISL's core invariant: *AISL cannot be used to express the internal manufacturing of data, since it is not a real programming language; AISL is descriptive only.* Only function parameters, `Agent.prompt()`/`Agent.review()`, and external references may produce a concrete value. An undeclared method call with parentheses is explicitly not one of them.

`Unprivileged` values are still useful descriptively: you can chain off them, compare them for equality, use them as if conditions, and pass them where an unspecified value is expected. What you can't do is cast the result into a concrete type and treat it as real data your AISL spec document has "produced":

```
type Statement

function analyze(s: Statement):
    if s.is_valid():           # implied-bool: fine, describing a condition
        if s.kind() == s.other_kind():  # equality: fine, describing a comparison
            s.do_something()   # chained call: fine, descriptive
    # s.kind() as Kind        # ← error: can't manufacture a concrete Kind from an ad hoc call
```

**When to use which form**

Use bare property access (`obj.prop`) when you're describing a value that simply is there on the object — a type tag, a discriminant, a field whose content you want to refer to or match against. This is the right form when you want to cast the result to an enum and drive a match statement.

Use a method call (`obj.method()`) when you're describing an operation the object performs — a validation, a transformation, a predicate. These are useful for if conditions and equality checks, but their results should stay opaque (you aren't claiming to know what type the computation produces).

The quick test: if replacing `obj.method()` with a `Bool` literal (or `Unspecified`) would still capture your intent, it's a method call. If you need to treat the result as a specific type — match it against an `enum`, return it, assign it — reach for the bare property form and make the type relationship explicit via `as`.

**When you'll see helpful errors**

If you write `obj.method() as SomeType`, the checker tells you: "if 'method' describes a data attribute (not a computation), use bare property access — `obj.method` without the `()` — which types as `Unspecified` and is castable." Similarly, matching directly on a method-call result (`match obj.method():`) warns you that the `Unprivileged` result can't drive exhaustiveness checking and suggests match `obj.prop as EnumType:` as the alternative.

---

**The key takeaway**

Parentheses mean "I am describing a computation whose *result* is opaque (unverifiable)"; no parentheses mean "I am describing a data attribute *assumed* to be on hand that I'm willing to name a type for." Both forms are valid AISL — they just express different things about the relationship between the object and the semantic meaning of the descriptive value in question.