import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { currentVersion, nextVersion, writeVersion } from "./bump-version.mjs"

describe("nextVersion", () => {
  it("bumps major, resetting minor and patch", () => {
    assert.equal(nextVersion("1.2.3", "major"), "2.0.0")
  })

  it("bumps minor, resetting patch", () => {
    assert.equal(nextVersion("1.2.3", "minor"), "1.3.0")
  })

  it("bumps patch and hotfix identically", () => {
    assert.equal(nextVersion("1.2.3", "patch"), "1.2.4")
    assert.equal(nextVersion("1.2.3", "hotfix"), "1.2.4")
  })

  it("rejects an unknown level", () => {
    assert.throws(() => nextVersion("1.2.3", "bogus"))
  })

  it("rejects a non-semver current version", () => {
    assert.throws(() => nextVersion("1.2", "patch"))
  })
})

describe("currentVersion / writeVersion", () => {
  it("round-trips a version and preserves the rest of the file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "bump-version-"))
    const file = path.join(dir, "package.json")
    const original = '{\n  "name": "demo",\n  "version": "0.3.2",\n  "license": "ISC"\n}\n'
    writeFileSync(file, original)

    assert.equal(currentVersion(file), "0.3.2")
    writeVersion(file, "0.4.0")

    assert.equal(currentVersion(file), "0.4.0")
    assert.equal(readFileSync(file, "utf8"), original.replace("0.3.2", "0.4.0"))
  })
})
