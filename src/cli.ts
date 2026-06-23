#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { tokenize, LexError } from "./lexer.js";
import { parse, ParseError } from "./parser.js";
import { check } from "./checker.js";

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
		const diagnostics = check(program);

		if (diagnostics.length === 0) {
			console.log(`${file}: no issues found`);
			return;
		}

		const sorted = [...diagnostics].sort((a, b) => a.line - b.line);
		for (const d of sorted) {
			console.log(`${file}:${d.line}: ${d.severity}: ${d.message}`);
		}
		const errorCount = diagnostics.filter((d) => d.severity === "error").length;
		const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
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
