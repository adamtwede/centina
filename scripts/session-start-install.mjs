#!/usr/bin/env node
// SessionStart hook: keeps the plugin's vendored checker deps installed.
// Design: docs/plugin-checker-install.md. Fires on every session, so the
// no-op path (nothing changed) must stay cheap — a read and a hash compare.

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { HASH_MARKER, installedHash, packageHash, syncCheckerSource } from "./checker-sync.mjs"

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

// The mod (hooks/register.tsx) may not see CLAUDE_PLUGIN_DATA in its own
// environment, and the Work item tracker button needs it to run the checker, so
// leave the path beside the plugin. Best effort: a read-only root loses only the button's refresh.
const pointer = path.join(pluginRoot, ".centina-data")
try {
  if (!existsSync(pointer) || readFileSync(pointer, "utf8") !== pluginData) writeFileSync(pointer, pluginData)
} catch {}

// Step 1 — copy source unconditionally. Cheap: a handful of small .ts files.
// bin/centina-check repeats this before every run, since a plugin update
// lands mid-session and this hook does not fire again.
syncCheckerSource(pluginRoot, pluginData)

// Step 2 — gate the expensive npm install behind a package.json hash.
const hashMarkerPath = path.join(pluginData, HASH_MARKER)
const currentHash = packageHash(pluginRoot)

if (currentHash === installedHash(pluginData)) {
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
