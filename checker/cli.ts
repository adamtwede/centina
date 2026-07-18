import { SourceFile } from "ts-morph"
import { getSpecSourceFiles, loadProject, resolveScope } from "./harness"
import { assumptionBookkeepingRule } from "./rules/assumptionBookkeeping"
import { boundaryDependencyRule } from "./rules/boundaryDependency"
import { boundaryDirectionRule } from "./rules/boundaryDirection"
import { holeEnumerationRule } from "./rules/holeEnumeration"
import { namingConsistencyRule } from "./rules/namingConsistency"
import { specExplanationRule } from "./rules/specExplanation"
import { Finding, Rule } from "./types"

const RULES: Rule[] = [
  holeEnumerationRule,
  boundaryDirectionRule,
  boundaryDependencyRule,
  assumptionBookkeepingRule,
  namingConsistencyRule,
  specExplanationRule,
]

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const

function printFindings(findings: Finding[]): void {
  const byFile = new Map<string, Finding[]>()
  for (const finding of findings) {
    const existing = byFile.get(finding.file) ?? []
    existing.push(finding)
    byFile.set(finding.file, existing)
  }

  for (const [file, fileFindings] of [...byFile.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`\n${file}`)
    const sorted = [...fileFindings].sort((a, b) => {
      if (a.rule !== b.rule) return a.rule.localeCompare(b.rule)
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    })
    for (const finding of sorted) {
      console.log(
        `  [${finding.severity}] ${finding.rule} :${finding.line} — ${finding.message}`,
      )
    }
  }
}

function cycleFindings(cycles: string[][]): Finding[] {
  return cycles.map((cycle) => ({
    rule: "dependency-cycle",
    severity: "error",
    file: cycle[0],
    line: 1,
    message: `import cycle among local specs: ${cycle
      .map((file) => file.split("/").pop())
      .join(" -> ")}`,
  }))
}

function main(): void {
  const project = loadProject()
  const requestedPaths = process.argv.slice(2)

  let targetSourceFiles: SourceFile[]
  let cycles: string[][] = []

  if (requestedPaths.length === 0) {
    targetSourceFiles = getSpecSourceFiles(project)
  } else {
    try {
      const scope = resolveScope(project, requestedPaths)
      targetSourceFiles = scope.files
      cycles = scope.cycles
    } catch (error) {
      console.error((error as Error).message)
      process.exit(1)
    }
  }

  const diagnostics =
    requestedPaths.length === 0
      ? project.getPreEmitDiagnostics()
      : targetSourceFiles.flatMap((sourceFile) =>
          project.getPreEmitDiagnostics(sourceFile),
        )

  if (diagnostics.length > 0) {
    console.log(project.formatDiagnosticsWithColorAndContext(diagnostics))
  } else {
    console.log("tsc: clean")
  }

  const findings = [
    ...RULES.flatMap((rule) => rule.check(targetSourceFiles)),
    ...cycleFindings(cycles),
  ]

  if (findings.length > 0) {
    printFindings(findings)
  } else {
    console.log("\nspec-plane rules: clean")
  }

  const hasErrors =
    diagnostics.length > 0 ||
    findings.some((finding) => finding.severity === "error")
  process.exit(hasErrors ? 1 : 0)
}

main()
