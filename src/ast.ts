export type TypeRef =
	| { kind: "named"; name: string; line: number }
	| { kind: "array"; element: TypeRef; line: number };

export interface EnumDecl {
	kind: "EnumDecl";
	name: string;
	members: string[];
	line: number;
}

export interface TypeDecl {
	kind: "TypeDecl";
	name: string;
	line: number;
}

export type ExternalSymbolKind = "type" | "function" | "object";

/**
 * Points an AISL-facing name at a real symbol in another file or library,
 * e.g. `external type Step from "src/models.ts"`, or with a renamed real
 * symbol: `external renamed type ModelStep from "src/models.ts" was Step`.
 * `path` is a relative/absolute file path or a bare library specifier.
 * `realName` defaults to `name` when no `renamed`/`was` clause is present.
 *
 * Resolution branches on `path`'s extension (see resolveLocalExternals.ts
 * and resolveExternals.ts): a `.aisl` target is parsed and checked directly,
 * so the symbol is treated exactly as though declared natively in this
 * document (full nominal typing, never `Unknown`). Anything else (real-code
 * files or bare library specifiers) is only heuristically verified and always
 * types as `Unknown`, since its real shape can't be parsed with confidence.
 */
export interface ExternalDecl {
	kind: "ExternalDecl";
	/** `"import"` for `.aisl`-targeting declarations; `"external"` for real-code/library targets. */
	keyword: "external" | "import";
	symbolKind: ExternalSymbolKind;
	name: string;
	path: string;
	realName: string;
	/**
	 * When true, the backing file is not required to exist. The symbol is treated as an Unknown stub —
	 * no file-existence check, no verification; useful for sketching dependency graphs before files are created.
	 */
	assumed?: boolean;
	line: number;
}

export interface Param {
	name: string;
	typeAnnotation?: TypeRef;
	line: number;
}

export type BoundaryRole = "datasource" | "datasink" | "boundary";

export interface DoorDecl {
	name: string;
	params: Param[];
	returnType?: TypeRef;
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

export interface FunctionDecl {
	kind: "FunctionDecl";
	name: string;
	params: Param[];
	returnType?: TypeRef;
	body: Stmt[];
	line: number;
}

export interface GlobalVarDecl {
	kind: "GlobalVarDecl";
	name: string;
	typeAnnotation?: TypeRef;
	init: Expr;
	/** Present when declared with `datasource name = ...` or `datasink name = ...` syntax. */
	role?: "datasource" | "datasink";
	line: number;
}

export type TopLevel = EnumDecl | TypeDecl | FunctionDecl | GlobalVarDecl | ExternalDecl | BoundaryDecl;

export interface Program {
	kind: "Program";
	enums: EnumDecl[];
	types: TypeDecl[];
	globals: GlobalVarDecl[];
	functions: FunctionDecl[];
	externals: ExternalDecl[];
	boundaries: BoundaryDecl[];
}

export type Stmt =
	| { kind: "VarDecl"; name: string; typeAnnotation?: TypeRef; init: Expr; line: number }
	| { kind: "ExprStmt"; expr: Expr; line: number }
	| { kind: "FieldAssign"; obj: Expr; field: string; value: Expr; line: number }
	| { kind: "If"; cond: Expr; then: Stmt[]; else?: Stmt[]; line: number }
	| { kind: "Foreach"; varName: string; iterable: Expr; body: Stmt[]; line: number }
	| { kind: "DoWhile"; body: Stmt[]; cond: Expr; line: number }
	| { kind: "Match"; subject: Expr; cases: MatchCase[]; line: number }
	| { kind: "Return"; expr?: Expr; line: number }
	| { kind: "AgentComment"; text: string; line: number };

export interface MatchCase {
	label: string;
	labelKind: "ident" | "string";
	wildcard: boolean;
	body: Stmt[];
	line: number;
}

export type TemplatePart =
	| { kind: "Text"; value: string }
	| { kind: "Expr"; expr: Expr };

export type Expr =
	| { kind: "Ident"; name: string; line: number }
	| { kind: "StringLit"; value: string; line: number }
	| { kind: "TemplateStr"; parts: TemplatePart[]; line: number }
	| { kind: "NumberLit"; value: number; line: number }
	| { kind: "BoolLit"; value: boolean; line: number }
	| { kind: "Binary"; op: "+" | "==" | "!=" | "&&" | "||"; left: Expr; right: Expr; line: number }
	| { kind: "Unary"; op: "!"; expr: Expr; line: number }
	| { kind: "Call"; callee: Expr; args: Expr[]; line: number }
	| { kind: "Member"; obj: Expr; prop: string; line: number }
	| { kind: "Cast"; expr: Expr; typeAnnotation: TypeRef; line: number }
	| { kind: "Is"; expr: Expr; typeName: string; negated: boolean; line: number };
