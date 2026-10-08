import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { isAbsolute } from "../ledger/config"

// What `centina-check setup` does, in order: docs/plugin-setup-procedure.md.

/** Marks where the tsserver plugin's path goes in `tsconfig.template.json`. */
export const PLACEHOLDER = "<placeholder, substituted at generation time>"

/** The ledger command's generated files; it writes them with LF endings. */
export const GENERATED_FILES = ["LEDGER-INDEX.md", "LEDGER-LABELS.md", "LEDGER.json", "STANDING.md"]

const VOCABULARY = ["centina.ts", "conformance.ts"]
const REGISTRY = "known-projects.json"

/** A refusal with a message for the person or agent running the command. */
export class SetupError extends Error {}

export interface SetupOptions {
  /** The artifacts root: where `.centina/`, `specs/` and the copies below are written. */
  artifactsRoot: string
  /** The host project root, as `--host-root` gave it. Required for a project with no config yet. */
  hostRoot?: string
  /** `CLAUDE_PLUGIN_ROOT`: the installed plugin, where the copies come from. */
  pluginRoot: string
  /** `CLAUDE_PLUGIN_DATA`: holds the checker and its `node_modules`, and the registry. */
  pluginData: string
}

export interface SetupResult {
  /** What was written or replaced. Empty when the project was already current. */
  changes: string[]
  /** Things the human has to do or know; setup never does them itself. */
  advice: string[]
}

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** Text compared as git's autocrlf leaves it: a CRLF checkout is the same content. */
const lf = (text: string): string => text.replace(/\r\n/g, "\n")

const slashes = (p: string): string => p.split(path.sep).join("/")

const same = (a: string, b: string): boolean => path.relative(a, b) === ""

const within = (child: string, parent: string): boolean => {
  const rel = path.relative(parent, child)
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
}

function readRequired(file: string): string {
  if (!existsSync(file)) throw new SetupError(`${file} is missing; the plugin install looks incomplete`)
  return readFileSync(file, "utf8")
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    throw new SetupError(`cannot read ${file}: ${(error as Error).message}`)
  }
}

function writeAtomic(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  const staging = `${file}.${process.pid}.tmp`
  writeFileSync(staging, text)
  renameSync(staging, file)
}

/** The nearest directory at or above `start` holding a `.git`: what Step 1 offers as the host root. */
export function nearestGitRoot(start: string): string | undefined {
  let dir = path.resolve(start)
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

// ---- the registry ----

/** `known-projects.json`: a flat list of artifacts roots. Absent is empty; anything else unreadable is refused. */
function readRegistry(pluginData: string): unknown[] {
  const file = path.join(pluginData, REGISTRY)
  if (!existsSync(file)) return []
  const parsed = readJson(file)
  if (!Array.isArray(parsed)) throw new SetupError(`${file} is not a list of paths; fix or remove it, then rerun`)
  return parsed
}

/**
 * The registered artifacts root that `dir` sits at or under, nearest first. An
 * entry whose `.centina/config.json` is gone is not a project any more, so it
 * does not match.
 */
export function findProject(dir: string, pluginData: string): string | undefined {
  const target = path.resolve(dir)
  const matches = readRegistry(pluginData)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => path.resolve(entry))
    .filter((entry) => existsSync(path.join(entry, ".centina", "config.json")) && within(target, entry))
  return matches.sort((a, b) => b.length - a.length)[0]
}

// ---- the config ----

type Config = Record<string, unknown>

interface ConfigPlan {
  file: string
  existing: Config | undefined
  next: Config
  advice: string[]
}

/** `target` as a path relative to `root`, forward slashes, `"."` for the same place. */
function relativeSpelling(root: string, target: string): string {
  const rel = path.relative(root, target)
  if (path.isAbsolute(rel)) {
    throw new SetupError(
      `${target} cannot be written relative to ${root} (a different drive); put the project on one drive`,
    )
  }
  return slashes(rel) || "."
}

function suggestion(root: string): string {
  const git = nearestGitRoot(root)
  return git
    ? `the nearest ancestor holding a .git is ${git}; pass --host-root "${git}" to use it`
    : "no ancestor holds a .git; pass --host-root with the project root"
}

/**
 * The config as it should be, decided without writing. Both paths are written
 * relative to the directory holding `.centina/`: the config is committed and
 * read on other machines, and an absolute path is right on only one. An
 * absolute `hostRoot` that does not exist here is never derived from — the
 * config came from another machine, and which directory is the host there is
 * the human's call.
 */
function planConfig(root: string, version: string, hostRoot: string | undefined): ConfigPlan {
  const file = path.join(root, ".centina", "config.json")
  const advice: string[] = []
  let existing: Config | undefined
  if (existsSync(file)) {
    const parsed = readJson(file)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new SetupError(`${file} is not a JSON object; fix or remove it, then rerun`)
    }
    existing = parsed as Config
  }
  const next: Config = { ...existing }

  for (const key of ["hostRoot", "artifactsRoot"]) {
    if (next[key] !== undefined && typeof next[key] !== "string") {
      throw new SetupError(`${key} in ${file} is not a string; fix it, then rerun`)
    }
  }

  if (hostRoot !== undefined) {
    if (!isDir(hostRoot)) throw new SetupError(`--host-root ${hostRoot} is not a directory`)
    next.hostRoot = relativeSpelling(root, hostRoot)
  } else if (typeof next.hostRoot === "string" && isAbsolute(next.hostRoot)) {
    if (!existsSync(next.hostRoot)) {
      throw new SetupError(
        `hostRoot in ${file} is the absolute path ${next.hostRoot}, which does not exist on this machine, ` +
          `so the config came from another one and the host root there is yours to confirm: ${suggestion(root)}`,
      )
    }
    next.hostRoot = relativeSpelling(root, next.hostRoot)
  } else if (next.hostRoot === undefined && existing === undefined) {
    throw new SetupError(`${root} has no .centina/config.json yet, so a host root is needed: ${suggestion(root)}`)
  } else if (typeof next.hostRoot === "string" && !isDir(path.resolve(root, next.hostRoot))) {
    advice.push(`hostRoot ${JSON.stringify(next.hostRoot)} in ${file} does not resolve to a directory from ${root}`)
  }

  if (next.artifactsRoot === undefined || isAbsolute(next.artifactsRoot as string)) next.artifactsRoot = "."
  next.pluginVersion = version
  return { file, existing, next, advice }
}

/** `key: before → after` for each key whose value differs; `key value` for one that is new. */
function configDiff(before: Config | undefined, after: Config): string[] {
  return Object.keys(after)
    .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after[key]))
    .map((key) =>
      before?.[key] === undefined
        ? `${key} ${JSON.stringify(after[key])}`
        : `${key}: ${JSON.stringify(before[key])} → ${JSON.stringify(after[key])}`,
    )
}

// ---- the files ----

/** The template with the tsserver plugin's path in place: `<DATA>/checker/tsPlugin.cjs`, forward slashes. */
function renderTsconfig(pluginRoot: string, pluginData: string): string {
  const template = lf(readRequired(path.join(pluginRoot, "tsconfig.template.json")))
  const plugin = path.join(path.resolve(pluginData), "checker", "tsPlugin.cjs")
  if (!existsSync(plugin)) {
    throw new SetupError(
      `${plugin} is missing: the checker is not installed into CLAUDE_PLUGIN_DATA yet. ` +
        "Start a Claude Code session with the plugin loaded (its SessionStart hook installs it), then rerun",
    )
  }
  const parts = template.split(PLACEHOLDER)
  if (parts.length !== 2) {
    throw new SetupError(`tsconfig.template.json must hold ${JSON.stringify(PLACEHOLDER)} exactly once`)
  }
  const text = parts.join(JSON.stringify(slashes(plugin)).slice(1, -1))
  JSON.parse(text)
  return text
}

/** Writes `text` to `file` unless it already holds that content (line endings aside). */
function put(file: string, text: string): "wrote" | "replaced" | undefined {
  const present = existsSync(file)
  if (present && lf(readFileSync(file, "utf8")) === lf(text)) return undefined
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
  return present ? "replaced" : "wrote"
}

/**
 * Appends whichever of `wanted` the file lacks, keeping the rest of it and its
 * line endings. `has` says whether an existing line already covers one.
 */
function ensureLines(file: string, wanted: string[], has: (line: string, want: string) => boolean): string[] {
  const text = existsSync(file) ? readFileSync(file, "utf8") : ""
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const missing = wanted.filter((want) => !lines.some((line) => !line.startsWith("#") && has(line, want)))
  if (missing.length === 0) return []
  const eol = text.includes("\r\n") ? "\r\n" : "\n"
  const base = text === "" || text.endsWith("\n") ? text : text + eol
  writeFileSync(file, base + missing.join(eol) + eol)
  return missing
}

const ignores = (line: string, want: string): boolean => [want, want.replace(/^\//, ""), `**${want}`].includes(line)

const setsLf = (line: string, want: string): boolean => {
  const [pattern, ...attributes] = line.split(/\s+/)
  return pattern === want.split(/\s+/)[0] && attributes.includes("eol=lf")
}

function trackedByGit(root: string, file: string): boolean {
  return spawnSync("git", ["-C", root, "ls-files", "--error-unmatch", "--", file], { stdio: "ignore" }).status === 0
}

// ---- the whole procedure ----

/**
 * Steps 3 and 4 of the setup procedure, and the config and registry writes of
 * Step 2, for one artifacts root. Idempotent: a project that is already current
 * is left byte-for-byte alone. Everything that can refuse is decided before the
 * first write, so a refusal leaves nothing half-done.
 */
export function setupProject(options: SetupOptions): SetupResult {
  const root = path.resolve(options.artifactsRoot)
  const { pluginRoot, pluginData } = options
  const changes: string[] = []

  const version = (readJson(path.join(pluginRoot, ".claude-plugin", "plugin.json")) as { version?: unknown }).version
  if (typeof version !== "string" || version === "") {
    throw new SetupError(`no version in ${path.join(pluginRoot, ".claude-plugin", "plugin.json")}`)
  }
  const tsconfig = renderTsconfig(pluginRoot, pluginData)
  const vocabulary = VOCABULARY.map((name) => ({ name, text: readRequired(path.join(pluginRoot, name)) }))

  const specs = path.join(root, "specs")
  if (existsSync(root) && !isDir(root)) throw new SetupError(`${root} exists and is not a directory`)
  if (existsSync(specs) && !isDir(specs)) throw new SetupError(`${specs} exists and is not a directory`)

  const config = planConfig(root, version, options.hostRoot ? path.resolve(options.hostRoot) : undefined)
  const registry = readRegistry(pluginData)

  // ---- writes ----
  if (!isDir(specs)) {
    mkdirSync(specs, { recursive: true })
    changes.push("created specs/")
  }

  const diff = configDiff(config.existing, config.next)
  if (diff.length > 0) {
    writeAtomic(config.file, `${JSON.stringify(config.next, null, 2)}\n`)
    changes.push(`${config.existing ? "updated" : "wrote"} .centina/config.json (${diff.join("; ")})`)
  }
  const previous = config.existing?.pluginVersion
  if (typeof previous === "string" && previous !== version) {
    changes.push(`stub tsconfig regenerated: plugin updated from ${previous} → ${version}`)
  }

  for (const { name, text } of vocabulary) {
    const copied = put(path.join(root, name), text)
    if (copied === "wrote") changes.push(`wrote ${name}`)
    if (copied === "replaced") changes.push(`replaced ${name}, which differed from the plugin's copy`)
  }

  const tsconfigFile = path.join(root, "tsconfig.json")
  const wroteTsconfig = put(tsconfigFile, tsconfig)
  if (wroteTsconfig) changes.push(`${wroteTsconfig} tsconfig.json`)

  for (const line of ensureLines(path.join(root, ".gitignore"), ["/tsconfig.json"], ignores)) {
    changes.push(`added ${line} to .gitignore`)
  }
  const attributes = GENERATED_FILES.map((name) => `${name} text eol=lf`)
  for (const line of ensureLines(path.join(root, ".gitattributes"), attributes, setsLf)) {
    changes.push(`added "${line}" to .gitattributes`)
  }

  if (!registry.some((entry) => typeof entry === "string" && same(path.resolve(entry), root))) {
    writeAtomic(path.join(pluginData, REGISTRY), `${JSON.stringify([...registry, root], null, 2)}\n`)
    changes.push(`registered ${root} in ${REGISTRY}`)
  }

  const advice = [...config.advice]
  if (trackedByGit(root, "tsconfig.json")) {
    advice.push(
      `tsconfig.json is tracked by git, but it is machine-specific. Untrack it yourself: git rm --cached "${tsconfigFile}"`,
    )
  }
  return { changes, advice }
}
