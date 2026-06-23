import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { check } from "../src/checker.js";

test("prototype.aisl has zero checker diagnostics", () => {
	const source = readFileSync(new URL("../prototype.aisl", import.meta.url), "utf8");
	const diagnostics = check(parse(tokenize(source)));
	assert.deepEqual(diagnostics, [], JSON.stringify(diagnostics, null, 2));
});
