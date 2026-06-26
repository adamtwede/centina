export type TokenType =
	| "ENUM" | "TYPE" | "FUNCTION" | "RETURN" | "IF" | "ELIF" | "ELSE" | "MATCH" | "CASE"
	| "FOREACH" | "IN" | "DO" | "WHILE" | "AS" | "TRUE" | "FALSE"
	| "EXTERNAL" | "IMPORT" | "ASSUMED" | "OBJECT" | "RENAMED" | "FROM" | "WAS"
	| "IDENT" | "STRING" | "TEMPLATE_STRING" | "NUMBER"
	| "COLON" | "COMMA" | "DOT" | "LPAREN" | "RPAREN" | "LBRACKET" | "RBRACKET"
	| "ARROW" | "PIPE" | "EQUALS" | "EQEQ" | "NEQ" | "PLUS" | "BANG" | "ANDAND" | "OROR"
	| "COMMENT" | "NEWLINE" | "INDENT" | "DEDENT" | "EOF";

/** A piece of a backtick-delimited template string: literal text, or a raw `${...}` expression awaiting parsing. */
export type TemplateSegment =
	| { kind: "text"; value: string }
	| { kind: "expr"; raw: string; line: number; col: number };

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	col: number;
	/** Only set for COMMENT tokens whose text matches `# @prompt: ...` */
	isPrompt?: boolean;
	/** Only set for TEMPLATE_STRING tokens. */
	segments?: TemplateSegment[];
}

const KEYWORDS: Record<string, TokenType> = {
	enum: "ENUM",
	type: "TYPE",
	function: "FUNCTION",
	return: "RETURN",
	if: "IF",
	elif: "ELIF",
	else: "ELSE",
	match: "MATCH",
	case: "CASE",
	foreach: "FOREACH",
	in: "IN",
	do: "DO",
	while: "WHILE",
	as: "AS",
	true: "TRUE",
	false: "FALSE",
	external: "EXTERNAL",
	import: "IMPORT",
	assumed: "ASSUMED",
	object: "OBJECT",
	renamed: "RENAMED",
	from: "FROM",
	was: "WAS",
};

export class LexError extends Error {
	constructor(message: string, public line: number, public col: number) {
		super(`${message} (line ${line}, col ${col})`);
	}
}

/**
 * Indentation-significant lexer, modeled on Python's tokenizer: blank lines
 * and comment-only lines never affect the indent stack, and indentation is
 * compared as raw leading-whitespace strings (one must be a prefix of the
 * other) rather than converting tabs/spaces to a column count.
 */
export function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	const lines = source.split(/\r\n|\r|\n/);
	const indentStack: string[] = [""];
	// Whether the previous non-blank line ended with COLON, i.e. genuinely opened a
	// block. Only such a line entitles the next line — including a comment-only one,
	// for the `# @prompt: ...`-as-sole-body case — to push a deeper indent level.
	let prevLineOpensBlock = false;

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const raw = lines[lineNo];
		const line = lineNo + 1;

		const leadingMatch = /^[ \t]*/.exec(raw)!;
		const leading = leadingMatch[0];
		const rest = raw.slice(leading.length);

		if (rest === "") {
			continue;
		}

		// Comment-only lines participate in indentation just like code lines: a
		// `# @prompt: ...` comment can be the sole statement in a function body, so it
		// must be able to open/close blocks the same way a real statement would.
		const isCommentOnly = rest[0] === "#";
		const current = indentStack[indentStack.length - 1];
		if (leading.length > current.length) {
			// A comment-only line indented deeper than the current block, with no
			// preceding line that actually opened one, has nothing real to belong to —
			// e.g. a function header and its body commented out on separate lines,
			// leaving the body's original indentation dangling. Treat it as staying at
			// the current level instead of phantom-opening a block the parser never
			// asked for.
			if (isCommentOnly && !prevLineOpensBlock) {
				tokenizeLine(rest, line, leading.length + 1, tokens);
				tokens.push({ type: "NEWLINE", value: "", line, col: raw.length + 1 });
				prevLineOpensBlock = false;
				continue;
			}
			if (!leading.startsWith(current)) {
				throw new LexError("inconsistent indentation", line, 1);
			}
			indentStack.push(leading);
			tokens.push({ type: "INDENT", value: leading, line, col: 1 });
		} else if (leading.length < current.length) {
			while (indentStack.length > 1 && leading.length < indentStack[indentStack.length - 1].length) {
				indentStack.pop();
				tokens.push({ type: "DEDENT", value: "", line, col: 1 });
			}
			if (indentStack[indentStack.length - 1] !== leading) {
				throw new LexError("inconsistent indentation", line, 1);
			}
		} else if (leading !== current) {
			throw new LexError("inconsistent indentation", line, 1);
		}

		tokenizeLine(rest, line, leading.length + 1, tokens);
		tokens.push({ type: "NEWLINE", value: "", line, col: raw.length + 1 });
		prevLineOpensBlock = tokens[tokens.length - 2]?.type === "COLON";
	}

	while (indentStack.length > 1) {
		indentStack.pop();
		tokens.push({ type: "DEDENT", value: "", line: lines.length, col: 1 });
	}
	tokens.push({ type: "EOF", value: "", line: lines.length + 1, col: 1 });
	return tokens;
}

function makeCommentToken(text: string, line: number, col: number): Token {
	const isPrompt = /^#\s*@prompt:/.test(text);
	return { type: "COMMENT", value: text, line, col, isPrompt };
}

function tokenizeLine(text: string, line: number, colOffset: number, out: Token[]): void {
	let i = 0;
	while (i < text.length) {
		const col = colOffset + i;
		const c = text[i];

		if (c === " " || c === "\t") {
			i++;
			continue;
		}

		if (c === "#") {
			// A comment that is the only content on its line is a real statement (it can be
			// the sole `@prompt:`-tagged body of a stub function), so it gets a token. A
			// trailing comment after code on the same line is just a human aside and is
			// discarded outright.
			if (i === 0) {
				out.push(makeCommentToken(text.slice(i), line, col));
			}
			return;
		}

		if (c === '"') {
			let j = i + 1;
			let value = "";
			while (j < text.length && text[j] !== '"') {
				if (text[j] === "\\" && j + 1 < text.length) {
					value += text[j + 1];
					j += 2;
				} else {
					value += text[j];
					j++;
				}
			}
			if (text[j] !== '"') {
				throw new LexError("unterminated string literal", line, col);
			}
			out.push({ type: "STRING", value, line, col });
			i = j + 1;
			continue;
		}

		if (c === "`") {
			const segments: TemplateSegment[] = [];
			let textBuf = "";
			let j = i + 1;
			while (j < text.length && text[j] !== "`") {
				if (text[j] === "\\" && j + 1 < text.length) {
					textBuf += text[j + 1];
					j += 2;
					continue;
				}
				if (text[j] === "$" && text[j + 1] === "{") {
					if (textBuf) {
						segments.push({ kind: "text", value: textBuf });
						textBuf = "";
					}
					const exprCol = colOffset + j + 2;
					j += 2;
					const exprStart = j;
					let depth = 1;
					while (j < text.length && depth > 0) {
						if (text[j] === "{") depth++;
						else if (text[j] === "}") {
							depth--;
							if (depth === 0) break;
						}
						j++;
					}
					if (depth !== 0) {
						throw new LexError("unterminated template expression", line, col);
					}
					segments.push({ kind: "expr", raw: text.slice(exprStart, j), line, col: exprCol });
					j++; // skip closing '}'
					continue;
				}
				textBuf += text[j];
				j++;
			}
			if (text[j] !== "`") {
				throw new LexError("unterminated template string literal", line, col);
			}
			if (textBuf) segments.push({ kind: "text", value: textBuf });
			out.push({ type: "TEMPLATE_STRING", value: text.slice(i, j + 1), segments, line, col });
			i = j + 1;
			continue;
		}

		if (/[0-9]/.test(c)) {
			let j = i;
			while (j < text.length && /[0-9.]/.test(text[j])) j++;
			out.push({ type: "NUMBER", value: text.slice(i, j), line, col });
			i = j;
			continue;
		}

		if (/[A-Za-z_]/.test(c)) {
			let j = i;
			while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
			const word = text.slice(i, j);
			const kw = KEYWORDS[word];
			out.push({ type: kw ?? "IDENT", value: word, line, col });
			i = j;
			continue;
		}

		const two = text.slice(i, i + 2);
		if (two === "->") {
			out.push({ type: "ARROW", value: two, line, col });
			i += 2;
			continue;
		}
		if (two === "==") {
			out.push({ type: "EQEQ", value: two, line, col });
			i += 2;
			continue;
		}
		if (two === "!=") {
			out.push({ type: "NEQ", value: two, line, col });
			i += 2;
			continue;
		}
		if (two === "&&") {
			out.push({ type: "ANDAND", value: two, line, col });
			i += 2;
			continue;
		}
		if (two === "||") {
			out.push({ type: "OROR", value: two, line, col });
			i += 2;
			continue;
		}

		const single: Partial<Record<string, TokenType>> = {
			":": "COLON",
			",": "COMMA",
			".": "DOT",
			"(": "LPAREN",
			")": "RPAREN",
			"[": "LBRACKET",
			"]": "RBRACKET",
			"|": "PIPE",
			"=": "EQUALS",
			"+": "PLUS",
			"!": "BANG",
		};
		const t = single[c];
		if (t) {
			out.push({ type: t, value: c, line, col });
			i++;
			continue;
		}

		throw new LexError(`unexpected character '${c}'`, line, col);
	}
}
