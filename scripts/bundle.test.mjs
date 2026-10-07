import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { BUNDLE, assertSafeDestination, install, needsConfirmation } from "../install.mjs"

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (rel) => readFileSync(path.join(repo, rel), "utf8")

function withScratch(fn) {
  const scratch = mkdtempSync(path.join(tmpdir(), "centina-install-"))
  try {
    fn(scratch)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

function stub(root, rel, content = "") {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  writeFileSync(path.join(root, rel), content)
}

// A checkout holding just the paths the installer is supposed to copy.
function fakeCheckout(root) {
  for (const dir of BUNDLE.dirs) stub(root, `${dir}/keep`)
  for (const file of BUNDLE.files) stub(root, file)
  for (const doc of BUNDLE.docs) stub(root, `docs/${doc}`)
  return root
}

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

const installerDocs = () => BUNDLE.docs

// Bundled files that name a doc through the plugin root at read time.
function referencedDocs(bundled) {
  const sources = ["skills/centina-session-zero/SKILL.md", "skills/centina-iterate/SKILL.md", "skills/centina-realize/SKILL.md", "skills/centina-spike/SKILL.md", ...bundled.map((d) => `docs/${d}`)]
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
      assert.ok(bundled.includes(name), `${name} is read via CLAUDE_PLUGIN_ROOT but install.mjs does not copy it`)
    }
  })

  it("copies only paths that exist", () => {
    for (const doc of installerDocs()) {
      assert.ok(existsSync(path.join(repo, "docs", doc)), `docs/${doc} is missing`)
    }
    for (const rel of [...BUNDLE.dirs, ...BUNDLE.files]) {
      assert.ok(existsSync(path.join(repo, rel)), `${rel} is missing`)
    }
  })

  // Scripts run through a shebang or `node` on every OS; a CRLF checkout (git's
  // autocrlf on Windows) breaks them as `node\r: not found`.
  it("installs scripts with LF line endings", () => {
    withScratch((scratch) => {
      const dest = path.join(scratch, "centina")
      install(repo, dest)
      for (const rel of ["bin/centina-check", "scripts/session-start-install.mjs", "hooks/hooks.json"]) {
        assert.ok(!readFileSync(path.join(dest, rel), "utf8").includes("\r"), `${rel} has CRLF line endings`)
      }
    })
  })

  // Claude Code re-injects an invoked skill after each compaction, cut at 20,000
  // characters, and the cut loses the end of the file (the "What NOT to do" list
  // and the last steps of a close). A skill a long session depends on has to fit.
  it("keeps every skill inside the 20,000 characters kept after compaction", () => {
    for (const skill of ["centina-session-zero", "centina-iterate", "centina-realize", "centina-spike"]) {
      const length = read(`skills/${skill}/SKILL.md`).length
      assert.ok(length <= 20_000, `${skill} is ${length} characters; move detail into a doc read on demand`)
    }
  })
})

describe("installer", () => {
  it("replaces the destination and leaves out dev-only artifacts", () => {
    withScratch((scratch) => {
      const src = fakeCheckout(path.join(scratch, "src"))
      stub(src, "checker/node_modules/dep/index.js")
      stub(src, "checker/package-lock.json")
      stub(src, ".claude-plugin/types/index.d.ts")
      stub(src, "docs/dev-only.md")
      const dest = path.join(scratch, "dest")
      stub(dest, "stale.txt")
      install(src, dest)
      assert.ok(!existsSync(path.join(dest, "stale.txt")), "the old install should be removed")
      assert.ok(existsSync(path.join(dest, "checker/keep")))
      assert.ok(existsSync(path.join(dest, "docs", BUNDLE.docs[0])))
      for (const rel of ["checker/node_modules", "checker/package-lock.json", ".claude-plugin/types", "docs/dev-only.md"]) {
        assert.ok(!existsSync(path.join(dest, rel)), `${rel} should not be installed`)
      }
    })
  })

  it("refuses a destination that would delete or recurse into the checkout, or that contains home", () => {
    withScratch((scratch) => {
      const src = fakeCheckout(path.join(scratch, "src"))
      assert.throws(() => assertSafeDestination(src, src), /checkout/)
      assert.throws(() => assertSafeDestination(src, scratch), /checkout/)
      assert.throws(() => assertSafeDestination(src, path.join(src, "out")), /inside the checkout/)
      assert.throws(() => assertSafeDestination(src, homedir()), /would delete it/)
      assert.throws(() => assertSafeDestination(src, path.dirname(homedir())), /would delete it/)
      assert.doesNotThrow(() => assertSafeDestination(src, path.join(scratch, "elsewhere")))
    })
  })

  it("only asks before overwriting something real", () => {
    withScratch((scratch) => {
      assert.equal(needsConfirmation(path.join(scratch, "missing")), false)
      mkdirSync(path.join(scratch, "empty"))
      assert.equal(needsConfirmation(path.join(scratch, "empty")), false)
      stub(scratch, "full/file")
      assert.equal(needsConfirmation(path.join(scratch, "full")), true)
    })
  })

  it("replaces a symlinked destination without following it", (t) => {
    withScratch((scratch) => {
      const src = fakeCheckout(path.join(scratch, "src"))
      const link = path.join(scratch, "link")
      try {
        symlinkSync(src, link, "junction")
      } catch {
        return t.skip("cannot create links on this machine")
      }
      assert.equal(needsConfirmation(link), false)
      assert.doesNotThrow(() => assertSafeDestination(src, link))
      install(src, link)
      assert.ok(existsSync(path.join(src, "checker/keep")), "the checkout must survive")
      assert.ok(existsSync(path.join(link, "checker/keep")))
    })
  })
})
