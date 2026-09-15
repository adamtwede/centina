import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { printFindings } from "../report"
import { Finding } from "../types"
import { checkLedger, checkProposals } from "./check"
import { renderIndex, renderStanding } from "./generate"
import { LEDGER_INDEX, STANDING, commentLines, readLedger, scanSystemFiles } from "./parse"

const USAGE = "usage: centina-check ledger [--check] [--contracts <file>]... <system-dir>..."

/**
 * `centina-check ledger <system-dir>...`: validates each system's ledger and
 * the label citations in its files, then writes LEDGER-INDEX.md and
 * STANDING.md. With `--check`, reports out-of-date generated files instead of
 * writing them. `--contracts <file>` (one system only) also enumerates the
 * `@proposal` overrides in a centina-realize contracts module. Returns the
 * exit code.
 */
export function runLedgerCommand(argv: string[]): number {
  let checkOnly = false
  const dirs: string[] = []
  const contractsFiles: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--check") checkOnly = true
    else if (arg === "--contracts") {
      const file = argv[++i]
      if (!file) {
        console.error(`--contracts requires a file\n${USAGE}`)
        return 1
      }
      contractsFiles.push(file)
    } else if (arg.startsWith("--")) {
      console.error(`unknown option ${arg}\n${USAGE}`)
      return 1
    } else dirs.push(arg)
  }
  if (dirs.length === 0) {
    console.error(USAGE)
    return 1
  }
  if (contractsFiles.length > 0 && dirs.length > 1) {
    console.error(`--contracts applies to one system directory at a time\n${USAGE}`)
    return 1
  }

  // bin/centina-check runs from the plugin's checker copy; resolve paths against the caller's directory.
  const baseDir = process.env.CENTINA_CALLER_CWD ?? process.cwd()
  let hasErrors = false

  for (const dir of dirs) {
    const systemDir = path.resolve(baseDir, dir)
    if (!existsSync(path.join(systemDir, "LEDGER.md"))) {
      console.error(`no LEDGER.md in ${systemDir}`)
      hasErrors = true
      continue
    }

    const ledger = readLedger(systemDir)
    const findings: Finding[] = checkLedger(ledger, scanSystemFiles(systemDir))

    for (const contractsFile of contractsFiles.map((file) => path.resolve(baseDir, file))) {
      if (!existsSync(contractsFile)) {
        console.error(`no such contracts file: ${contractsFile}`)
        hasErrors = true
        continue
      }
      const lines = commentLines(contractsFile, readFileSync(contractsFile, "utf8"))
      findings.push(...checkProposals(ledger, contractsFile, lines))
    }

    const generated: [string, string][] = [
      [LEDGER_INDEX, renderIndex(ledger)],
      [STANDING, renderStanding(ledger)],
    ]
    for (const [name, content] of generated) {
      const target = path.join(systemDir, name)
      const current = existsSync(target) ? readFileSync(target, "utf8") : undefined
      if (current === content) continue
      if (checkOnly) {
        findings.push({
          rule: "ledger-generated-stale",
          severity: "error",
          file: target,
          line: 1,
          message: `${name} is out of date; run centina-check ledger without --check`,
        })
      } else {
        writeFileSync(target, content)
        console.log(`wrote ${target}`)
      }
    }

    if (findings.length > 0) {
      printFindings(findings)
      hasErrors ||= findings.some((finding) => finding.severity === "error")
    } else {
      console.log(`ledger: clean (${ledger.system})`)
    }
  }

  return hasErrors ? 1 : 0
}
