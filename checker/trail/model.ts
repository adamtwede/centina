import { Ledger, labelKey, parseQualified, status } from "../ledger/parse"
import { Finding } from "../types"
import { resolve } from "./check"
import { Decision, Gate, OPTION_REF, OptionKind, Trail, TrailOption, optionRef } from "./parse"
import { Tick, weigh } from "./weights"

// The tracker's view of a trail: a time-ordered list of decision points with
// what was offered, taken and left, the gates and their readings, and the
// alternatives that keep coming back. Pure: the HTML template only draws it.

export type OptionState = "taken" | "unexplored" | "parked" | "abandoned" | "done"

export interface Cite {
  label: string
  title?: string
  status?: string
  /** Opens the entry in VS Code. */
  url?: string
}

export interface ModelOption {
  n: number
  label: string
  kind: OptionKind
  state: OptionState
  note?: string
  why?: string
  recommended: boolean
  cites: Cite[]
  /** The decision that took this option up later, when it was first left. */
  takenLaterBy?: string
}

export interface ModelNode {
  id: string
  /** Epoch seconds the options were offered. */
  t: number
  /** Epoch seconds the human answered, when they did. */
  answeredAt?: number
  item?: string
  question: string
  checkpoint?: string
  backfilled?: boolean
  options: ModelOption[]
  chose: number[]
  other?: string
  quote?: string
  from?: string
  /** Set when the work did not continue from the previous decision's chosen option. */
  jump?: { from: string }
  cites: Cite[]
  pending: boolean
  activeMin?: number
  tokens?: number
  /** Epoch seconds the segment after this decision ends. */
  tEnd: number
}

export interface ModelGate {
  id: string
  item: string
  statement: string
  metric?: string
  unit?: string
  tolerance?: number
  direction?: "max" | "min"
  quote?: string
  ruled?: string
  readings: { t: number; value?: number; verdict: string; after?: string; evidence?: string }[]
  /** From the last two readings: `away` when the latest is further past the tolerance than the one before. */
  trend?: "toward" | "away" | "level"
}

export interface Standing {
  label: string
  kind: OptionKind
  cites: Cite[]
  offers: number
  firstT: number
  lastT: number
  state: OptionState
  why?: string
  activeMin?: number
  tokens?: number
}

export interface Tiles {
  decisions: number
  closeDeclined: number
  closeOffered: number
  standing: number
  checkpoints: number
  /** Chosen options (of items with a gate) that have a gate reading after them, and all of them. */
  readOf: number
  chosenOf: number
  /** Chosen options in a row, at the end, with no gate reading after them. */
  sinceReading: number
  pending?: string
  activeMin?: number
  tokens?: number
}

export interface TrackerModel {
  system: string
  now: number
  items: string[]
  weighted: boolean
  /** Sessions the trail names that have no transcript copy. */
  missingTranscripts: string[]
  nodes: ModelNode[]
  gates: ModelGate[]
  standing: Standing[]
  tiles: Tiles
  problems: { errors: number; warnings: number }
  hiddenSuperseded: number
}

function normalize(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export function buildModel(
  trail: Trail,
  findings: Finding[],
  options: { ledger?: Ledger; ticks?: Tick[]; missingTranscripts?: string[]; now?: number },
): TrackerModel {
  const { ledger, ticks } = options
  const now = options.now ?? Date.now() / 1000
  const state = resolve(trail)
  const byId = new Map(state.decisions.map((d) => [d.id, d]))
  const live = state.decisions.filter((d) => !state.superseded.has(d.id))

  const cite = (label: string): Cite => {
    const ref = parseQualified(label)
    const entry = ref && ledger?.entries.find((e) => e.key === labelKey(ref))
    return entry
      ? { label, title: entry.title, status: status(entry), url: `vscode://file${encodeURI(`${entry.file}:${entry.line}`)}` }
      : { label }
  }

  const optionState = (d: Decision, o: TrailOption, chose: number[]): OptionState => {
    if (chose.includes(o.n)) return "taken"
    return state.marks.get(optionRef(d.id, o.n))?.state ?? "unexplored"
  }

  // The decision that took an option up later, found through `from`.
  const takenLater = new Map<string, string>()
  for (const d of live) if (d.from) takenLater.set(d.from, d.id)

  const sorted = [...live].sort((a, b) => a.t - b.t || a.line - b.line)
  const nodes: ModelNode[] = sorted.map((d, i) => {
    const choice = state.choices.get(d.id)
    const chose = choice?.chose ?? []
    const prev = sorted[i - 1]
    const prevChose = prev ? (state.choices.get(prev.id)?.chose ?? []) : []
    const continues = !d.from || (prev && OPTION_REF.exec(d.from)?.[1] === prev.id && prevChose.includes(Number(OPTION_REF.exec(d.from)?.[2])))
    return {
      id: d.id,
      t: d.t,
      answeredAt: choice?.t,
      item: d.item,
      question: d.question,
      checkpoint: d.checkpoint,
      backfilled: d.backfilled,
      options: d.options.map((o) => ({
        n: o.n,
        label: o.label,
        kind: o.kind,
        state: optionState(d, o, chose),
        note: o.note,
        why: state.marks.get(optionRef(d.id, o.n))?.why,
        recommended: d.recommended === o.n,
        cites: o.cites.map(cite),
        takenLaterBy: chose.includes(o.n) ? undefined : takenLater.get(optionRef(d.id, o.n)),
      })),
      chose,
      other: choice?.other,
      quote: choice?.quote,
      from: d.from,
      jump: continues ? undefined : { from: d.from! },
      cites: d.options.filter((o) => chose.includes(o.n)).flatMap((o) => o.cites).map(cite),
      pending: !choice,
      tEnd: now,
    }
  })

  // Weights: from the answer to a decision to the answer to the next.
  const start = (n: ModelNode) => n.answeredAt ?? n.t
  const lastTick = ticks && ticks.length > 0 ? ticks[ticks.length - 1].t : now
  nodes.forEach((n, i) => {
    n.tEnd = i + 1 < nodes.length ? start(nodes[i + 1]) : Math.max(lastTick + 1, start(n))
    if (ticks && ticks.length > 0) {
      const w = weigh(ticks, start(n), n.tEnd)
      n.activeMin = w.activeMin
      n.tokens = w.tokens
    }
  })

  // Gates and readings.
  const gates: ModelGate[] = state.gates
    .filter((g) => !state.superseded.has(g.id))
    .map((g: Gate) => {
      const readings = state.readings.filter((r) => r.gate === g.id).sort((a, b) => a.t - b.t).map((r) => ({ t: r.t, value: r.value, verdict: r.verdict, after: r.after, evidence: r.evidence }))
      const past = (v: number) => (g.direction === "min" ? (g.tolerance ?? 0) - v : v - (g.tolerance ?? 0))
      const withValue = readings.filter((r) => r.value !== undefined)
      let trend: ModelGate["trend"]
      if (g.tolerance !== undefined && withValue.length >= 2) {
        const a = past(withValue[withValue.length - 2].value!)
        const b = past(withValue[withValue.length - 1].value!)
        trend = b > a ? "away" : b < a ? "toward" : "level"
      }
      return { id: g.id, item: g.item, statement: g.statement, metric: g.metric, unit: g.unit, tolerance: g.tolerance, direction: g.direction, quote: g.quote, ruled: g.ruled, readings, trend }
    })

  // Standing alternatives: options offered and never taken, merged across decisions.
  const optionAt = (ref: string): TrailOption | undefined => {
    const m = OPTION_REF.exec(ref)
    return m ? byId.get(m[1])?.options.find((o) => o.n === Number(m[2])) : undefined
  }
  const keyOf = (o: TrailOption, depth = 0): string => {
    const target = o.revives && depth < 20 ? optionAt(o.revives) : undefined
    return target ? keyOf(target, depth + 1) : normalize(o.label)
  }
  const groups = new Map<string, { label: string; kind: OptionKind; cites: Set<string>; offers: number; firstT: number; lastT: number; takenEver: boolean; state: OptionState; why?: string }>()
  for (const d of sorted) {
    const chose = state.choices.get(d.id)?.chose ?? []
    for (const o of d.options) {
      const key = keyOf(o)
      const g = groups.get(key) ?? { label: o.label, kind: o.kind, cites: new Set<string>(), offers: 0, firstT: d.t, lastT: d.t, takenEver: false, state: "unexplored" as OptionState }
      g.label = o.label
      g.kind = o.kind
      o.cites.forEach((c) => g.cites.add(c))
      g.lastT = d.t
      if (chose.includes(o.n)) g.takenEver = true
      else g.offers += 1
      const mark = state.marks.get(optionRef(d.id, o.n))
      if (mark && !chose.includes(o.n)) {
        g.state = mark.state
        g.why = mark.why
      }
      groups.set(key, g)
    }
  }
  const standing: Standing[] = [...groups.values()]
    .filter((g) => !g.takenEver && g.offers > 0)
    .map((g) => ({
      label: g.label, kind: g.kind, cites: [...g.cites].map(cite), offers: g.offers, firstT: g.firstT, lastT: g.lastT, state: g.state, why: g.why,
      ...(ticks && ticks.length > 0 ? weigh(ticks, g.firstT, now) : {}),
    }))
    .sort((a, b) => b.offers - a.offers || a.firstT - b.firstT)

  // Tiles.
  const gated = new Set(gates.map((g) => g.item))
  const readAfter = new Set(state.readings.map((r) => r.after).filter(Boolean))
  const chosenRefs = nodes.filter((n) => n.item && gated.has(n.item)).flatMap((n) => n.chose.map((c) => ({ ref: optionRef(n.id, c), t: n.t })))
  let since = 0
  for (const c of [...chosenRefs].reverse()) {
    if (readAfter.has(c.ref)) break
    since += 1
  }
  const closeOffered = nodes.flatMap((n) => n.options.filter((o) => o.kind === "close"))
  const items = [...new Set(nodes.map((n) => n.item).filter((i): i is string => !!i))]
  const timed = nodes.filter((n) => n.activeMin !== undefined)
  const tiles: Tiles = {
    decisions: nodes.length,
    closeOffered: closeOffered.length,
    closeDeclined: closeOffered.filter((o) => o.state !== "taken").length,
    standing: standing.length,
    checkpoints: nodes.filter((n) => n.checkpoint).length,
    readOf: chosenRefs.filter((c) => readAfter.has(c.ref)).length,
    chosenOf: chosenRefs.length,
    sinceReading: since,
    pending: nodes.find((n) => n.pending)?.id,
    activeMin: timed.length ? Math.round(timed.reduce((a, n) => a + (n.activeMin ?? 0), 0) * 10) / 10 : undefined,
    tokens: timed.length ? timed.reduce((a, n) => a + (n.tokens ?? 0), 0) : undefined,
  }
  return {
    system: trail.system ?? "",
    now,
    items,
    weighted: timed.length > 0,
    missingTranscripts: options.missingTranscripts ?? [],
    nodes,
    gates,
    standing,
    tiles,
    problems: { errors: findings.filter((f) => f.severity === "error").length, warnings: findings.filter((f) => f.severity === "warning").length },
    hiddenSuperseded: state.decisions.length - live.length,
  }
}
