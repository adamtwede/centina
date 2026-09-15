import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { printFindings } from "../report"
import { Finding } from "../types"
import { checkLedger } from "./check"
import { renderIndex, renderStanding } from "./generate"
import { LEDGER_INDEX, STANDING, readLedger, scanSystemFiles } from "./parse"

const USAGE = "usage: centina-check ledger [--check] <system-dir>..."

/**
 * `centina-check ledger <system-dir>...`: validates each system's ledger and
 * the label citations in its files, then writes LEDGER-INDEX.md and
 * STANDING.md. With `--check`, reports out-of-date generated files instead of
 * writing them. Returns the exit code.
 */
export function runLedgerCommand(argv: string[]): number {
  let checkOnly = false
  const dirs: string[] = []
  for (const arg of argv) {
    if (arg === "--check") checkOnly = true
    else if (arg.startsWith("--")) {
      console.error(`unknown option ${arg}\n${USAGE}`)
      return 1
    } else dirs.push(arg)
  }
  if (dirs.length === 0) {
    console.error(USAGE)
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
