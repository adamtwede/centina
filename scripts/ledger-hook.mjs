#!/usr/bin/env node
// PostToolUse hook: when a write lands inside a system directory that has a
// LEDGER.md, runs `centina-check ledger` on that directory. Errors block by
// default (exit 2, reason shown to Claude). The human can set
// "ledgerHook": "warn" or "off" in the project's .centina/config.json.
// Design: docs/ledger.md.

import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const MODES = new Set(["block", "warn", "off"])

/**
 * True if `dir` contains a file whose name is exactly "LEDGER.md" — checked
 * against the directory listing, not `existsSync`, because `existsSync` matches
 * case-insensitively on case-insensitive filesystems (default macOS/Windows) and
 * would wrongly treat a same-named-but-different-case file (e.g. a reference doc
 * called `ledger.md`) as a system marker.
 */
function hasLedgerFile(dir) {
  try {
    return readdirSync(dir).includes("LEDGER.md")
  } catch {
    return false
  }
}

/** Nearest ancestor directory of `filePath` containing LEDGER.md. */
export function findSystemDir(filePath) {
  let dir = path.dirname(path.resolve(filePath))
  for (;;) {
    if (hasLedgerFile(dir)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/** `ledgerHook` from the nearest .centina/config.json above `systemDir`; "block" when absent or invalid. */
export function hookMode(systemDir) {
  let dir = systemDir
  for (;;) {
    const configPath = path.join(dir, ".centina", "config.json")
    if (existsSync(configPath)) {
      try {
        const mode = JSON.parse(readFileSync(configPath, "utf8")).ledgerHook
        return MODES.has(mode) ? mode : "block"
      } catch {
        return "block"
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) return "block"
    dir = parent
  }
}

/** Maps a checker run to the hook's exit code and output. */
export function decide({ mode, systemDir, status, output }) {
  if (status === 0) return { exitCode: 0 }
  if (mode === "warn") {
    return {
      exitCode: 0,
      stdout: JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: `centina-check ledger reported problems in ${systemDir} (hook set to warn):\n${output}`,
        },
      }),
    }
  }
  return {
    exitCode: 2,
    stderr:
      `centina-check ledger failed for ${systemDir}. Fix these before continuing. ` +
      `Only the human may change "ledgerHook" in .centina/config.json.\n${output}`,
  }
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"))
  const filePath = input.tool_input?.file_path
  if (!filePath) return 0

  const systemDir = findSystemDir(filePath)
  if (!systemDir) return 0

  const mode = hookMode(systemDir)
  if (mode === "off") return 0

  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
  const pluginData = process.env.CLAUDE_PLUGIN_DATA
  if (!pluginRoot || !pluginData || !existsSync(path.join(pluginData, "checker", "node_modules"))) {
    console.error("centina: checker not installed yet; ledger hook skipped.")
    return 0
  }

  const result = spawnSync(process.execPath, [path.join(pluginRoot, "bin", "centina-check"), "ledger", systemDir], {
    encoding: "utf8",
  })
  const outcome = decide({
    mode,
    systemDir,
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  })
  if (outcome.stdout) process.stdout.write(outcome.stdout)
  if (outcome.stderr) process.stderr.write(outcome.stderr)
  return outcome.exitCode
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
