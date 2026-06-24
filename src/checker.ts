import {
  EnumDecl,
  Expr,
  ExternalDecl,
  FunctionDecl,
  Program,
  Stmt,
  TypeDecl,
  TypeRef,
} from "./ast.js";

export type Severity = "error" | "warning";

export interface Diagnostic {
  severity: Severity;
  message: string;
  line: number;
}

/** Internal type representation used during checking. Distinct from the surface-syntax TypeRef. */
type Ty =
  | { kind: "named"; name: string }
  | { kind: "array"; element: Ty }
  | { kind: "unspecified" }
  | { kind: "unknown" };

const UNSPECIFIED: Ty = { kind: "unspecified" };
/**
 * The type of any reference to an `external` symbol — deliberately distinct
 * from `Unspecified`. Both require an explicit cast before flowing into a
 * concrete slot, but `Unknown` additionally warns on that cast: the shape
 * being assumed has never been verified against the real symbol, so the risk
 * is "wrong cast," not just "missing cast." Member access on `Unknown` is NOT
 * flagged the way it is on `Unspecified` — an external symbol's members are
 * expected to be accessed freely (that's the whole point of referencing it),
 * the risk lives specifically in casting it into one of this document's own types.
 */
const UNKNOWN: Ty = { kind: "unknown" };
const BUILTIN_SCALARS = new Set(["String", "Bool", "Number"]);
const AGENT_TYPE = "Agent";
/** Methods on Agent that route text to a model and must always type as Unspecified. */
const AGENT_PROMPT_METHODS = new Set(["prompt", "review"]);
/** Free functions provided by the runtime rather than declared in the document itself. */
const BUILTIN_FUNCTIONS: Record<string, { params: Ty[]; returnType: Ty }> = {
  human_intervened: { params: [], returnType: { kind: "named", name: "Bool" } },
};

/** Plain Levenshtein edit distance, used to flag likely property-name typos. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** Max edit distance treated as a likely typo rather than a genuinely different name; too-short names are exempt. */
function maxTypoDistance(a: string, b: string): number {
  const minLen = Math.min(a.length, b.length);
  if (minLen <= 2) return 0;
  return minLen <= 4 ? 1 : 2;
}

function tyToString(t: Ty): string {
  if (t.kind === "unspecified") return "Unspecified";
  if (t.kind === "unknown") return "Unknown";
  if (t.kind === "array") return `${tyToString(t.element)}[]`;
  return t.name;
}

/**
 * Directional, not symmetric: an `Unspecified`/`Unknown` value (e.g. an
 * uncast Agent.prompt()/.review() result, a dynamic property access, or an
 * external symbol reference) is never automatically usable as a concrete
 * type — it must go through an explicit `as` cast first. A concrete value,
 * on the other hand, is always usable where `Unspecified`/`Unknown` is
 * expected, since that slot hasn't committed to (or can't verify) a type.
 */
function isAssignable(expected: Ty, actual: Ty): boolean {
  if (expected.kind === "unspecified" || expected.kind === "unknown") return true;
  if (actual.kind === "unspecified" || actual.kind === "unknown") return false;
  if (expected.kind === "array" && actual.kind === "array")
    return isAssignable(expected.element, actual.element);
  if (expected.kind === "named" && actual.kind === "named")
    return expected.name === actual.name;
  return false;
}

interface FunctionSig {
  name: string;
  params: { name: string; type: Ty }[];
  returnType: Ty;
  line: number;
}

class Scope {
  private vars = new Map<string, Ty>();
  constructor(private parent?: Scope) {}

  declare(name: string, type: Ty): void {
    this.vars.set(name, type);
  }

  /** Returns the declared type if `name` is already bound in this scope or an ancestor, else undefined. */
  lookup(name: string): Ty | undefined {
    if (this.vars.has(name)) return this.vars.get(name);
    return this.parent?.lookup(name);
  }

  child(): Scope {
    return new Scope(this);
  }
}

export function check(program: Program): Diagnostic[] {
  return new Checker(program).run();
}

class Checker {
  private diagnostics: Diagnostic[] = [];
  private enums = new Map<string, EnumDecl>();
  /** Maps an enum member name to the enum it belongs to, for `==` comparisons and match-case resolution. */
  private enumMemberOwner = new Map<string, string>();
  private types = new Map<string, TypeDecl>();
  private functions = new Map<string, FunctionSig>();
  private globalScope = new Scope();
  /** typeName -> propName -> every line it was accessed on, for cross-document typo detection. */
  private propertyUsage = new Map<string, Map<string, number[]>>();
  /** `external type` aliases — resolve to Unknown rather than a real shape. */
  private externalTypes = new Map<string, ExternalDecl>();
  /** `external function` aliases — callable, return Unknown, args unchecked (no param info is tracked). */
  private externalFunctions = new Map<string, ExternalDecl>();

  constructor(private program: Program) {}

  private error(message: string, line: number): void {
    this.diagnostics.push({ severity: "error", message, line });
  }

  private warn(message: string, line: number): void {
    this.diagnostics.push({ severity: "warning", message, line });
  }

  run(): Diagnostic[] {
    this.collectDecls();
    this.checkGlobals();
    for (const fn of this.program.functions) {
      this.checkFunction(fn);
    }
    this.checkPropertyTypos();
    return this.diagnostics;
  }

  // ---- declaration collection -------------------------------------------------

  private collectDecls(): void {
    for (const e of this.program.enums) {
      if (this.enums.has(e.name)) {
        this.error(`enum '${e.name}' is already declared`, e.line);
        continue;
      }
      this.enums.set(e.name, e);
      for (const member of e.members) {
        if (this.enumMemberOwner.has(member)) {
          this.error(
            `enum member '${member}' is already declared on enum '${this.enumMemberOwner.get(member)}'`,
            e.line,
          );
          continue;
        }
        this.enumMemberOwner.set(member, e.name);
      }
    }

    for (const t of this.program.types) {
      if (this.isKnownTypeName(t.name)) {
        this.error(`type '${t.name}' is already declared`, t.line);
        continue;
      }
      this.types.set(t.name, t);
    }

    for (const ext of this.program.externals) {
      const alreadyDeclared =
        ext.symbolKind === "type"
          ? this.isKnownTypeName(ext.name)
          : ext.symbolKind === "function"
            ? this.functions.has(ext.name) || this.externalFunctions.has(ext.name)
            : this.globalScope.lookup(ext.name) !== undefined;
      if (alreadyDeclared) {
        this.error(`'${ext.name}' is already declared`, ext.line);
        continue;
      }
      if (ext.symbolKind === "type") {
        this.externalTypes.set(ext.name, ext);
      } else if (ext.symbolKind === "function") {
        this.externalFunctions.set(ext.name, ext);
      } else {
        this.globalScope.declare(ext.name, UNKNOWN);
      }
    }

    for (const fn of this.program.functions) {
      if (this.functions.has(fn.name) || this.externalFunctions.has(fn.name)) {
        this.error(`function '${fn.name}' is already declared`, fn.line);
        continue;
      }
      const params = fn.params.map((p) => ({
        name: p.name,
        type: p.typeAnnotation
          ? this.resolveTypeRef(p.typeAnnotation)
          : UNSPECIFIED,
      }));
      const returnType = fn.returnType
        ? this.resolveTypeRef(fn.returnType)
        : UNSPECIFIED;
      this.functions.set(fn.name, {
        name: fn.name,
        params,
        returnType,
        line: fn.line,
      });
    }
  }

  private isKnownTypeName(name: string): boolean {
    return (
      this.enums.has(name) ||
      this.types.has(name) ||
      this.externalTypes.has(name) ||
      BUILTIN_SCALARS.has(name) ||
      name === AGENT_TYPE ||
      name === "Unspecified" ||
      name === "Unknown"
    );
  }

  /** Resolves a surface TypeRef to an internal Ty, reporting an error for unknown type names. */
  private resolveTypeRef(ref: TypeRef): Ty {
    if (ref.kind === "array") {
      return { kind: "array", element: this.resolveTypeRef(ref.element) };
    }
    if (ref.name === "Unspecified") return UNSPECIFIED;
    if (ref.name === "Unknown" || this.externalTypes.has(ref.name)) return UNKNOWN;
    if (!this.isKnownTypeName(ref.name)) {
      this.error(`unknown type '${ref.name}'`, ref.line);
    }
    return { kind: "named", name: ref.name };
  }

  // ---- globals ------------------------------------------------------------------

  private checkGlobals(): void {
    for (const g of this.program.globals) {
      const initTy = this.checkExpr(g.init, this.globalScope);
      const declaredTy = g.typeAnnotation
        ? this.resolveTypeRef(g.typeAnnotation)
        : initTy;
      this.checkNominalAssignable(declaredTy, initTy, g.line, g.name);
      this.globalScope.declare(g.name, declaredTy);
    }
  }

  // ---- functions ------------------------------------------------------------------

  private checkFunction(fn: FunctionDecl): void {
    const sig = this.functions.get(fn.name)!;
    const scope = this.globalScope.child();
    for (const p of sig.params) {
      scope.declare(p.name, p.type);
    }

    if (this.isPromptOnlyStub(fn.body)) {
      return;
    }

    for (const stmt of fn.body) {
      this.checkStmt(stmt, scope, sig);
    }
  }

  /** A function body consisting solely of `@prompt:` comments is an intentionally unimplemented stub. */
  private isPromptOnlyStub(body: Stmt[]): boolean {
    return body.length > 0 && body.every((s) => s.kind === "PromptComment");
  }

  // ---- statements ------------------------------------------------------------------

  private checkStmt(stmt: Stmt, scope: Scope, sig: FunctionSig): void {
    switch (stmt.kind) {
      case "VarDecl": {
        const initTy = this.checkExpr(stmt.init, scope);
        const declaredTy = stmt.typeAnnotation
          ? this.resolveTypeRef(stmt.typeAnnotation)
          : initTy;
        this.checkNominalAssignable(declaredTy, initTy, stmt.line, stmt.name);
        scope.declare(stmt.name, declaredTy);
        return;
      }
      case "ExprStmt":
        this.checkExpr(stmt.expr, scope);
        return;
      case "If": {
        this.checkExpr(stmt.cond, scope);
        const thenScope = scope.child();
        for (const s of stmt.then) this.checkStmt(s, thenScope, sig);
        if (stmt.else) {
          const elseScope = scope.child();
          for (const s of stmt.else) this.checkStmt(s, elseScope, sig);
        }
        return;
      }
      case "Foreach": {
        const iterableTy = this.checkExpr(stmt.iterable, scope);
        const elementTy: Ty =
          iterableTy.kind === "array" ? iterableTy.element : UNSPECIFIED;
        const bodyScope = scope.child();
        bodyScope.declare(stmt.varName, elementTy);
        for (const s of stmt.body) this.checkStmt(s, bodyScope, sig);
        return;
      }
      case "DoWhile": {
        const bodyScope = scope.child();
        for (const s of stmt.body) this.checkStmt(s, bodyScope, sig);
        this.checkExpr(stmt.cond, bodyScope);
        return;
      }
      case "Match": {
        this.checkMatch(stmt, scope, sig);
        return;
      }
      case "Return": {
        const actual = stmt.expr
          ? this.checkExpr(stmt.expr, scope)
          : UNSPECIFIED;
        this.checkNominalAssignable(
          sig.returnType,
          actual,
          stmt.line,
          `return value of '${sig.name}'`,
        );
        return;
      }
      case "PromptComment":
        return;
    }
  }

  private checkMatch(
    stmt: Extract<Stmt, { kind: "Match" }>,
    scope: Scope,
    sig: FunctionSig,
  ): void {
    const subjectTy = this.checkExpr(stmt.subject, scope);

    const seen = new Set<string>();
    for (const c of stmt.cases) {
      if (seen.has(c.label)) {
        this.error(`duplicate match case '${c.label}'`, c.line);
      }
      seen.add(c.label);

      const owner = this.enumMemberOwner.get(c.label);
      if (!owner) {
        this.error(`'${c.label}' is not a member of any declared enum`, c.line);
      } else if (subjectTy.kind === "named" && subjectTy.name !== owner) {
        this.error(
          `case '${c.label}' belongs to enum '${owner}', but match subject has type '${tyToString(subjectTy)}'`,
          c.line,
        );
      }

      const caseScope = scope.child();
      for (const s of c.body) this.checkStmt(s, caseScope, sig);
    }

    if (subjectTy.kind === "named" && this.enums.has(subjectTy.name)) {
      const enumDecl = this.enums.get(subjectTy.name)!;
      const missing = enumDecl.members.filter((m) => !seen.has(m));
      if (missing.length > 0) {
        this.error(
          `match over enum '${subjectTy.name}' is not exhaustive; missing case(s): ${missing.join(", ")}`,
          stmt.line,
        );
      }
    } else if (subjectTy.kind === "unspecified") {
      this.warn(
        `match subject has type 'Unspecified'; cast it to an enum type to enable exhaustiveness checking`,
        stmt.line,
      );
    }
  }

  // ---- expressions ------------------------------------------------------------------

  private checkExpr(expr: Expr, scope: Scope): Ty {
    switch (expr.kind) {
      case "Ident": {
        if (this.enumMemberOwner.has(expr.name)) {
          return { kind: "named", name: this.enumMemberOwner.get(expr.name)! };
        }
        const ty = scope.lookup(expr.name);
        if (ty === undefined) {
          if (this.functions.has(expr.name)) return UNSPECIFIED;
          if (this.externalFunctions.has(expr.name)) return UNKNOWN;
          this.error(`'${expr.name}' is not defined in this scope`, expr.line);
          return UNSPECIFIED;
        }
        return ty;
      }
      case "StringLit":
        return { kind: "named", name: "String" };
      case "TemplateStr": {
        for (const part of expr.parts) {
          if (part.kind === "Expr") this.checkExpr(part.expr, scope);
        }
        return { kind: "named", name: "String" };
      }
      case "NumberLit":
        return { kind: "named", name: "Number" };
      case "BoolLit":
        return { kind: "named", name: "Bool" };
      case "Unary": {
        this.checkExpr(expr.expr, scope);
        return { kind: "named", name: "Bool" };
      }
      case "Binary": {
        this.checkExpr(expr.left, scope);
        this.checkExpr(expr.right, scope);
        if (
          expr.op === "&&" ||
          expr.op === "||" ||
          expr.op === "==" ||
          expr.op === "!="
        ) {
          return { kind: "named", name: "Bool" };
        }
        return UNSPECIFIED;
      }
      case "Member":
        return this.checkMemberAccess(expr.obj, expr.prop, scope, expr.line);
      case "Cast": {
        const fromTy = this.checkExpr(expr.expr, scope);
        const toTy = this.resolveTypeRef(expr.typeAnnotation);
        if (fromTy.kind === "unknown" && toTy.kind === "named") {
          this.warn(
            `casting a value of external type 'Unknown' to '${tyToString(toTy)}' assumes a shape that hasn't been verified against the real symbol — confirm this is correct`,
            expr.line,
          );
        }
        return toTy;
      }
      case "Call":
        return this.checkCall(expr, scope);
    }
  }

  /**
   * Shared by plain `obj.prop` access and method-call callees (`obj.prop(...)`).
   * Property access always types as Unspecified by design (properties are
   * fully dynamic, see `recordPropertyUsage`) — but accessing a property on a
   * value whose own type is Unspecified is different: that's an unproven
   * assumption about a value nothing has committed to a shape for yet, so it's
   * flagged unless the access is itself chained off another property access
   * (which is already-accepted dynamic-property territory, not re-flagged).
   */
  private checkMemberAccess(obj: Expr, prop: string, scope: Scope, line: number): Ty {
    const objTy = this.checkExpr(obj, scope);
    if (objTy.kind === "unspecified") {
      if (obj.kind !== "Member") {
        this.warn(
          `property '.${prop}' accessed on a value of type 'Unspecified'; cast it to a concrete type first to resolve what '${prop}' refers to`,
          line,
        );
      }
    } else if (objTy.kind === "named") {
      this.recordPropertyUsage(objTy.name, prop, line);
    }
    return objTy;
  }

  private recordPropertyUsage(typeName: string, prop: string, line: number): void {
    let props = this.propertyUsage.get(typeName);
    if (!props) {
      props = new Map();
      this.propertyUsage.set(typeName, props);
    }
    let lines = props.get(prop);
    if (!lines) {
      lines = [];
      props.set(prop, lines);
    }
    lines.push(line);
  }

  /**
   * Cross-document heuristic: for each type, the most commonly used spelling
   * of a property is treated as canonical; any other spelling close enough
   * (by edit distance) to a strictly more common one is flagged as a likely
   * typo. Spellings used equally often are left alone — there's no way to
   * tell which one is "right," so that's a genuine naming inconsistency for
   * a human to resolve, not a typo to silently prefer one side of.
   */
  private checkPropertyTypos(): void {
    for (const [typeName, props] of this.propertyUsage) {
      const entries = [...props.entries()];
      if (entries.length < 2) continue;

      for (const [propName, lines] of entries) {
        let best: { name: string; count: number; dist: number } | undefined;
        for (const [otherName, otherLines] of entries) {
          if (propName === otherName) continue;
          if (otherLines.length <= lines.length) continue;
          const dist = levenshtein(propName, otherName);
          if (dist === 0 || dist > maxTypoDistance(propName, otherName)) continue;
          if (!best || dist < best.dist) {
            best = { name: otherName, count: otherLines.length, dist };
          }
        }
        if (best) {
          for (const line of lines) {
            this.warn(
              `property '.${propName}' on type '${typeName}' is close to '.${best.name}' (used ${best.count}x elsewhere) — possible typo?`,
              line,
            );
          }
        }
      }
    }
  }

  private checkCall(expr: Extract<Expr, { kind: "Call" }>, scope: Scope): Ty {
    if (expr.callee.kind === "Member") {
      const objTy = this.checkMemberAccess(expr.callee.obj, expr.callee.prop, scope, expr.callee.line);
      for (const a of expr.args) this.checkExpr(a, scope);
      if (
        objTy.kind === "named" &&
        objTy.name === AGENT_TYPE &&
        AGENT_PROMPT_METHODS.has(expr.callee.prop)
      ) {
        return UNSPECIFIED;
      }
      // A method call chained off an external (Unknown) object stays Unknown,
      // so the "unverified shape" risk survives the chain instead of quietly
      // downgrading to the less-suspicious Unspecified.
      return objTy.kind === "unknown" ? UNKNOWN : UNSPECIFIED;
    }

    if (expr.callee.kind === "Ident" && expr.callee.name === AGENT_TYPE) {
      for (const a of expr.args) this.checkExpr(a, scope);
      if (expr.args.length !== 1) {
        this.error(
          `'Agent(...)' expects exactly one ModelId argument`,
          expr.line,
        );
      }
      return { kind: "named", name: AGENT_TYPE };
    }

    if (expr.callee.kind === "Ident" && this.externalFunctions.has(expr.callee.name)) {
      for (const a of expr.args) this.checkExpr(a, scope);
      return UNKNOWN;
    }

    if (expr.callee.kind === "Ident" && BUILTIN_FUNCTIONS[expr.callee.name]) {
      const builtin = BUILTIN_FUNCTIONS[expr.callee.name];
      for (const a of expr.args) this.checkExpr(a, scope);
      if (expr.args.length !== builtin.params.length) {
        this.error(
          `function '${expr.callee.name}' expects ${builtin.params.length} argument(s), got ${expr.args.length}`,
          expr.line,
        );
      }
      return builtin.returnType;
    }

    if (expr.callee.kind === "Ident") {
      const sig = this.functions.get(expr.callee.name);
      if (!sig) {
        this.error(
          `'${expr.callee.name}' is not a defined function`,
          expr.line,
        );
        for (const a of expr.args) this.checkExpr(a, scope);
        return UNSPECIFIED;
      }
      if (expr.args.length !== sig.params.length) {
        this.error(
          `function '${sig.name}' expects ${sig.params.length} argument(s), got ${expr.args.length}`,
          expr.line,
        );
      }
      const n = Math.min(expr.args.length, sig.params.length);
      for (let i = 0; i < n; i++) {
        const argTy = this.checkExpr(expr.args[i], scope);
        this.checkNominalAssignable(
          sig.params[i].type,
          argTy,
          expr.args[i].line,
          sig.params[i].name,
        );
      }
      for (let i = n; i < expr.args.length; i++)
        this.checkExpr(expr.args[i], scope);
      return sig.returnType;
    }

    this.checkExpr(expr.callee, scope);
    for (const a of expr.args) this.checkExpr(a, scope);
    return UNSPECIFIED;
  }

  /** Nominal compatibility check: Unspecified is compatible with anything (it's the gradual-typing escape hatch); otherwise type names/array shapes must match exactly. */
  private checkNominalAssignable(
    expected: Ty,
    actual: Ty,
    line: number,
    context: string,
  ): void {
    if (isAssignable(expected, actual)) return;
    this.error(
      `type mismatch for ${context}: expected '${tyToString(expected)}', got '${tyToString(actual)}'`,
      line,
    );
  }
}
