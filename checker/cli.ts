import { SourceFile } from "ts-morph"
import { getSpecSourceFiles, loadProject, resolveScope } from "./harness"
import { runLedgerCommand } from "./ledger/command"
import { printFindings } from "./report"
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

function parseArgs(argv: string[]): { tsConfigFilePath?: string; requestedPaths: string[] } {
  const requestedPaths: string[] = []
  let tsConfigFilePath: string | undefined

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project") {
      tsConfigFilePath = argv[++i]
      if (!tsConfigFilePath) {
        console.error("--project requires a path argument")
        process.exit(1)
      }
    } else {
      requestedPaths.push(argv[i])
    }
  }

  return { tsConfigFilePath, requestedPaths }
}

function main(): void {
  if (process.argv[2] === "ledger") {
    process.exit(runLedgerCommand(process.argv.slice(3)))
  }

  const { tsConfigFilePath, requestedPaths } = parseArgs(process.argv.slice(2))
  const project = loadProject(tsConfigFilePath)

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
