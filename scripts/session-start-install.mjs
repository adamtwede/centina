#!/usr/bin/env node
// SessionStart hook: keeps the plugin's vendored checker deps installed.
// Design: docs/plugin-checker-install.md. Fires on every session, so the
// no-op path (nothing changed) must stay cheap — a read and a hash compare.

import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
const pluginData = process.env.CLAUDE_PLUGIN_DATA

if (!pluginRoot || !pluginData) {
  console.error(
    "centina: CLAUDE_PLUGIN_ROOT/CLAUDE_PLUGIN_DATA not set — skipping checker install."
  )
  process.exit(0)
}

const dataCheckerDir = path.join(pluginData, "checker")
mkdirSync(dataCheckerDir, { recursive: true })

// Step 1 — copy source unconditionally. Cheap: a handful of small .ts files.
cpSync(path.join(pluginRoot, "checker"), dataCheckerDir, { recursive: true })
cpSync(path.join(pluginRoot, "centina.ts"), path.join(pluginData, "centina.ts"))

// Step 2 — gate the expensive npm install behind a package.json hash.
const packageJsonPath = path.join(pluginRoot, "checker", "package.json")
const hashMarkerPath = path.join(pluginData, ".installed-package-hash")

const currentHash = createHash("sha256")
  .update(readFileSync(packageJsonPath))
  .digest("hex")

const storedHash = existsSync(hashMarkerPath)
  ? readFileSync(hashMarkerPath, "utf8").trim()
  : null

if (currentHash === storedHash) {
  process.exit(0)
}

const result = spawnSync("npm", ["install"], {
  cwd: dataCheckerDir,
  stdio: "inherit",
})

if (result.status !== 0) {
  console.error(
    "centina: checker dependency install failed (see output above). " +
      "The checker won't run until this succeeds — it will retry next session."
  )
  // Leave the old marker untouched so the next session retries.
  process.exit(0)
}

writeFileSync(hashMarkerPath, currentHash)
