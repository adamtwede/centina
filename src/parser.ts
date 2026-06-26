import { Token, TokenType, tokenize } from "./lexer.js";

// Token types that are valid as object property names after '.'.
// All keywords are allowed in property position — only punctuation and
// structural tokens are excluded.
const PROPERTY_NAME_TOKENS = new Set<TokenType>([
	"IDENT",
	"ENUM", "TYPE", "FUNCTION", "RETURN", "IF", "ELIF", "ELSE", "MATCH", "CASE",
	"FOREACH", "IN", "DO", "WHILE", "AS", "TRUE", "FALSE",
	"EXTERNAL", "IMPORT", "ASSUMED", "OBJECT", "RENAMED", "FROM", "WAS",
]);
import {
	EnumDecl,
	Expr,
	ExternalDecl,
	ExternalSymbolKind,
	FunctionDecl,
	GlobalVarDecl,
	MatchCase,
	Param,
	Program,
	Stmt,
	TemplatePart,
	TypeDecl,
	TypeRef,
} from "./ast.js";

export class ParseError extends Error {
	constructor(message: string, public line: number) {
		super(`${message} (line ${line})`);
	}
}

export function parse(tokens: Token[]): Program {
	return new Parser(tokens).parseProgram();
}

class Parser {
	private pos = 0;

	constructor(private tokens: Token[]) {}

	private peek(offset = 0): Token {
		return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
	}

	private advance(): Token {
		const t = this.tokens[this.pos];
		if (this.pos < this.tokens.length - 1) this.pos++;
		return t;
	}

	private check(type: TokenType): boolean {
		return this.peek().type === type;
	}

	private match(type: TokenType): Token | undefined {
		if (this.check(type)) return this.advance();
		return undefined;
	}

	private expect(type: TokenType, context: string): Token {
		if (!this.check(type)) {
			const t = this.peek();
			throw new ParseError(`expected ${type} ${context}, got ${t.type} '${t.value}'`, t.line);
		}
		return this.advance();
	}

	// Like expect("IDENT", ...) but also accepts keyword tokens in property
	// position — e.g. obj.type, obj.function are valid in AISL.
	private expectIdentOrKeyword(context: string): Token {
		const t = this.peek();
		if (PROPERTY_NAME_TOKENS.has(t.type)) return this.advance();
		throw new ParseError(
			`expected IDENT ${context}, got ${t.type} '${t.value}'`,
			t.line,
		);
	}

	/** Skips blank NEWLINE-only lines and non-prompt comment lines between declarations/statements. */
	private skipTrivia(): void {
		for (;;) {
			if (this.check("NEWLINE")) {
				this.advance();
				continue;
			}
			if (this.check("COMMENT") && !this.peek().isPrompt) {
				this.advance();
				continue;
			}
			break;
		}
	}

	parseProgram(): Program {
		const program: Program = { kind: "Program", enums: [], types: [], globals: [], functions: [], externals: [] };
		this.skipTrivia();
		while (!this.check("EOF")) {
			if (this.check("ENUM")) {
				program.enums.push(this.parseEnumDecl());
			} else if (this.check("TYPE")) {
				program.types.push(this.parseTypeDecl());
			} else if (this.check("FUNCTION")) {
				program.functions.push(this.parseFunctionDecl());
			} else if (this.check("EXTERNAL") || this.check("IMPORT") || this.check("ASSUMED")) {
				program.externals.push(this.parseExternalDecl());
			} else if (this.check("IDENT")) {
				program.globals.push(this.parseGlobalVarDecl());
			} else {
				const t = this.peek();
				throw new ParseError(`unexpected token '${t.value}' at top level`, t.line);
			}
			this.skipTrivia();
		}
		return program;
	}

	private parseEnumDecl(): EnumDecl {
		const start = this.expect("ENUM", "to start enum declaration");
		const name = this.expect("IDENT", "for enum name").value;
		this.expect("EQUALS", "after enum name");
		const members = [this.expect("IDENT", "as enum member").value];
		while (this.match("PIPE")) {
			members.push(this.expect("IDENT", "as enum member").value);
		}
		this.expect("NEWLINE", "after enum declaration");
		return { kind: "EnumDecl", name, members, line: start.line };
	}

	private parseTypeDecl(): TypeDecl {
		const start = this.expect("TYPE", "to start type declaration");
		const name = this.expect("IDENT", "for type name").value;
		this.expect("NEWLINE", "after type declaration");
		return { kind: "TypeDecl", name, line: start.line };
	}

	private parseExternalDecl(): ExternalDecl {
		const startTok = this.peek();
		const assumed = !!this.match("ASSUMED");

		let keyword: "import" | "external";
		if (this.check("IMPORT")) {
			this.advance();
			keyword = "import";
		} else {
			this.expect("EXTERNAL", `to start ${assumed ? "assumed " : ""}external declaration`);
			keyword = "external";
		}

		const isRenamed = !!this.match("RENAMED");

		let symbolKind: ExternalSymbolKind;
		if (this.match("TYPE")) symbolKind = "type";
		else if (this.match("FUNCTION")) symbolKind = "function";
		else if (this.match("OBJECT")) symbolKind = "object";
		else {
			const t = this.peek();
			throw new ParseError(
				`expected 'type', 'function', or 'object' after '${assumed ? "assumed " : ""}${keyword}'${isRenamed ? " renamed" : ""}, got ${t.type} '${t.value}'`,
				t.line,
			);
		}

		const name = this.expect("IDENT", "for external symbol name").value;
		this.expect("FROM", "after external symbol name");
		const path = this.expect("STRING", "for external symbol's source path").value;

		let realName = name;
		if (isRenamed) {
			this.expect("WAS", "after external symbol path in a 'renamed' declaration");
			realName = this.expect("IDENT", "for the real (pre-rename) external symbol name").value;
		}

		this.expect("NEWLINE", "after external declaration");
		return { kind: "ExternalDecl", keyword, symbolKind, name, path, realName, assumed: assumed || undefined, line: startTok.line };
	}

	private parseTypeRef(): TypeRef {
		const start = this.expect("IDENT", "for type name");
		let ref: TypeRef = { kind: "named", name: start.value, line: start.line };
		while (this.check("LBRACKET")) {
			this.advance();
			this.expect("RBRACKET", "to close array type suffix '[]'");
			ref = { kind: "array", element: ref, line: start.line };
		}
		return ref;
	}

	private parseGlobalVarDecl(): GlobalVarDecl {
		const nameTok = this.expect("IDENT", "for global variable name");
		let typeAnnotation: TypeRef | undefined;
		if (this.match("COLON")) {
			typeAnnotation = this.parseTypeRef();
		}
		this.expect("EQUALS", "in global variable declaration");
		const init = this.parseExpr();
		this.expect("NEWLINE", "after global variable declaration");
		return { kind: "GlobalVarDecl", name: nameTok.value, typeAnnotation, init, line: nameTok.line };
	}

	private parseFunctionDecl(): FunctionDecl {
		const start = this.expect("FUNCTION", "to start function declaration");
		const name = this.expect("IDENT", "for function name").value;
		this.expect("LPAREN", "after function name");
		const params: Param[] = [];
		if (!this.check("RPAREN")) {
			params.push(this.parseParam());
			while (this.match("COMMA")) {
				params.push(this.parseParam());
			}
		}
		this.expect("RPAREN", "to close parameter list");
		let returnType: TypeRef | undefined;
		if (this.match("ARROW")) {
			returnType = this.parseTypeRef();
		}
		this.expect("COLON", "after function signature");
		this.expect("NEWLINE", "after function signature");
		const body = this.parseBlock();
		return { kind: "FunctionDecl", name, params, returnType, body, line: start.line };
	}

	private parseParam(): Param {
		const nameTok = this.expect("IDENT", "for parameter name");
		let typeAnnotation: TypeRef | undefined;
		if (this.match("COLON")) {
			typeAnnotation = this.parseTypeRef();
		}
		return { name: nameTok.value, typeAnnotation, line: nameTok.line };
	}

	/** Expects the current position to be just after a NEWLINE that opens a block; consumes INDENT ... DEDENT. */
	private parseBlock(): Stmt[] {
		this.expect("INDENT", "to begin indented block");
		const stmts: Stmt[] = [];
		this.skipTrivia();
		while (!this.check("DEDENT") && !this.check("EOF")) {
			stmts.push(this.parseStmt());
			this.skipTrivia();
		}
		this.expect("DEDENT", "to end indented block");
		return stmts;
	}

	private parseStmt(): Stmt {
		const t = this.peek();

		if (t.type === "COMMENT") {
			this.advance();
			this.expect("NEWLINE", "after comment");
			return { kind: "PromptComment", text: t.value, line: t.line };
		}

		if (t.type === "IF") return this.parseIf();
		if (t.type === "FOREACH") return this.parseForeach();
		if (t.type === "DO") return this.parseDoWhile();
		if (t.type === "MATCH") return this.parseMatch();
		if (t.type === "RETURN") return this.parseReturn();

		if (t.type === "IDENT" && this.peek(1).type === "COLON") {
			return this.parseVarDecl();
		}
		if (t.type === "IDENT" && this.peek(1).type === "EQUALS") {
			return this.parseVarDecl();
		}

		const expr = this.parseExpr();
		if (this.check("EQUALS")) {
			if (expr.kind !== "Member") {
				throw new ParseError(
					`left-hand side of '=' must be a field access (e.g. 'obj.field = value')`,
					expr.line,
				);
			}
			this.advance(); // consume '='
			const value = this.parseExpr();
			this.expect("NEWLINE", "after field assignment");
			return { kind: "FieldAssign", obj: expr.obj, field: expr.prop, value, line: expr.line };
		}
		this.expect("NEWLINE", "after expression statement");
		return { kind: "ExprStmt", expr, line: t.line };
	}

	private parseVarDecl(): Stmt {
		const nameTok = this.expect("IDENT", "for variable name");
		let typeAnnotation: TypeRef | undefined;
		if (this.match("COLON")) {
			typeAnnotation = this.parseTypeRef();
		}
		this.expect("EQUALS", "in variable declaration/assignment");
		const init = this.parseExpr();
		this.expect("NEWLINE", "after variable declaration/assignment");
		return { kind: "VarDecl", name: nameTok.value, typeAnnotation, init, line: nameTok.line };
	}

	private parseIf(): Stmt {
		const start = this.expect("IF", "to start if statement");
		const cond = this.parseExpr();
		this.expect("COLON", "after if condition");
		this.expect("NEWLINE", "after if condition");
		const then = this.parseBlock();
		this.skipTrivia();
		return { kind: "If", cond, then, else: this.parseElseChain(), line: start.line };
	}

	// Parses the optional elif/else-if/else tail after an if or elif body.
	// Called after skipTrivia(), so the current token is the first on the
	// next logical line (ELIF, ELSE, or the start of the next statement).
	private parseElseChain(): Stmt[] | undefined {
		// elif <cond>: — single keyword form
		if (this.check("ELIF")) {
			const tok = this.advance();
			return [this.parseElifRest(tok.line)];
		}
		// else if <cond>: — two-keyword form; IF must immediately follow ELSE
		// on the same line (no tokens between them after skipTrivia)
		if (this.check("ELSE") && this.peek(1).type === "IF") {
			const tok = this.advance(); // consume ELSE
			this.advance(); // consume IF
			return [this.parseElifRest(tok.line)];
		}
		// else: — plain else block
		if (this.check("ELSE")) {
			this.advance();
			this.expect("COLON", "after else");
			this.expect("NEWLINE", "after else");
			return this.parseBlock();
		}
		return undefined;
	}

	// Parses the condition, body, and optional tail of an elif branch, given
	// that the elif/else-if keyword(s) have already been consumed.
	private parseElifRest(line: number): Stmt {
		const cond = this.parseExpr();
		this.expect("COLON", "after elif condition");
		this.expect("NEWLINE", "after elif condition");
		const then = this.parseBlock();
		this.skipTrivia();
		return { kind: "If", cond, then, else: this.parseElseChain(), line };
	}

	private parseForeach(): Stmt {
		const start = this.expect("FOREACH", "to start foreach statement");
		const varName = this.expect("IDENT", "as foreach loop variable").value;
		this.expect("IN", "in foreach statement");
		const iterable = this.parseExpr();
		this.expect("COLON", "after foreach iterable");
		this.expect("NEWLINE", "after foreach iterable");
		const body = this.parseBlock();
		return { kind: "Foreach", varName, iterable, body, line: start.line };
	}

	private parseDoWhile(): Stmt {
		const start = this.expect("DO", "to start do-while statement");
		this.expect("NEWLINE", "after 'do'");
		const body = this.parseBlock();
		this.skipTrivia();
		this.expect("WHILE", "to close do-while statement");
		const cond = this.parseExpr();
		this.expect("NEWLINE", "after while condition");
		return { kind: "DoWhile", body, cond, line: start.line };
	}

	private parseMatch(): Stmt {
		const start = this.expect("MATCH", "to start match statement");
		const subject = this.parseExpr();
		this.expect("COLON", "after match subject");
		this.expect("NEWLINE", "after match subject");
		this.expect("INDENT", "to begin match body");
		const cases: MatchCase[] = [];
		this.skipTrivia();
		while (this.check("CASE")) {
			const caseStart = this.advance();
			let label: string;
			let labelKind: "ident" | "string";
			if (this.check("STRING")) {
				label = this.advance().value;
				labelKind = "string";
			} else {
				label = this.expect("IDENT", "as match case label").value;
				labelKind = "ident";
			}
			this.expect("COLON", "after match case label");
			this.expect("NEWLINE", "after match case label");
			const body = this.parseBlock();
			cases.push({ label, labelKind, body, line: caseStart.line });
			this.skipTrivia();
		}
		this.expect("DEDENT", "to end match body");
		return { kind: "Match", subject, cases, line: start.line };
	}

	private parseReturn(): Stmt {
		const start = this.expect("RETURN", "to start return statement");
		let expr: Expr | undefined;
		if (!this.check("NEWLINE")) {
			expr = this.parseExpr();
		}
		this.expect("NEWLINE", "after return statement");
		return { kind: "Return", expr, line: start.line };
	}

	// Expression precedence, low to high:
	// ||  &&  ==/!=  +  unary !  as-cast  call/member postfix  primary
	private parseExpr(): Expr {
		return this.parseOr();
	}

	private parseOr(): Expr {
		let left = this.parseAnd();
		while (this.check("OROR")) {
			const t = this.advance();
			const right = this.parseAnd();
			left = { kind: "Binary", op: "||", left, right, line: t.line };
		}
		return left;
	}

	private parseAnd(): Expr {
		let left = this.parseEquality();
		while (this.check("ANDAND")) {
			const t = this.advance();
			const right = this.parseEquality();
			left = { kind: "Binary", op: "&&", left, right, line: t.line };
		}
		return left;
	}

	private parseEquality(): Expr {
		let left = this.parseAdditive();
		while (this.check("EQEQ") || this.check("NEQ")) {
			const t = this.advance();
			const right = this.parseAdditive();
			left = { kind: "Binary", op: t.type === "EQEQ" ? "==" : "!=", left, right, line: t.line };
		}
		return left;
	}

	private parseAdditive(): Expr {
		let left = this.parseUnary();
		while (this.check("PLUS")) {
			const t = this.advance();
			const right = this.parseUnary();
			left = { kind: "Binary", op: "+", left, right, line: t.line };
		}
		return left;
	}

	private parseUnary(): Expr {
		if (this.check("BANG")) {
			const t = this.advance();
			const expr = this.parseUnary();
			return { kind: "Unary", op: "!", expr, line: t.line };
		}
		return this.parseCast();
	}

	private parseCast(): Expr {
		let expr = this.parsePostfix();
		while (this.check("AS")) {
			this.advance();
			const typeAnnotation = this.parseTypeRef();
			expr = { kind: "Cast", expr, typeAnnotation, line: expr.line };
		}
		return expr;
	}

	private parsePostfix(): Expr {
		let expr = this.parsePrimary();
		for (;;) {
			if (this.check("DOT")) {
				this.advance();
				const prop = this.expectIdentOrKeyword("after '.'").value;
				expr = { kind: "Member", obj: expr, prop, line: expr.line };
			} else if (this.check("LPAREN")) {
				this.advance();
				const args: Expr[] = [];
				if (!this.check("RPAREN")) {
					args.push(this.parseExpr());
					while (this.match("COMMA")) {
						args.push(this.parseExpr());
					}
				}
				this.expect("RPAREN", "to close call arguments");
				expr = { kind: "Call", callee: expr, args, line: expr.line };
			} else {
				break;
			}
		}
		return expr;
	}

	private parsePrimary(): Expr {
		const t = this.peek();
		if (t.type === "STRING") {
			this.advance();
			return { kind: "StringLit", value: t.value, line: t.line };
		}
		if (t.type === "TEMPLATE_STRING") {
			this.advance();
			const parts: TemplatePart[] = (t.segments ?? []).map((seg) => {
				if (seg.kind === "text") return { kind: "Text", value: seg.value };
				const subTokens = tokenize(seg.raw + "\n").map((tok) => ({ ...tok, line: seg.line }));
				const subParser = new Parser(subTokens);
				const expr = subParser.parseExpr();
				if (!subParser.check("NEWLINE") || subParser.peek(1).type !== "EOF") {
					throw new ParseError(`unexpected token in template expression`, seg.line);
				}
				return { kind: "Expr", expr };
			});
			return { kind: "TemplateStr", parts, line: t.line };
		}
		if (t.type === "NUMBER") {
			this.advance();
			return { kind: "NumberLit", value: parseFloat(t.value), line: t.line };
		}
		if (t.type === "TRUE" || t.type === "FALSE") {
			this.advance();
			return { kind: "BoolLit", value: t.type === "TRUE", line: t.line };
		}
		if (t.type === "IDENT") {
			this.advance();
			return { kind: "Ident", name: t.value, line: t.line };
		}
		if (t.type === "LPAREN") {
			this.advance();
			const expr = this.parseExpr();
			this.expect("RPAREN", "to close parenthesized expression");
			return expr;
		}
		throw new ParseError(`unexpected token '${t.value}' in expression`, t.line);
	}
}
