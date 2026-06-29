# Implementation Plan: Add Boundary Primitives

**Spec source**: specs/add_boundary_primitives/add_boundary_primitives.aisl  
**Design source**: docs/boundaries.md  
**Status**: Not yet implemented

---

## Overview

Add three new top-level declaration keywords — `datasource`, `datasink`, and `boundary` — to the AISL lexer, parser, AST, and checker. Boundary kinds declare a named, closed interface of "door" methods with a directional role. Instances are constructed from a boundary kind and declared as globals. Door calls on an instance type as the door's declared return type (a privileged read), and undeclared method calls on a boundary instance are a hard error (not `Unprivileged`).

---

## Files that change

### 1. `src/lexer.ts`

Add three new token types for the new keywords:

- Add `"DATASOURCE" | "DATASINK" | "BOUNDARY"` to the `TokenType` union (line 1–8 area).
- Add corresponding entries to the `KEYWORDS` record (line 26–44 area):
  ```
  datasource: "DATASOURCE",
  datasink: "DATASINK",
  boundary: "BOUNDARY",
  ```

### 2. `src/ast.ts`

Add a `BoundaryDecl` node and supporting types:

```typescript
export type BoundaryRole = "datasource" | "datasink" | "boundary";

export interface DoorDecl {
  name: string;
  params: Param[];
  returnType?: TypeRef;  // absent = void door
  line: number;
}

export interface BoundaryDecl {
  kind: "BoundaryDecl";
  role: BoundaryRole;
  name: string;
  constructorParams: Param[];
  doors: DoorDecl[];
  line: number;
}
```

Add `BoundaryDecl` to the `TopLevel` union:
```typescript
export type TopLevel = EnumDecl | TypeDecl | FunctionDecl | GlobalVarDecl | ExternalDecl | BoundaryDecl;
```

Add `boundaries: BoundaryDecl[]` to the `Program` interface.

### 3. `src/parser.ts`

**In `parseProgram()`**: add three new branches before the `IDENT` branch (global var fallthrough):
```typescript
} else if (this.check("DATASOURCE") || this.check("DATASINK") || this.check("BOUNDARY")) {
  program.boundaries.push(this.parseBoundaryDecl());
}
```

**Add `parseBoundaryDecl()` method**: consumes the role keyword, then IDENT (kind name), then LPAREN / params / RPAREN, then COLON / NEWLINE / INDENT. Each indented line is a door: IDENT LPAREN params RPAREN [ARROW typeRef] NEWLINE. Ends at DEDENT.

```
datasource GoogleSearch(url: String):
    search(term: String) -> SearchResult[]
```

Door params use the existing `parseParam()`. Return type uses the existing `parseTypeRef()` after `ARROW`; absent = void.

**Initialize `program.boundaries = []`** in `parseProgram()`.

### 4. `src/checker.ts`

#### New internal data structure

Add a `boundaries` map in the `Checker` class to hold resolved boundary kinds:

```typescript
interface DoorSig {
  params: { name: string; type: Ty }[];
  returnType: Ty;   // UNSPECIFIED when no annotation; internal sentinel for void?
  isVoid: boolean;  // true when no return type annotation
}

interface BoundarySig {
  name: string;
  role: BoundaryRole;
  constructorParams: { name: string; type: Ty }[];
  doors: Map<string, DoorSig>;
  line: number;
}
```

Add `private boundaries = new Map<string, BoundarySig>();` to the checker.

#### `collectDecls()`

Iterate `program.boundaries`; resolve constructor params and door signatures; add to `this.boundaries`. Name collision check: error if name already declared as type, enum, or boundary.

Add `BoundaryDecl` names to `BUILTIN_TYPE_NAMES` check (boundary names cannot shadow built-ins).

#### `checkGlobals()`

When a global's init is a `Call` whose callee is an `Ident` matching a boundary kind name, type the global as `{ kind: "named", name: kindName }` (the kind name) — same mechanism as `Agent(...)`. Check that constructor args match the kind's `constructorParams` in count (loose — arity check only, consistent with how the rest of the checker handles params). Do not flag boundary constructor calls as `Unprivileged`.

#### `checkCall()` — boundary constructor dispatch

Add a branch analogous to the `Agent` constructor branch:
```typescript
if (expr.callee.kind === "Ident" && this.boundaries.has(expr.callee.name)) {
  for (const a of expr.args) this.checkExpr(a, scope);
  const sig = this.boundaries.get(expr.callee.name)!;
  if (expr.args.length !== sig.constructorParams.length) {
    this.error(`'${sig.name}(...)' expects ${sig.constructorParams.length} argument(s), got ${expr.args.length}`, expr.line);
  }
  return { kind: "named", name: sig.name };
}
```

#### `checkCall()` — door method dispatch

When the callee is a `Member` and `objTy` is a `named` type that resolves to a known boundary kind:

1. Look up the door by name in `sig.doors`.
2. If the door exists:
   - Check arg count against `door.params.length`.
   - Return `door.returnType` if the door has a return type annotation, else return the sentinel for void (see below). A void door call result should not be bindable — if it appears as the RHS of a `VarDecl`, emit an error ("door '...' returns nothing; its result cannot be bound to a variable").
3. If the door does **not** exist: emit a hard **error** (not a warning):
   ```
   error: 'fetch_all' is not a declared door of 'GoogleSearch'; only declared doors may be called on a boundary instance
   ```
   Return `UNSPECIFIED` to let checking continue.

**Void return sentinel**: use `UNSPECIFIED` as the internal return type for void doors (doors with no `->` annotation), but track `isVoid` on the sig and emit an error if a void door call is bound in a `VarDecl`. Alternatively, add `{ kind: "void" }` to the `Ty` union — but given the rest of the checker is simpler without it, prefer the `isVoid` flag approach.

#### Direction enforcement

After collecting `BoundarySig` entries in `collectDecls()`, validate each door against its kind's role:

- **`datasource`**: every door must have a return type annotation (non-void). If a door is void, emit a **warning**:
  ```
  warning: door 'write' on datasource 'LogFile' returns nothing — datasources are read-only; did you mean 'boundary'?
  ```
- **`datasink`**: every door must be void (no return annotation). If a door has a return type, emit a **warning**:
  ```
  warning: door 'search' on datasink 'LogFile' returns a value — datasinks are write-only; did you mean 'boundary'?
  ```
- **`boundary`**: any mix is allowed; no direction diagnostics.

Warnings, not errors, to match the design doc ("warns/errors" — and since the spec function itself only emits errors, the softer signal is appropriate for the direction check).

#### Privileged source status

Door read results (non-void doors on `datasource` or `boundary`) are a privileged source — exactly like `Agent.prompt()`. The checker already treats `Unspecified` as castable and concrete named types as directly usable. Since door return types are annotated concrete types, they flow nominally into typed bindings with no cast required — this is automatic once the door call returns a `named` Ty.

#### `checkMemberAccess()` — property access on boundary instances

When `objTy` is a named type resolving to a boundary kind, property access (non-call) should still warn on unknown properties — existing `recordPropertyUsage` is fine here. No new special-casing needed.

#### `isKnownTypeName()` helper (if it exists)

If the checker has a helper that checks whether a name is a known type, include `this.boundaries.has(name)` in its check.

### 5. `src/symbols.ts`

Add boundary kinds to the `SymbolTable` so the VSCode extension and external tooling can see them:

```typescript
export interface DoorEntry {
  params: ParamEntry[];
  returnType: string | null;  // null = void
}

export interface BoundaryEntry {
  role: "datasource" | "datasink" | "boundary";
  constructorParams: ParamEntry[];
  doors: Record<string, DoorEntry>;
}
```

Add `boundaries: Record<string, BoundaryEntry>` to `SymbolTable`.

In `buildSymbolTable()`, iterate `program.boundaries` and populate `boundaries`.

### 6. `tests/prototype.test.ts` and regression fixture

`prototype.aisl` should not need changes — it predates boundaries and doesn't use the new keywords. The test that enforces zero diagnostics on it (`tests/prototype.test.ts`) should continue to pass without modification.

Add a new test file `tests/boundary.test.ts` that covers:
- A clean `datasource` / `datasink` / `boundary` declaration (no diagnostics).
- A void door on a `datasource` → warning.
- A returning door on a `datasink` → warning.
- An undeclared door call on a boundary instance → error.
- A void door call result bound in a `VarDecl` → error.
- A door call result flowing into a typed binding without a cast → no diagnostic (privileged source).
- Constructor arity mismatch → error.

---

## Cascade effects across the pipeline

- `resolveLocalExternals.ts` parses and type-checks `.aisl` target files. It currently copies `enums`, `types`, `functions`, and `globals` from the target program into the importer. Add `boundaries` to this splice so a boundary kind declared in one `.aisl` file can be imported via `external`.
- `resolveExternals.ts` does not need changes (it handles non-`.aisl` targets only, and boundary kinds in real code are `Unknown` like everything else).
- The CLI (`src/cli.ts`) prints diagnostics from `check()` — no changes needed if the checker emits errors/warnings via the existing `Diagnostic` shape.

---

## Completion criteria

All of the following should pass after implementation:

```bash
npm run typecheck           # no TypeScript errors
npm test                    # all tests pass, including new boundary.test.ts
npm run check prototype.aisl  # still zero diagnostics
```

Observable behaviors:
- `datasource Foo(x: String): bar() -> String` parses and checks without diagnostics.
- `foo = Foo("val"); result = foo.bar()` binds `result` as `String` with no cast required.
- `foo.undeclared()` emits an error naming the undeclared door.
- A void door call `foo.log()` on a `datasource Foo` emits a direction warning.
- `x = foo.log()` where `log` is a void door emits an error about binding a void result.
