#!/usr/bin/env node
// The isolation's positive control (docs/head-to-head.md, "Isolation",
// "Proof that it holds"): from inside a container started exactly as a run's
// is, try to get out on purpose and confirm every attempt fails, and that the
// one sanctioned route (the API through the proxy) works. Needs no token.
// Run once per image build, and after any change to the proxy or networks.
//
// Usage: node experiments/head-to-head/escape-test.mjs

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { CONTAINER_FLAGS, docker, requireProxy, RUN_IMAGE } from "./lib.mjs"

// Each check: a name, whether the command should succeed ("ok") or fail
// ("fail"), and the command. `-f` makes curl fail on an HTTP error status, so
// a proxy refusal (403) counts as a failure for the blocked hosts.
const CHECKS = [
  ["API reachable through the proxy", "ok", "curl -sS --max-time 20 -o /dev/null https://api.anthropic.com/"],
  ["API unreachable bypassing the proxy", "fail", "curl -sS --max-time 10 --noproxy '*' -o /dev/null https://api.anthropic.com/"],
  ["GitHub blocked", "fail", "curl -fsS --max-time 15 -o /dev/null https://github.com/"],
  ["raw GitHub blocked", "fail", "curl -fsS --max-time 15 -o /dev/null https://raw.githubusercontent.com/"],
  ["npm registry blocked", "fail", "curl -fsS --max-time 15 -o /dev/null https://registry.npmjs.org/"],
  ["plain HTTP blocked", "fail", "curl -fsS --max-time 15 -o /dev/null http://example.com/"],
  ["outside names don't resolve", "fail", "getent hosts github.com"],
  ["no host drive", "fail", "test -e /mnt/c"],
  ["no Docker Desktop host mount", "fail", "test -e /host_mnt"],
  ["no user CLAUDE.md", "fail", 'test -e "$HOME/.claude/CLAUDE.md"'],
  ["no memory directory", "fail", 'test -e "$HOME/.claude/projects"'],
  [
    "nothing mounted but /work",
    "ok",
    // Mount points other than the kernel's own and the three files Docker
    // always provides; anything else is a mount the run didn't ask for.
    "test -z \"$(awk '{print $2}' /proc/mounts | grep -vE '^/$|^/(proc|dev|sys)(/|$)|^/etc/(hosts|hostname|resolv\\.conf)$|^/work$')\"",
  ],
]

const script = CHECKS.map(
  ([name, expect, command]) =>
    `if ( ${command} ) >/tmp/out 2>&1; then got=ok; else got=fail; fi; ` +
    `if [ "$got" = "${expect}" ]; then echo "PASS  ${name}"; ` +
    `else echo "FAIL  ${name} (expected ${expect}, got $got): $(head -c 300 /tmp/out | tr '\\n' ' ')"; fi`,
).join("\n")

try {
  requireProxy()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const work = mkdtempSync(path.join(tmpdir(), "h2h-escape-"))
try {
  const result = docker([
    "run", "--rm", ...CONTAINER_FLAGS,
    "--mount", `type=bind,source=${work},target=/work`,
    RUN_IMAGE, "bash", "-c", script,
  ])
  process.stdout.write(result.stdout)
  if (result.stderr.trim()) process.stderr.write(result.stderr)
  const lines = result.stdout.split("\n").filter(Boolean)
  const failed = lines.filter((line) => line.startsWith("FAIL")).length
  const passed = lines.filter((line) => line.startsWith("PASS")).length
  if (result.status !== 0 || passed + failed !== CHECKS.length) {
    console.error(`\nthe test container didn't complete every check (exit ${result.status})`)
    process.exit(1)
  }
  console.log(failed ? `\n${failed} of ${CHECKS.length} checks FAILED: the isolation does not hold` : `\nall ${CHECKS.length} checks passed`)
  process.exit(failed ? 1 : 0)
} finally {
  rmSync(work, { recursive: true, force: true })
}
