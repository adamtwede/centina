import { SourceFile } from "ts-morph"
import { CheckArgs, parseCheckArgs } from "./cliArgs"
import { diagnosticsForScope } from "./diagnostics"
import { getSpecSourceFiles, loadProject, resolveScope } from "./harness"
import { runLedgerCommand } from "./ledger/command"
import { runSetupCommand } from "./setup/command"
import { runTrailCommand } from "./trail/command"
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

function main(): void {
  if (process.argv[2] === "ledger") {
    process.exit(runLedgerCommand(process.argv.slice(3)))
  }
  if (process.argv[2] === "setup") {
    process.exit(runSetupCommand(process.argv.slice(3)))
  }
  if (process.argv[2] === "trail") {
    process.exit(runTrailCommand(process.argv.slice(3)))
  }

  const baseDir = process.env.CENTINA_CALLER_CWD ?? process.cwd()
  let args: CheckArgs
  try {
    args = parseCheckArgs(process.argv.slice(2), baseDir)
  } catch (error) {
    console.error((error as Error).message)
    process.exit(1)
  }
  const { tsConfigFilePath, requestedPaths } = args
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

  const diagnostics = diagnosticsForScope(
    project,
    requestedPaths.length === 0 ? undefined : targetSourceFiles,
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
