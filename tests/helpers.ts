import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { check, Diagnostic } from "../src/checker.js";

/** Tokenizes, parses, and type-checks a source snippet, returning the resulting diagnostics. */
export function diagnosticsFor(source: string): Diagnostic[] {
	const tokens = tokenize(source);
	const program = parse(tokens);
	return check(program);
}

export function errorsOf(diagnostics: Diagnostic[]): Diagnostic[] {
	return diagnostics.filter((d) => d.severity === "error");
}

export function warningsOf(diagnostics: Diagnostic[]): Diagnostic[] {
	return diagnostics.filter((d) => d.severity === "warning");
}
