#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tokenize, LexError } from "./lexer.js";
import { parse, ParseError } from "./parser.js";
import { checkAndCollect } from "./checker.js";
import { resolveExternals } from "./resolveExternals.js";
import { resolveLocalExternals } from "./resolveLocalExternals.js";
import { buildSymbolTable } from "./symbols.js";
import { parseDirectives, applyDirectives } from "./directives.js";

function main(): void {
	const file = process.argv[2];
	if (!file) {
		console.error("usage: aisl-check <file.aisl>");
		process.exitCode = 2;
		return;
	}

	const source = readFileSync(file, "utf8");

	try {
		const tokens = tokenize(source);
		const program = parse(tokens);
		const { program: resolvedProgram, diagnostics: localExternalDiagnostics } = resolveLocalExternals(program, dirname(file));
		const { diagnostics: checkDiagnostics, propertyUsage } = checkAndCollect(resolvedProgram);
		const diagnostics = [
			...localExternalDiagnostics,
			...checkDiagnostics,
			...resolveExternals(resolvedProgram, dirname(file)),
		];

		try {
			const symbolTable = buildSymbolTable(resolvedProgram, propertyUsage, resolve(file));
			writeFileSync(`${file}.symbols.json`, JSON.stringify(symbolTable, null, 2));
		} catch {
			// Symbol table write is best-effort — don't abort the checker on failure.
		}

		const { remaining } = applyDirectives(diagnostics, parseDirectives(source));

		const errorLines = new Set(remaining.filter((d) => d.severity === "error").map((d) => d.line));
		const coalesced = remaining.filter((d) => !(d.severity === "warning" && errorLines.has(d.line)));

		if (coalesced.length === 0) {
			console.log(`${file}: no issues found`);
			return;
		}

		const sorted = [...coalesced].sort((a, b) => a.line - b.line);
		for (const d of sorted) {
			console.log(`${file}:${d.line}: ${d.severity}: ${d.message}`);
		}
		const errorCount = coalesced.filter((d) => d.severity === "error").length;
		const warningCount = coalesced.filter((d) => d.severity === "warning").length;
		console.log(`\n${errorCount} error(s), ${warningCount} warning(s)`);
		if (errorCount > 0) process.exitCode = 1;
	} catch (e) {
		if (e instanceof LexError || e instanceof ParseError) {
			console.error(`${file}: ${e.message}`);
			process.exitCode = 1;
			return;
		}
		throw e;
	}
}

main();
