import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, before, describe, it } from "node:test"
import { Project } from "ts-morph"
import { diagnosticsForScope } from "./diagnostics"

// Regression: a scoped run once reported every project-wide tsc error for
// each scoped file, so a clean spec failed because a neighbour was broken.
describe("diagnosticsForScope", () => {
  let dir: string
  let project: Project

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), "centina-diagnostics-"))
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, module: "esnext", moduleResolution: "bundler", target: "es2022" },
        include: ["*.centina.ts"],
      }),
    )
    writeFileSync(path.join(dir, "broken.centina.ts"), 'export const broken: number = "not a number"\n')
    writeFileSync(path.join(dir, "clean.centina.ts"), "export const fine: number = 1\n")
    project = new Project({ tsConfigFilePath: path.join(dir, "tsconfig.json") })
  })

  after(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const file = (name: string) => project.getSourceFileOrThrow(path.join(dir, name))

  it("reports nothing for a clean file scoped alone, even when a neighbour is broken", () => {
    assert.deepEqual(diagnosticsForScope(project, [file("clean.centina.ts")]), [])
  })

  it("reports the broken file's own error when it is in scope", () => {
    const diagnostics = diagnosticsForScope(project, [file("broken.centina.ts")])
    assert.equal(diagnostics.length, 1)
    assert.equal(diagnostics[0].getSourceFile()?.getBaseName(), "broken.centina.ts")
  })

  it("reports each in-scope error once when several files are scoped", () => {
    const diagnostics = diagnosticsForScope(project, [file("broken.centina.ts"), file("clean.centina.ts")])
    assert.equal(diagnostics.length, 1)
  })

  it("reports project-wide diagnostics when no scope is given", () => {
    const diagnostics = diagnosticsForScope(project)
    assert.equal(diagnostics.length, 1)
    assert.equal(diagnostics[0].getSourceFile()?.getBaseName(), "broken.centina.ts")
  })
})
