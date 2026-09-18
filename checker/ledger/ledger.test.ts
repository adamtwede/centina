import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { checkLedger, checkProposals } from "./check"
import { runLedgerCommand } from "./command"
import { affectedWorkItems, renderIndex, renderStanding } from "./generate"
import { commentLines, readLedger, scanSystemFiles } from "./parse"

function system(files: Record<string, string>): string {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "ledger-")), "demo")
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return dir
}

function check(files: Record<string, string>) {
  const dir = system(files)
  return checkLedger(readLedger(dir), scanSystemFiles(dir))
}

function rules(files: Record<string, string>): string[] {
  return check(files).map((finding) => finding.rule)
}

const VALID = `# Ledger: demo

## Goals and rules

### sz:G1: Is information-first play engaging?
- Status: active

### sz:R1: Only the simulation touches content generation
- Kind: structural
- Status: ratified

## Decisions

### sz:P1: cap escalation depth at 3 attempts
- Date: 2026-05-14
- Status: superseded
- Obsoleted-by: sz:P2

Original text stays.

### sz:P2: cap escalation depth at 5 attempts
- Status: ratified
- Obsoletes: sz:P1

(a) Depth cap is 5.
(b) Cap applies per task.

### matcher:W1: phase 1, the matcher slice
- Kind: phase
- Status: active
- Constraints: sz:R1

### matcher:W2: build the scorer
- Kind: step
- Phase: matcher:W1
- Status: planned
- Premises: sz:P2(a)
`

describe("ledger check", () => {
  it("accepts a valid ledger", () => {
    assert.deepEqual(check({ "LEDGER.md": VALID }), [])
  })

  it("reports duplicate labels", () => {
    assert.ok(rules({ "LEDGER.md": `${VALID}\n### sz:G1: again\n- Status: active\n` }).includes("ledger-duplicate-label"))
  })

  it("reports malformed headings, unknown fields and bad statuses", () => {
    const found = rules({
      "LEDGER.md": `### P3: no scope\n- Status: open\n\n### sz:P3: typo field\n- Stauts: open\n\n### sz:Q1: bad status\n- Status: ratified\n`,
    })
    assert.ok(found.includes("ledger-malformed"))
    assert.ok(found.includes("ledger-unknown-field"))
    assert.ok(found.includes("ledger-invalid-status"))
  })

  it("requires Kind on W and R, and rejects fields that do not apply", () => {
    const found = rules({
      "LEDGER.md": `### sz:W1: no kind\n- Status: planned\n\n### sz:P1: kind on a proposal\n- Kind: step\n- Status: open\n`,
    })
    assert.ok(found.includes("ledger-invalid-kind"))
    assert.ok(found.includes("ledger-field-not-applicable"))
  })

  it("reports one-way supersession and a status mismatch", () => {
    const found = rules({
      "LEDGER.md": `### sz:P1: old\n- Status: superseded\n\n### sz:P2: new\n- Status: ratified\n- Obsoletes: sz:P1\n`,
    })
    assert.equal(found.filter((r) => r === "ledger-supersession").length, 2)
  })

  it("checks Updates against Updated-by", () => {
    const found = rules({
      "LEDGER.md": `### sz:P1: old\n- Status: ratified\n\n(a) part\n\n### sz:P2: amends\n- Status: ratified\n- Updates: sz:P1(a)\n`,
    })
    assert.ok(found.includes("ledger-supersession"))
  })

  it("requires Evidence, Depends-on and Review where they apply", () => {
    const found = check({
      "LEDGER.md": `### sz:F1: measured\n- Status: measured\n\n### sz:W1: blocked\n- Kind: step\n- Status: blocked\n\n### sz:R1: provisional\n- Kind: method\n- Status: provisional\n`,
    }).filter((f) => f.rule === "ledger-missing-field")
    assert.equal(found.length, 3)
  })

  it("reports undefined labels and parts in headers, bodies and other files", () => {
    const found = check({
      "LEDGER.md": `### sz:P1: cites things\n- Status: open\n- Updates: sz:P9\n\nSee sz:P8 and sz:P1(z).\n`,
      "ARCHITECTURE.md": `Door decided by sz:P7.\n`,
    }).filter((f) => f.rule === "ledger-undefined-label")
    assert.equal(found.length, 4)
  })

  it("reports bare labels in markdown but resolves them in component spec comments", () => {
    const found = check({
      "LEDGER.md": VALID,
      "ARCHITECTURE.md": `Bare P2 here.\n`,
      "matcher.centina.ts": `// Decided by W2.\nconst W9 = 1\n`,
    })
    assert.deepEqual(
      found.map((f) => [f.rule, path.basename(f.file)]),
      [["ledger-bare-label", "ARCHITECTURE.md"]],
    )
  })

  it("reports a bare label that resolves to an undefined entry in a spec comment", () => {
    const found = check({ "LEDGER.md": VALID, "matcher.centina.ts": `/** See P40. */\nexport {}\n` })
    assert.deepEqual(found.map((f) => f.rule), ["ledger-undefined-label"])
  })

  it("reports citing a superseded label unless its successor is on the same line", () => {
    const found = check({
      "LEDGER.md": VALID,
      "ARCHITECTURE.md": `Cap from sz:P1.\nCap from sz:P1, replaced by sz:P2.\n`,
    })
    assert.deepEqual(found.map((f) => [f.rule, f.line]), [["ledger-stale-citation", 1]])
  })

  it("does not treat ledger bodies as current state", () => {
    assert.deepEqual(check({ "LEDGER.md": `${VALID}\n### sz:F1: history\n- Status: hypothesis\n\nEarlier we had sz:P1.\n` }), [])
  })

  it("reports citing an updated part without its updater", () => {
    const found = check({
      "LEDGER.md": `### sz:P1: old\n- Status: ratified\n- Updated-by: sz:P2\n\n(a) part\n\n### sz:P2: amends\n- Status: ratified\n- Updates: sz:P1(a)\n`,
      "ARCHITECTURE.md": `Uses sz:P1(a).\nUses sz:P1(a) as amended by sz:P2.\n`,
    })
    assert.deepEqual(found.map((f) => [f.rule, f.line]), [["ledger-stale-citation", 1]])
  })

  it("requires @agent labels in spec files to be ledger labels", () => {
    const found = check({
      "LEDGER.md": VALID,
      "matcher.centina.ts": `// @agent(C1): free text\n// @agent(W2): ledger label\n// @agent(sz:P2): qualified\n// @agent: unlabeled\nexport {}\n`,
    })
    assert.deepEqual(found.map((f) => [f.rule, f.line]), [["ledger-agent-label", 1]])
  })

  it("skips archive, transcripts, fenced code and cross-system citations", () => {
    const found = check({
      "LEDGER.md": VALID,
      "archive/OLD.md": `Bare P1.\n`,
      "transcripts/x.md": `sz:P99\n`,
      "NOTES.md": "```\nP1 sz:P99\n```\nSee chrysalis/physsim:P4.\n",
    })
    assert.deepEqual(found, [])
  })
})

describe("contracts module proposals", () => {
  const LEDGER = `### physsim:W1: pass a corridor per path to propagate
- Kind: change-request
- Status: active

### physsim:W2: floor depth in EnvironmentSample
- Kind: change-request
- Status: done

### physsim:W3: build arrivals
- Kind: step
- Status: active
`

  it("lists open overrides and reports closed, wrong-kind, undefined and malformed ones", () => {
    const ledger = readLedger(system({ "LEDGER.md": LEDGER }))
    const source = [
      "/** @proposal(physsim:W1) */",
      "/** @proposal(physsim:W2) */",
      "/** @proposal(physsim:W3) */",
      "/** @proposal(physsim:W9) */",
      "/** @proposal(W1) */",
      "export {}",
    ].join("\n")
    const findings = checkProposals(ledger, "contracts.ts", commentLines("contracts.ts", source))
    assert.deepEqual(
      findings.map((f) => [f.severity, f.rule, f.line]),
      [
        ["info", "ledger-proposal", 1],
        ["error", "ledger-proposal", 2],
        ["error", "ledger-proposal", 3],
        ["error", "ledger-undefined-label", 4],
        ["error", "ledger-proposal", 5],
      ],
    )
  })
})

describe("ledger generation", () => {
  it("lists standing goals and rules", () => {
    const standing = renderStanding(readLedger(system({ "LEDGER.md": VALID })))
    assert.match(standing, /- `sz:G1`: Is information-first play engaging\?/)
    assert.match(standing, /- `sz:R1` \(structural\): Only the simulation touches content generation/)
  })

  it("groups open items by phase and lists settled items with successors", () => {
    const index = renderIndex(readLedger(system({ "LEDGER.md": VALID })))
    assert.match(index, /## Phase matcher:W1\n\n\| Label \| Kind \| Status \| Title \|/)
    assert.match(index, /\| sz:P1 \| superseded \| cap escalation depth at 3 attempts \| sz:P2 \|/)
  })

  it("lists work items whose premises no longer hold", () => {
    const ledger = readLedger(
      system({
        "LEDGER.md": `### sz:F1: premise\n- Status: measured-false\n- Evidence: verify.ts\n\n### sz:W1: step\n- Kind: step\n- Status: planned\n- Premises: sz:F1\n`,
      }),
    )
    assert.deepEqual(
      affectedWorkItems(ledger).map(({ entry, reasons }) => [entry.key, reasons]),
      [["sz:W1", ["Premises sz:F1 is measured-false"]]],
    )
  })
})

describe("ledger command", () => {
  it("writes generated files, then reports them stale after a ledger edit", () => {
    const dir = system({ "LEDGER.md": VALID })
    const log = console.log
    console.log = () => {}
    try {
      assert.equal(runLedgerCommand([dir]), 0)
      assert.equal(runLedgerCommand(["--check", dir]), 0)
      writeFileSync(path.join(dir, "LEDGER.md"), `${VALID}\n### sz:G2: second goal\n- Status: active\n`)
      assert.equal(runLedgerCommand(["--check", dir]), 1)
      assert.equal(runLedgerCommand([dir]), 0)
      assert.match(readFileSync(path.join(dir, "STANDING.md"), "utf8"), /sz:G2/)
    } finally {
      console.log = log
    }
  })
})
