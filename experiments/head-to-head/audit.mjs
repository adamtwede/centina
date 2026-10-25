#!/usr/bin/env node
// Audits one run directory written by run.mjs (docs/head-to-head.md,
// "Isolation", "Proof that it holds"). A run is usable only once this passes.
//
//   leak       a canary from a hidden file appears anywhere in the run, or a
//              web tool was used. The run is discarded and the leak logged.
//   attempt    a tool call reached for the network or for a path outside the
//              container's own (/work, /tmp, its home, the system). Blocked by
//              the isolation, so not a leak, but recorded and read by a human.
//
// Usage: node experiments/head-to-head/audit.mjs <run dir> [--canaries <file>]
//   --canaries  one canary string per line (blank lines and # comments skipped)
//
// Writes <run dir>/audit.json and marks meta.json audited. Exits 1 on any leak.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { parseArgs } from "./lib.mjs"

const WEB_TOOLS = new Set(["WebFetch", "WebSearch"])
const PATH_FIELDS = ["file_path", "path", "notebook_path"]
const ALLOWED_ROOTS = ["/work", "/tmp", "/home/node", "/usr", "/bin", "/lib", "/etc", "/dev/null", "/proc/self"]
const NETWORK_COMMAND = /\b(curl|wget|nc|ncat|ssh|scp|telnet|git\s+(clone|fetch|pull)|npm\s+(i|install|view)|npx|pip3?\s+install)\b|https?:\/\//
const ABSOLUTE_PATH = /(?:^|[\s'"=(])(\/[A-Za-z0-9._\-/]+)/g
const WINDOWS_PATH = /\b[A-Za-z]:[\\/]/

function allowedPath(p) {
  return ALLOWED_ROOTS.some((root) => p === root || p.startsWith(root + "/"))
}

/** Every tool call in a stream-json transcript, subagents' included. */
function toolCalls(transcript) {
  const calls = []
  for (const line of transcript.split("\n")) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (event.type !== "assistant") continue
    for (const block of event.message?.content ?? []) {
      if (block.type === "tool_use") calls.push({ id: block.id, name: block.name, input: block.input ?? {} })
    }
  }
  return calls
}

function auditCall(call) {
  const findings = []
  const add = (kind, why) => findings.push({ kind, tool: call.name, id: call.id, why })
  if (WEB_TOOLS.has(call.name)) add("leak", `${call.name} used`)
  for (const field of PATH_FIELDS) {
    const value = call.input[field]
    if (typeof value === "string" && value.startsWith("/") && !allowedPath(value)) add("attempt", `${field} outside the container's own paths: ${value}`)
    if (typeof value === "string" && WINDOWS_PATH.test(value)) add("attempt", `${field} is a Windows path: ${value}`)
  }
  if (call.name === "Bash" && typeof call.input.command === "string") {
    const command = call.input.command
    if (NETWORK_COMMAND.test(command)) add("attempt", `network command: ${command.slice(0, 200)}`)
    for (const [, p] of command.matchAll(ABSOLUTE_PATH)) {
      if (!allowedPath(p)) add("attempt", `path outside the container's own paths in a command: ${p}`)
    }
    if (WINDOWS_PATH.test(command)) add("attempt", `Windows path in a command: ${command.slice(0, 200)}`)
  }
  return findings
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* files(full)
    else if (entry.isFile()) yield full
  }
}

function readCanaries(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
}

const args = parseArgs(process.argv.slice(2))
const runDir = args._[0] && path.resolve(args._[0])
if (!runDir) {
  console.error("usage: audit.mjs <run dir> [--canaries <file>]")
  process.exit(2)
}

const transcript = readFileSync(path.join(runDir, "transcript.jsonl"), "utf8")
const calls = toolCalls(transcript)
const findings = calls.flatMap(auditCall)

const canaryFile = typeof args.canaries === "string" ? path.resolve(args.canaries) : null
const canaries = canaryFile ? readCanaries(canaryFile) : []
for (const file of files(runDir)) {
  if (file === canaryFile || path.basename(file) === "audit.json" || statSync(file).size > 50_000_000) continue
  const text = readFileSync(file, "utf8")
  for (const canary of canaries) {
    if (text.includes(canary)) findings.push({ kind: "leak", file: path.relative(runDir, file), why: `canary found: ${canary}` })
  }
}

const leaks = findings.filter((f) => f.kind === "leak")
const attempts = findings.filter((f) => f.kind === "attempt")
const report = {
  audited: new Date().toISOString(),
  toolCalls: calls.length,
  canariesChecked: canaries.length,
  verdict: leaks.length ? "leaked" : "clean",
  findings,
}
writeFileSync(path.join(runDir, "audit.json"), JSON.stringify(report, null, 2) + "\n")

const metaPath = path.join(runDir, "meta.json")
const meta = JSON.parse(readFileSync(metaPath, "utf8"))
meta.audited = report.verdict
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n")

for (const f of findings) console.log(`${f.kind.padEnd(8)} ${f.tool ?? f.file}: ${f.why}`)
if (canaries.length === 0) console.log("warning: no canaries checked; pass --canaries for any run that had hidden files nearby")
console.log(`${report.verdict}: ${calls.length} tool calls, ${leaks.length} leaks, ${attempts.length} attempts`)
process.exit(leaks.length ? 1 : 0)
