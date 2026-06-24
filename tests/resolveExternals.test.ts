import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { resolveExternals } from "../src/resolveExternals.js";

const fixtures = new URL("./fixtures/", import.meta.url).pathname;

function externalsFor(source: string) {
	const program = parse(tokenize(source));
	return resolveExternals(program, fixtures);
}

test("a correctly-typed external symbol found in a local TS file verifies cleanly", () => {
	const diags = externalsFor('external type Step from "./models.ts"\n');
	assert.equal(diags.length, 0);
});

test("an external function correctly matched to a real TS export verifies cleanly", () => {
	const diags = externalsFor('external function decompose from "./models.ts"\n');
	assert.equal(diags.length, 0);
});

test("an external object correctly matched to a real TS export verifies cleanly", () => {
	const diags = externalsFor('external object config from "./models.ts"\n');
	assert.equal(diags.length, 0);
});

test("a TS export found under the wrong declared kind warns about the mismatch", () => {
	const diags = externalsFor('external function Step from "./models.ts"\n');
	assert.equal(diags.length, 1);
	assert.match(diags[0].message, /declared as external 'function', but looks like a 'type' export/);
});

test("a symbol not found anywhere in the real TS file warns", () => {
	const diags = externalsFor('external type DoesNotExist from "./models.ts"\n');
	assert.equal(diags.length, 1);
	assert.match(diags[0].message, /could not find a plausible export of 'DoesNotExist'/);
});

test("a missing local file warns instead of erroring", () => {
	const diags = externalsFor('external type Step from "./no_such_file.ts"\n');
	assert.equal(diags.length, 1);
	assert.match(diags[0].message, /could not find '\.\/no_such_file\.ts'/);
});

test("a bare library specifier is never resolved and always warns", () => {
	const diags = externalsFor('external object lodash from "lodash"\n');
	assert.equal(diags.length, 1);
	assert.match(diags[0].message, /isn't a local file path/);
});

test("python class, function, and module-level assignment exports all verify cleanly", () => {
	const diags = externalsFor(
		'external type Step from "./models.py"\nexternal function decompose from "./models.py"\nexternal object config from "./models.py"\n',
	);
	assert.equal(diags.length, 0);
});

test("an unrecognized file extension is reported as unverifiable, not an error", () => {
	const diags = externalsFor('external type Step from "./models.json"\n');
	assert.equal(diags.length, 1);
	assert.match(diags[0].message, /unrecognized file type/);
});

test("a `renamed` clause is verified against the real name, not the AISL-facing alias", () => {
	const diags = externalsFor('external renamed type ModelStep from "./models.ts" was Step\n');
	assert.equal(diags.length, 0);
});
