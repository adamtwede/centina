import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (rel) => readFileSync(path.join(repo, rel), "utf8")

// The docs/ leaf of the directory tree in docs/plugin-file-layout.md.
function layoutDocs() {
  const lines = read("docs/plugin-file-layout.md").split("\n")
  const start = lines.findIndex((l) => /^[│├└─\s]*docs\/$/.test(l))
  assert.notEqual(start, -1, "no docs/ node in plugin-file-layout.md's tree")
  const names = []
  for (const line of lines.slice(start + 1)) {
    const m = line.match(/^\s*[├└]── (\S+\.md)$/)
    if (!m) break
    names.push(m[1])
  }
  return names
}

// The doc filenames install.sh copies, allowing for line continuations.
function installerDocs() {
  const body = read("install.sh").replace(/\\\n/g, " ")
  const m = body.match(/^for doc in (.+?); do$/m)
  assert.ok(m, "no docs loop in install.sh")
  return m[1].trim().split(/\s+/)
}

// Bundled files that name a doc through the plugin root at read time.
function referencedDocs(bundled) {
  const sources = ["skills/centina-session-zero/SKILL.md", "skills/centina-iterate/SKILL.md", "skills/centina-realize/SKILL.md", ...bundled.map((d) => `docs/${d}`)]
  const found = new Set()
  for (const rel of sources) {
    for (const m of read(rel).matchAll(/CLAUDE_PLUGIN_ROOT\}\/docs\/([A-Za-z0-9_-]+\.md)/g)) {
      found.add(m[1])
    }
  }
  return found
}

describe("plugin bundle", () => {
  it("installs exactly the docs the layout tree declares", () => {
    assert.deepEqual([...installerDocs()].sort(), [...layoutDocs()].sort())
  })

  it("installs every doc a bundled file reads from the plugin root", () => {
    const bundled = installerDocs()
    for (const name of referencedDocs(bundled)) {
      assert.ok(bundled.includes(name), `${name} is read via CLAUDE_PLUGIN_ROOT but install.sh does not copy it`)
    }
  })

  it("copies only paths that exist", () => {
    for (const doc of installerDocs()) {
      assert.ok(existsSync(path.join(repo, "docs", doc)), `docs/${doc} is missing`)
    }
    for (const m of read("install.sh").matchAll(/^cp (?:-R )?"\$SRC\/([^"]+)"/gm)) {
      assert.ok(existsSync(path.join(repo, m[1])), `${m[1]} is missing`)
    }
  })
})
