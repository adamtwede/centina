import type * as ts from "typescript/lib/tsserverlibrary"
import type { Project } from "ts-morph"
import { getSpecSourceFiles, loadProject } from "./harness"
import { assumptionBookkeepingRule } from "./rules/assumptionBookkeeping"
import { boundaryDependencyRule } from "./rules/boundaryDependency"
import { boundaryDirectionRule } from "./rules/boundaryDirection"
import { holeEnumerationRule } from "./rules/holeEnumeration"
import { namingConsistencyRule } from "./rules/namingConsistency"
import { Finding, Rule } from "./types"

const RULES: Rule[] = [
  holeEnumerationRule,
  boundaryDirectionRule,
  boundaryDependencyRule,
  assumptionBookkeepingRule,
  namingConsistencyRule,
]

// Assigned once per rule so editors can filter/sort by code; 91000 is an
// arbitrary private range that doesn't collide with real TS diagnostic codes.
const RULE_CODES: Record<string, number> = {
  "hole-enumeration": 91001,
  "boundary-direction": 91002,
  "boundary-dependency": 91003,
  "assumption-bookkeeping": 91004,
  "naming-consistency": 91005,
}

function severityToCategory(
  tsModule: typeof ts,
  severity: Finding["severity"],
): ts.DiagnosticCategory {
  switch (severity) {
    case "error":
      return tsModule.DiagnosticCategory.Error
    case "warning":
      return tsModule.DiagnosticCategory.Warning
    case "info":
      return tsModule.DiagnosticCategory.Suggestion
  }
}

function findingToDiagnostic(
  tsModule: typeof ts,
  sourceFile: ts.SourceFile,
  finding: Finding,
): ts.Diagnostic {
  const lineStarts = sourceFile.getLineStarts()
  const start = lineStarts[finding.line - 1] ?? 0
  const end = lineStarts[finding.line] ?? sourceFile.text.length
  return {
    file: sourceFile,
    start,
    length: Math.max(1, end - start - 1),
    messageText: finding.message,
    category: severityToCategory(tsModule, finding.severity),
    code: RULE_CODES[finding.rule] ?? 91000,
    source: "centina",
  }
}

function init(modules: { typescript: typeof ts }) {
  const tsModule = modules.typescript

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    let project: Project | undefined

    function getProject(): Project {
      project ??= loadProject()
      return project
    }

    const proxy: ts.LanguageService = Object.create(null)
    for (const key of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      const original = info.languageService[key]
      // @ts-expect-error — generic passthrough proxy, keys are proxied uniformly
      proxy[key] = (...args: unknown[]) => original.apply(info.languageService, args)
    }

    proxy.getSemanticDiagnostics = (fileName: string) => {
      const prior = info.languageService.getSemanticDiagnostics(fileName)
      if (!fileName.endsWith(".centina.ts")) return prior

      try {
        const morphProject = getProject()
        const snapshot = info.languageServiceHost.getScriptSnapshot(fileName)
        if (snapshot) {
          const text = snapshot.getText(0, snapshot.getLength())
          morphProject.createSourceFile(fileName, text, { overwrite: true })
        }

        const specFiles = getSpecSourceFiles(morphProject)
        const findings = RULES.flatMap((rule) => rule.check(specFiles)).filter(
          (finding) => finding.file === fileName,
        )

        const program = info.languageService.getProgram()
        const sourceFile = program?.getSourceFile(fileName)
        if (!sourceFile) return prior

        return [
          ...prior,
          ...findings.map((finding) =>
            findingToDiagnostic(tsModule, sourceFile, finding),
          ),
        ]
      } catch {
        // A bug in our rules must never take down the editor's real
        // diagnostics — fall back to whatever tsserver already computed.
        return prior
      }
    }

    return proxy
  }

  return { create }
}

export = init
