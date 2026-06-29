import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { check, Diagnostic, BUILTIN_TYPE_NAMES } from "./checker.js";
import {
  BoundaryDecl,
  EnumDecl,
  ExternalDecl,
  ExternalSymbolKind,
  FunctionDecl,
  GlobalVarDecl,
  Program,
  TypeDecl,
  TypeRef,
} from "./ast.js";

/** "external" here means "found only as another `external ... from ...` entry in the target file" — a forwarding chain, never injected directly (see below). */
type NativeKind = "enum" | "type" | "function" | "global" | "external" | "boundary";
type InjectableKind = "enum" | "type" | "function" | "global" | "boundary";
type NativeDecl =
  | EnumDecl
  | TypeDecl
  | FunctionDecl
  | GlobalVarDecl
  | ExternalDecl
  | BoundaryDecl;

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
function findNative(
  program: Program,
  name: string,
): { decl: NativeDecl; nativeKind: NativeKind } | undefined {
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
  const b = program.boundaries.find((d) => d.name === name);
  if (b) return { decl: b, nativeKind: "boundary" };
  return undefined;
}

/** Whether the declared `external` kind keyword matches what the target file actually declares. An enum is an acceptable match for the `type` keyword, since both are used as types in this document. */
function symbolKindMatches(
  declared: ExternalSymbolKind,
  native: InjectableKind,
): boolean {
  if (declared === "type") return native === "type" || native === "enum" || native === "boundary";
  if (declared === "function") return native === "function";
  return native === "global";
}

function nativeKindLabel(k: InjectableKind): string {
  return k === "global" ? "object" : k;
}

function cloneAs(decl: NativeDecl, alias: string): NativeDecl {
  return { ...decl, name: alias } as NativeDecl;
}

function inject(
  program: Program,
  alias: string,
  decl: NativeDecl,
  nativeKind: InjectableKind,
): void {
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
    case "boundary":
      program.boundaries.push(cloned as BoundaryDecl);
      return;
  }
}

function collectTypeRefNames(ref: TypeRef, into: Set<string>): void {
  if (ref.kind === "array") {
    collectTypeRefNames(ref.element, into);
    return;
  }
  into.add(ref.name);
}

/** Every named type a function's params/return type, or a global's annotation, references — the dependency set that must already be available in the importing document for the clone to type-check. */
function signatureTypeNames(
  decl: NativeDecl,
  nativeKind: InjectableKind,
): Set<string> {
  const names = new Set<string>();
  if (nativeKind === "function") {
    const fn = decl as FunctionDecl;
    for (const p of fn.params)
      if (p.typeAnnotation) collectTypeRefNames(p.typeAnnotation, names);
    if (fn.returnType) collectTypeRefNames(fn.returnType, names);
  } else if (nativeKind === "global") {
    const g = decl as GlobalVarDecl;
    if (g.typeAnnotation) collectTypeRefNames(g.typeAnnotation, names);
  }
  return names;
}

/**
 * Where a missing dependency type's `external` suggestion should actually
 * point. If `name` is only reachable in the immediate target via *another*
 * `external` entry there (a one-hop forward, e.g. `shared.aisl` itself says
 * `external type C from "./library.aisl"`), the suggestion must name the true
 * source (`library.aisl`) — recommending `external type C from "./shared.aisl"`
 * would just trade one missing-dependency error for the existing
 * forwarding-chain error. `target.path` is rebased from the target file's own
 * directory to the importer's `baseDir`, since the importer can't necessarily
 * reach it with the same relative path the target file used. Only one hop is
 * resolved, matching the rest of this module's single-hop policy — if that
 * hop is itself a further chain, the human hits the standard chain error when
 * they follow this suggestion, rather than this function chasing indefinitely.
 */
function resolveDependencySource(
  loadedProgram: Program,
  loadedDir: string,
  baseDir: string,
  immediatePath: string,
  name: string,
): { path: string; realName: string; nativeKind: string } {
  const found = findNative(loadedProgram, name);
  if (found && found.nativeKind === "external") {
    const target = found.decl as ExternalDecl;
    if (isAbsolute(target.path)) {
      return {
        path: target.path,
        realName: target.realName,
        nativeKind: found.nativeKind,
      };
    }
    // console.log("name1: ", name);
    const absPath = resolve(loadedDir, target.path);
    const rel = relative(baseDir, absPath);
    const path = rel.startsWith(".") ? rel : `./${rel}`;
    return { path, realName: target.realName, nativeKind: found.nativeKind };
  }
  return {
    path: immediatePath,
    realName: name,
    nativeKind: found ? found.nativeKind : "unknown",
  };
}

function collectDeclaredNames(program: Program): Set<string> {
  const names = new Set<string>();
  for (const d of program.enums) names.add(d.name);
  for (const d of program.types) names.add(d.name);
  for (const d of program.functions) names.add(d.name);
  for (const d of program.globals) names.add(d.name);
  for (const d of program.externals) names.add(d.name);
  for (const d of program.boundaries) names.add(d.name);
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
 * Only the requested declaration itself is cloned — a function's params/return
 * type or a global's annotation may reference another custom type that isn't
 * separately imported. Rather than chasing that transitively (which would
 * reopen the cycle-detection problem the single-hop design avoids, and raises
 * thorny questions about renamed imports), that case is detected up front and
 * reported as a single error listing the exact `external type ... from "..."`
 * line(s) needed, so the fix is copy-paste rather than guesswork. The
 * dependent entry is not injected in that case — its diagnostic stands alone;
 * any other diagnostics produced by call sites that can no longer find the
 * (un-injected) symbol are expected secondary fallout, not bugs.
 */
export function resolveLocalExternals(
  program: Program,
  baseDir: string,
): { program: Program; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  // assumed entries bypass all validation and resolution — they're Unknown stubs regardless of path or keyword.
  const assumedExternals = program.externals.filter((e) => e.assumed);
  const definedExternals = program.externals.filter((e) => !e.assumed);

  // Validate keyword/path consistency before routing.
  for (const e of definedExternals) {
    if (e.keyword === "external" && isAislTarget(e.path)) {
      diagnostics.push({
        severity: "error",
        message: `references to symbols in other AISL files must use the 'import' keyword`,
        line: e.line,
      });
    } else if (e.keyword === "import" && !isAislTarget(e.path)) {
      diagnostics.push({
        severity: "error",
        message: `references to symbols in real-code source files must use the 'external' keyword`,
        line: e.line,
      });
    }
  }

  // Valid routing: 'import' + .aisl path → resolve here; 'external' + non-.aisl → pass to resolveExternals.
  // Mismatched entries are already diagnosed above and excluded from both paths.
  const aislExternals = definedExternals.filter(
    (e) => e.keyword === "import" && isAislTarget(e.path),
  );
  const otherExternals = definedExternals.filter(
    (e) => e.keyword === "external" && !isAislTarget(e.path),
  );

  const resolved: Program = {
    ...program,
    enums: [...program.enums],
    types: [...program.types],
    functions: [...program.functions],
    globals: [...program.globals],
    externals: [...otherExternals, ...assumedExternals],
  };

  const usedNames = collectDeclaredNames({
    ...program,
    externals: [...otherExternals, ...assumedExternals],
  });
  /**
   * What a cloned signature's type references may resolve against: builtins,
   * everything already declared natively in this document, and the alias
   * name of every `.aisl` external requested here (even ones not yet
   * processed in loop order, and regardless of whether they themselves
   * succeed — a later failure on one of those gets its own diagnostic).
   */
  const availableTypeNames = new Set<string>([
    ...BUILTIN_TYPE_NAMES,
    ...usedNames,
    ...aislExternals.map((e) => e.name),
  ]);

  for (const ext of aislExternals) {
    if (usedNames.has(ext.name)) {
      diagnostics.push({
        severity: "error",
        message: `'${ext.name}' is already declared`,
        line: ext.line,
      });
      continue;
    }

    const absPath = isAbsolute(ext.path)
      ? ext.path
      : resolve(baseDir, ext.path);
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
        message: `'${ext.realName}' in '${ext.path}' is itself declared as '${target.keyword}', pointing at '${target.path}' — reference '${target.path}' directly instead of chaining through '${ext.path}'`,
        line: ext.line,
      });
      continue;
    }

    if (!symbolKindMatches(ext.symbolKind, found.nativeKind)) {
      diagnostics.push({
        severity: "warning",
        message: `'${ext.realName}' is declared as ${ext.keyword} '${ext.symbolKind}', but '${ext.path}' declares it as a '${nativeKindLabel(found.nativeKind)}'`,
        line: ext.line,
      });
    }

    if (found.nativeKind === "function" || found.nativeKind === "global") {
      const referenced = signatureTypeNames(found.decl, found.nativeKind);
      const missing = [...referenced].filter((n) => !availableTypeNames.has(n));
      if (missing.length > 0) {
        const importLines = missing
          .map((n) => {
            const src = resolveDependencySource(
              loaded.program,
              loaded.dir,
              baseDir,
              ext.path,
              n,
            );
            if (src.nativeKind === "external") {
              if (src.realName === n) {
                const firstPart = `import type ${n} from "${src.path}"`;
                const underline = "^".repeat(src.path.length);
                const offset = " ".repeat(
                  firstPart.length - underline.length - 1,
                );
                const secondPart = `\n${offset}${underline} WARNING: '${n}' WAS FOUND TO ALSO BE AN EXTERNAL DECLARATION IN ${src.path}. THIS IS NOT THE CORRECT PATH.`;
                return firstPart + secondPart;
              } else {
                const firstPart = `import renamed type ${n} from "${src.path}"`;
                const middlePart = ` was ${src.realName}`;
                const underline = "^".repeat(src.path.length);
                const offset = " ".repeat(
                  firstPart.length - underline.length - 1,
                );
                const secondPart = `\n${offset}${underline} WARNING: '${n}' WAS FOUND TO ALSO BE AN EXTERNAL DECLARATION IN ${src.path}. THIS IS NOT THE CORRECT PATH.`;
                return firstPart + middlePart + secondPart;
              }
            } else {
              return src.realName === n
                ? `import type ${n} from "${src.path}"`
                : `import renamed type ${n} from "${src.path}" was ${src.realName}`;
            }
          })
          .join("\n");
        const subject =
          found.nativeKind === "function"
            ? "parameter(s) of type(s)"
            : "a type";
        diagnostics.push({
          severity: "error",
          message: `${nativeKindLabel(found.nativeKind)} '${ext.name}' (from '${ext.path}') has ${subject} not available here. Lines needed:\n\n${importLines}\n`,
          line: ext.line,
        });
        continue;
      }
    }

    usedNames.add(ext.name);
    inject(resolved, ext.name, found.decl, found.nativeKind);
  }

  return { program: resolved, diagnostics };
}
