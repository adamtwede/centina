import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { check } from "../src/checker.js";
import { parseDirectives, applyDirectives } from "../src/directives.js";

const FIXTURES_DIR = new URL("./aisl", import.meta.url).pathname;

function collectAislFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			files.push(...collectAislFiles(full));
		} else if (entry.endsWith(".aisl")) {
			files.push(full);
		}
	}
	return files.sort();
}

for (const filePath of collectAislFiles(FIXTURES_DIR)) {
	const name = filePath.slice(FIXTURES_DIR.length + 1);
	test(`fixture: ${name}`, () => {
		const source = readFileSync(filePath, "utf8");
		const tokens = tokenize(source);
		const program = parse(tokens);
		const diagnostics = check(program);
		const directives = parseDirectives(source);
		const { remaining, unused } = applyDirectives(diagnostics, directives);

		if (unused.length > 0) {
			const detail = unused
				.map((d) => `  line ${d.line}: # ~${d.severity === "error" ? "error" : "warn"}: ${d.pattern}`)
				.join("\n");
			assert.fail(`${name}: ${unused.length} unmatched directive(s) — expected diagnostic never fired:\n${detail}`);
		}

		if (remaining.length > 0) {
			const detail = remaining
				.map((d) => `  ${filePath}:${d.line}: ${d.severity}: ${d.message}`)
				.join("\n");
			assert.fail(`${name}: ${remaining.length} unexpected diagnostic(s):\n${detail}`);
		}
	});
}
