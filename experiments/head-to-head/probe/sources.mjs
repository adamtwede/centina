#!/usr/bin/env node
// Builds the probe's three nested sources (docs/head-to-head.md, "Separate
// probe", method step 3) from the specs as frozen, each with a run manifest.
// Every file is read from git at a pinned commit, never from the working
// tree, so a later edit to a spec or the contract can't reach a run. Each
// source also gets the I/O contract (contract.ts), word for word.
//
// The filled spec's header opens with a provenance note (lines 1–4) that all
// three sources drop (settled 2026-10-25), so each source carries the header
// from "loop:" on. Nothing else is changed.
//
// Usage: node experiments/head-to-head/probe/sources.mjs [--check]
//   (no flag)  write sources/<name>/ and its manifest.json
//   --check    exit non-zero if anything written differs from a fresh build

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, "sources")

/** The no-fill version's freeze commit; the filled spec and its siblings are unchanged there since 8dc0f29. */
const SOURCE_COMMIT = "96264f6a422bbe429767a64ab9c1b721d9df9195"
/** The contract as settled (draft 2). */
const CONTRACT_COMMIT = "da977b53025a4f52494e0d36eb9d0058b7e9d887"
const CONTRACT = "experiments/head-to-head/probe/contract.ts"
const SPEC_DIR = "specs/hill-climbing-loop"
const SIBLINGS = ["shared", "task-matcher", "task-corpus"].map((n) => `${SPEC_DIR}/${n}.centina.ts`)

/** The header's provenance note: three lines and the blank comment line after them. */
const PROVENANCE_LINES = 4
const PROVENANCE_START = "// hill-climbing-loop.centina.ts — the Centina port of prototype.aisl"

function fail(message) {
  console.error(message)
  process.exit(1)
}

function atCommit(file, commit = SOURCE_COMMIT) {
  const text = execFileSync("git", ["show", `${commit}:${file}`], {
    cwd: HERE,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
  return text.replace(/\r\n/g, "\n")
}

/** A loop spec without its provenance note, refusing a file whose header isn't the one expected. */
function withoutProvenance(file) {
  const lines = atCommit(file).split("\n")
  if (!lines[0].startsWith(PROVENANCE_START) || lines[PROVENANCE_LINES - 1] !== "//") {
    fail(`${file} at ${SOURCE_COMMIT} doesn't open with the expected provenance note`)
  }
  if (lines[PROVENANCE_LINES] !== "// loop:") fail(`${file}: the header doesn't continue with "// loop:"`)
  return lines.slice(PROVENANCE_LINES).join("\n")
}

/** The header comment alone, from "loop:" to step 6, as plain text. */
function proseHeader() {
  const lines = withoutProvenance(`${SPEC_DIR}/hill-climbing-loop.centina.ts`).split("\n")
  const end = lines.findIndex((line) => !line.startsWith("//"))
  if (end <= 0) fail("couldn't find the end of the header comment")
  return lines.slice(0, end).map((line) => line.replace(/^\/\/ ?/, "")).join("\n") + "\n"
}

/** Each source as { "<path in /work>": content }. */
function build() {
  const contract = { "contract.ts": atCommit(CONTRACT, CONTRACT_COMMIT) }
  const vocabulary = atCommit("centina.ts")
  const siblings = Object.fromEntries(SIBLINGS.map((f) => [f, atCommit(f)]))
  const loopAs = `${SPEC_DIR}/hill-climbing-loop.centina.ts`
  return {
    prose: { ...contract, "hill-climbing-loop.md": proseHeader() },
    nofill: {
      ...contract,
      "centina.ts": vocabulary,
      ...siblings,
      [loopAs]: withoutProvenance(`${SPEC_DIR}/hill-climbing-loop.nofill.centina.ts`),
    },
    filled: {
      ...contract,
      "centina.ts": vocabulary,
      ...siblings,
      [loopAs]: withoutProvenance(loopAs),
    },
  }
}

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join("/")]
  })
}

function rendered(files) {
  const manifest = {
    sourceCommit: SOURCE_COMMIT,
    contractCommit: CONTRACT_COMMIT,
    files: Object.keys(files)
      .sort()
      .map((to) => ({ from: `files/${to}`, to })),
  }
  return {
    ...Object.fromEntries(Object.entries(files).map(([to, text]) => [`files/${to}`, text])),
    "manifest.json": JSON.stringify(manifest, null, 2) + "\n",
  }
}

const check = process.argv.includes("--check")
const sources = build()
let stale = []

for (const [name, files] of Object.entries(sources)) {
  const dir = path.join(OUT, name)
  const want = rendered(files)
  if (check) {
    const have = listFiles(dir)
    for (const rel of new Set([...have, ...Object.keys(want)])) {
      const full = path.join(dir, rel)
      const current = existsSync(full) ? readFileSync(full, "utf8").replace(/\r\n/g, "\n") : undefined
      if (current !== want[rel]) stale.push(`${name}/${rel}`)
    }
    continue
  }
  rmSync(dir, { recursive: true, force: true })
  for (const [rel, text] of Object.entries(want)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    writeFileSync(path.join(dir, rel), text)
  }
  console.log(`${name}: ${Object.keys(files).length} file(s)`)
}

if (check) {
  if (stale.length) fail(`sources out of date with ${SOURCE_COMMIT}:\n  ${stale.join("\n  ")}`)
  console.log(`sources match ${SOURCE_COMMIT}`)
}
