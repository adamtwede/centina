import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { checkLedger, checkProposals } from "./check"
import { runLedgerCommand } from "./command"
import { affectedWorkItems, renderIndex, renderStanding } from "./generate"
import { commentLines, readLedger, scanBuildRoot, scanSystemFiles } from "./parse"

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

  it("leaves @agent labels alone outside a spec file", () => {
    const found = check({ "LEDGER.md": VALID, "contracts.ts": `// @agent(C1): free text\nexport {}\n` })
    assert.deepEqual(found, [])
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

const BUILD_LEDGER = `# Ledger: demo

### matcher:W1: phase 1, the matcher slice
- Kind: phase
- Status: active

### matcher:W2: build the scorer
- Kind: step
- Phase: matcher:W1
- Status: planned

### matcher:W3: land the registry
- Kind: step
- Phase: matcher:W1
- Status: done

### matcher:Q1: how are ties broken
- Status: answered

### matcher:P1: score on recency
- Status: superseded
- Obsoleted-by: matcher:P2

### matcher:P2: score on recency and depth
- Status: ratified
- Obsoletes: matcher:P1
`

function buildTree(files: Record<string, string>): string {
  const root = path.join(mkdtempSync(path.join(tmpdir(), "build-")), "src")
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(root, name)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

function checkBuild(ledgerText: string, files: Record<string, string>) {
  const dir = system({ "LEDGER.md": ledgerText })
  return checkLedger(readLedger(dir), scanSystemFiles(dir), scanBuildRoot(buildTree(files)))
}

describe("build-code citations", () => {
  it("checks the owner of a throw-only member in an implements class", () => {
    const found = checkBuild(BUILD_LEDGER, {
      "registry.ts": [
        "const UNBUILT = 'not built'",
        "export class RegistryImpl implements Registry {",
        "  register(): void {",
        "    throw new Error('not built; owned by matcher:W2')",
        "  }",
        "  land(): void {",
        "    throw new Error('not built; owned by matcher:W3')",
        "  }",
        "  tie(): void {",
        "    throw new Error(`not built; owned by ${'matcher:Q1'}`)",
        "  }",
        "  shared(): void {",
        "    throw new Error(UNBUILT)",
        "  }",
        "  two(): void {",
        "    throw new Error('owned by matcher:W2 and matcher:W1')",
        "  }",
        "  part(): void {",
        "    throw new Error('out of scope for matcher:W1(a)')",
        "  }",
        "  missing(): void {",
        "    throw new Error('owned by matcher:W40')",
        "  }",
        "}",
        "export class NotAFill {",
        "  loose(): void {",
        "    throw new Error('no owner needed here')",
        "  }",
        "}",
      ].join("\n"),
    })
    assert.deepEqual(
      found.map((f) => [f.rule, f.line]),
      [
        ["ledger-unbuilt-owner", 6],
        ["ledger-unbuilt-owner", 9],
        ["ledger-unbuilt-owner", 12],
        ["ledger-unbuilt-owner", 15],
        ["ledger-unbuilt-owner", 18],
        ["ledger-undefined-label", 21],
      ],
    )
    assert.match(found[0].message, /matcher:W3, which is done/)
    assert.match(found[1].message, /matcher:Q1, which is not a work item/)
    assert.match(found[2].message, /names no work item/)
    // A missing owner is a warning; a label that resolves wrongly is an error.
    assert.deepEqual(found.map((f) => f.severity), [
      "error",
      "error",
      "warning",
      "error",
      "error",
      "error",
    ])
    assert.match(found[3].message, /an unbuilt member has one owner/)
    assert.match(found[4].message, /not a part of one/)
  })

  it("covers a member whose body is an arrow property", () => {
    const found = checkBuild(BUILD_LEDGER, {
      "arrow.ts": [
        "export class ArrowImpl implements Registry {",
        "  register = (): void => {",
        "    throw new Error('owned by matcher:W3')",
        "  }",
        "}",
      ].join("\n"),
    })
    assert.deepEqual(found.map((f) => f.rule), ["ledger-unbuilt-owner"])
  })

  it("reports a bare owner label once, not twice", () => {
    const found = checkBuild(BUILD_LEDGER, {
      "bare.ts": [
        "export class BareImpl implements Registry {",
        "  go(): void {",
        "    throw new Error('owned by W2')",
        "  }",
        "}",
      ].join("\n"),
    })
    assert.deepEqual(found.map((f) => f.rule), ["ledger-bare-label"])
  })

  it("reads build-code comments but no other string", () => {
    const found = checkBuild(BUILD_LEDGER, {
      "guards.ts": [
        "// Rejects out-of-order beams per matcher:P1.",
        "export class ScorerImpl implements Scorer {",
        "  score(input: number): number {",
        "    if (input < 0) throw new Error('rejected per matcher:P1')",
        "    return input",
        "  }",
        "}",
      ].join("\n"),
    })
    assert.deepEqual(found.map((f) => [f.rule, f.line]), [["ledger-stale-citation", 1]])
  })

  it("accepts a guard citing a provisional limit and an owner citing an open step", () => {
    const found = checkBuild(
      `${BUILD_LEDGER}\n### matcher:R1: bodies do not rotate\n- Kind: limit\n- Status: provisional\n- Review: when rotation is built\n`,
      {
        "field.ts": [
          "// Refuses a rotated body per matcher:R1.",
          "export class FieldImpl implements Field {",
          "  sample(angle: number): number {",
          "    if (angle !== 0) throw new Error('rotation unsupported (matcher:R1)')",
          "    return angle",
          "  }",
          "  future(): void {",
          "    throw new Error('not built; owned by matcher:W2')",
          "  }",
          "}",
        ].join("\n"),
      },
    )
    assert.deepEqual(found, [])
  })

  it("covers an unbuilt member that validates before it throws", () => {
    const found = checkBuild(BUILD_LEDGER, {
      "panel.ts": [
        "export class PanelImpl implements Panel {",
        "  scrollback(id: string): unknown {",
        "    this.getOrThrow(id)",
        "    throw new Error('not built; owned by matcher:W3')",
        "  }",
        "  history(id: string): unknown {",
        "    const known = this.getOrThrow(id)",
        "    if (known === undefined) throw new Error('rejected per matcher:P2')",
        "    throw new Error('not built; owned by matcher:W2')",
        "  }",
        "}",
      ].join("\n"),
    })
    // `history` is well-formed: its owner is open, and the label in the guard
    // above it is not a second owner.
    assert.deepEqual(found.map((f) => [f.rule, f.line]), [["ledger-unbuilt-owner", 2]])
    assert.match(found[0].message, /matcher:W3, which is done/)
  })

  it("leaves a member that can still return out of the unbuilt set", () => {
    const found = checkBuild(BUILD_LEDGER, {
      "partial.ts": [
        "export class PartialImpl implements Panel {",
        "  cached(id: string): number {",
        "    if (id === '') return 0",
        "    throw new Error('owned by matcher:W3')",
        "  }",
        "  swallowed(id: string): number {",
        "    try {",
        "      return this.lookup(id)",
        "    } catch {",
        "      throw new Error('owned by matcher:W3')",
        "    }",
        "  }",
        "}",
      ].join("\n"),
    })
    assert.deepEqual(found, [])
  })
})

describe("ledger settings", () => {
  function project(config: unknown, files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), "project-"))
    const systemDir = path.join(root, "specs", "demo")
    for (const [name, content] of Object.entries(files)) {
      const full = path.join(root, name)
      mkdirSync(path.dirname(full), { recursive: true })
      writeFileSync(full, content)
    }
    if (config !== undefined) {
      mkdirSync(path.join(root, ".centina"), { recursive: true })
      writeFileSync(
        path.join(root, ".centina", "config.json"),
        JSON.stringify({ hostRoot: root, artifactsRoot: root, ...(config as object) }),
      )
    }
    return systemDir
  }

  function run(dir: string): { code: number; output: string } {
    const log = console.log
    const lines: string[] = []
    console.log = (...args: unknown[]) => lines.push(args.join(" "))
    try {
      return { code: runLedgerCommand([dir]), output: lines.join("\n") }
    } finally {
      console.log = log
    }
  }

  it("checks the build roots named for the system", () => {
    const dir = project(
      { systems: { "specs/demo": { buildRoots: ["prototype/src"] } } },
      {
        "specs/demo/LEDGER.md": BUILD_LEDGER,
        "specs/demo/REALIZE-STATE.md": "# Run frame\n\nBuild roots: see `.centina/config.json`.\n",
        "prototype/src/registry.ts":
          "export class R implements Registry {\n  go(): void {\n    throw new Error('owned by matcher:W3')\n  }\n}\n",
      },
    )
    const { code, output } = run(dir)
    assert.equal(code, 1)
    assert.match(output, /ledger-unbuilt-owner/)
    assert.match(output, /matcher:W3, which is done/)
  })

  it("reports a system that has run realize with no build roots named", () => {
    const dir = project(
      {},
      { "specs/demo/LEDGER.md": BUILD_LEDGER, "specs/demo/REALIZE-STATE.md": "# Run frame\n" },
    )
    const { code, output } = run(dir)
    assert.equal(code, 1)
    assert.match(output, /ledger-config/)
    assert.match(output, /systems\["specs\/demo"\]\.buildRoots is unset/)
  })

  it("stays quiet for a system that has not run realize", () => {
    const dir = project({}, { "specs/demo/LEDGER.md": BUILD_LEDGER })
    assert.equal(run(dir).code, 0)
  })

  it("reports a build root that does not exist", () => {
    const dir = project(
      { systems: { "specs/demo": { buildRoots: ["prototype/gone"] } } },
      { "specs/demo/LEDGER.md": BUILD_LEDGER, "specs/demo/REALIZE-STATE.md": "# Run frame\n" },
    )
    const { code, output } = run(dir)
    assert.equal(code, 1)
    assert.match(output, /which does not exist/)
  })
})

describe("limit rules", () => {
  it("lists limits apart from the rules meant to last", () => {
    const standing = renderStanding(
      readLedger(
        system({
          "LEDGER.md": `### sz:R1: only the simulation generates content\n- Kind: structural\n- Status: ratified\n\n### sz:R2: bodies do not rotate\n- Kind: limit\n- Status: provisional\n- Review: when rotation is built\n`,
        }),
      ),
    )
    assert.match(standing, /## Rules\n\n- `sz:R1` \(structural\): only the simulation generates content/)
    assert.match(standing, /## Current limits\n\n- `sz:R2` \(provisional\): bodies do not rotate/)
  })
})
