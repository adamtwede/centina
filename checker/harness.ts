import path from "node:path"
import { fileURLToPath } from "node:url"
import { Project, SourceFile } from "ts-morph"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultTsConfigFilePath = path.resolve(__dirname, "..", "tsconfig.json")

/**
 * `tsConfigFilePath`, when given, is the packaged-plugin path: the skill
 * resolves `artifactsRoot` (registry lookup or a fresh setup-procedure run,
 * see docs/plugin-setup-procedure.md) and passes
 * `<artifactsRoot>/tsconfig.json` through explicitly — harness.ts doesn't
 * re-walk the registry itself. Omitted, it falls back to this repo's own
 * root tsconfig.json, unchanged from before packaging existed.
 */
export function loadProject(tsConfigFilePath?: string): Project {
  return new Project({ tsConfigFilePath: tsConfigFilePath ?? defaultTsConfigFilePath })
}

/** Every `*.centina.ts` spec file in the project — excludes centina.ts itself and checker/** (neither matches the suffix). */
export function getSpecSourceFiles(project: Project): SourceFile[] {
  return project
    .getSourceFiles()
    .filter((sourceFile) => sourceFile.getFilePath().endsWith(".centina.ts"))
}

export interface ScopeResolution {
  /** The requested files plus every local spec they transitively import, dependencies before dependents. */
  files: SourceFile[]
  /** Each entry is a cycle among local spec imports, listed in traversal order with the repeated file last. */
  cycles: string[][]
}

/**
 * Resolves a scoped `npm run check -- <files>` request: follows each
 * requested file's local `*.centina.ts` imports transitively (imports of
 * `centina.ts` itself don't count — it's vocabulary, not a spec dependency),
 * returning the closure in dependency-before-dependent order so a rule that
 * needs a dependency's declarations (e.g. boundary dependency-direction)
 * always sees it checked first. Import cycles are reported, not thrown —
 * the traversal still completes on a best-effort basis.
 */
export function resolveScope(
  project: Project,
  requestedPaths: string[],
): ScopeResolution {
  const specFiles = new Set(
    getSpecSourceFiles(project).map((sourceFile) => sourceFile.getFilePath()),
  )

  const roots = requestedPaths.map((requestedPath) => {
    const sourceFile = project.getSourceFile(requestedPath)
    if (!sourceFile) {
      throw new Error(`no such spec file in project: ${requestedPath}`)
    }
    return sourceFile
  })

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: SourceFile[] = []
  const cycles: string[][] = []
  const stack: string[] = []

  function localSpecImports(sourceFile: SourceFile): SourceFile[] {
    return sourceFile
      .getImportDeclarations()
      .map((importDeclaration) => importDeclaration.getModuleSpecifierSourceFile())
      .filter(
        (imported): imported is SourceFile =>
          imported !== undefined && specFiles.has(imported.getFilePath()),
      )
  }

  function visit(sourceFile: SourceFile): void {
    const filePath = sourceFile.getFilePath()
    if (visited.has(filePath)) return
    if (visiting.has(filePath)) {
      const cycleStart = stack.indexOf(filePath)
      cycles.push([...stack.slice(cycleStart), filePath])
      return
    }

    visiting.add(filePath)
    stack.push(filePath)
    for (const dependency of localSpecImports(sourceFile)) {
      visit(dependency)
    }
    stack.pop()
    visiting.delete(filePath)

    visited.add(filePath)
    ordered.push(sourceFile)
  }

  for (const root of roots) visit(root)

  return { files: ordered, cycles }
}
