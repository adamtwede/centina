import { Finding } from "../types"
import { Ledger, parseQualified, labelKey, status } from "../ledger/parse"
import { Choice, Decision, Gate, Mark, OPTION_REF, Reading, Trail, Waive, scopeOf } from "./parse"

// Rules for TRAIL.jsonl. Format and reasons: docs/trail.md.

/** The key of a label with any part dropped, `sz:W3(a)` to `sz:W3`; undefined when it is not a qualified label. */
function keyOf(label: string): string | undefined {
  const ref = parseQualified(label)
  return ref ? labelKey(ref) : undefined
}

export interface Resolved {
  decisions: Decision[]
  choices: Map<string, Choice>
  marks: Map<string, Mark>
  gates: Gate[]
  readings: Reading[]
  /** Ids a later record corrects. */
  superseded: Set<string>
  /** The waivers in effect, by `rule|subject`; a lifted one is gone. */
  waivers: Map<string, Waive>
}

export const waiverKey = (rule: string, subject: string) => `${rule}|${keyOf(subject) ?? subject}`

/** The records in effect: the latest choice per decision and mark per option; corrected ids noted. */
export function resolve(trail: Trail): Resolved {
  const out: Resolved = { decisions: [], choices: new Map(), marks: new Map(), gates: [], readings: [], superseded: new Set(), waivers: new Map() }
  for (const r of trail.records) {
    if (r.type === "decision") {
      out.decisions.push(r)
      if (r.corrects) out.superseded.add(r.corrects)
    } else if (r.type === "gate") {
      out.gates.push(r)
      if (r.corrects) out.superseded.add(r.corrects)
    } else if (r.type === "choice") out.choices.set(r.decision, r)
    else if (r.type === "mark") out.marks.set(r.option, r)
    else if (r.type === "reading") out.readings.push(r)
    else if (r.type === "waive") {
      if (r.lifted) out.waivers.delete(waiverKey(r.rule, r.subject))
      else out.waivers.set(waiverKey(r.rule, r.subject), r)
    }
  }
  return out
}

/** A warning the human has ruled is not to be raised, kept so it is still shown. */
export interface Waived {
  finding: Finding
  waiver: Waive
}

/** A standing warning a `waive` record could rule out: its rule and the subject it is about. */
export interface Waivable {
  rule: string
  subject: string
}

/** The findings that stand; see `analyze` for the waived ones. */
export function checkTrail(trail: Trail, ledger?: Ledger): Finding[] {
  return analyze(trail, ledger).findings
}

/**
 * Every rule, then the waivers: a `waive` record drops the warnings of its rule
 * for its subject (the item or decision the warning is about) and moves them to
 * `waived`, where the command and the page still list them. Only warnings can
 * be waived. A waiver with no ruling quote is an error, and one that matches
 * nothing is a warning, so a stale waiver is not forgotten.
 */
export function analyze(trail: Trail, ledger?: Ledger): { findings: Finding[]; waived: Waived[]; waivable: Waivable[] } {
  const raised: Finding[] = [...trail.problems]
  const subjects = new Map<Finding, string>()
  const add = (rule: string, severity: Finding["severity"], line: number, message: string, subject?: string) => {
    const finding: Finding = { rule, severity, file: trail.file, line, message }
    raised.push(finding)
    if (subject !== undefined) subjects.set(finding, subject)
  }
  const state = resolve(trail)

  // Ids.
  const decisions = new Map<string, Decision>()
  const gates = new Map<string, Gate>()
  for (const d of state.decisions) {
    if (decisions.has(d.id)) add("trail-id", "error", d.line, `${d.id} is already used on line ${decisions.get(d.id)!.line}; a correction takes a new id and "corrects"`)
    else decisions.set(d.id, d)
  }
  for (const g of state.gates) {
    if (gates.has(g.id)) add("trail-id", "error", g.line, `${g.id} is already used on line ${gates.get(g.id)!.line}`)
    else gates.set(g.id, g)
  }
  const next = new Map<string, number>()
  for (const d of state.decisions) {
    const scope = scopeOf(d.id)
    const number = Number(d.id.slice(d.id.indexOf("/d") + 2))
    const expected = (next.get(scope) ?? 0) + 1
    if (number !== expected && !d.corrects) add("trail-id", "warning", d.line, `${d.id}: the next number in scope ${scope} is d${expected}`, d.id)
    next.set(scope, Math.max(number, next.get(scope) ?? 0))
  }

  const optionExists = (ref: string): boolean => {
    const m = OPTION_REF.exec(ref)
    if (!m) return false
    const d = decisions.get(m[1])
    return !!d && (d.options.length === 0 || d.options.some((o) => o.n === Number(m[2])))
  }
  const needOption = (ref: string | undefined, line: number, what: string) => {
    if (ref !== undefined && !optionExists(ref)) add("trail-ref", "error", line, `${what} ${ref} names no decision option`)
  }
  const needCorrected = (id: string | undefined, line: number, known: Map<string, unknown>) => {
    if (id !== undefined && !known.has(id)) add("trail-ref", "error", line, `corrects ${id}, which is not in the trail`)
  }

  for (const d of state.decisions) {
    needOption(d.from, d.line, `"from"`)
    for (const o of d.options) {
      needOption(o.revives, d.line, `option ${o.n} "revives"`)
      const revived = o.revives && OPTION_REF.exec(o.revives)
      if (revived && decisions.get(revived[1]) && decisions.get(revived[1])!.t > d.t) {
        add("trail-time", "warning", d.line, `option ${o.n} revives ${o.revives}, which was offered later`, d.id)
      }
    }
    needCorrected(d.corrects, d.line, decisions)
    if (d.options.length > 0 && !d.options.some((o) => o.kind === "close")) {
      add("trail-no-close", "warning", d.line, `${d.id} offers no close option; a menu of only ways to continue is how a line never ends`, d.id)
    }
  }
  for (const c of state.choices.values()) {
    const d = decisions.get(c.decision)
    if (!d) {
      add("trail-ref", "error", c.line, `choice names ${c.decision}, which is not in the trail`)
      continue
    }
    if (c.t < d.t) add("trail-time", "warning", c.line, `choice is dated before ${c.decision}`, c.decision)
    for (const n of c.chose) {
      if (d.options.length > 0 && !d.options.some((o) => o.n === n)) add("trail-ref", "error", c.line, `choice names option ${n}, which ${c.decision} did not offer`)
    }
    if (c.chose.length === 0 && !c.other) add("trail-ref", "warning", c.line, `choice of ${c.decision} took no option and gives no "other"`)
  }
  for (const m of state.marks.values()) needOption(m.option, m.line, `mark`)
  for (const g of state.gates) {
    needCorrected(g.corrects, g.line, gates)
    if (!g.ruled || !g.quote) add("trail-gate-ruling", "error", g.line, `${g.id} has no "ruled" label and "quote": the human rules a gate, the agent only drafts it`)
  }
  for (const r of state.readings) {
    if (!gates.has(r.gate)) add("trail-ref", "error", r.line, `reading names ${r.gate}, which is not in the trail`)
    needOption(r.after, r.line, `"after"`)
  }

  // A decision the work has moved past with no answer.
  const answered = (d: Decision) => state.choices.has(d.id)
  const later = (d: Decision) => trail.records.some((r) => r.line > d.line && (r.type === "decision" || r.type === "choice" || r.type === "reading") && !(r.type === "choice" && r.decision === d.id))
  for (const d of state.decisions) {
    if (!answered(d) && later(d) && !state.superseded.has(d.id)) add("trail-unanswered", "warning", d.line, `${d.id} has no choice and later records exist`, d.id)
  }

  // Labels against the ledger.
  if (ledger) {
    const known = new Set(ledger.entries.map((e) => e.key))
    const need = (label: string | undefined, line: number, what: string) => {
      if (label === undefined) return
      const key = keyOf(label)
      if (key === undefined) return
      if (!known.has(key)) add("trail-label", "error", line, `${what} ${label} is not in the ledger`)
    }
    for (const d of state.decisions) {
      need(d.item, d.line, `item`)
      for (const o of d.options) for (const c of o.cites) need(c, d.line, `option ${o.n} cites`)
    }
    for (const g of state.gates) {
      need(g.item, g.line, `item`)
      need(g.ruled, g.line, `"ruled"`)
    }
    for (const r of state.readings) need(r.evidence, r.line, `evidence`)
    for (const m of state.marks.values()) for (const c of m.cites) need(c, m.line, `mark cites`)

    // The trail is only as good as its capture: a live spike with findings and no records is the signal.
    const gated = new Set(state.gates.filter((g) => !state.superseded.has(g.id)).map((g) => keyOf(g.item)))
    const decided = new Set(state.decisions.map((d) => (d.item ? keyOf(d.item) : undefined)))
    for (const e of ledger.entries) {
      if (!/:W\d+$/.test(e.key) || e.fields.get("Kind")?.value !== "spike" || status(e) !== "active") continue
      const findings = ledger.entries.filter((o) => o.fields.get("Premises")?.value.split(",").some((p) => keyOf(p.trim()) === e.key)).length
      if (!decided.has(e.key) && findings >= 2) {
        add("trail-missing-decision", "warning", 1, `${e.key} is an active spike with ${findings} findings and no decision in the trail; the options offered along the way were not recorded`, e.key)
      }
      if (!gated.has(e.key)) add("trail-spike-no-gate", "warning", 1, `${e.key} is an active spike with no ruled gate in the trail`, e.key)
    }
  }

  // Waivers.
  const findings: Finding[] = []
  const waived: Waived[] = []
  const waivable = new Map<string, Waivable>()
  const used = new Set<string>()
  const addWaiveFinding = (severity: Finding["severity"], line: number, message: string) =>
    findings.push({ rule: "trail-waive", severity, file: trail.file, line, message })
  for (const f of raised) {
    const subject = subjects.get(f)
    const key = subject !== undefined && f.severity === "warning" ? waiverKey(f.rule, subject) : undefined
    const waiver = key === undefined ? undefined : state.waivers.get(key)
    if (waiver && key && waiver.quote) {
      used.add(key)
      waived.push({ finding: f, waiver })
    } else {
      findings.push(f)
      if (subject !== undefined && f.severity === "warning") waivable.set(waiverKey(f.rule, subject), { rule: f.rule, subject })
    }
  }
  for (const [key, w] of state.waivers) {
    if (!w.quote) addWaiveFinding("error", w.line, `the waiver of ${w.rule} for ${w.subject} has no "quote": the human rules a waiver, the agent only records it`)
    else if (!used.has(key)) addWaiveFinding("warning", w.line, `the waiver of ${w.rule} for ${w.subject} matches no warning now; lift it with a record carrying "lifted":true`)
  }
  return { findings: findings.sort((a, b) => a.line - b.line), waived: waived.sort((a, b) => a.finding.line - b.finding.line), waivable: [...waivable.values()] }
}

