import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { Finding } from "../types"

// Format: docs/trail.md. One JSON object per line; a line that does not parse
// or does not have the right shape is reported and skipped, so one bad record
// never hides the rest.

export const TRAIL_FILE = "TRAIL.jsonl"

export type OptionKind = "refine" | "branch" | "close"
export type MarkState = "parked" | "abandoned" | "done"
export type Verdict = "pass" | "fail" | "inconclusive"
export type Direction = "max" | "min"

export interface TrailOption {
  n: number
  label: string
  kind: OptionKind
  cites: string[]
  /** Option ref (`scope/dN.n`) of an earlier option this one offers again. */
  revives?: string
  note?: string
}

interface Base {
  /** 1-based line in TRAIL.jsonl. */
  line: number
  /** ISO time, UTC. */
  at: string
  /** Epoch seconds of `at`. */
  t: number
}

export interface Decision extends Base {
  type: "decision"
  id: string
  session?: string
  /** Option ref whose work led here; absent at a root. */
  from?: string
  item?: string
  question: string
  options: TrailOption[]
  recommended?: number
  /** Why the agent stopped for review (`centina-spike` checkpoints). */
  checkpoint?: string
  /** Set on a record written after the fact, from the ledger alone. */
  backfilled?: boolean
  corrects?: string
}

export interface Choice extends Base {
  type: "choice"
  decision: string
  chose: number[]
  other?: string
  quote?: string
}

export interface Mark extends Base {
  type: "mark"
  option: string
  state: MarkState
  why?: string
  cites: string[]
}

export interface Gate extends Base {
  type: "gate"
  id: string
  item: string
  statement: string
  metric?: string
  unit?: string
  tolerance?: number
  direction?: Direction
  /** Ledger label where the human ruled it. */
  ruled?: string
  quote?: string
  corrects?: string
}

export interface Reading extends Base {
  type: "reading"
  gate: string
  /** Option ref whose work produced it. */
  after?: string
  value?: number
  unit?: string
  verdict: Verdict
  evidence?: string
}

export interface Link extends Base {
  type: "link"
  scope: string
  file: string
}

/**
 * The human's ruling that a warning is not to be raised for one subject (an
 * item label or a decision id), with where and why. A later record for the same
 * rule and subject replaces it; `lifted` ends the waiver.
 */
export interface Waive extends Base {
  type: "waive"
  rule: string
  subject: string
  why: string
  quote?: string
  lifted?: boolean
}

export type TrailRecord = Decision | Choice | Mark | Gate | Reading | Link | Waive

export interface Trail {
  file: string
  system?: string
  records: TrailRecord[]
  problems: Finding[]
  hasHeader: boolean
}

export const DECISION_ID = /^[a-z][a-z0-9-]*\/d[1-9]\d*$/
export const GATE_ID = /^[a-z][a-z0-9-]*\/g[1-9]\d*$/
export const OPTION_REF = /^([a-z][a-z0-9-]*\/d[1-9]\d*)\.([1-9]\d*)$/
const LABEL = /^(?:[a-z][a-z0-9-]*\/)?[a-z][a-z0-9-]*:[PQFOWGRA][1-9]\d*(?:\([a-z]\))?$/

export function scopeOf(id: string): string {
  return id.slice(0, id.indexOf("/"))
}

export function optionRef(decision: string, n: number): string {
  return `${decision}.${n}`
}

type Raw = Record<string, unknown>
const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === "string" && v !== ""
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

function strings(v: unknown): string[] | undefined {
  if (v === undefined) return []
  return Array.isArray(v) && v.every(isString) ? (v as string[]) : undefined
}

/** Parses one record, or says what is wrong with it. */
function parseRecord(raw: Raw, line: number): TrailRecord | string {
  const type = raw.type
  if (!isString(raw.at) && type !== "trail") return `"at" is required (ISO time, UTC)`
  const at = String(raw.at)
  const t = Date.parse(at) / 1000
  if (Number.isNaN(t)) return `"at" is not a time: ${at}`
  const base = { line, at, t }
  const cites = strings(raw.cites)
  if (cites === undefined) return `"cites" must be a list of labels`
  const badCite = cites.find((c) => !LABEL.test(c))
  if (badCite) return `"${badCite}" is not a qualified label`

  switch (type) {
    case "decision": {
      if (!isString(raw.id) || !DECISION_ID.test(raw.id)) return `"id" must look like scope/d12`
      if (!isString(raw.question)) return `"question" is required`
      if (!Array.isArray(raw.options) || raw.options.length === 0) {
        if (raw.backfilled === true) {
          return {
            ...base, type, id: raw.id, question: raw.question, options: [], backfilled: true,
            session: isString(raw.session) ? raw.session : undefined,
            from: isString(raw.from) ? raw.from : undefined,
            item: isString(raw.item) ? raw.item : undefined,
          }
        }
        return `"options" must be a non-empty list (or the record "backfilled": true)`
      }
      const options: TrailOption[] = []
      for (const o of raw.options) {
        if (!isObject(o) || !Number.isInteger(o.n) || (o.n as number) < 1) return `each option needs an integer "n" from 1`
        if (!isString(o.label)) return `option ${o.n} needs a "label"`
        if (o.kind !== "refine" && o.kind !== "branch" && o.kind !== "close") return `option ${o.n}: "kind" must be refine, branch or close`
        const oc = strings(o.cites)
        if (oc === undefined || oc.some((c) => !LABEL.test(c))) return `option ${o.n}: "cites" must be a list of qualified labels`
        if (o.revives !== undefined && !(isString(o.revives) && OPTION_REF.test(o.revives))) return `option ${o.n}: "revives" must look like scope/d9.3`
        options.push({
          n: o.n as number, label: o.label, kind: o.kind, cites: oc,
          revives: o.revives as string | undefined, note: isString(o.note) ? o.note : undefined,
        })
      }
      if (new Set(options.map((o) => o.n)).size !== options.length) return `option numbers repeat`
      if (raw.recommended !== undefined && !options.some((o) => o.n === raw.recommended)) return `"recommended" names no option`
      if (raw.from !== undefined && !(isString(raw.from) && OPTION_REF.test(raw.from))) return `"from" must look like scope/d9.3`
      return {
        ...base, type, id: raw.id, question: raw.question, options,
        session: isString(raw.session) ? raw.session : undefined,
        from: raw.from as string | undefined, item: isString(raw.item) ? raw.item : undefined,
        recommended: raw.recommended as number | undefined,
        checkpoint: isString(raw.checkpoint) ? raw.checkpoint : undefined,
        backfilled: raw.backfilled === true ? true : undefined,
        corrects: isString(raw.corrects) ? raw.corrects : undefined,
      }
    }
    case "choice": {
      if (!isString(raw.decision) || !DECISION_ID.test(raw.decision)) return `"decision" must look like scope/d12`
      if (!Array.isArray(raw.chose) || !raw.chose.every((n) => Number.isInteger(n))) return `"chose" must be a list of option numbers`
      return {
        ...base, type, decision: raw.decision, chose: raw.chose as number[],
        other: isString(raw.other) ? raw.other : undefined, quote: isString(raw.quote) ? raw.quote : undefined,
      }
    }
    case "mark": {
      if (!isString(raw.option) || !OPTION_REF.test(raw.option)) return `"option" must look like scope/d9.3`
      if (raw.state !== "parked" && raw.state !== "abandoned" && raw.state !== "done") return `"state" must be parked, abandoned or done`
      return { ...base, type, option: raw.option, state: raw.state, why: isString(raw.why) ? raw.why : undefined, cites }
    }
    case "gate": {
      if (!isString(raw.id) || !GATE_ID.test(raw.id)) return `"id" must look like scope/g3`
      if (!isString(raw.item) || !LABEL.test(raw.item)) return `"item" must be a qualified label`
      if (!isString(raw.statement)) return `"statement" is required`
      if (raw.tolerance !== undefined && !isNumber(raw.tolerance)) return `"tolerance" must be a number`
      if (raw.direction !== undefined && raw.direction !== "max" && raw.direction !== "min") return `"direction" must be max or min`
      return {
        ...base, type, id: raw.id, item: raw.item, statement: raw.statement,
        metric: isString(raw.metric) ? raw.metric : undefined, unit: isString(raw.unit) ? raw.unit : undefined,
        tolerance: raw.tolerance as number | undefined, direction: raw.direction as Direction | undefined,
        ruled: isString(raw.ruled) ? raw.ruled : undefined, quote: isString(raw.quote) ? raw.quote : undefined,
        corrects: isString(raw.corrects) ? raw.corrects : undefined,
      }
    }
    case "reading": {
      if (!isString(raw.gate) || !GATE_ID.test(raw.gate)) return `"gate" must look like scope/g3`
      if (raw.verdict !== "pass" && raw.verdict !== "fail" && raw.verdict !== "inconclusive") return `"verdict" must be pass, fail or inconclusive`
      if (raw.value !== undefined && !isNumber(raw.value)) return `"value" must be a number`
      if (raw.after !== undefined && !(isString(raw.after) && OPTION_REF.test(raw.after))) return `"after" must look like scope/d9.3`
      return {
        ...base, type, gate: raw.gate, verdict: raw.verdict, after: raw.after as string | undefined,
        value: raw.value as number | undefined, unit: isString(raw.unit) ? raw.unit : undefined,
        evidence: isString(raw.evidence) ? raw.evidence : undefined,
      }
    }
    case "waive": {
      if (!isString(raw.rule) || !/^trail-[a-z-]+$/.test(raw.rule)) return `"rule" must name a trail rule, like trail-spike-no-gate`
      if (!isString(raw.subject)) return `"subject" is required: the item label or decision id the rule is waived for`
      if (!isString(raw.why)) return `"why" is required`
      return { ...base, type, rule: raw.rule, subject: raw.subject, why: raw.why, quote: isString(raw.quote) ? raw.quote : undefined, lifted: raw.lifted === true ? true : undefined }
    }
    case "link": {
      if (!isString(raw.scope) || !isString(raw.file)) return `"scope" and "file" are required`
      return { ...base, type, scope: raw.scope, file: raw.file }
    }
    default:
      return `unknown record type ${JSON.stringify(type)}`
  }
}

/** Reads `<systemDir>/TRAIL.jsonl`. Undefined when the system has no trail. */
export function readTrail(systemDir: string): Trail | undefined {
  const file = path.join(systemDir, TRAIL_FILE)
  if (!existsSync(file)) return undefined
  const trail: Trail = { file, records: [], problems: [], hasHeader: false }
  const problem = (line: number, message: string, severity: Finding["severity"] = "error") =>
    trail.problems.push({ rule: "trail-parse", severity, file, line, message })
  readFileSync(file, "utf8").split(/\r?\n/).forEach((text, index) => {
    const line = index + 1
    if (text.trim() === "") return
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch (error) {
      return problem(line, `not JSON: ${(error as Error).message}`)
    }
    if (!isObject(raw)) return problem(line, "a record is a JSON object")
    if (raw.type === "trail") {
      if (raw.version !== 1) return problem(line, `unsupported trail version ${JSON.stringify(raw.version)}`)
      trail.hasHeader = true
      trail.system = isString(raw.system) ? raw.system : undefined
      return
    }
    const parsed = parseRecord(raw, line)
    if (typeof parsed === "string") return problem(line, parsed)
    trail.records.push(parsed)
  })
  if (!trail.hasHeader) problem(1, `the first line should be {"type":"trail","version":1,"system":"…"}`, "warning")
  return trail
}
