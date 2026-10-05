import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { printFindings } from "../report"
import { readLedger } from "../ledger/parse"
import { Waivable, analyze } from "./check"
import { buildModel } from "./model"
import { TRAIL_FILE, readTrail } from "./parse"
import { renderTracker } from "./render"
import { loadTicks } from "./weights"

export const TRACKER_FILE = "TRACKER.html"

const WAIVE_EXAMPLES = 5

/**
 * How to rule a warning out, with a record to copy for each warning that can
 * be (docs/trail.md, `waive`). The quote is the human's, so it is left to them.
 */
function waiveGuidance(file: string, waivable: Waivable[]): string[] {
  const at = new Date().toISOString().replace(/\.\d+Z$/, "Z")
  const lines = [
    "",
    `To rule a warning out, append a line like one of these to ${file}.`,
    `"quote" is your own words (without it the waiver is an error); "why" says what you decided. Only warnings can be waived, and`,
    "only for work you have decided not to bring under the trail: otherwise fix the record.",
  ]
  for (const { rule, subject } of waivable.slice(0, WAIVE_EXAMPLES)) {
    lines.push(`  ${JSON.stringify({ type: "waive", rule, subject, why: "<what you decided>", quote: "<your words>", at })}`)
  }
  if (waivable.length > WAIVE_EXAMPLES) lines.push(`  ... and ${waivable.length - WAIVE_EXAMPLES} more (same shape, other rule and subject)`)
  return lines
}

const USAGE = "usage: centina-check trail [--check] [--item <label>] [--out <file>] <system-dir>"

/**
 * `centina-check trail <system-dir>`: validates the system's TRAIL.jsonl
 * (docs/trail.md) and writes TRACKER.html beside it, the decision tree with
 * what each stretch of work cost. `--check` validates without writing.
 * `--item` opens the page on that work item (default: the one worked on last).
 * `--out` writes the page elsewhere. Weights come from the transcript copies
 * in `<system-dir>/transcripts/`, read as timestamps and token counts only, and
 * kept in `<system-dir>/weights/` so they outlast the copies.
 * A system with no TRAIL.jsonl is not an error. Returns the exit code.
 */
export function runTrailCommand(argv: string[]): number {
  let checkOnly = false
  let out: string | undefined
  let item: string | undefined
  const dirs: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--check") checkOnly = true
    else if (arg === "--item") {
      item = argv[++i]
      if (!item) {
        console.error(`--item requires a work item label\n${USAGE}`)
        return 1
      }
    } else if (arg === "--out") {
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
  const { findings, waived, waivable } = analyze(trail, ledger)
  const hasErrors = findings.some((f) => f.severity === "error")
  if (findings.length > 0) printFindings(findings)
  if (waivable.length > 0) for (const line of waiveGuidance(trail.file, waivable)) console.log(line)
  if (findings.length === 0) console.log(`trail: clean (${path.basename(systemDir)})`)
  if (waived.length > 0) {
    console.log(`\n${waived.length} waived (the human ruled these not to be raised):`)
    for (const { finding, waiver } of waived) console.log(`  ${finding.rule} for ${waiver.subject}: ${waiver.why}`)
  }

  if (!checkOnly) {
    const sessions = trail.records.flatMap((r) => (r.type === "decision" && r.session ? [r.session] : []))
    const { ticks, missing } = loadTicks(systemDir, sessions, true)
    const model = buildModel(trail, findings, { ledger, ticks, missingTranscripts: missing, waived, item })
    const target = out ? path.resolve(baseDir, out) : path.join(systemDir, TRACKER_FILE)
    const html = renderTracker(model)
    if (!existsSync(target) || readFileSync(target, "utf8") !== html) {
      writeFileSync(target, html)
      console.log(`wrote ${target}`)
    }
    // Always named, so a caller can tell a page written from a checker that failed.
    console.log(`tracker: ${target}`)
  }
  return hasErrors ? 1 : 0
}
