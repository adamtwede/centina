import { Diagnostic, Project, SourceFile } from "ts-morph"

/**
 * tsc diagnostics for the check's scope. With no scope (the whole-project run)
 * this is the project's diagnostics. With a scope it is only the scoped files'
 * own diagnostics. ts-morph's Project method takes no arguments, so calling it
 * per file would repeat every project-wide error once per scoped file.
 */
export function diagnosticsForScope(project: Project, scope?: SourceFile[]): Diagnostic[] {
  return scope === undefined
    ? project.getPreEmitDiagnostics()
    : scope.flatMap((sourceFile) => sourceFile.getPreEmitDiagnostics())
}
