import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { check, Diagnostic } from "./checker.js";
import {
	EnumDecl,
	ExternalDecl,
	ExternalSymbolKind,
	FunctionDecl,
	GlobalVarDecl,
	Program,
	TypeDecl,
} from "./ast.js";

/** "external" here means "found only as another `external ... from ...` entry in the target file" — a forwarding chain, never injected directly (see below). */
type NativeKind = "enum" | "type" | "function" | "global" | "external";
type InjectableKind = "enum" | "type" | "function" | "global";
type NativeDecl = EnumDecl | TypeDecl | FunctionDecl | GlobalVarDecl | ExternalDecl;

interface LoadedFile {
	program: Program;
	hasErrors: boolean;
	dir: string;
}

/** Keyed by absolute path, so the same target file is only parsed/checked once per `aisl-check` run even if several externals point at it. */
const fileCache = new Map<string, LoadedFile>();

function loadFile(absPath: string): LoadedFile {
	const cached = fileCache.get(absPath);
	if (cached) return cached;
	const program = parse(tokenize(readFileSync(absPath, "utf8")));
	const hasErrors = check(program).some((d) => d.severity === "error");
	const loaded: LoadedFile = { program, hasErrors, dir: dirname(absPath) };
	fileCache.set(absPath, loaded);
	return loaded;
}

function isAislTarget(path: string): boolean {
	return path.toLowerCase().endsWith(".aisl");
}

/** Looks for `name` among the target file's own declarations, across every namespace, including its own `external` entries (which signal a forwarding chain rather than a real declaration). */
function findNative(program: Program, name: string): { decl: NativeDecl; nativeKind: NativeKind } | undefined {
	const e = program.enums.find((d) => d.name === name);
	if (e) return { decl: e, nativeKind: "enum" };
	const t = program.types.find((d) => d.name === name);
	if (t) return { decl: t, nativeKind: "type" };
	const f = program.functions.find((d) => d.name === name);
	if (f) return { decl: f, nativeKind: "function" };
	const g = program.globals.find((d) => d.name === name);
	if (g) return { decl: g, nativeKind: "global" };
	const ext = program.externals.find((d) => d.name === name);
	if (ext) return { decl: ext, nativeKind: "external" };
	return undefined;
}

/** Whether the declared `external` kind keyword matches what the target file actually declares. An enum is an acceptable match for the `type` keyword, since both are used as types in this document. */
function symbolKindMatches(declared: ExternalSymbolKind, native: InjectableKind): boolean {
	if (declared === "type") return native === "type" || native === "enum";
	if (declared === "function") return native === "function";
	return native === "global";
}

function nativeKindLabel(k: InjectableKind): string {
	return k === "global" ? "object" : k;
}

function cloneAs(decl: NativeDecl, alias: string): NativeDecl {
	return { ...decl, name: alias } as NativeDecl;
}

function inject(program: Program, alias: string, decl: NativeDecl, nativeKind: InjectableKind): void {
	const cloned = cloneAs(decl, alias);
	switch (nativeKind) {
		case "enum":
			program.enums.push(cloned as EnumDecl);
			return;
		case "type":
			program.types.push(cloned as TypeDecl);
			return;
		case "function":
			program.functions.push(cloned as FunctionDecl);
			return;
		case "global":
			program.globals.push(cloned as GlobalVarDecl);
			return;
	}
}

function collectDeclaredNames(program: Program): Set<string> {
	const names = new Set<string>();
	for (const d of program.enums) names.add(d.name);
	for (const d of program.types) names.add(d.name);
	for (const d of program.functions) names.add(d.name);
	for (const d of program.globals) names.add(d.name);
	for (const d of program.externals) names.add(d.name);
	return names;
}

/**
 * Resolves `external` declarations whose path targets another local `.aisl`
 * file (as opposed to real code or a library specifier, see
 * resolveExternals.ts): the symbol is treated as though it were declared
 * natively in this document — full nominal typing, never `Unknown` — by
 * parsing and checking the target file, then splicing a renamed clone of its
 * real declaration into this program before `check()` runs on it.
 *
 * Deliberately single-hop and non-transitive: if the requested name is only
 * reachable in the target file via *another* `external` entry there, that's
 * an error pointing the human at the original source rather than silently
 * chasing the chain. One useful side effect of refusing to chase chains:
 * there's no real cycle-detection machinery needed here, since we never
 * recurse past one hop — A referencing B referencing A can't loop, it just
 * fails fast with a clear message the moment a chain (rather than a native
 * declaration) is found.
 *
 * Resolved (or failed) `.aisl`-targeted entries are removed from the
 * returned program's `externals` list; everything else (real-code/library
 * targets) passes through untouched for `resolveExternals.ts`'s heuristic
 * pass to handle after `check()` runs.
 *
 * Known limitation: only the requested declaration itself is cloned. If an
 * imported function's signature (or an imported global's type annotation)
 * references another custom type that isn't separately referenced, that type
 * won't resolve in the importing file — the human needs to reference it too.
 */
export function resolveLocalExternals(program: Program, baseDir: string): { program: Program; diagnostics: Diagnostic[] } {
	const diagnostics: Diagnostic[] = [];
	const aislExternals = program.externals.filter((e) => isAislTarget(e.path));
	const otherExternals = program.externals.filter((e) => !isAislTarget(e.path));

	const resolved: Program = {
		...program,
		enums: [...program.enums],
		types: [...program.types],
		functions: [...program.functions],
		globals: [...program.globals],
		externals: [...otherExternals],
	};

	const usedNames = collectDeclaredNames({ ...program, externals: otherExternals });

	for (const ext of aislExternals) {
		if (usedNames.has(ext.name)) {
			diagnostics.push({ severity: "error", message: `'${ext.name}' is already declared`, line: ext.line });
			continue;
		}

		const absPath = isAbsolute(ext.path) ? ext.path : resolve(baseDir, ext.path);
		if (!existsSync(absPath)) {
			diagnostics.push({
				severity: "error",
				message: `could not find '${ext.path}' to resolve external symbol '${ext.name}'`,
				line: ext.line,
			});
			continue;
		}

		let loaded: LoadedFile;
		try {
			loaded = loadFile(absPath);
		} catch (e) {
			diagnostics.push({
				severity: "error",
				message: `failed to load '${ext.path}': ${(e as Error).message}`,
				line: ext.line,
			});
			continue;
		}

		if (loaded.hasErrors) {
			diagnostics.push({
				severity: "error",
				message: `errors in '${ext.path}' must be resolved before symbols can be referenced`,
				line: ext.line,
			});
			continue;
		}

		const found = findNative(loaded.program, ext.realName);
		if (!found) {
			diagnostics.push({
				severity: "error",
				message: `could not find '${ext.realName}' declared in '${ext.path}'`,
				line: ext.line,
			});
			continue;
		}

		if (found.nativeKind === "external") {
			const target = found.decl as ExternalDecl;
			diagnostics.push({
				severity: "error",
				message: `'${ext.realName}' in '${ext.path}' is itself declared as external, pointing at '${target.path}' — reference '${target.path}' directly instead of chaining through '${ext.path}'`,
				line: ext.line,
			});
			continue;
		}

		if (!symbolKindMatches(ext.symbolKind, found.nativeKind)) {
			diagnostics.push({
				severity: "warning",
				message: `'${ext.realName}' is declared as external '${ext.symbolKind}', but '${ext.path}' declares it as a '${nativeKindLabel(found.nativeKind)}'`,
				line: ext.line,
			});
		}

		usedNames.add(ext.name);
		inject(resolved, ext.name, found.decl, found.nativeKind);
	}

	return { program: resolved, diagnostics };
}
