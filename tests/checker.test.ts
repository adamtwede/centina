import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticsFor, errorsOf, warningsOf } from "./helpers.js";

test("flags a reference to an undefined identifier", () => {
	const diags = diagnosticsFor("function f():\n\treturn unknown_name\n");
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /not defined in this scope/);
});

test("does not flag a defined identifier", () => {
	const diags = diagnosticsFor("function f(x):\n\treturn x\n");
	assert.equal(errorsOf(diags).length, 0);
});

test("flags a nominal type mismatch on a function argument", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction g(s: Step):\n\treturn s\nfunction f():\n\tg(\"hello\")\n",
	);
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /expected 'Step', got 'String'/);
});

test("does not flag matching nominal types", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction g(s: Step):\n\treturn s\nfunction f(s: Step):\n\tg(s)\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("an Agent.prompt() result is Unspecified and cannot flow into a typed slot without a cast", () => {
	const diags = diagnosticsFor(
		[
			"type Step",
			"function g(s: Step):",
			"\treturn s",
			"function f(agent: Agent):",
			'\tg(agent.prompt("hi"))',
			"",
		].join("\n"),
	);
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /expected 'Step', got 'Unspecified'/);
});

test("an explicit `as` cast on a prompt result satisfies a typed slot", () => {
	const diags = diagnosticsFor(
		[
			"type Step",
			"function g(s: Step):",
			"\treturn s",
			"function f(agent: Agent):",
			'\tg(agent.prompt("hi") as Step)',
			"",
		].join("\n"),
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("a concrete value may flow into an Unspecified-typed slot with no cast required", () => {
	const diags = diagnosticsFor("function f(x: Unspecified):\n\treturn x\nfunction g():\n\tf(\"hello\")\n");
	assert.equal(errorsOf(diags).length, 0);
});

test("match over an enum requires every member to be handled", () => {
	const diags = diagnosticsFor(
		[
			"enum Verdict = A | B | C",
			"function f(v: Verdict):",
			"\tmatch v:",
			"\t\tcase A:",
			"\t\t\treturn 1",
			"",
		].join("\n"),
	);
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /not exhaustive.*B, C/);
});

test("an exhaustive match over an enum raises no error", () => {
	const diags = diagnosticsFor(
		[
			"enum Verdict = A | B",
			"function f(v: Verdict):",
			"\tmatch v:",
			"\t\tcase A:",
			"\t\t\treturn 1",
			"\t\tcase B:",
			"\t\t\treturn 2",
			"",
		].join("\n"),
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("a match case naming an unknown label is an error", () => {
	const diags = diagnosticsFor(
		[
			"enum Verdict = A | B",
			"function f(v: Verdict):",
			"\tmatch v:",
			"\t\tcase A:",
			"\t\t\treturn 1",
			"\t\tcase NOT_A_MEMBER:",
			"\t\t\treturn 2",
			"",
		].join("\n"),
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /is not a member of any declared enum/.test(e.message)));
});

test("a duplicate match case is an error", () => {
	const diags = diagnosticsFor(
		[
			"enum Verdict = A | B",
			"function f(v: Verdict):",
			"\tmatch v:",
			"\t\tcase A:",
			"\t\t\treturn 1",
			"\t\tcase A:",
			"\t\t\treturn 2",
			"\t\tcase B:",
			"\t\t\treturn 3",
			"",
		].join("\n"),
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /duplicate match case/.test(e.message)));
});

test("matching on an Unspecified subject warns instead of erroring, since exhaustiveness can't be known", () => {
	const diags = diagnosticsFor(
		[
			"enum Verdict = A | B",
			"function f(agent: Agent):",
			'\tmatch agent.prompt("hi"):',
			"\t\tcase A:",
			"\t\t\treturn 1",
			"",
		].join("\n"),
	);
	assert.equal(errorsOf(diags).length, 0);
	assert.ok(warningsOf(diags).some((w) => /cast it to an enum type/.test(w.message)));
});

test("a function body that is only @prompt comments is treated as an intentional stub, not flagged", () => {
	const diags = diagnosticsFor("function f():\n\t# @prompt: figure this out later\n");
	assert.equal(diags.length, 0);
});

test("undeclared dot-notation property access is never flagged", () => {
	const diags = diagnosticsFor('function f(agent: Agent):\n\treturn agent.some_made_up_property\n');
	assert.equal(errorsOf(diags).length, 0);
});

test("calling a function with the wrong number of arguments is an error", () => {
	const diags = diagnosticsFor("function g(a, b):\n\treturn a\nfunction f():\n\tg(1)\n");
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /expects 2 argument\(s\), got 1/.test(e.message)));
});

test("referencing an unknown type name is an error", () => {
	const diags = diagnosticsFor("function f(x: NotARealType):\n\treturn x\n");
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /unknown type 'NotARealType'/.test(e.message)));
});

test("the built-in human_intervened() function is recognized", () => {
	const diags = diagnosticsFor("function f():\n\treturn human_intervened()\n");
	assert.equal(errorsOf(diags).length, 0);
});
