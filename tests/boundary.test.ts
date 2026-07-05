import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticsFor, errorsOf, warningsOf } from "./helpers.js";

// ---- clean declarations ----

test("a datasource with only returning doors has no diagnostics", () => {
	const diags = diagnosticsFor(
		`datasource GoogleSearch(url: String):
\tsearch(term: String) -> String
`);
	assert.equal(errorsOf(diags).length, 0);
	assert.equal(warningsOf(diags).length, 0);
});

test("a datasink with only void doors has no diagnostics", () => {
	const diags = diagnosticsFor(
		`datasink LogFile(path: String):
\twrite(line: String)
`);
	assert.equal(errorsOf(diags).length, 0);
	assert.equal(warningsOf(diags).length, 0);
});

test("a boundary with mixed doors has no diagnostics", () => {
	const diags = diagnosticsFor(
		`type Markdown
boundary EditableDoc(path: String):
\tread() -> Markdown
\twrite(content: Markdown)
`);
	assert.equal(errorsOf(diags).length, 0);
	assert.equal(warningsOf(diags).length, 0);
});

// ---- direction enforcement ----

test("a void door on a datasource is an error", () => {
	const diags = diagnosticsFor(
		`datasource LogFile(path: String):
\twrite(line: String)
`);
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /datasource/);
	assert.match(errors[0].message, /read-only/);
});

test("a returning door on a datasink is an error", () => {
	const diags = diagnosticsFor(
		`datasink GoogleSearch(url: String):
\tsearch(term: String) -> String
`);
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /datasink/);
	assert.match(errors[0].message, /write-only/);
});

// ---- constructor and instance ----

test("a boundary instance is constructed without diagnostics", () => {
	const diags = diagnosticsFor(
		`datasource GoogleSearch(url: String):
\tsearch(term: String) -> String
google = GoogleSearch("https://google.com")
`);
	assert.equal(errorsOf(diags).length, 0);
});

test("boundary constructor arity mismatch is an error", () => {
	const diags = diagnosticsFor(
		`datasource GoogleSearch(url: String):
\tsearch(term: String) -> String
google = GoogleSearch("a", "b")
`);
	const errors = errorsOf(diags);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /expects 1 argument/);
});

// ---- door calls ----

test("a declared door call result flows into a typed binding without a cast", () => {
	const diags = diagnosticsFor(
		`type SearchResult
datasource GoogleSearch(url: String):
\tsearch(term: String) -> SearchResult
google = GoogleSearch("https://google.com")
function f() -> SearchResult:
\tresult = google.search("aisl")
\treturn result
`);
	assert.equal(errorsOf(diags).length, 0);
});

test("an undeclared door call on a boundary instance is an error", () => {
	const diags = diagnosticsFor(
		`datasource GoogleSearch(url: String):
\tsearch(term: String) -> String
google = GoogleSearch("https://google.com")
function f():
\tx = google.fetch_all()
`);
	const errors = errorsOf(diags);
	const doorError = errors.find((e) => /not a declared door/.test(e.message));
	assert.ok(doorError, "expected 'not a declared door' error");
});

test("binding a void door call result to a variable is an error", () => {
	const diags = diagnosticsFor(
		`datasink LogFile(path: String):
\twrite(line: String)
log = LogFile("out.log")
function f():
\tx = log.write("hello")
`);
	const errors = errorsOf(diags);
	const voidError = errors.find((e) => /returns nothing/.test(e.message));
	assert.ok(voidError, "expected 'returns nothing' error");
});

test("a void door call used as a statement (not bound) is fine", () => {
	const diags = diagnosticsFor(
		`datasink LogFile(path: String):
\twrite(line: String)
log = LogFile("out.log")
function f():
\tlog.write("hello")
`);
	assert.equal(errorsOf(diags).length, 0);
});

// ---- role narrowing ----

test("datasource-narrowed boundary instance parses and checks with no diagnostics", () => {
	const diags = diagnosticsFor(
		`boundary Container(widgetType: String):
\tadd_widget(widget: Widget)
\tget_widgets() -> Widget[]
\tremove_widget() -> Widget
datasource containerX = Container("WidgetX")
`);
	assert.equal(errorsOf(diags).length, 0);
});

test("datasink-narrowed boundary instance parses and checks with no diagnostics", () => {
	const diags = diagnosticsFor(
		`boundary Container(widgetType: String):
\tadd_widget(widget: Widget)
\tget_widgets() -> Widget[]
\tremove_widget() -> Widget
datasink containerY = Container("WidgetY")
`);
	assert.equal(errorsOf(diags).length, 0);
});

test("calling a void door on a datasource-narrowed instance is an error", () => {
	const diags = diagnosticsFor(
		`boundary Container(widgetType: String):
\tadd_widget(widget: Widget)
\tget_widgets() -> Widget[]
datasource containerX = Container("WidgetX")
function f():
\tcontainerX.add_widget("w")
`);
	const errors = errorsOf(diags);
	const err = errors.find((e) => /void door.*datasource.*narrowed/.test(e.message));
	assert.ok(err, "expected void-door-on-datasource error");
});

test("calling a returning door on a datasink-narrowed instance is an error", () => {
	const diags = diagnosticsFor(
		`boundary Container(widgetType: String):
\tadd_widget(widget: Widget)
\tget_widgets() -> Widget[]
datasink containerY = Container("WidgetY")
function f():
\tresult = containerY.get_widgets()
`);
	const errors = errorsOf(diags);
	const err = errors.find((e) => /returning door.*datasink.*narrowed/.test(e.message));
	assert.ok(err, "expected returning-door-on-datasink error");
});

test("calling a returning door on a datasource-narrowed instance is fine", () => {
	const diags = diagnosticsFor(
		`boundary Container(widgetType: String):
\tadd_widget(widget: Widget)
\tget_widgets() -> Widget[]
datasource containerX = Container("WidgetX")
function f():
\tresult = containerX.get_widgets()
`);
	assert.equal(errorsOf(diags).length, 0);
});

test("calling a void door on a datasink-narrowed instance is fine", () => {
	const diags = diagnosticsFor(
		`boundary Container(widgetType: String):
\tadd_widget(widget: Widget)
\tget_widgets() -> Widget[]
datasink containerY = Container("WidgetY")
function f():
\tcontainerY.add_widget("w")
`);
	assert.equal(errorsOf(diags).length, 0);
});

test("narrowing annotation on a datasource kind (not boundary) is an error", () => {
	const diags = diagnosticsFor(
		`datasource GoogleSearch(url: String):
\tsearch(term: String) -> String
datasource narrowed = GoogleSearch("https://google.com")
`);
	const errors = errorsOf(diags);
	const err = errors.find((e) => /requires a 'boundary' kind/.test(e.message));
	assert.ok(err, "expected 'requires a boundary kind' error");
});

test("narrowing annotation on a datasink kind (not boundary) is an error", () => {
	const diags = diagnosticsFor(
		`datasink LogFile(path: String):
\twrite(line: String)
datasink narrowed = LogFile("out.log")
`);
	const errors = errorsOf(diags);
	const err = errors.find((e) => /requires a 'boundary' kind/.test(e.message));
	assert.ok(err, "expected 'requires a boundary kind' error");
});
