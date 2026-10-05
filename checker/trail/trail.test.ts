import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { readLedger } from "../ledger/parse"
import { analyze, checkTrail } from "./check"
import { TRACKER_FILE, runTrailCommand } from "./command"
import { buildModel } from "./model"
import { readTrail } from "./parse"
import { readTicks, weigh } from "./weights"

const HEADER = `{"type":"trail","version":1,"system":"demo"}`
const LEDGER = `# Ledger: demo

### demo:W1: a spike
- Kind: spike
- Status: active

### demo:F1: first finding
- Status: measured-false
- Premises: demo:W1

### demo:F2: second finding
- Status: measured
- Premises: demo:W1
`

function line(o: object): string {
  return JSON.stringify(o)
}

function decision(n: number, extra: Record<string, unknown> = {}) {
  return line({
    type: "decision", id: `demo/d${n}`, at: `2026-10-0${n}T10:00:00Z`, item: "demo:W1", question: `what next ${n}?`,
    options: [
      { n: 1, label: "Overlap test", kind: "refine", cites: ["demo:F1"] },
      { n: 2, label: "Return to the earlier approach", kind: "branch" },
      { n: 3, label: "Stop and record", kind: "close" },
    ],
    ...extra,
  })
}

function choice(n: number, chose: number[], extra: Record<string, unknown> = {}) {
  return line({ type: "choice", decision: `demo/d${n}`, chose, at: `2026-10-0${n}T10:30:00Z`, quote: "go", ...extra })
}

function system(trail: string[], files: Record<string, string> = {}): string {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "trail-")), "demo")
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, "LEDGER.md"), LEDGER)
  writeFileSync(path.join(dir, "TRAIL.jsonl"), `${trail.join("\n")}\n`)
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    writeFileSync(path.join(dir, name), content)
  }
  return dir
}

function allRules(trail: string[]): string[] {
  const dir = system(trail)
  return checkTrail(readTrail(dir)!, readLedger(dir)).map((f) => f.rule)
}

/** The rules that fire, without the active spike's missing gate, which the fixture ledger always has. */
function rules(trail: string[]): string[] {
  return allRules(trail).filter((r) => r !== "trail-spike-no-gate")
}

describe("trail parsing and rules", () => {
  it("accepts a well-formed trail", () => {
    assert.deepEqual(rules([HEADER, decision(1), choice(1, [1]), decision(2, { from: "demo/d1.1" })]), [])
  })

  it("reports a line that is not JSON or has the wrong shape, and keeps reading", () => {
    const dir = system([HEADER, "{nope", line({ type: "decision", id: "bad" }), decision(1), choice(1, [1])])
    const trail = readTrail(dir)!
    assert.equal(trail.problems.filter((p) => p.rule === "trail-parse").length, 2)
    assert.equal(trail.records.length, 2)
  })

  it("warns when the header line is missing", () => {
    assert.deepEqual(rules([decision(1), choice(1, [1])]), ["trail-parse"])
  })

  it("holds references to what exists: from, revives, choice, reading, mark", () => {
    const found = rules([
      HEADER,
      decision(1, { from: "demo/d9.1" }),
      choice(1, [7]),
      line({ type: "choice", decision: "demo/d5", chose: [1], at: "2026-10-01T11:00:00Z" }),
      line({ type: "reading", gate: "demo/g4", verdict: "fail", at: "2026-10-01T11:00:00Z" }),
      line({ type: "mark", option: "demo/d1.9", state: "parked", at: "2026-10-01T11:00:00Z" }),
    ])
    assert.deepEqual(found.filter((r) => r === "trail-ref").length, 5)
  })

  it("holds a gate to the human's ruling", () => {
    const drafted = line({ type: "gate", id: "demo/g1", item: "demo:W1", statement: "no more than 3 dB", at: "2026-10-01T11:00:00Z" })
    assert.ok(rules([HEADER, drafted]).includes("trail-gate-ruling"))
    const ruled = line({ type: "gate", id: "demo/g1", item: "demo:W1", statement: "no more than 3 dB", ruled: "demo:W1", quote: "the 3 dB tolerance stands", at: "2026-10-01T11:00:00Z" })
    assert.ok(!rules([HEADER, ruled]).includes("trail-gate-ruling"))
  })

  it("warns about a decision with no close option", () => {
    const noClose = line({ type: "decision", id: "demo/d1", at: "2026-10-01T10:00:00Z", question: "q", options: [{ n: 1, label: "a", kind: "refine" }, { n: 2, label: "b", kind: "refine" }] })
    assert.ok(rules([HEADER, noClose, choice(1, [1])]).includes("trail-no-close"))
  })

  it("warns about a decision left unanswered while work moved on, but not the latest one", () => {
    assert.ok(rules([HEADER, decision(1), decision(2)]).includes("trail-unanswered"))
    assert.ok(!rules([HEADER, decision(1), choice(1, [1]), decision(2)]).includes("trail-unanswered"))
  })

  it("rejects a repeated id and a label the ledger does not have", () => {
    assert.ok(rules([HEADER, decision(1), decision(1)]).includes("trail-id"))
    const unknown = line({ type: "decision", id: "demo/d1", at: "2026-10-01T10:00:00Z", item: "demo:W9", question: "q", options: [{ n: 1, label: "a", kind: "refine", cites: ["demo:F9"] }, { n: 2, label: "b", kind: "close" }] })
    assert.equal(rules([HEADER, unknown]).filter((r) => r === "trail-label").length, 2)
  })

  it("notices an active spike with findings and no decision, which is how dropped capture shows", () => {
    const found = allRules([HEADER, line({ type: "link", scope: "x", file: "TRAIL-x.jsonl", at: "2026-10-01T10:00:00Z" })])
    assert.ok(found.includes("trail-missing-decision"))
    assert.ok(found.includes("trail-spike-no-gate"))
  })

  it("positive control: a correct trail is quiet and each rule above fires only on its own fault", () => {
    assert.deepEqual(rules([HEADER, decision(1), choice(1, [1])]), [])
    const gate = line({ type: "gate", id: "demo/g1", item: "demo:W1", statement: "s", ruled: "demo:W1", quote: "q", at: "2026-10-01T09:00:00Z" })
    assert.deepEqual(allRules([HEADER, gate, decision(1), choice(1, [1])]), [])
  })
})

describe("the tracker model", () => {
  const model = (trail: string[], files: Record<string, string> = {}, ticks?: boolean) => {
    const dir = system(trail, files)
    const t = readTrail(dir)!
    return buildModel(t, checkTrail(t, readLedger(dir)), { ledger: readLedger(dir), ticks: ticks ? readTicks(path.join(dir, "transcripts", "s1.jsonl")) : undefined, now: Date.parse("2026-10-09T00:00:00Z") / 1000 })
  }

  it("states what was taken, offered and left, and finds a return to an earlier option", () => {
    const m = model([HEADER, decision(1), choice(1, [1]), decision(2, { from: "demo/d1.1" }), choice(2, [1]), decision(3, { from: "demo/d1.2", options: [{ n: 1, label: "Return to the earlier approach", kind: "branch", revives: "demo/d1.2" }, { n: 2, label: "Stop and record", kind: "close" }] }), choice(3, [1])])
    assert.deepEqual(m.nodes.map((n) => n.chose), [[1], [1], [1]])
    assert.equal(m.nodes[1].jump, undefined)
    assert.deepEqual(m.nodes[2].jump, { from: "demo/d1.2" })
    assert.equal(m.nodes[0].options.find((o) => o.n === 2)!.takenLaterBy, "demo/d3")
    assert.equal(m.nodes[0].options.find((o) => o.n === 3)!.state, "unexplored")
  })

  it("merges an alternative offered again, by revives or by its words, into one standing alternative", () => {
    const m = model([HEADER, decision(1), choice(1, [1]), decision(2, { from: "demo/d1.1" }), choice(2, [1]), decision(3, { from: "demo/d2.1" }), choice(3, [1])])
    const stop = m.standing.find((s) => s.kind === "close")!
    assert.equal(stop.offers, 3)
    const branch = m.standing.find((s) => s.label === "Return to the earlier approach")!
    assert.equal(branch.offers, 3)
    assert.equal(m.tiles.closeDeclined, 3)
    assert.equal(m.tiles.closeOffered, 3)
  })

  it("opens on the item asked for, else the latest one, and counts each item on its own", () => {
    const two = [HEADER, decision(1), choice(1, [1]), decision(2, { item: "demo:W2" }), choice(2, [1]), decision(3, { item: "demo:W2", from: "demo/d2.1" })]
    const dir = system(two)
    const t = readTrail(dir)!
    const build = (item?: string) => buildModel(t, checkTrail(t, readLedger(dir)), { ledger: readLedger(dir), item, now: Date.parse("2026-10-09T00:00:00Z") / 1000 })
    assert.equal(build().focus, "demo:W2")
    assert.equal(build("demo:W1").focus, "demo:W1")
    assert.equal(build("demo:W9").focus, "demo:W2", "an item the trail never mentions is ignored")
    const m = build()
    assert.deepEqual([m.views["demo:W1"].tiles.decisions, m.views["demo:W2"].tiles.decisions, m.tiles.decisions], [1, 2, 3])
    assert.equal(m.itemInfo["demo:W1"].decisions, 1)
    assert.equal(m.itemInfo["demo:W1"].title, "a spike")
  })

  it("lets a mark settle a branch, and a branch taken once is no longer standing", () => {
    const m = model([HEADER, decision(1), choice(1, [1]), line({ type: "mark", option: "demo/d1.2", state: "parked", why: "waits on data", at: "2026-10-02T09:00:00Z" }), decision(2, { from: "demo/d1.1" }), choice(2, [2])])
    assert.equal(m.nodes[0].options.find((o) => o.n === 2)!.state, "parked")
    assert.ok(!m.standing.some((s) => s.label === "Return to the earlier approach"))
  })

  it("follows a gate's readings and says whether the latest moved away from the tolerance", () => {
    const gate = line({ type: "gate", id: "demo/g1", item: "demo:W1", statement: "step <= 3 dB", unit: "dB", tolerance: 3, direction: "max", ruled: "demo:W1", quote: "3 dB", at: "2026-10-01T09:00:00Z" })
    const reading = (n: number, value: number, after: string) => line({ type: "reading", gate: "demo/g1", after, value, verdict: "fail", at: `2026-10-0${n}T11:00:00Z` })
    const m = model([HEADER, gate, decision(1), choice(1, [1]), reading(1, 4.2, "demo/d1.1"), decision(2, { from: "demo/d1.1" }), choice(2, [1]), reading(2, 5.1, "demo/d2.1"), decision(3, { from: "demo/d2.1" }), choice(3, [1])])
    assert.equal(m.gates[0].trend, "away")
    assert.deepEqual([m.tiles.readOf, m.tiles.chosenOf, m.tiles.sinceReading], [2, 3, 1])
  })

  it("hides a decision a later record corrects", () => {
    const m = model([HEADER, decision(1), decision(2, { corrects: "demo/d1" }), choice(2, [1])])
    assert.deepEqual(m.nodes.map((n) => n.id), ["demo/d2"])
    assert.equal(m.hiddenSuperseded, 1)
  })

  it("weighs the work after each answer from the transcript, counting an assistant message once and ignoring long gaps", () => {
    const at = (iso: string) => iso
    const row = (type: string, ts: string, extra: object = {}) => line({ type, timestamp: at(ts), ...extra })
    const transcript = [
      row("user", "2026-10-01T10:30:00Z"),
      row("assistant", "2026-10-01T10:31:00Z", { message: { id: "m1", usage: { output_tokens: 100 } } }),
      row("assistant", "2026-10-01T10:31:00Z", { message: { id: "m1", usage: { output_tokens: 100 } } }),
      row("assistant", "2026-10-01T10:35:00Z", { message: { id: "m2", usage: { output_tokens: 50 } } }),
      row("assistant", "2026-10-01T12:00:00Z", { message: { id: "m3", usage: { output_tokens: 10 } } }),
    ].join("\n")
    const m = model([HEADER, decision(1, { session: "s1" }), choice(1, [1])], { "transcripts/s1.jsonl": transcript }, true)
    assert.equal(m.weighted, true)
    assert.equal(m.nodes[0].tokens, 160)
    assert.equal(m.nodes[0].activeMin, 5)
    assert.equal(weigh([], 0, 10).tokens, 0)
  })
})

function waive(extra: Record<string, unknown> = {}) {
  return line({
    type: "waive", rule: "trail-spike-no-gate", subject: "demo:W1", why: "retrofitted, not revisiting", quote: "leave it",
    at: "2026-10-05T09:00:00Z", ...extra,
  })
}

describe("waivers", () => {
  const run = (trail: string[]) => {
    const dir = system(trail)
    return analyze(readTrail(dir)!, readLedger(dir))
  }
  const base = [HEADER, decision(1), choice(1, [1])]

  it("moves the warning of its rule for its subject to waived, and keeps the others", () => {
    const { findings, waived } = run([...base, waive()])
    assert.ok(!findings.some((f) => f.rule === "trail-spike-no-gate"))
    assert.deepEqual(waived.map((w) => w.finding.rule), ["trail-spike-no-gate"])
    assert.ok(!findings.some((f) => f.rule === "trail-waive"))
  })

  it("does not touch the same rule for another subject, or another rule for the subject", () => {
    assert.ok(run([...base, waive({ subject: "demo:W2" })]).findings.some((f) => f.rule === "trail-spike-no-gate"))
    const noClose = line({ type: "decision", id: "demo/d1", at: "2026-10-01T10:00:00Z", item: "demo:W1", question: "q", options: [{ n: 1, label: "go", kind: "refine" }] })
    const { findings } = run([HEADER, noClose, choice(1, [1]), waive({ rule: "trail-no-close", subject: "demo/d1" })])
    assert.ok(!findings.some((f) => f.rule === "trail-no-close"))
    assert.ok(findings.some((f) => f.rule === "trail-spike-no-gate"))
  })

  it("is an error without the human's quote, and then waives nothing", () => {
    const { findings } = run([...base, waive({ quote: undefined })])
    assert.ok(findings.some((f) => f.rule === "trail-waive" && f.severity === "error"))
    assert.ok(findings.some((f) => f.rule === "trail-spike-no-gate"))
  })

  it("warns when it matches nothing, and when it names an error rule", () => {
    assert.ok(run([...base, waive({ rule: "trail-no-close" })]).findings.some((f) => f.rule === "trail-waive" && f.severity === "warning"))
    const bad = line({ type: "choice", decision: "demo/d1", chose: [9], at: "2026-10-01T11:00:00Z" })
    const { findings } = run([HEADER, decision(1), bad, waive({ rule: "trail-ref", subject: "demo/d1" })])
    assert.ok(findings.some((f) => f.rule === "trail-ref" && f.severity === "error"))
  })

  it("is ended by a later lifted record", () => {
    const { findings, waived } = run([...base, waive(), waive({ lifted: true, at: "2026-10-06T09:00:00Z" })])
    assert.ok(findings.some((f) => f.rule === "trail-spike-no-gate"))
    assert.equal(waived.length, 0)
  })

  it("is listed on the page", () => {
    const dir = system([...base, waive()])
    runTrailCommand([dir])
    assert.match(readFileSync(path.join(dir, TRACKER_FILE), "utf8"), /retrofitted, not revisiting/)
  })
})

describe("centina-check trail", () => {
  it("writes TRACKER.html with the model embedded, and not again when nothing changed", () => {
    const dir = system([HEADER, decision(1), choice(1, [1])])
    assert.equal(runTrailCommand([dir]), 0)
    const html = readFileSync(path.join(dir, TRACKER_FILE), "utf8")
    assert.match(html, /demo\/d1/)
    assert.doesNotMatch(html, /__DATA__/)
  })

  it("--check validates and writes nothing; an error makes the exit code 1", () => {
    const dir = system([HEADER, decision(1), choice(1, [9])])
    assert.equal(runTrailCommand(["--check", dir]), 1)
    assert.equal(existsSync(path.join(dir, TRACKER_FILE)), false)
  })

  it("is not an error for a system with no trail", () => {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), "trail-")), "empty")
    mkdirSync(dir)
    assert.equal(runTrailCommand([dir]), 0)
  })

  it("cannot be broken by markup in a label", () => {
    const evil = line({ type: "decision", id: "demo/d1", at: "2026-10-01T10:00:00Z", question: "</script><b>x", options: [{ n: 1, label: "</script>", kind: "refine" }, { n: 2, label: "stop", kind: "close" }] })
    const dir = system([HEADER, evil, choice(1, [1])])
    runTrailCommand([dir])
    assert.equal((readFileSync(path.join(dir, TRACKER_FILE), "utf8").match(/<\/script>/g) ?? []).length, 2)
  })
})
