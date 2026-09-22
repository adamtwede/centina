// The checker runs from CLAUDE_PLUGIN_DATA, the only copy with node_modules
// installed. Keeping that copy's SOURCE current is shared between the
// SessionStart hook and bin/centina-check, because a plugin update lands
// mid-session and the hook does not fire again: an unsynced DATA copy runs
// the previous rules and prints "clean", a pass that means nothing.
// Design: docs/plugin-checker-install.md.

import { createHash } from "node:crypto"
import { cpSync, existsSync, readFileSync } from "node:fs"
import path from "node:path"

export const HASH_MARKER = ".installed-package-hash"

/**
 * Copies the plugin's checker source over DATA's. `cpSync` adds and replaces
 * without deleting, so DATA's installed `node_modules` survives; the filter
 * keeps a dev checkout's own copy from being dragged along.
 */
export function syncCheckerSource(pluginRoot, pluginData) {
  cpSync(path.join(pluginRoot, "checker"), path.join(pluginData, "checker"), {
    recursive: true,
    filter: (source) => path.basename(source) !== "node_modules",
  })
  for (const name of ["centina.ts", "conformance.ts"]) {
    cpSync(path.join(pluginRoot, name), path.join(pluginData, name))
  }
}

export function packageHash(pluginRoot) {
  const file = path.join(pluginRoot, "checker", "package.json")
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

export function installedHash(pluginData) {
  const marker = path.join(pluginData, HASH_MARKER)
  return existsSync(marker) ? readFileSync(marker, "utf8").trim() : undefined
}

/**
 * Whether DATA's installed dependencies match the plugin's current
 * `checker/package.json`. New source against old dependencies is the
 * silent-wrong-answer case, so a caller that cannot fix it refuses instead.
 */
export function depsCurrent(pluginRoot, pluginData) {
  return installedHash(pluginData) === packageHash(pluginRoot)
}

/** The plugin's version, for saying which checker ran. */
export function pluginVersion(pluginRoot) {
  try {
    return JSON.parse(readFileSync(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")).version
  } catch {
    return undefined
  }
}
