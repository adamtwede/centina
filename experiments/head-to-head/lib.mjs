// Shared names and helpers for the head-to-head harness (docs/head-to-head.md,
// "Isolation"). Plain Node, no dependencies, so it runs the same on every OS.

import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const HERE = path.dirname(fileURLToPath(import.meta.url))

export const RUN_IMAGE = "centina-h2h-run"
export const PROXY_IMAGE = "centina-h2h-proxy"
export const PROXY_NAME = "centina-h2h-proxy"
/** Run containers join only this network; `--internal` gives it no route out. */
export const NET_INTERNAL = "centina-h2h-internal"
/** The proxy's second network, the one with a route out. */
export const NET_EGRESS = "centina-h2h-egress"
export const PROXY_URL = `http://${PROXY_NAME}:8888`

/**
 * Hardening and network flags every run container gets, the escape test's
 * included, so the test exercises exactly what a run gets.
 */
export const CONTAINER_FLAGS = [
  "--network", NET_INTERNAL,
  "--cap-drop", "ALL",
  "--security-opt", "no-new-privileges",
  "--pids-limit", "512",
  "--memory", "4g",
  // Both cases: Node reads the upper-case names, and curl reads only the
  // lower-case `http_proxy`.
  "-e", `HTTPS_PROXY=${PROXY_URL}`,
  "-e", `HTTP_PROXY=${PROXY_URL}`,
  "-e", "NO_PROXY=localhost,127.0.0.1",
  "-e", `https_proxy=${PROXY_URL}`,
  "-e", `http_proxy=${PROXY_URL}`,
  "-e", "no_proxy=localhost,127.0.0.1",
]

/** Run docker synchronously; returns { status, stdout, stderr }. */
export function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", ...options })
  if (result.error) throw new Error(`docker ${args[0]}: ${result.error.message}`)
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
}

export function proxyRunning() {
  const { status, stdout } = docker(["inspect", "-f", "{{.State.Running}}", PROXY_NAME])
  return status === 0 && stdout.trim() === "true"
}

/** Fail with the command that fixes it, rather than run without the proxy. */
export function requireProxy() {
  if (!proxyRunning()) {
    throw new Error(`the proxy isn't running; start it with: node ${path.join(HERE, "net.mjs")} up`)
  }
}

/**
 * The subscription token from `claude setup-token`. The author keeps it in a
 * file outside every repo; nothing here prints it, and run output is scrubbed
 * for it (see `scrub`).
 */
export function tokenPath() {
  return process.env.CENTINA_H2H_TOKEN_FILE ?? path.join(homedir(), ".centina-h2h", "oauth-token")
}

export function readToken() {
  const file = tokenPath()
  let token
  try {
    token = readFileSync(file, "utf8").trim()
  } catch {
    throw new Error(
      `no token at ${file}. Run \`claude setup-token\` and save the token it prints to that file ` +
        "(or point CENTINA_H2H_TOKEN_FILE at another file).",
    )
  }
  if (!token) throw new Error(`${file} is empty`)
  return token
}

export function scrub(text, token) {
  return token ? text.split(token).join("[REDACTED-TOKEN]") : text
}

/** `--name value` and `--flag` parsing; positional arguments land in `_`. */
export function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith("--")) {
      args._.push(arg)
      continue
    }
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith("--")) args[key] = true
    else args[key] = argv[++i]
  }
  return args
}
