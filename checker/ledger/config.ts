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
 * A system's key in `systems`: its directory relative to the artifacts root.
 * Not its name — a system lives wherever a LEDGER.md sits, spec trees nest, and
 * two systems can share a basename.
 *
 * The artifacts root is the directory holding `.centina/`, not the config's
 * recorded `artifactsRoot`: setup writes the config at
 * `<artifactsRoot>/.centina/config.json`, so the two are the same place, and the
 * recorded absolute path is only right on the machine that wrote it. Resolved
 * on another, it points nowhere and every key came out as `../../...` junk.
 */
export function systemKey(config: CentinaConfig, systemDir: string): string {
  return path.relative(config.dir, path.resolve(systemDir)).split(path.sep).join("/")
}

/**
 * The host project root. A relative `hostRoot` is relative to the directory
 * holding `.centina/`, so a checkout works wherever it sits; an absolute one
 * is used as written. Absent, the artifacts root stands in.
 */
export function hostDir(config: CentinaConfig): string {
  return config.hostRoot ? path.resolve(config.dir, config.hostRoot) : config.dir
}

/** A system's build trees, resolved absolute against the host root. */
export function buildRootsFor(config: CentinaConfig, systemDir: string): string[] {
  const roots = config.systems?.[systemKey(config, systemDir)]?.buildRoots ?? []
  return roots.map((root) => path.resolve(hostDir(config), root))
}

// A config written on Windows may be read on a POSIX machine and the other way
// round, so absoluteness is judged by either platform's rule, not this one's.
export const isAbsolute = (p: string) => path.posix.isAbsolute(p) || path.win32.isAbsolute(p)

/** True when `hostRoot` is an absolute path this machine does not have. */
export function hostRootMissing(config: CentinaConfig): boolean {
  return config.hostRoot !== undefined && isAbsolute(config.hostRoot) && !existsSync(config.hostRoot)
}

export interface ConfigIssue {
  severity: "error" | "warning"
  message: string
}

/**
 * Absolute `hostRoot`/`artifactsRoot` paths are machine-specific, and the
 * config is committed. A `hostRoot` this machine does not have is an error when
 * the system names build roots — they cannot be found, so build code is not
 * being checked — and a warning otherwise. An absolute path that does exist
 * still works, and is only a warning to make relative.
 */
export function portabilityIssues(config: CentinaConfig, systemDir: string): ConfigIssue[] {
  const issues: ConfigIssue[] = []
  const named = (config.systems?.[systemKey(config, systemDir)]?.buildRoots ?? []).length > 0
  const relativeTo = (absolute: string) =>
    path.relative(config.dir, absolute).split(path.sep).join("/") || "."
  const advice = "relative to the directory holding .centina/, so every checkout of the project agrees"

  for (const field of ["hostRoot", "artifactsRoot"] as const) {
    const value = config[field]
    if (value === undefined || !isAbsolute(value)) continue
    if (existsSync(value)) {
      issues.push({
        severity: "warning",
        message: `${field} is the absolute path ${value}; write it ${advice} (${JSON.stringify(relativeTo(value))})`,
      })
    } else if (field === "hostRoot") {
      issues.push({
        severity: named ? "error" : "warning",
        message:
          `hostRoot is the absolute path ${value}, which does not exist on this machine` +
          (named ? "; the build roots cannot be found, so build code is not being checked" : "") +
          `; write it ${advice} (usually "..")`,
      })
    } else {
      issues.push({
        severity: "warning",
        message: `artifactsRoot is the absolute path ${value}, which does not exist on this machine; the checker uses the directory holding .centina/ instead, so write it "."`,
      })
    }
  }
  return issues
}
