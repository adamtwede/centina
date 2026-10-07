import path from "node:path"
import { findProject, setupProject } from "./setup"

const USAGE = [
  "usage: centina-check setup [--host-root <path>] <artifactsRoot>",
  "       centina-check setup --find <dir>",
].join("\n")

/**
 * `centina-check setup <artifactsRoot>`: the mechanical part of
 * docs/plugin-setup-procedure.md. Creates `specs/`, copies `centina.ts` and
 * `conformance.ts`, writes `tsconfig.json`, keeps `.gitignore` and
 * `.gitattributes` current, writes or migrates `.centina/config.json`, and
 * registers the project. `--host-root` names the host project root; it is
 * required for a project with no config yet, and to replace a `hostRoot` that
 * does not exist on this machine.
 *
 * `setup --find <dir>` prints the registered artifacts root that `dir` sits at
 * or under, or nothing. Needs `CLAUDE_PLUGIN_DATA`; setup also needs
 * `CLAUDE_PLUGIN_ROOT`. Returns the exit code.
 */
export function runSetupCommand(argv: string[]): number {
  let hostRoot: string | undefined
  let find = false
  const dirs: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--find") find = true
    else if (arg === "--host-root") {
      hostRoot = argv[++i]
      if (!hostRoot) {
        console.error(`--host-root requires a path\n${USAGE}`)
        return 1
      }
    } else if (arg.startsWith("--")) {
      console.error(`unknown option ${arg}\n${USAGE}`)
      return 1
    } else dirs.push(arg)
  }
  if (dirs.length !== 1 || (find && hostRoot !== undefined)) {
    console.error(USAGE)
    return 1
  }

  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
  const pluginData = process.env.CLAUDE_PLUGIN_DATA
  if (!pluginData || (!find && !pluginRoot)) {
    console.error(
      `setup: ${!pluginData ? "CLAUDE_PLUGIN_DATA" : "CLAUDE_PLUGIN_ROOT"} is not set. Claude Code sets both inside a ` +
        "session; in a plain shell, export them first (docs/plugin-setup-procedure.md).",
    )
    return 1
  }

  // bin/centina-check runs from the plugin's checker copy; resolve paths against the caller's directory.
  const baseDir = process.env.CENTINA_CALLER_CWD ?? process.cwd()
  const target = path.resolve(baseDir, dirs[0])
  try {
    if (find) {
      const project = findProject(target, pluginData)
      if (project) console.log(project)
      return 0
    }
    const { changes, advice } = setupProject({
      artifactsRoot: target,
      hostRoot: hostRoot === undefined ? undefined : path.resolve(baseDir, hostRoot),
      pluginRoot: pluginRoot as string,
      pluginData,
    })
    if (changes.length === 0) console.log(`setup: ${target} is already current`)
    for (const change of changes) console.log(`setup: ${change}`)
    for (const note of advice) console.log(`setup: NOTE ${note}`)
    return 0
  } catch (error) {
    if (!(error instanceof Error)) throw error
    console.error(`setup: ${error.message}`)
    return 1
  }
}
