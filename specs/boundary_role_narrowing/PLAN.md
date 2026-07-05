# Implementation Plan: Boundary Role Narrowing

**Status**: Not yet implemented

---

## Overview

Allow a `boundary` kind to be instantiated with an explicit role annotation (`datasource` or `datasink`) at the declaration site. The role narrows which doors are callable on that instance, subject to the same direction-enforcement rules that apply to standalone `datasource`/`datasink` kind declarations.

```aisl
boundary Container(widgetType: WidgetType):
    add_widget(widget: Widget)
    get_widgets() -> Widget[]
    remove_widget() -> Widget

datasource containerX = Container("WidgetX" as WidgetType)   # read side
datasink   containerY = Container("WidgetY" as WidgetType)   # write side
```

`containerX` is typed as `Container` but restricted: calling a void door (`add_widget`) on it is a hard error. `containerY` is similarly restricted: calling a returning door (`get_widgets`, `remove_widget`) on it is a hard error.

### Constraints

- Only `datasource` and `datasink` are valid narrowing annotations. `boundary` on a global is not valid syntax for a narrowed instantiation (it's always a kind declaration when seen at top level followed by IDENT LPAREN).
- The RHS kind **must** be declared as `boundary`. Applying a narrowing annotation to a `datasource` or `datasink` kind is an error ("role annotation 'datasource' requires the right-hand side to be a 'boundary' kind; 'ContainerX' is a 'datasource'").
- Door visibility: the narrowed role does **not** hide the other doors from the type — it errors at the call site when a door violating the narrowed role is called. The instance's type is still `Container`; the enforcement is behavioral, not structural.

---

## Files that change

### 1. `src/ast.ts`

Add an optional `role` field to `GlobalVarDecl`:

```typescript
export interface GlobalVarDecl {
  kind: "GlobalVarDecl";
  name: string;
  typeAnnotation?: TypeRef;
  init: Expr;
  role?: "datasource" | "datasink";   // ← new
  line: number;
}
```

### 2. `src/parser.ts`

**In `parseProgram()`**: change the DATASOURCE/DATASINK branch to distinguish a kind declaration from a narrowed global using a two-token lookahead:

```typescript
} else if (this.check("DATASOURCE") || this.check("DATASINK") || this.check("BOUNDARY")) {
  // peek(1) skips trivia — but tokens[pos+1] is the IDENT, tokens[pos+2] is the
  // disambiguating token. For a kind declaration it's LPAREN; for a narrowed global
  // it's COLON (type annotation) or EQUALS (no annotation).
  const isNarrowedGlobal =
    (this.check("DATASOURCE") || this.check("DATASINK")) &&
    (this.peek(2).type === "EQUALS" || this.peek(2).type === "COLON");
  if (isNarrowedGlobal) {
    program.globals.push(this.parseNarrowedGlobalVarDecl());
  } else {
    program.boundaries.push(this.parseBoundaryDecl());
  }
```

**Add `parseNarrowedGlobalVarDecl()`**: consumes the role keyword, then delegates to the body of `parseGlobalVarDecl()` with the role attached.

```typescript
private parseNarrowedGlobalVarDecl(): GlobalVarDecl {
  const roleTok = this.advance();   // DATASOURCE or DATASINK
  const role = roleTok.type === "DATASOURCE" ? "datasource" : "datasink";
  const nameTok = this.expect("IDENT", "for global variable name after role annotation");
  let typeAnnotation: TypeRef | undefined;
  if (this.match("COLON")) {
    typeAnnotation = this.parseTypeRef();
  }
  this.expect("EQUALS", "in role-narrowed global variable declaration");
  const init = this.parseExpr();
  this.expect("NEWLINE", "after role-narrowed global variable declaration");
  return { kind: "GlobalVarDecl", name: nameTok.value, typeAnnotation, init, role, line: nameTok.line };
}
```

Note: `parseGlobalVarDecl()` is unchanged; narrowed globals go through the new method.

### 3. `src/checker.ts`

#### New field

```typescript
private narrowedRoles = new Map<string, "datasource" | "datasink">();
```

Maps global variable names to their narrowed role. Populated during global checking.

#### `checkGlobals()`

When a global has `g.role` set:

1. Resolve the init expression. If the init is a `Call` whose callee is an `Ident` naming a known boundary kind, proceed; otherwise emit an error and skip role registration.
2. Verify the kind's `role` is `"boundary"`. If not, error:
   ```
   error: role annotation 'datasource' requires a 'boundary' kind on the right-hand side; 'ContainerX' is declared as 'datasource'
   ```
3. Register `this.narrowedRoles.set(g.name, g.role)`.

#### `checkCall()` — door dispatch

After looking up `door` in `bsig.doors` and confirming it exists, check whether the calling instance has a narrowed role:

```typescript
// Determine effective role: narrowed role overrides the kind's declared role.
let effectiveRole = bsig.role;
if (expr.callee.kind === "Member" && expr.callee.obj.kind === "Ident") {
  const narrowed = this.narrowedRoles.get(expr.callee.obj.name);
  if (narrowed) effectiveRole = narrowed;
}

if (effectiveRole === "datasource" && door.isVoid) {
  this.error(
    `door '${door.name}' returns nothing — cannot call a void door on a 'datasource'-narrowed instance of '${bsig.name}'; datasources are read-only`,
    expr.line
  );
}
if (effectiveRole === "datasink" && !door.isVoid) {
  this.error(
    `door '${door.name}' returns a value — cannot call a returning door on a 'datasink'-narrowed instance of '${bsig.name}'; datasinks are write-only`,
    expr.line
  );
}
```

This piggybacks on the existing door lookup; no restructuring needed.

### 4. `src/symbols.ts`

Add `role?: "datasource" | "datasink"` to the global's symbol entry (the `GlobalEntry` interface or equivalent), populated when `g.role` is set. This surfaces the narrowing information to tooling.

### 5. `tests/boundary.test.ts`

New test cases to add:

- `datasource x = Boundary(...)` — clean declaration, no diagnostics.
- `datasink y = Boundary(...)` — clean declaration, no diagnostics.
- `datasource x = Boundary(...); x.voidDoor()` — error (void door on datasource-narrowed instance).
- `datasink y = Boundary(...); y.returningDoor()` — error (returning door on datasink-narrowed instance).
- `datasource x = Boundary(...); x.returningDoor()` — no error (returning doors are fine on datasource).
- `datasink y = Boundary(...); y.voidDoor()` — no error (void doors are fine on datasink).
- `datasource x = SomeDatasource(...)` — error (narrowing annotation requires boundary kind on RHS).
- `datasink y = SomeDatasink(...)` — error (narrowing annotation requires boundary kind on RHS).

---

## Cascade effects

- `resolveLocalExternals.ts`: no changes needed. The narrowing role is on the `GlobalVarDecl`, which is already spliced across files. The checker in the importing file will read `g.role` from the injected node and populate `narrowedRoles` for the imported global.
- `resolveExternals.ts`: no changes needed.
- `src/cli.ts`: no changes needed.

---

## Completion criteria

```bash
npm run typecheck   # no TypeScript errors
npm test            # all tests pass including new narrowing cases
npm run check prototype.aisl  # still zero diagnostics
```

Observable behaviors:
- `datasource x = Container("v" as T)` parses and checks with no diagnostics when `Container` is a `boundary`.
- `x.add_widget(w)` on a datasource-narrowed `x` is a hard error.
- `y.get_widgets()` on a datasink-narrowed `y` is a hard error.
- `datasource x = SomeDatasource(...)` where `SomeDatasource` is declared as `datasource` is a hard error.
