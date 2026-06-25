# Implementation Plan: Refactor External Symbols Syntax

**Spec source**: `specs/refactor_external/refactor_external.aisl`
**Status**: Implemented ✓

## Summary

Splits the single `external` keyword into two distinct keywords:
- `import` — for symbols from other `.aisl` files (full nominal typing via `resolveLocalExternals.ts`)
- `external` — for symbols from real-code/library targets (Unknown typing via `resolveExternals.ts`)

No behavioral changes. Purely syntactic. Each keyword is now validated against its target path, and mismatches are hard errors.

---

## Changes

### `src/lexer.ts`
- Added `"IMPORT"` to the `TokenType` union.
- Added `import: "IMPORT"` to the keyword-to-token map.

### `src/ast.ts`
- Added `keyword: "external" | "import"` field to `ExternalDecl`. Updated JSDoc to note that routing is now determined by `keyword`, not solely by path extension.

### `src/parser.ts`
- Added `"IMPORT"` to `PROPERTY_NAME_TOKENS`.
- Top-level dispatch: now triggers on both `EXTERNAL` and `IMPORT` tokens.
- `parseExternalDecl()`: consumes whichever token was present and sets `keyword` on the returned `ExternalDecl`.

### `src/resolveLocalExternals.ts`
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

### `src/resolveExternals.ts`
- No changes required. Receives only `external`-keyword non-`.aisl` entries from the pre-filtered `resolved.externals`.

### Tests
- `tests/resolveLocalExternals.test.ts`: All test source strings migrated from `external ... from "*.aisl"` to `import ... from "*.aisl"`. Assertion regexes updated to match new message text. Three new test cases added for keyword/path validation.
- `tests/fixtures/shared.aisl`, `reexport.aisl`, `broken2.aisl`: `.aisl`-targeting `external` declarations migrated to `import`.

### Spec file
- `specs/refactor_external/refactor_external.aisl`: Updated to reflect implemented state (the before-example `external function ... from "*.aisl"` is now a comment; the `import function ...` form is active).
