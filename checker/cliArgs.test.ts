import assert from "node:assert/strict"
import path from "node:path"
import { describe, it } from "node:test"
import { parseCheckArgs } from "./cliArgs"

const base = path.resolve("caller", "dir")

describe("parseCheckArgs", () => {
  it("resolves relative spec paths against the caller directory, not the process cwd", () => {
    const { requestedPaths } = parseCheckArgs(["specs/a.centina.ts"], base)
    assert.deepEqual(requestedPaths, [path.resolve(base, "specs/a.centina.ts")])
  })

  it("resolves a relative --project against the caller directory", () => {
    const { tsConfigFilePath } = parseCheckArgs(["--project", "tsconfig.json"], base)
    assert.equal(tsConfigFilePath, path.resolve(base, "tsconfig.json"))
  })

  it("leaves absolute paths unchanged", () => {
    const absolute = path.resolve("elsewhere", "spec.centina.ts")
    const { requestedPaths } = parseCheckArgs([absolute], base)
    assert.deepEqual(requestedPaths, [absolute])
  })

  it("does not treat the value after --project as a spec path", () => {
    const { requestedPaths, tsConfigFilePath } = parseCheckArgs(
      ["--project", "t.json", "a.centina.ts"],
      base,
    )
    assert.equal(tsConfigFilePath, path.resolve(base, "t.json"))
    assert.deepEqual(requestedPaths, [path.resolve(base, "a.centina.ts")])
  })

  it("keeps spec paths in the order given", () => {
    const { requestedPaths } = parseCheckArgs(["b.centina.ts", "a.centina.ts"], base)
    assert.deepEqual(requestedPaths, [
      path.resolve(base, "b.centina.ts"),
      path.resolve(base, "a.centina.ts"),
    ])
  })

  it("returns no project and no paths for empty argv", () => {
    assert.deepEqual(parseCheckArgs([], base), {
      tsConfigFilePath: undefined,
      requestedPaths: [],
    })
  })

  it("throws when --project has no value", () => {
    assert.throws(() => parseCheckArgs(["--project"], base), {
      message: "--project requires a path argument",
    })
  })
})
