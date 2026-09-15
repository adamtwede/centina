import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { decide, findSystemDir, hookMode } from "./ledger-hook.mjs"
import { candidateSystemDirs, copyTranscript, sessionSystemDirs } from "./transcript-hook.mjs"

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))

function tree(files) {
  const root = mkdtempSync(path.join(tmpdir(), "hooks-"))
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(root, name)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

describe("ledger hook", () => {
  it("finds the nearest directory with a LEDGER.md", () => {
    const root = tree({ "specs/demo/LEDGER.md": "", "specs/demo/sub/a.centina.ts": "" })
    assert.equal(findSystemDir(path.join(root, "specs/demo/sub/a.centina.ts")), path.join(root, "specs/demo"))
    assert.equal(findSystemDir(path.join(root, "specs/other.md")), undefined)
  })

  it("reads ledgerHook from the nearest config and defaults to block", () => {
    const root = tree({ "specs/demo/LEDGER.md": "", "specs/plain/LEDGER.md": "" })
    assert.equal(hookMode(path.join(root, "specs/demo")), "block")
    writeFileSync(path.join(root, "specs/demo/.keep"), "")
    mkdirSync(path.join(root, ".centina"))
    writeFileSync(path.join(root, ".centina/config.json"), JSON.stringify({ ledgerHook: "warn" }))
    assert.equal(hookMode(path.join(root, "specs/demo")), "warn")
    writeFileSync(path.join(root, ".centina/config.json"), "{not json")
    assert.equal(hookMode(path.join(root, "specs/plain")), "block")
  })

  it("blocks on failure by default, warns when configured, and passes on success", () => {
    assert.deepEqual(decide({ mode: "block", systemDir: "/s", status: 0, output: "" }), { exitCode: 0 })
    const blocked = decide({ mode: "block", systemDir: "/s", status: 1, output: "bad label" })
    assert.equal(blocked.exitCode, 2)
    assert.match(blocked.stderr, /bad label/)
    const warned = decide({ mode: "warn", systemDir: "/s", status: 1, output: "bad label" })
    assert.equal(warned.exitCode, 0)
    assert.match(JSON.parse(warned.stdout).hookSpecificOutput.additionalContext, /bad label/)
  })
})

describe("transcript hook", () => {
  it("finds system directories under the cwd and related registered projects", () => {
    const root = tree({
      "host/centina/specs/under/LEDGER.md": "",
      "host/centina/specs/noledger/NOTES.md": "",
      "unrelated/specs/x/LEDGER.md": "",
    })
    const dirs = candidateSystemDirs(path.join(root, "host"), [
      path.join(root, "host/centina"),
      path.join(root, "unrelated"),
    ])
    assert.deepEqual(dirs, [path.join(root, "host/centina/specs/under")])
  })

  it("matches sessions by ID in top-level markdown, ignoring generated files", () => {
    const root = tree({
      "a/LEDGER.md": "- Session: s-123\n",
      "b/LEDGER.md": "",
      "b/LEDGER-INDEX.md": "s-123",
    })
    assert.deepEqual(sessionSystemDirs([path.join(root, "a"), path.join(root, "b")], "s-123"), [path.join(root, "a")])
  })

  it("copies the transcript and ignores the transcripts directory in git", () => {
    const root = tree({ "sys/LEDGER.md": "", "t.jsonl": "{}\n" })
    const target = copyTranscript(path.join(root, "sys"), "s-1", path.join(root, "t.jsonl"))
    assert.equal(readFileSync(target, "utf8"), "{}\n")
    assert.equal(readFileSync(path.join(root, "sys/transcripts/.gitignore"), "utf8"), "*\n")
  })

  it("runs end to end from hook input and always exits 0", () => {
    const root = tree({ "proj/specs/sys/LEDGER.md": "- Session: s-9\n", "t.jsonl": "line\n" })
    const run = (input) =>
      spawnSync(process.execPath, [path.join(scriptsDir, "transcript-hook.mjs")], {
        input: JSON.stringify(input),
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PLUGIN_DATA: path.join(root, "no-data") },
      })

    const ok = run({ session_id: "s-9", transcript_path: path.join(root, "t.jsonl"), cwd: path.join(root, "proj") })
    assert.equal(ok.status, 0)
    assert.ok(existsSync(path.join(root, "proj/specs/sys/transcripts/s-9.jsonl")))

    assert.equal(run({ session_id: "s-9", transcript_path: path.join(root, "missing.jsonl"), cwd: root }).status, 0)
  })
})
