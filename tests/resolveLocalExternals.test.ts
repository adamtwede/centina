import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { check } from "../src/checker.js";
import { resolveExternals } from "../src/resolveExternals.js";
import { resolveLocalExternals } from "../src/resolveLocalExternals.js";

const fixtures = new URL("./fixtures/", import.meta.url).pathname;

function resolve(source: string) {
	const program = parse(tokenize(source));
	return resolveLocalExternals(program, fixtures);
}

function checkWithLocalExternals(source: string) {
	const { program, diagnostics } = resolve(source);
	return [...diagnostics, ...check(program)];
}

test("an external symbol targeting another .aisl file's native type resolves with no diagnostics", () => {
	const diags = checkWithLocalExternals(
		'external type Step from "./shared.aisl"\nexternal function decompose from "./shared.aisl"\nfunction f(s: Step):\n\treturn decompose(s)\n',
	);
	assert.equal(diags.filter((d) => d.severity === "error").length, 0);
});

test("an external symbol targeting another .aisl file's native enum carries its members and exhaustiveness checking", () => {
	const diags = checkWithLocalExternals(
		'external type Status from "./shared.aisl"\nfunction f(s: Status):\n\tmatch s:\n\t\tcase PENDING:\n\t\t\treturn\n\t\tcase DONE:\n\t\t\treturn\n',
	);
	assert.equal(diags.filter((d) => d.severity === "error").length, 0);
});

test("an external symbol targeting another .aisl file's native global variable carries its concrete type", () => {
	const diags = checkWithLocalExternals(
		'external object count from "./shared.aisl"\nfunction f():\n\tx: Number = count\n\treturn x\n',
	);
	assert.equal(diags.filter((d) => d.severity === "error").length, 0);
});

test("an external symbol whose kind keyword does not match the real declaration's kind warns but still resolves using the real kind", () => {
	const diags = checkWithLocalExternals(
		'external function Step from "./shared.aisl"\nfunction f(s: Step):\n\treturn s\n',
	);
	assert.equal(diags.filter((d) => d.severity === "error").length, 0);
	assert.ok(
		diags.some(
			(d) => d.severity === "warning" && /declared as external 'function', but '.\/shared\.aisl' declares it as a 'type'/.test(d.message),
		),
	);
});

test("an external symbol naming something that's itself declared external in the target .aisl file errors instead of forwarding it", () => {
	const { diagnostics } = resolve('external object lodash from "./shared.aisl"\n');
	assert.equal(diagnostics.length, 1);
	assert.match(
		diagnostics[0].message,
		/'lodash' in '\.\/shared\.aisl' is itself declared as external, pointing at 'lodash'/,
	);
});

test("a `renamed`/`was` clause lets the AISL-facing alias differ from the real symbol name in another .aisl file", () => {
	const diags = checkWithLocalExternals(
		'external renamed type ModelStep from "./shared.aisl" was Step\nfunction f(s: ModelStep):\n\treturn s\n',
	);
	assert.equal(diags.filter((d) => d.severity === "error").length, 0);
});

test("a cloned external's local path is rebased to the file it was found in, not the importer", () => {
	const { program } = resolve('external type ModelStep from "./subdir/shared2.aisl"\n');
	const extDiags = resolveExternals(program, fixtures);
	assert.equal(extDiags.length, 0);
});

test("an external symbol naming a real .aisl file but a name not declared anywhere in it is an error", () => {
	const { diagnostics } = resolve('external type DoesNotExist from "./shared.aisl"\n');
	assert.equal(diagnostics.length, 1);
	assert.match(diagnostics[0].message, /could not find 'DoesNotExist' declared in '\.\/shared\.aisl'/);
});

test("an external symbol naming a missing .aisl file is an error, not a crash", () => {
	const { diagnostics } = resolve('external type Foo from "./no_such_file.aisl"\n');
	assert.equal(diagnostics.length, 1);
	assert.match(diagnostics[0].message, /could not find '\.\/no_such_file\.aisl'/);
});

test("an external symbol targeting an .aisl file with its own checker errors is blocked", () => {
	const { diagnostics } = resolve('external type bad from "./broken.aisl"\n');
	assert.equal(diagnostics.length, 1);
	assert.match(diagnostics[0].message, /errors in '\.\/broken\.aisl' must be resolved/);
});

test("an external symbol naming a name that is itself external in the target file errors instead of chasing the chain", () => {
	const { diagnostics } = resolve('external type Step from "./reexport.aisl"\n');
	assert.equal(diagnostics.length, 1);
	assert.match(
		diagnostics[0].message,
		/'Step' in '\.\/reexport\.aisl' is itself declared as external, pointing at '\.\/shared\.aisl'/,
	);
});

test("an external alias colliding with an existing local declaration is an error", () => {
	const { diagnostics } = resolve('type Step\nexternal type Step from "./shared.aisl"\n');
	assert.equal(diagnostics.length, 1);
	assert.match(diagnostics[0].message, /'Step' is already declared/);
});

test("two externals aliased to the same name targeting another .aisl file collide with each other", () => {
	const { diagnostics } = resolve(
		'external type Step from "./shared.aisl"\nexternal type Step from "./shared.aisl"\n',
	);
	assert.equal(diagnostics.length, 1);
	assert.match(diagnostics[0].message, /'Step' is already declared/);
});
