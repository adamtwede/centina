import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, extname, resolve } from "node:path";
import { ExternalDecl, ExternalSymbolKind, Program } from "./ast.js";
import { Diagnostic } from "./checker.js";

const JS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PY_EXTENSIONS = new Set([".py"]);

interface FoundSymbol {
	/** "unknown" = found via a re-export-style match where the real kind can't be determined. */
	kind: ExternalSymbolKind | "unknown";
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLocalPath(path: string): boolean {
	return path.startsWith(".") || isAbsolute(path);
}

function findInJsTs(source: string, realName: string): FoundSymbol | undefined {
	const name = escapeRegExp(realName);
	if (new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?function\\s*\\*?\\s*${name}\\b`).test(source)) {
		return { kind: "function" };
	}
	if (
		new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(?:async\\s*)?\\(`).test(source) ||
		new RegExp(`export\\s+const\\s+${name}\\s*=\\s*function\\b`).test(source)
	) {
		return { kind: "function" };
	}
	if (new RegExp(`export\\s+(?:default\\s+)?(?:abstract\\s+)?(?:type|interface|class)\\s+${name}\\b`).test(source)) {
		return { kind: "type" };
	}
	if (new RegExp(`export\\s+(?:const|let|var)\\s+${name}\\b`).test(source)) {
		return { kind: "object" };
	}
	if (new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(source)) {
		return { kind: "unknown" };
	}
	return undefined;
}

function findInPython(source: string, realName: string): FoundSymbol | undefined {
	const name = escapeRegExp(realName);
	if (new RegExp(`^\\s*def\\s+${name}\\b`, "m").test(source)) return { kind: "function" };
	if (new RegExp(`^\\s*class\\s+${name}\\b`, "m").test(source)) return { kind: "type" };
	if (new RegExp(`^${name}\\s*=`, "m").test(source)) return { kind: "object" };
	return undefined;
}

/**
 * Best-effort, regex-based verification of `external` declarations against
 * real files on disk. Deliberately not a real parser, so it can miss
 * legitimate export patterns (barrel re-exports, decorators, unusual
 * formatting) — every non-match is a warning, never an error. Bare library
 * specifiers (anything that isn't a relative/absolute file path) are never
 * resolved at all: that needs real module resolution (node_modules /
 * installed packages), which is out of scope for this heuristic pass.
 *
 * Kept separate from `check()` so the core checker stays filesystem-free and
 * trivially testable from raw source strings.
 */
export function resolveExternals(program: Program, baseDir: string): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	for (const ext of program.externals) {
		diagnostics.push(...verifyOne(ext, baseDir));
	}

	return diagnostics;
}

function verifyOne(ext: ExternalDecl, baseDir: string): Diagnostic[] {
	if (!isLocalPath(ext.path)) {
		return [
			{
				severity: "warning",
				message: `external symbol '${ext.realName}' references library '${ext.path}', which isn't a local file path — only symbols in files within the project are verified, not installed packages`,
				line: ext.line,
			},
		];
	}

	const absPath = isAbsolute(ext.path) ? ext.path : resolve(baseDir, ext.path);
	if (!existsSync(absPath)) {
		return [
			{
				severity: "warning",
				message: `could not find '${ext.path}' to verify external symbol '${ext.realName}'`,
				line: ext.line,
			},
		];
	}

	const extension = extname(absPath);
	let source: string;
	try {
		source = readFileSync(absPath, "utf8");
	} catch {
		return [
			{
				severity: "warning",
				message: `could not read '${ext.path}' to verify external symbol '${ext.realName}'`,
				line: ext.line,
			},
		];
	}

	let found: FoundSymbol | undefined;
	if (JS_EXTENSIONS.has(extension)) {
		found = findInJsTs(source, ext.realName);
	} else if (PY_EXTENSIONS.has(extension)) {
		found = findInPython(source, ext.realName);
	} else {
		return [
			{
				severity: "warning",
				message: `'${ext.path}' has an unrecognized file type — only ECMAScript and Python sources can be verified right now, so '${ext.realName}' is unverified`,
				line: ext.line,
			},
		];
	}

	if (!found) {
		return [
			{
				severity: "warning",
				message: `could not find a plausible export of '${ext.realName}' in '${ext.path}'`,
				line: ext.line,
			},
		];
	}

	if (found.kind !== "unknown" && found.kind !== ext.symbolKind) {
		return [
			{
				severity: "warning",
				message: `'${ext.realName}' is declared as external '${ext.symbolKind}', but looks like a '${found.kind}' export in '${ext.path}'`,
				line: ext.line,
			},
		];
	}

	return [];
}
