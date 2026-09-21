import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

// Settings format: docs/ledger.md, "The checker" → "Settings".

export interface SystemSettings {
  /** Build trees for this system, relative to `hostRoot`. */
  buildRoots?: string[]
}

export interface CentinaConfig {
  file: string
  /** Directory holding `.centina/`. */
  dir: string
  hostRoot?: string
  artifactsRoot?: string
  systems?: Record<string, SystemSettings>
  /** Set when the file exists but could not be read; reported rather than ignored. */
  problem?: string
}

/** Nearest `.centina/config.json` at or above `startDir`. */
export function findConfig(startDir: string): CentinaConfig | undefined {
  let dir = path.resolve(startDir)
  for (;;) {
    const file = path.join(dir, ".centina", "config.json")
    if (existsSync(file)) {
      try {
        const parsed = JSON.parse(readFileSync(file, "utf8"))
        return { ...parsed, file, dir }
      } catch (error) {
        return { file, dir, problem: `cannot read ${file}: ${(error as Error).message}` }
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * A system's key in `systems`: its directory relative to `artifactsRoot`. Not
 * its name — a system lives wherever a LEDGER.md sits, spec trees nest, and
 * two systems can share a basename.
 */
export function systemKey(config: CentinaConfig, systemDir: string): string {
  const root = config.artifactsRoot ? path.resolve(config.artifactsRoot) : config.dir
  return path.relative(root, path.resolve(systemDir)).split(path.sep).join("/")
}

/** A system's build trees, resolved absolute against `hostRoot`. */
export function buildRootsFor(config: CentinaConfig, systemDir: string): string[] {
  const roots = config.systems?.[systemKey(config, systemDir)]?.buildRoots ?? []
  const host = config.hostRoot ? path.resolve(config.hostRoot) : config.dir
  return roots.map((root) => path.resolve(host, root))
}
