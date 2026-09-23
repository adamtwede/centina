import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { printFindings } from "../report"
import { Finding } from "../types"
import { checkLedger, checkProposals } from "./check"
import { buildRootsFor, findConfig, systemKey } from "./config"
import { renderIndex, renderLabels, renderStanding } from "./generate"
import {
  BuildFile,
  LEDGER_INDEX,
  LEDGER_LABELS,
  STANDING,
  commentLines,
  readLedger,
  scanBuildRoot,
  scanSystemFiles,
} from "./parse"

const USAGE = "usage: centina-check ledger [--check] [--contracts <file>]... <system-dir>..."

const REALIZE_STATE = "REALIZE-STATE.md"

/**
 * A system's build trees, from `systems.<key>.buildRoots` in the nearest
 * `.centina/config.json`. A system that has run `centina-realize` but names no
 * build tree is an error: build code exists and nothing is checking it. See
 * docs/ledger.md, "Citations from build code".
 */
function collectBuildFiles(systemDir: string): { files: BuildFile[]; findings: Finding[] } {
  const findings: Finding[] = []
  const files: BuildFile[] = []
  const config = findConfig(systemDir)
  const roots = config ? buildRootsFor(config, systemDir) : []
  const report = (file: string, message: string) =>
    findings.push({ rule: "ledger-config", severity: "error", file, line: 1, message })

  if (config?.problem) report(config.file, config.problem)

  for (const root of roots) {
    if (existsSync(root)) files.push(...scanBuildRoot(root))
    else report(config!.file, `buildRoots names ${root}, which does not exist`)
  }

  const realizeState = path.join(systemDir, REALIZE_STATE)
  if (roots.length === 0 && existsSync(realizeState)) {
    report(
      realizeState,
      config
        ? `${REALIZE_STATE} records build work, but systems["${systemKey(config, systemDir)}"].buildRoots is unset in ${config.file}; build code is not being checked`
        : `${REALIZE_STATE} records build work, but there is no .centina/config.json above ${systemDir} to name its buildRoots`,
    )
  }

  return { files, findings }
}

/**
 * `centina-check ledger <system-dir>...`: validates each system's ledger and
 * the label citations in its files, then writes LEDGER-INDEX.md,
 * LEDGER-LABELS.md and STANDING.md. With `--check`, reports out-of-date
 * generated files instead of writing them. `--contracts <file>` (one system
 * only) also enumerates the `@proposal` overrides in a centina-realize
 * contracts module. Returns the exit code.
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
    const build = collectBuildFiles(systemDir)
    const findings: Finding[] = [
      ...build.findings,
      ...checkLedger(ledger, scanSystemFiles(systemDir), build.files),
    ]

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
      [LEDGER_LABELS, renderLabels(ledger)],
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
