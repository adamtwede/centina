import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { HASH_MARKER, depsCurrent, packageHash, pluginVersion, syncCheckerSource } from "./checker-sync.mjs"

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function tree(files) {
  const root = mkdtempSync(path.join(tmpdir(), "sync-"))
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(root, name)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

function fakePlugin(extra = {}) {
  return tree({
    "checker/package.json": JSON.stringify({ dependencies: { "ts-morph": "^28.0.0" } }),
    "checker/cli.ts": "// new rule\n",
    "centina.ts": "// vocabulary\n",
    "conformance.ts": "// conformance\n",
    ".claude-plugin/plugin.json": JSON.stringify({ version: "9.9.9" }),
    ...extra,
  })
}

describe("checker sync", () => {
  it("replaces stale source and leaves installed dependencies alone", () => {
    const root = fakePlugin()
    const data = tree({
      "checker/cli.ts": "// old rule\n",
      "checker/node_modules/ts-morph/index.js": "installed",
    })

    syncCheckerSource(root, data)

    assert.equal(readFileSync(path.join(data, "checker/cli.ts"), "utf8"), "// new rule\n")
    assert.ok(existsSync(path.join(data, "checker/node_modules/ts-morph/index.js")))
    assert.equal(readFileSync(path.join(data, "centina.ts"), "utf8"), "// vocabulary\n")
  })

  it("does not carry a dev checkout's own node_modules across", () => {
    const root = fakePlugin({ "checker/node_modules/stale/index.js": "checkout copy" })
    const data = tree({})
    syncCheckerSource(root, data)
    assert.equal(existsSync(path.join(data, "checker/node_modules/stale/index.js")), false)
  })

  it("reads the installed dependency hash", () => {
    const root = fakePlugin()
    const data = tree({})
    assert.equal(depsCurrent(root, data), false)
    writeFileSync(path.join(data, HASH_MARKER), packageHash(root))
    assert.equal(depsCurrent(root, data), true)
    writeFileSync(path.join(root, "checker/package.json"), JSON.stringify({ dependencies: { "ts-morph": "^29" } }))
    assert.equal(depsCurrent(root, data), false)
  })

  it("reads the plugin version, and survives a missing manifest", () => {
    assert.equal(pluginVersion(fakePlugin()), "9.9.9")
    assert.equal(pluginVersion(tree({})), undefined)
  })
})

describe("centina-check wrapper", () => {
  const wrapper = path.join(repoRoot, "bin", "centina-check")
  const run = (env) => spawnSync(process.execPath, [wrapper], { encoding: "utf8", env: { ...process.env, ...env } })

  it("refuses when dependencies are out of date for the plugin version", () => {
    const root = fakePlugin()
    const data = tree({ "checker/node_modules/ts-morph/index.js": "installed" })
    writeFileSync(path.join(data, HASH_MARKER), "an older plugin's hash")

    const result = run({ CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: data })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /dependencies are out of date/)
    // Source was still brought forward, so the next session starts current.
    assert.equal(readFileSync(path.join(data, "checker/cli.ts"), "utf8"), "// new rule\n")
  })

  it("says which checker it ran", () => {
    const root = fakePlugin()
    const data = tree({ "checker/node_modules/ts-morph/index.js": "installed" })
    writeFileSync(path.join(data, HASH_MARKER), packageHash(root))
    const result = run({ CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: data })
    assert.match(result.stderr, /checker 9\.9\.9 from /)
  })

  it("warns rather than pretending when the plugin root is unknown", () => {
    const data = tree({ "checker/node_modules/ts-morph/index.js": "installed" })
    const result = run({ CLAUDE_PLUGIN_ROOT: "", CLAUDE_PLUGIN_DATA: data })
    assert.match(result.stderr, /could not be brought up to date/)
  })
})
