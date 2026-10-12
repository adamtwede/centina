import path from "node:path"

export interface CheckArgs {
  tsConfigFilePath?: string
  requestedPaths: string[]
}

/**
 * Parses the check command's arguments. Relative paths resolve against
 * `baseDir`, the directory the user invoked the checker from. bin/centina-check
 * runs the checker from its own directory, so resolving against `process.cwd()`
 * here would silently look in the wrong place.
 *
 * Throws on a `--project` with no value; the caller decides how to report it.
 */
export function parseCheckArgs(argv: string[], baseDir: string): CheckArgs {
  const requestedPaths: string[] = []
  let tsConfigFilePath: string | undefined

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project") {
      const value = argv[++i]
      if (!value) {
        throw new Error("--project requires a path argument")
      }
      tsConfigFilePath = path.resolve(baseDir, value)
    } else {
      requestedPaths.push(path.resolve(baseDir, argv[i]))
    }
  }

  return { tsConfigFilePath, requestedPaths }
}
