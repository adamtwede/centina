import type { Diagnostic } from "./checker.js";

export interface Directive {
	severity: "error" | "warning";
	pattern: string;
	isRegex: boolean;
	line: number;
}

export interface DirectiveResult {
	remaining: Diagnostic[];
	suppressed: Diagnostic[];
	unused: Directive[];
}

/** Parse all `# ~error:` and `# ~warn:` directives from source, keyed by 1-based line number. */
export function parseDirectives(source: string): Directive[] {
	const directives: Directive[] = [];
	const lines = source.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(/#\s*~(error|warn):\s*(.+?)\s*$/);
		if (!m) continue;
		const severity: "error" | "warning" = m[1] === "error" ? "error" : "warning";
		const raw = m[2].trim();
		const isRegex = raw.startsWith("/") && raw.endsWith("/") && raw.length > 2;
		const pattern = isRegex ? raw.slice(1, -1) : raw;
		directives.push({ severity, pattern, isRegex, line: i + 1 });
	}
	return directives;
}

function directiveMatches(directive: Directive, diagnostic: Diagnostic): boolean {
	if (directive.severity !== diagnostic.severity) return false;
	if (directive.line !== diagnostic.line) return false;
	return directive.isRegex
		? new RegExp(directive.pattern).test(diagnostic.message)
		: diagnostic.message.includes(directive.pattern);
}

/**
 * For each diagnostic, attempt to match it against an unused directive on the same line.
 * A matched diagnostic is suppressed (moved to `suppressed`); unmatched ones stay in `remaining`.
 * Directives that matched nothing are returned as `unused`.
 */
export function applyDirectives(diagnostics: Diagnostic[], directives: Directive[]): DirectiveResult {
	const remaining: Diagnostic[] = [];
	const suppressed: Diagnostic[] = [];
	const usedDirectives = new Set<Directive>();

	for (const diag of diagnostics) {
		const directive = directives.find((d) => !usedDirectives.has(d) && directiveMatches(d, diag));
		if (directive) {
			usedDirectives.add(directive);
			suppressed.push(diag);
		} else {
			remaining.push(diag);
		}
	}

	const unused = directives.filter((d) => !usedDirectives.has(d));
	return { remaining, suppressed, unused };
}
