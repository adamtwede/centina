#!/usr/bin/env node
// One headless run of the head-to-head experiment, in isolation
// (docs/head-to-head.md, "Isolation" and "Authentication"). Builds the run's
// working directory fresh from a manifest (never a .git), starts a container
// on the internal network with the author's subscription token, pipes the
// prompt to `claude -p`, and records the transcript and the run's metadata.
// Then run audit.mjs on the run directory before using anything from it.
//
// Usage: node experiments/head-to-head/run.mjs --manifest <file> --prompt <file>
//          [--out <dir>] [--id <run id>] [--model <id>] [--timeout <minutes>]
//
// The manifest is JSON: { "files": [{ "from": "<path>", "to": "<path in /work>" }] },
// with `from` relative to the manifest's directory.
//
// The run directory gets:
//   work/              the container's /work, inputs first, then whatever the agent wrote
//   transcript.jsonl   the stream-json transcript, scrubbed of the token
//   stderr.log         the CLI's stderr, scrubbed
//   meta.json          model, CLI version, inputs with hashes, timing, usage, status

import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  CONTAINER_FLAGS,
  docker,
  HERE,
  parseArgs,
  readToken,
  requireProxy,
  RUN_IMAGE,
  scrub,
} from "./lib.mjs"

const DEFAULT_MODEL = "claude-opus-5-5"
const DEFAULT_TIMEOUT_MINUTES = 90

function fail(message) {
  console.error(message)
  process.exit(1)
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

/** Copy the manifest's files into `work`, refusing anything that could carry history. */
function buildWork(manifestPath, work) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail("manifest has no files")
  const base = path.dirname(manifestPath)
  const inputs = []
  for (const { from, to } of manifest.files) {
    if (typeof from !== "string" || typeof to !== "string") fail(`bad manifest entry: ${JSON.stringify({ from, to })}`)
    const source = path.resolve(base, from)
    const target = path.resolve(work, to)
    if (!target.startsWith(work + path.sep)) fail(`manifest target escapes /work: ${to}`)
    if ([from, to].some((p) => p.split(/[\\/]/).includes(".git"))) fail(`manifest entry touches .git: ${from}`)
    if (!existsSync(source)) fail(`manifest source missing: ${source}`)
    if (!statSync(source).isFile()) fail(`manifest sources must be files, not directories: ${source}`)
    mkdirSync(path.dirname(target), { recursive: true })
    cpSync(source, target)
    inputs.push({ to, sha256: sha256(source) })
  }
  return inputs
}

/**
 * Read the final `result` event. A run cut off by a usage limit must never be
 * scored as finished (docs/head-to-head.md, "Usage limits"), so anything but a
 * clean success is marked for the author to look at.
 */
function classify(lines, exitCode, timedOut) {
  let result = null
  for (const line of lines) {
    try {
      const event = JSON.parse(line)
      if (event.type === "result") result = event
    } catch {
      // A partial line from a killed run; the status below already says so.
    }
  }
  if (timedOut) return { status: "timeout", result }
  if (!result) return { status: "no-result", result }
  const text = typeof result.result === "string" ? result.result : ""
  if (/usage limit|rate limit|limit reached|out of (extra )?usage/i.test(text)) return { status: "usage-limit", result }
  if (result.is_error || result.subtype !== "success" || exitCode !== 0) return { status: "error", result }
  return { status: "complete", result }
}

const args = parseArgs(process.argv.slice(2))
if (typeof args.manifest !== "string" || typeof args.prompt !== "string") {
  fail("usage: run.mjs --manifest <file> --prompt <file> [--out <dir>] [--id <run id>] [--model <id>] [--timeout <minutes>]")
}

let token
try {
  requireProxy()
  token = readToken()
} catch (error) {
  fail(error.message)
}

const id = typeof args.id === "string" ? args.id : `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 6)}`
const runDir = path.resolve(typeof args.out === "string" ? args.out : path.join(HERE, "runs", id))
if (existsSync(runDir)) fail(`run directory already exists: ${runDir}`)
const work = path.join(runDir, "work")
mkdirSync(work, { recursive: true })

const inputs = buildWork(path.resolve(args.manifest), work)
const prompt = readFileSync(path.resolve(args.prompt), "utf8")
const model = typeof args.model === "string" ? args.model : DEFAULT_MODEL
const timeoutMinutes = Number(args.timeout ?? DEFAULT_TIMEOUT_MINUTES)

const image = docker(["image", "inspect", "-f", '{{.Id}} {{index .Config.Labels "centina.h2h.claude-code-version"}}', RUN_IMAGE])
if (image.status !== 0) fail(`no ${RUN_IMAGE} image; build it with: node ${path.join(HERE, "net.mjs")} build`)
const [imageId, cliVersion] = image.stdout.trim().split(" ")

const container = `centina-h2h-run-${id}`.replace(/[^a-zA-Z0-9_.-]/g, "-")
const dockerArgs = [
  "run", "--rm", "-i", "--name", container, ...CONTAINER_FLAGS,
  // Passed by name only, so the value comes from this process's environment
  // and never appears on a command line.
  "-e", "CLAUDE_CODE_OAUTH_TOKEN",
  "--mount", `type=bind,source=${work},target=/work`,
  RUN_IMAGE,
  "claude", "-p",
  "--output-format", "stream-json", "--verbose",
  "--model", model,
  "--dangerously-skip-permissions",
  "--disallowedTools", "WebFetch", "WebSearch",
]

const started = new Date()
const child = spawn("docker", dockerArgs, {
  env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: token },
  stdio: ["pipe", "pipe", "pipe"],
})
let stdout = ""
let stderr = ""
child.stdout.on("data", (chunk) => (stdout += chunk))
child.stderr.on("data", (chunk) => (stderr += chunk))
child.stdin.end(prompt)

let timedOut = false
const timer = setTimeout(() => {
  timedOut = true
  docker(["kill", container])
}, timeoutMinutes * 60_000)

const exitCode = await new Promise((resolve) => child.on("close", resolve))
clearTimeout(timer)
const ended = new Date()

const transcript = scrub(stdout, token)
writeFileSync(path.join(runDir, "transcript.jsonl"), transcript)
writeFileSync(path.join(runDir, "stderr.log"), scrub(stderr, token))

const lines = transcript.split("\n").filter(Boolean)
const { status, result } = classify(lines, exitCode, timedOut)
const meta = {
  id,
  status,
  model,
  cliVersion,
  imageId,
  started: started.toISOString(),
  ended: ended.toISOString(),
  exitCode,
  inputs,
  promptSha256: createHash("sha256").update(prompt).digest("hex"),
  usage: result?.usage ?? null,
  numTurns: result?.num_turns ?? null,
  durationMs: result?.duration_ms ?? null,
  audited: false,
}
writeFileSync(path.join(runDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n")

console.log(`${status}: ${runDir}`)
console.log(`next: node ${path.join(HERE, "audit.mjs")} ${runDir} --canaries <file>`)
process.exit(status === "complete" ? 0 : 1)
