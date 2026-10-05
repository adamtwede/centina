import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { printFindings } from "../report"
import { readLedger } from "../ledger/parse"
import { checkTrail } from "./check"
import { buildModel } from "./model"
import { TRAIL_FILE, readTrail } from "./parse"
import { renderTracker } from "./render"
import { loadTicks } from "./weights"

export const TRACKER_FILE = "TRACKER.html"

const USAGE = "usage: centina-check trail [--check] [--out <file>] <system-dir>"

/**
 * `centina-check trail <system-dir>`: validates the system's TRAIL.jsonl
 * (docs/trail.md) and writes TRACKER.html beside it, the decision tree with
 * what each stretch of work cost. `--check` validates without writing.
 * `--out` writes the page elsewhere. Weights come from the transcript copies
 * in `<system-dir>/transcripts/`, read as timestamps and token counts only.
 * A system with no TRAIL.jsonl is not an error. Returns the exit code.
 */
export function runTrailCommand(argv: string[]): number {
  let checkOnly = false
  let out: string | undefined
  const dirs: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--check") checkOnly = true
    else if (arg === "--out") {
      out = argv[++i]
      if (!out) {
        console.error(`--out requires a file\n${USAGE}`)
        return 1
      }
    } else if (arg.startsWith("--")) {
      console.error(`unknown option ${arg}\n${USAGE}`)
      return 1
    } else dirs.push(arg)
  }
  if (dirs.length !== 1) {
    console.error(USAGE)
    return 1
  }

  const baseDir = process.env.CENTINA_CALLER_CWD ?? process.cwd()
  const systemDir = path.resolve(baseDir, dirs[0])
  const trail = readTrail(systemDir)
  if (!trail) {
    console.log(`trail: none (no ${TRAIL_FILE} in ${systemDir})`)
    return 0
  }

  const ledger = existsSync(path.join(systemDir, "LEDGER.md")) ? readLedger(systemDir) : undefined
  const findings = checkTrail(trail, ledger)
  const hasErrors = findings.some((f) => f.severity === "error")
  if (findings.length > 0) printFindings(findings)
  else console.log(`trail: clean (${path.basename(systemDir)})`)

  if (!checkOnly) {
    const sessions = trail.records.flatMap((r) => (r.type === "decision" && r.session ? [r.session] : []))
    const { ticks, missing } = loadTicks(systemDir, sessions)
    const model = buildModel(trail, findings, { ledger, ticks, missingTranscripts: missing })
    const target = out ? path.resolve(baseDir, out) : path.join(systemDir, TRACKER_FILE)
    const html = renderTracker(model)
    if (!existsSync(target) || readFileSync(target, "utf8") !== html) {
      writeFileSync(target, html)
      console.log(`wrote ${target}`)
    }
  }
  return hasErrors ? 1 : 0
}
