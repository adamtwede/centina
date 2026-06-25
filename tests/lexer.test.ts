import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, LexError } from "../src/lexer.js";

test("tokenizes a simple function with indentation", () => {
	const tokens = tokenize('function f():\n\treturn "x"\n');
	const types = tokens.map((t) => t.type);
	assert.deepEqual(types, [
		"FUNCTION",
		"IDENT",
		"LPAREN",
		"RPAREN",
		"COLON",
		"NEWLINE",
		"INDENT",
		"RETURN",
		"STRING",
		"NEWLINE",
		"DEDENT",
		"EOF",
	]);
});

test("blank lines do not affect indentation", () => {
	const tokens = tokenize("function f():\n\treturn 1\n\n\treturn 2\n");
	const types = tokens.map((t) => t.type);
	// no spurious INDENT/DEDENT around the blank line
	assert.deepEqual(types, [
		"FUNCTION", "IDENT", "LPAREN", "RPAREN", "COLON", "NEWLINE",
		"INDENT",
		"RETURN", "NUMBER", "NEWLINE",
		"RETURN", "NUMBER", "NEWLINE",
		"DEDENT", "EOF",
	]);
});

test("a comment-only line can open and close a block on its own", () => {
	const tokens = tokenize("function f():\n\t# @prompt: fill me in\n");
	const types = tokens.map((t) => t.type);
	assert.deepEqual(types, [
		"FUNCTION", "IDENT", "LPAREN", "RPAREN", "COLON", "NEWLINE",
		"INDENT", "COMMENT", "NEWLINE", "DEDENT", "EOF",
	]);
	const comment = tokens.find((t) => t.type === "COMMENT")!;
	assert.equal(comment.isPrompt, true);
});

test("a deeper-indented comment with no preceding colon stays at the current level, not a phantom block", () => {
	// Simulates commenting out a header line and its (separately indented) body line
	// one at a time, e.g. via an editor's line-comment toggle: the body comment keeps
	// its original deeper indentation even though nothing real opened a block for it.
	const tokens = tokenize("# function f():\n\t# return 1\nfunction g():\n\treturn 2\n");
	const types = tokens.map((t) => t.type);
	assert.deepEqual(types, [
		"COMMENT", "NEWLINE",
		"COMMENT", "NEWLINE",
		"FUNCTION", "IDENT", "LPAREN", "RPAREN", "COLON", "NEWLINE",
		"INDENT", "RETURN", "NUMBER", "NEWLINE",
		"DEDENT", "EOF",
	]);
});

test("a plain comment is not flagged as a prompt comment", () => {
	const tokens = tokenize("# just a note\n");
	const comment = tokens.find((t) => t.type === "COMMENT")!;
	assert.equal(comment.isPrompt, false);
});

test("trailing inline comments after code are discarded, not tokenized", () => {
	const tokens = tokenize('x = 1 # trailing note\n');
	const types = tokens.map((t) => t.type);
	assert.ok(!types.includes("COMMENT"));
});

test("inconsistent indentation raises a LexError", () => {
	assert.throws(() => tokenize("function f():\n\treturn 1\n  return 2\n"), LexError);
});

test("indentation is style-agnostic: 2-space, 4-space, and tabs all tokenize identically", () => {
	const expected = [
		"FUNCTION", "IDENT", "LPAREN", "IDENT", "RPAREN", "COLON", "NEWLINE",
		"INDENT",
		"IF", "IDENT", "EQEQ", "IDENT", "COLON", "NEWLINE",
		"INDENT", "RETURN", "IDENT", "NEWLINE",
		"DEDENT",
		"RETURN", "IDENT", "NEWLINE",
		"DEDENT", "EOF",
	];

	const twoSpace = tokenize("function f(x):\n  if x == x:\n    return x\n  return x\n");
	const fourSpace = tokenize("function f(x):\n    if x == x:\n        return x\n    return x\n");
	const tabs = tokenize("function f(x):\n\tif x == x:\n\t\treturn x\n\treturn x\n");

	for (const tokens of [twoSpace, fourSpace, tabs]) {
		assert.deepEqual(tokens.map((t) => t.type), expected);
	}
});

test("a sibling line whose indent string isn't a match for its peer is inconsistent, even at equal column width", () => {
	// the nested line establishes "\t" as one level in; a later line at the same
	// visual depth but spelled as two spaces doesn't share that prefix, so it's
	// flagged even though a naive column-width count might treat both as "1 level in"
	assert.throws(() => tokenize("function f():\n\treturn 1\n  return 2\n"), LexError);
});

test("operators tokenize distinctly", () => {
	const tokens = tokenize("a == b != c && d || !e\n");
	const types = tokens.map((t) => t.type).filter((t) => t !== "IDENT" && t !== "NEWLINE" && t !== "EOF");
	assert.deepEqual(types, ["EQEQ", "NEQ", "ANDAND", "OROR", "BANG"]);
});

test("a template string splits into text and expr segments", () => {
	const tokens = tokenize("x = `hello ${name}, you are ${age} years old`\n");
	const tmpl = tokens.find((t) => t.type === "TEMPLATE_STRING")!;
	assert.deepEqual(
		tmpl.segments!.map((s) => (s.kind === "text" ? s.value : `expr:${s.raw}`)),
		["hello ", "expr:name", ", you are ", "expr:age", " years old"],
	);
});

test("a template string with no interpolation has a single text segment", () => {
	const tokens = tokenize("x = `plain text`\n");
	const tmpl = tokens.find((t) => t.type === "TEMPLATE_STRING")!;
	assert.deepEqual(tmpl.segments, [{ kind: "text", value: "plain text" }]);
});

test("an unterminated template string raises a LexError", () => {
	assert.throws(() => tokenize("x = `unterminated\n"), LexError);
});
