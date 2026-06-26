import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticsFor, errorsOf, warningsOf } from "./helpers.js";

test("flags a reference to an undefined identifier", () => {
	const diags = diagnosticsFor("function f() -> Unspecified:\n\treturn unknown_name\n");
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /not defined in this scope/);
});

test("does not flag a defined identifier", () => {
	const diags = diagnosticsFor("function f(x) -> Unspecified:\n\treturn x\n");
	assert.equal(errorsOf(diags).length, 0);
});

test("flags a nominal type mismatch on a function argument", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction g(s: Step) -> Step:\n\treturn s\nfunction f():\n\tg(\"hello\")\n",
	);
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /expected 'Step', got 'String'/);
});

test("does not flag matching nominal types", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction g(s: Step) -> Step:\n\treturn s\nfunction f(s: Step):\n\tg(s)\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("an Agent.prompt() result is Unspecified and cannot flow into a typed slot without a cast", () => {
	const diags = diagnosticsFor(
		[
			"type Step",
			"function g(s: Step) -> Step:",
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
			"function g(s: Step) -> Step:",
			"\treturn s",
			"function f(agent: Agent):",
			'\tg(agent.prompt("hi") as Step)',
			"",
		].join("\n"),
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("a concrete value may flow into an Unspecified-typed slot with no cast required", () => {
	const diags = diagnosticsFor("function f(x: Unspecified) -> Unspecified:\n\treturn x\nfunction g():\n\tf(\"hello\")\n");
	assert.equal(errorsOf(diags).length, 0);
});

test("match over an enum requires every member to be handled", () => {
	const diags = diagnosticsFor(
		[
			"enum Verdict = A | B | C",
			"function f(v: Verdict) -> Number:",
			"\tmatch v:",
			"\t\tcase A:",
			"\t\t\treturn 1",
			"\treturn 0",
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
			"function f(v: Verdict) -> Number:",
			"\tmatch v:",
			"\t\tcase A:",
			"\t\t\treturn 1",
			"\t\tcase B:",
			"\t\t\treturn 2",
			"\treturn 0",
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
			"function f(agent: Agent) -> Number:",
			'\tmatch agent.prompt("hi"):',
			"\t\tcase A:",
			"\t\t\treturn 1",
			"\treturn 0",
			"",
		].join("\n"),
	);
	assert.equal(errorsOf(diags).length, 0);
	assert.ok(warningsOf(diags).some((w) => /cast it to an enum type/.test(w.message)));
});

test("a function body that is only @agent comments is treated as an intentional stub, not flagged", () => {
	const diags = diagnosticsFor("function f():\n\t# @agent: figure this out later\n");
	assert.equal(diags.length, 0);
});

test("undeclared dot-notation property access is never flagged", () => {
	const diags = diagnosticsFor('function f(agent: Agent) -> Unspecified:\n\treturn agent.some_made_up_property\n');
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
	const diags = diagnosticsFor("function f() -> Bool:\n\treturn human_intervened()\n");
	assert.equal(errorsOf(diags).length, 0);
});

test("a template string types as String and satisfies a String-typed slot", () => {
	const diags = diagnosticsFor('function f(name: String) -> String:\n\tgreeting: String = `hello ${name}`\n\treturn greeting\n');
	assert.equal(errorsOf(diags).length, 0);
});

test("an undefined identifier inside a template expression is still flagged", () => {
	const diags = diagnosticsFor("function f():\n\treturn `value is ${unknown_name}`\n");
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /not defined in this scope/.test(e.message)));
});

test("accessing a property directly on an Unspecified-typed param warns", () => {
	const diags = diagnosticsFor("function f(x) -> Unspecified:\n\treturn x.foo\n");
	assert.equal(errorsOf(diags).length, 0);
	const warnings = warningsOf(diags);
	assert.ok(warnings.some((w) => /accessed on a value of type 'Unspecified'/.test(w.message)));
});

test("accessing a property on an uncast Agent.prompt() result warns", () => {
	const diags = diagnosticsFor(
		"function f(a: Agent):\n\treturn a.prompt(\"hi\").foo\n",
	);
	const warnings = warningsOf(diags);
	assert.ok(warnings.some((w) => /accessed on a value of type 'Unspecified'/.test(w.message)));
});

test("chained dynamic property access on a named type is not re-flagged as Unspecified", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction f(a: Agent):\n\treturn a.spec.nested\n",
	);
	const warnings = warningsOf(diags);
	assert.ok(!warnings.some((w) => /accessed on a value of type 'Unspecified'/.test(w.message)));
});

test("a misspelled property close to a far more common one is flagged as a likely typo", () => {
	const diags = diagnosticsFor(
		"function f(a: Agent):\n\tx = a.specification\n\ty = a.specification\n\tz = a.specification\n\tw = a.spexification\n",
	);
	const warnings = warningsOf(diags);
	assert.ok(warnings.some((w) => /'\.spexification'.*close to '\.specification'/.test(w.message)));
});

test("two equally common property spellings are not flagged against each other", () => {
	const diags = diagnosticsFor(
		"function f(a: Agent):\n\tx = a.spec\n\ty = a.specs\n",
	);
	const warnings = warningsOf(diags);
	assert.ok(!warnings.some((w) => /possible typo/.test(w.message)));
});

test("an ad-hoc method call on a custom-typed value is fine descriptively, uncast", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction f(s: Step):\n\ts.do_something(\"with a string\")\n\treturn\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("casting the result of an ad-hoc method call to a concrete type is an error, not just a warning", () => {
	const diags = diagnosticsFor(
		'type Step\nfunction f(s: Step):\n\treturn s.new("another step") as Step\n',
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot cast the result of an undeclared method call to 'Step'/.test(e.message)));
});

test("casting the result of an ad-hoc method call to an array type is also an error", () => {
	const diags = diagnosticsFor(
		'type Step\nfunction f(s: Step):\n\treturn s.new("another step") as Step[]\n',
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot cast the result of an undeclared method call/.test(e.message)));
});

test("calling Agent.prompt()/.review() stays the privileged path and may still be cast", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction f(a: Agent) -> Step:\n\treturn a.prompt(\"hi\") as Step\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("calling an undeclared method on an Agent itself (not .prompt/.review) is not the privileged path either", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction f(a: Agent):\n\treturn a.some_other_method(\"hi\") as Step\n",
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot cast the result of an undeclared method call to 'Step'/.test(e.message)));
});

test("an external type alias resolves to Unknown and requires a cast into a concrete slot", () => {
	const diags = diagnosticsFor(
		'external type Step from "src/models.ts"\nfunction f(s: Step):\n\tx: String = s\n',
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /expected 'String', got 'Unknown'/.test(e.message)));
});

test("casting an Unknown value to a concrete type warns about the unverified assumption", () => {
	const diags = diagnosticsFor(
		'external type Step from "src/models.ts"\nfunction f(s: Step):\n\treturn s as String\n',
	);
	const warnings = warningsOf(diags);
	assert.ok(warnings.some((w) => /external type 'Unknown' to 'String'.*hasn't been verified/.test(w.message)));
});

test("property access on an Unknown value is not flagged, unlike Unspecified", () => {
	const diags = diagnosticsFor(
		'external type Step from "src/models.ts"\nfunction f(s: Step):\n\treturn s.title\n',
	);
	const warnings = warningsOf(diags);
	assert.ok(!warnings.some((w) => /accessed on a value of type/.test(w.message)));
});

test("an external function call returns Unknown regardless of argument count", () => {
	const diags = diagnosticsFor(
		'external function debounce from "lodash"\nfunction f() -> Unknown:\n\treturn debounce(1, 2, 3)\n',
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("an external object is a global binding typed Unknown", () => {
	const diags = diagnosticsFor('external object lodash from "lodash"\nfunction f() -> Unknown:\n\treturn lodash.debounce(1)\n');
	assert.equal(errorsOf(diags).length, 0);
});

test("an external symbol name colliding with an existing declaration is an error", () => {
	const diags = diagnosticsFor('type Step\nexternal type Step from "src/models.ts"\n');
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /'Step' is already declared/.test(e.message)));
});

test("a `renamed` clause lets the AISL-facing alias differ from the real symbol name", () => {
	const program_diags = diagnosticsFor(
		'external renamed type ModelStep from "src/models.ts" was Step\nfunction f(s: ModelStep) -> ModelStep:\n\treturn s\n',
	);
	assert.equal(errorsOf(program_diags).length, 0);
});

// ---- built-in type names are reserved and cannot be redefined ----

for (const name of ["Agent", "Unspecified", "Unknown", "Unprivileged"]) {
	test(`redefining the built-in type '${name}' is an error`, () => {
		const diags = diagnosticsFor(`type ${name}\n`);
		const errors = errorsOf(diags);
		assert.ok(
			errors.some((e) => e.message === `cannot redefine built-in type '${name}'`),
			`expected a "cannot redefine built-in type '${name}'" error, got: ${JSON.stringify(errors)}`,
		);
	});
}

test("a redefinition error for a built-in is distinct from a duplicate user-type error", () => {
	const diags = diagnosticsFor("type Step\ntype Step\n");
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /'Step' is already declared/.test(e.message)));
	assert.ok(!errors.some((e) => /redefine built-in/.test(e.message)));
});

// ---- cast target restrictions ----

test("casting any value to the built-in Agent type is an error", () => {
	const diags = diagnosticsFor(
		'function f(a: Agent):\n\treturn a.prompt("hi") as Agent\n',
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot cast to built-in type 'Agent'/.test(e.message)));
});

test("casting an Unspecified value to Unknown is an error (the two are not interchangeable)", () => {
	const diags = diagnosticsFor(
		'function f(a: Agent):\n\tx = a.prompt("hi") as Unknown\n',
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot cast between 'Unspecified' and 'Unknown'/.test(e.message)));
});

test("casting an Unknown value to Unspecified is also an error", () => {
	const diags = diagnosticsFor(
		'external type Step from "src/models.ts"\nfunction f(s: Step):\n\tx = s as Unspecified\n',
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot cast between 'Unspecified' and 'Unknown'/.test(e.message)));
});

test("a redundant cast of an Unspecified value to Unspecified is allowed", () => {
	const diags = diagnosticsFor(
		'function f(a: Agent):\n\tx = a.prompt("hi") as Unspecified\n',
	);
	assert.equal(errorsOf(diags).length, 0);
});

// ---- Unspecified and Unknown are not interchangeable across assignment/return ----

test("returning an external (Unknown) value from an explicit `-> Unspecified` function is an error", () => {
	const diags = diagnosticsFor(
		'external function decompose from "./models.ts"\nfunction f() -> Unspecified:\n\treturn decompose()\n',
	);
	const errors = errorsOf(diags);
	assert.ok(
		errors.some((e) => /expected 'Unspecified', got 'Unknown'/.test(e.message)),
		JSON.stringify(errors),
	);
});

test("returning a concrete value from a `-> Unknown` function is an error (Unknown's only source is an external reference)", () => {
	const diags = diagnosticsFor(
		'function f() -> Unknown:\n\treturn "hi"\n',
	);
	const errors = errorsOf(diags);
	assert.ok(
		errors.some((e) => /expected 'Unknown', got 'String'/.test(e.message)),
		JSON.stringify(errors),
	);
});

test("returning an Unspecified value from a `-> Unknown` function is an error", () => {
	const diags = diagnosticsFor(
		'function f(a: Agent) -> Unknown:\n\treturn a.prompt("hi")\n',
	);
	const errors = errorsOf(diags);
	assert.ok(
		errors.some((e) => /expected 'Unknown', got 'Unspecified'/.test(e.message)),
		JSON.stringify(errors),
	);
});

test("returning an external (Unknown) value from an Unknown-typed slot is fine", () => {
	const diags = diagnosticsFor(
		'external function decompose from "./models.ts"\nfunction f() -> Unknown:\n\treturn decompose()\n',
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("returning a value from an un-annotated function is an error, regardless of the value's type", () => {
	const diags = diagnosticsFor(
		'external type Step from "./models.ts"\nfunction f(s: Step):\n\treturn s\n',
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /has no declared return type, so 'return <value>' is not allowed/.test(e.message)));
});

test("a bare `return` with no value is allowed in an un-annotated function", () => {
	const diags = diagnosticsFor(
		'function f(x: Bool):\n\tif x:\n\t\treturn\n\treturn\n',
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("passing an external (Unknown) value into an Unspecified-typed parameter is an error", () => {
	const diags = diagnosticsFor(
		[
			'external function decompose from "./models.ts"',
			"function f(x: Unspecified):",
			"\treturn x",
			"function g():",
			"\tf(decompose())",
		].join("\n"),
	);
	const errors = errorsOf(diags);
	assert.ok(
		errors.some((e) => /expected 'Unspecified', got 'Unknown'/.test(e.message)),
		JSON.stringify(errors),
	);
});

// ---- Unprivileged is internal-only and cannot be written in source ----

test("using 'Unprivileged' as a cast target is an error", () => {
	const diags = diagnosticsFor(
		'function f(a: Agent):\n\tx = a.prompt("hi") as Unprivileged\n',
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /'Unprivileged' cannot be written in source/.test(e.message)));
});

test("using 'Unprivileged' as a function return type is an error", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction f(s: Step) -> Unprivileged:\n\treturn s\n",
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /'Unprivileged' cannot be written in source/.test(e.message)));
});

test("using 'Unprivileged' as a parameter annotation is an error", () => {
	const diags = diagnosticsFor("function f(x: Unprivileged):\n\treturn x\n");
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /'Unprivileged' cannot be written in source/.test(e.message)));
});

// ---- an Unprivileged value may not be stored or returned ----

test("binding the result of an ad-hoc method call to a variable is an error, with a clear message", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction f(s: Step):\n\tx = s.whatever()\n\treturn\n",
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot bind the result of an undeclared method call to 'x'/.test(e.message)));
	// Regression: the old inference path produced a nonsensical self-mismatch.
	assert.ok(!errors.some((e) => /expected 'Unprivileged', got 'Unprivileged'/.test(e.message)));
});

test("returning the result of an ad-hoc method call is an error, even into a concrete return type", () => {
	const diags = diagnosticsFor(
		"type Step\nfunction f(s: Step) -> Step:\n\treturn s.whatever()\n",
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot return the result of an undeclared method call from 'f'/.test(e.message)));
});

// ---- a declared `-> T` must end the function body with a `return`, and a bare function may not return a value ----

test("returning a value from a function with no declared return type is an error", () => {
	const diags = diagnosticsFor("function f():\n\treturn \"hi\"\n");
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /'f' has no declared return type, so 'return <value>' is not allowed/.test(e.message)));
});

test("a bare `return` with no value is fine in a function with no declared return type", () => {
	const diags = diagnosticsFor("function f():\n\treturn\n");
	assert.equal(errorsOf(diags).length, 0);
});

test("a value returned from a function with no declared return type is still checked for other errors (e.g. undefined identifiers)", () => {
	const diags = diagnosticsFor("function f():\n\treturn unknown_name\n");
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /not defined in this scope/.test(e.message)));
});

test("a function with a declared return type whose body does not end in 'return' is an error", () => {
	const diags = diagnosticsFor('function f() -> String:\n\tx: String = "hi"\n');
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /'f' declares return type 'String' but its body does not end in a 'return' statement/.test(e.message)));
});

test("a function with a declared return type whose last statement is 'return' is fine", () => {
	const diags = diagnosticsFor('function f() -> String:\n\treturn "hi"\n');
	assert.equal(errorsOf(diags).length, 0);
});

test("a function with a declared return type ending in an `if` (even if every branch returns) is flagged, since the check is literal/syntactic, not full reachability analysis", () => {
	const diags = diagnosticsFor(
		[
			"function f(x: Bool) -> String:",
			"\tif x:",
			'\t\treturn "yes"',
			"\telse:",
			'\t\treturn "no"',
			"",
		].join("\n"),
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /does not end in a 'return' statement/.test(e.message)));
});

test("a function body consisting solely of @agent comments is exempt from the must-end-in-return rule", () => {
	const diags = diagnosticsFor("function f() -> String:\n\t# @agent: figure this out later\n");
	assert.equal(diags.length, 0);
});

test("casting an Unprivileged value to Unspecified or Unknown is an error (no laundering escape)", () => {
	for (const target of ["Unspecified", "Unknown"]) {
		const diags = diagnosticsFor(
			`type Step\nfunction f(s: Step):\n\tx = s.whatever() as ${target}\n\treturn\n`,
		);
		const errors = errorsOf(diags);
		assert.ok(
			errors.some((e) => /cannot cast the result of an undeclared method call/.test(e.message)),
			`expected a cast-from-unprivileged error for target ${target}, got: ${JSON.stringify(errors)}`,
		);
	}
});

// ---- obj.prop vs obj.fn() distinction ----

test("bare property access on a named local type types as Unspecified, not the named type", () => {
	// The property read describes "a data attribute that exists on the object"
	// — its type is unknown/dynamic (Unspecified), not the object's own type.
	const diags = diagnosticsFor(
		"type Foo\ntype Bar\nfunction f(x: Foo) -> Bar:\n\treturn x.kind as Bar\n",
	);
	// cast from Unspecified to Bar: should be accepted silently (Unspecified is
	// the intentional escape hatch, unlike Unknown whose casts warn)
	assert.equal(errorsOf(diags).length, 0);
	assert.equal(warningsOf(diags).length, 0);
});

test("bare property access enables cast-and-match flow that method call blocks", () => {
	// obj.prop as Enum + match — valid when the property is described as a
	// discriminant; the equivalent obj.prop() would be Unprivileged and block the cast.
	const diags = diagnosticsFor([
		"enum Kind = A | B | C",
		"type Foo",
		"type Bar",
		"function f(x: Foo) -> Bar:",
		"\tmatch x.kind as Kind:",
		"\t\tcase A:",
		"\t\t\treturn \"x\" as Bar",
		"\t\tcase B:",
		"\t\t\treturn \"y\" as Bar",
		"\t\tcase C:",
		"\t\t\treturn \"z\" as Bar",
		"\treturn \"\" as Bar",
	].join("\n"),
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("method call on local named type is Unprivileged; cast to concrete type is an error with a helpful hint", () => {
	const diags = diagnosticsFor(
		"type Foo\ntype Bar\nfunction f(x: Foo):\n\tx.kind() as Bar\n",
	);
	const errors = errorsOf(diags);
	assert.ok(errors.some((e) => /cannot cast the result of an undeclared method call/.test(e.message)));
	// Hint should point toward bare property access
	assert.ok(errors.some((e) => /bare property access.*without the/.test(e.message)));
});

test("keyword used as property name is valid (e.g. obj.type, obj.function)", () => {
	// Keywords are allowed after '.' in property/method position.
	const diags = diagnosticsFor(
		"type Foo\nfunction f(x: Foo):\n\ty = x.type\n\tz = x.function\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("keyword used as method name is valid (e.g. obj.type())", () => {
	const diags = diagnosticsFor(
		"type Foo\nfunction f(x: Foo):\n\tx.type()\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

// Equality and implied-bool conditions are intentionally unconstrained by type.
// These document that Unprivileged/Unspecified in condition position is valid
// AISL — describing when a branch fires is not "manufacturing" a concrete value.

test("equality comparison between two Unprivileged method-call results is allowed", () => {
	const diags = diagnosticsFor(
		"type Foo\nfunction f(a: Foo, b: Foo) -> Bool:\n\treturn a.kind() == b.kind()\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("bare property access used as implied-true condition is allowed", () => {
	const diags = diagnosticsFor(
		"type Foo\nfunction f(x: Foo):\n\tif x.ready:\n\t\tx.run()\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("method call used as implied-true condition is allowed", () => {
	const diags = diagnosticsFor(
		"type Foo\nfunction f(x: Foo):\n\tif x.is_ready():\n\t\tx.run()\n",
	);
	assert.equal(errorsOf(diags).length, 0);
});

test("negated implied-bool condition with ! is allowed for both prop and call", () => {
	const diags = diagnosticsFor([
		"type Foo",
		"function f(x: Foo):",
		"\tif !x.ready:",
		"\t\tx.skip()",
		"\tif !x.is_ready():",
		"\t\tx.skip()",
	].join("\n"),
	);
	assert.equal(errorsOf(diags).length, 0);
});
