import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../src/lexer.js";
import { parse, ParseError } from "../src/parser.js";

function parseSource(src: string) {
	return parse(tokenize(src));
}

test("parses an enum declaration", () => {
	const program = parseSource("enum Verdict = SUCCESS | FAILURE\n");
	assert.equal(program.enums.length, 1);
	assert.deepEqual(program.enums[0].members, ["SUCCESS", "FAILURE"]);
});

test("parses a type declaration", () => {
	const program = parseSource("type Feedback\n");
	assert.equal(program.types.length, 1);
	assert.equal(program.types[0].name, "Feedback");
});

test("parses a global var decl with a builtin constructor call", () => {
	const program = parseSource("enum ModelId = CLAUDE_OPUS\ncloud_model: Agent = Agent(CLAUDE_OPUS)\n");
	assert.equal(program.globals.length, 1);
	assert.equal(program.globals[0].name, "cloud_model");
	assert.equal(program.globals[0].typeAnnotation?.kind, "named");
});

test("parses function params with optional types and an array return type", () => {
	const program = parseSource(
		"function decompose(step: Step, agent) -> Step[]:\n\treturn step\n",
	);
	const fn = program.functions[0];
	assert.equal(fn.params.length, 2);
	assert.equal(fn.params[0].typeAnnotation?.kind, "named");
	assert.equal(fn.params[1].typeAnnotation, undefined);
	assert.equal(fn.returnType?.kind, "array");
});

test("parses if/else without parens around the condition", () => {
	const program = parseSource(
		"function f(a, b):\n\tif a == b:\n\t\treturn a\n\telse:\n\t\treturn b\n",
	);
	const stmt = program.functions[0].body[0];
	assert.equal(stmt.kind, "If");
});

test("parses foreach without parens", () => {
	const program = parseSource("function f(xs):\n\tforeach x in xs:\n\t\treturn x\n");
	assert.equal(program.functions[0].body[0].kind, "Foreach");
});

test("parses do-while", () => {
	const program = parseSource("function f():\n\tdo\n\t\treturn 1\n\twhile !done()\n");
	assert.equal(program.functions[0].body[0].kind, "DoWhile");
});

test("parses match/case", () => {
	const program = parseSource(
		"function f(v):\n\tmatch v:\n\t\tcase A:\n\t\t\treturn 1\n\t\tcase B:\n\t\t\treturn 2\n",
	);
	const stmt = program.functions[0].body[0];
	assert.equal(stmt.kind, "Match");
	if (stmt.kind === "Match") {
		assert.equal(stmt.cases.length, 2);
	}
});

test("parses an `as` cast and member/call chaining", () => {
	const program = parseSource(
		'function f(agent):\n\treturn agent.prompt("hi") as Step\n',
	);
	const ret = program.functions[0].body[0];
	assert.equal(ret.kind, "Return");
	if (ret.kind === "Return") {
		assert.equal(ret.expr?.kind, "Cast");
	}
});

test("a @agent comment as the sole function body becomes an AgentComment statement", () => {
	const program = parseSource("function f():\n\t# @agent: figure this out\n");
	assert.equal(program.functions[0].body.length, 1);
	assert.equal(program.functions[0].body[0].kind, "AgentComment");
});

test("throws ParseError on malformed input", () => {
	assert.throws(() => parseSource("function f(:\n"), ParseError);
});

test("parses an external type declaration with the alias as the real name by default", () => {
	const program = parseSource('external type Step from "src/models.ts"\n');
	assert.equal(program.externals.length, 1);
	const ext = program.externals[0];
	assert.equal(ext.symbolKind, "type");
	assert.equal(ext.name, "Step");
	assert.equal(ext.path, "src/models.ts");
	assert.equal(ext.realName, "Step");
});

test("parses an external declaration with a `renamed` clause", () => {
	const program = parseSource('external renamed type ModelStep from "src/models.ts" was Step\n');
	const ext = program.externals[0];
	assert.equal(ext.name, "ModelStep");
	assert.equal(ext.realName, "Step");
});

test("parses external function and object declarations", () => {
	const program = parseSource(
		'external renamed function debounce from "lodash" was debounce\nexternal object lodash from "lodash"\n',
	);
	assert.equal(program.externals.length, 2);
	assert.equal(program.externals[0].symbolKind, "function");
	assert.equal(program.externals[1].symbolKind, "object");
});

test("parses elif chain (single keyword form)", () => {
	const program = parseSource([
		"function f(a, b):",
		"\tif a:",
		"\t\treturn a",
		"\telif b:",
		"\t\treturn b",
		"\telse:",
		"\t\treturn a",
	].join("\n") + "\n");
	const stmt = program.functions[0].body[0];
	assert.equal(stmt.kind, "If");
	// The elif becomes a nested If in the else branch
	assert.ok(stmt.else !== undefined);
	const elif = stmt.else![0];
	assert.equal(elif.kind, "If");
	assert.ok(elif.else !== undefined); // has the final else
});

test("parses else-if chain (two-keyword form)", () => {
	const program = parseSource([
		"function f(a, b):",
		"\tif a:",
		"\t\treturn a",
		"\telse if b:",
		"\t\treturn b",
		"\telse:",
		"\t\treturn a",
	].join("\n") + "\n");
	const stmt = program.functions[0].body[0];
	assert.equal(stmt.kind, "If");
	assert.ok(stmt.else !== undefined);
	const elseIf = stmt.else![0];
	assert.equal(elseIf.kind, "If");
	assert.ok(elseIf.else !== undefined);
});

test("parses multiple elif branches terminating without else", () => {
	const program = parseSource([
		"function f(a, b, c):",
		"\tif a:",
		"\t\treturn a",
		"\telif b:",
		"\t\treturn b",
		"\telif c:",
		"\t\treturn c",
	].join("\n") + "\n");
	const stmt = program.functions[0].body[0];
	assert.equal(stmt.kind, "If");
	const second = stmt.else![0];
	assert.equal(second.kind, "If");
	const third = second.else![0];
	assert.equal(third.kind, "If");
	assert.equal(third.else, undefined); // no terminal else
});

test("parses keyword as object property name", () => {
	const program = parseSource("type Foo\nfunction f(x: Foo):\n\ty = x.type\n");
	// Should parse without throwing
	assert.equal(program.functions[0].body[0].kind, "VarDecl");
});
