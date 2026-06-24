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
 * Points an AISL-facing name at a real symbol in an external file or library,
 * e.g. `external type Step = "src/models.ts" renamed ModelStep`. `path` is
 * either a relative/absolute file path (heuristically verifiable against the
 * real file) or a bare library specifier (never verified, see resolveExternals.ts).
 * `realName` defaults to `name` when no `renamed` clause is present.
 */
export interface ExternalDecl {
	kind: "ExternalDecl";
	symbolKind: ExternalSymbolKind;
	name: string;
	path: string;
	realName: string;
	line: number;
}

export interface Param {
	name: string;
	typeAnnotation?: TypeRef;
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
	line: number;
}

export type TopLevel = EnumDecl | TypeDecl | FunctionDecl | GlobalVarDecl | ExternalDecl;

export interface Program {
	kind: "Program";
	enums: EnumDecl[];
	types: TypeDecl[];
	globals: GlobalVarDecl[];
	functions: FunctionDecl[];
	externals: ExternalDecl[];
}

export type Stmt =
	| { kind: "VarDecl"; name: string; typeAnnotation?: TypeRef; init: Expr; line: number }
	| { kind: "ExprStmt"; expr: Expr; line: number }
	| { kind: "If"; cond: Expr; then: Stmt[]; else?: Stmt[]; line: number }
	| { kind: "Foreach"; varName: string; iterable: Expr; body: Stmt[]; line: number }
	| { kind: "DoWhile"; body: Stmt[]; cond: Expr; line: number }
	| { kind: "Match"; subject: Expr; cases: MatchCase[]; line: number }
	| { kind: "Return"; expr?: Expr; line: number }
	| { kind: "PromptComment"; text: string; line: number };

export interface MatchCase {
	label: string;
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
	| { kind: "Cast"; expr: Expr; typeAnnotation: TypeRef; line: number };
