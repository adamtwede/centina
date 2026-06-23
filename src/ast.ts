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

export type TopLevel = EnumDecl | TypeDecl | FunctionDecl | GlobalVarDecl;

export interface Program {
	kind: "Program";
	enums: EnumDecl[];
	types: TypeDecl[];
	globals: GlobalVarDecl[];
	functions: FunctionDecl[];
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
