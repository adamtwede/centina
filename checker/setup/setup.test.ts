import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { beforeEach, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { runSetupCommand } from "./command"
import { PLACEHOLDER, SetupError, findProject, setupProject } from "./setup"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const gitAvailable = spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0

describe("centina-check setup", () => {
  let base: string
  let pluginRoot: string
  let pluginData: string
  let host: string
  let artifacts: string

  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
  const read = (...parts: string[]) => readFileSync(path.join(artifacts, ...parts), "utf8")
  const readConfig = () => JSON.parse(read(".centina", "config.json"))
  const registry = (): string[] => JSON.parse(readFileSync(path.join(pluginData, "known-projects.json"), "utf8"))
  const setup = (extra: { hostRoot?: string } = { hostRoot: host }) =>
    setupProject({ artifactsRoot: artifacts, pluginRoot, pluginData, ...extra })

  beforeEach(() => {
    base = mkdtempSync(path.join(tmpdir(), "centina-setup-"))
    pluginRoot = path.join(base, "plugin")
    pluginData = path.join(base, "data")
    host = path.join(base, "host")
    artifacts = path.join(host, "centina")
    write(path.join(pluginRoot, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "centina", version: "1.2.3" }))
    write(path.join(pluginRoot, "centina.ts"), "export const vocabulary = 1\n")
    write(path.join(pluginRoot, "conformance.ts"), "export const conformance = 1\n")
    write(path.join(pluginRoot, "tsconfig.template.json"), readFileSync(path.join(REPO, "tsconfig.template.json"), "utf8"))
    write(path.join(pluginData, "checker", "tsPlugin.cjs"), "module.exports = {}\n")
    mkdirSync(host, { recursive: true })
  })

  it("sets up a new project from nothing", () => {
    const { changes } = setup()
    assert.ok(existsSync(path.join(artifacts, "specs")))
    assert.equal(read("centina.ts"), "export const vocabulary = 1\n")
    assert.equal(read("conformance.ts"), "export const conformance = 1\n")
    assert.deepEqual(readConfig(), { hostRoot: "..", artifactsRoot: ".", pluginVersion: "1.2.3" })
    assert.deepEqual(registry(), [path.resolve(artifacts)])
    assert.match(read(".gitignore"), /^\/tsconfig\.json$/m)
    for (const name of ["LEDGER-INDEX.md", "LEDGER-LABELS.md", "LEDGER.json", "STANDING.md"]) {
      assert.match(read(".gitattributes"), new RegExp(`^${name.replace(".", "\\.")} text eol=lf$`, "m"))
    }
    assert.ok(changes.length >= 7, changes.join("\n"))
  })

  it("writes the tsserver plugin path from DATA, in forward slashes, and the result parses", () => {
    setup()
    const text = read("tsconfig.json")
    assert.ok(!text.includes(PLACEHOLDER))
    const name = JSON.parse(text).compilerOptions.plugins[0].name as string
    assert.equal(name, path.join(path.resolve(pluginData), "checker", "tsPlugin.cjs").split(path.sep).join("/"))
    assert.ok(!name.includes("\\"))
    assert.ok(!text.includes("\r"))
  })

  it("leaves an up-to-date project untouched on a second run", () => {
    setup()
    const files = ["centina.ts", "conformance.ts", "tsconfig.json", ".gitignore", ".gitattributes", ".centina/config.json"]
    const past = new Date("2020-01-01T00:00:00Z")
    for (const file of files) utimesSync(path.join(artifacts, file), past, past)
    utimesSync(path.join(pluginData, "known-projects.json"), past, past)

    const { changes, advice } = setup({})
    assert.deepEqual(changes, [])
    assert.deepEqual(advice, [])
    for (const file of files) assert.equal(statSync(path.join(artifacts, file)).mtimeMs, past.getTime(), file)
    assert.equal(statSync(path.join(pluginData, "known-projects.json")).mtimeMs, past.getTime())
    assert.equal(registry().length, 1)
  })

  it("leaves an existing specs/ and everything in it alone", () => {
    write(path.join(artifacts, "specs", "demo", "LEDGER.md"), "# Ledger: demo\n")
    write(path.join(artifacts, "specs", "a.centina.ts"), "export {}\n")
    const { changes } = setup()
    assert.equal(read("specs", "demo", "LEDGER.md"), "# Ledger: demo\n")
    assert.equal(read("specs", "a.centina.ts"), "export {}\n")
    assert.ok(!changes.includes("created specs/"))
  })

  it("refuses when specs is a file, and writes nothing", () => {
    write(path.join(artifacts, "specs"), "not a directory")
    assert.throws(setup, (error) => error instanceof SetupError && /specs.*not a directory/.test(error.message))
    assert.ok(!existsSync(path.join(artifacts, ".centina")))
    assert.ok(!existsSync(path.join(artifacts, "centina.ts")))
    assert.ok(!existsSync(path.join(pluginData, "known-projects.json")))
  })

  it("refuses a new project with no host root, naming the nearest .git, and writes nothing", () => {
    mkdirSync(path.join(host, ".git"))
    assert.throws(
      () => setup({}),
      (error) => error instanceof SetupError && error.message.includes("--host-root") && error.message.includes(host),
    )
    assert.ok(!existsSync(path.join(artifacts, "specs")))
    assert.ok(!existsSync(path.join(pluginData, "known-projects.json")))
  })

  it("refuses a host root that is not a directory", () => {
    assert.throws(() => setup({ hostRoot: path.join(base, "nowhere") }), /not a directory/)
  })

  describe("an existing config", () => {
    const configFile = () => path.join(artifacts, ".centina", "config.json")

    it("rewrites absolute paths that exist here as relative, keeping every other key in place", () => {
      write(
        configFile(),
        JSON.stringify({
          hostRoot: host,
          artifactsRoot: artifacts,
          pluginVersion: "1.2.3",
          ledgerHook: "off",
          systems: { "specs/demo": { buildRoots: ["src"] } },
        }),
      )
      setup({})
      assert.deepEqual(readConfig(), {
        hostRoot: "..",
        artifactsRoot: ".",
        pluginVersion: "1.2.3",
        ledgerHook: "off",
        systems: { "specs/demo": { buildRoots: ["src"] } },
      })
      assert.deepEqual(Object.keys(readConfig()), ["hostRoot", "artifactsRoot", "pluginVersion", "ledgerHook", "systems"])
    })

    it("refuses an absolute hostRoot that does not exist here, without deriving from it, and writes nothing", () => {
      const dead = process.platform === "win32" ? "Z:\\Users\\gone\\proj" : "/Users/gone/proj"
      const before = JSON.stringify({ hostRoot: dead, artifactsRoot: dead, pluginVersion: "1.0.0" })
      write(configFile(), before)
      mkdirSync(path.join(host, ".git"))
      assert.throws(
        () => setup({}),
        (error) => error instanceof SetupError && error.message.includes(dead) && error.message.includes("--host-root"),
      )
      assert.equal(read(".centina", "config.json"), before)
      assert.ok(!existsSync(path.join(artifacts, "centina.ts")))
    })

    it("takes --host-root in place of a dead one", () => {
      write(configFile(), JSON.stringify({ hostRoot: "/Users/gone/proj", artifactsRoot: ".", pluginVersion: "1.2.3" }))
      setup()
      assert.equal(readConfig().hostRoot, "..")
    })

    it("says so when the plugin version changed, and records the new one", () => {
      write(configFile(), JSON.stringify({ hostRoot: "..", artifactsRoot: ".", pluginVersion: "0.9.0" }))
      const { changes } = setup({})
      assert.ok(changes.includes("stub tsconfig regenerated: plugin updated from 0.9.0 → 1.2.3"), changes.join("\n"))
      assert.equal(readConfig().pluginVersion, "1.2.3")
      assert.deepEqual(setup({}).changes, [])
    })

    it("adds pluginVersion without announcing an update when the config had none", () => {
      write(configFile(), JSON.stringify({ hostRoot: "..", artifactsRoot: "." }))
      const { changes } = setup({})
      assert.ok(!changes.some((change) => change.startsWith("stub tsconfig regenerated")))
      assert.equal(readConfig().pluginVersion, "1.2.3")
    })

    it("does not rewrite a config that is only formatted differently", () => {
      const text = '{"hostRoot":"..","artifactsRoot":".","pluginVersion":"1.2.3"}'
      write(configFile(), text)
      setup({})
      assert.equal(read(".centina", "config.json"), text)
    })

    it("refuses a config it cannot read, without overwriting it", () => {
      write(configFile(), "{ not json")
      assert.throws(() => setup(), /cannot read/)
      assert.equal(read(".centina", "config.json"), "{ not json")
    })

    it("warns about a relative hostRoot that points nowhere", () => {
      write(configFile(), JSON.stringify({ hostRoot: "../missing", artifactsRoot: ".", pluginVersion: "1.2.3" }))
      const { advice } = setup({})
      assert.ok(advice.some((note) => note.includes("../missing")), advice.join("\n"))
      assert.equal(readConfig().hostRoot, "../missing")
    })
  })

  describe("the copies", () => {
    it("replaces a centina.ts that differs, and says so", () => {
      write(path.join(artifacts, "centina.ts"), "// edited here\n")
      const { changes } = setup()
      assert.equal(read("centina.ts"), "export const vocabulary = 1\n")
      assert.ok(changes.some((change) => change.startsWith("replaced centina.ts")), changes.join("\n"))
    })

    it("treats a CRLF copy as the same content", () => {
      write(path.join(artifacts, "centina.ts"), "export const vocabulary = 1\r\n")
      const { changes } = setup()
      assert.equal(read("centina.ts"), "export const vocabulary = 1\r\n")
      assert.ok(!changes.some((change) => change.includes("centina.ts")))
    })

    it("regenerates a tsconfig that names another machine's path", () => {
      write(path.join(artifacts, "tsconfig.json"), readFileSync(path.join(pluginRoot, "tsconfig.template.json"), "utf8").replace(PLACEHOLDER, "/Users/old/tsPlugin.cjs"))
      const { changes } = setup()
      assert.ok(changes.includes("replaced tsconfig.json"), changes.join("\n"))
      assert.ok(!read("tsconfig.json").includes("/Users/old"))
    })

    it("refuses when the checker is not installed in DATA, and writes nothing", () => {
      rmSync(path.join(pluginData, "checker"), { recursive: true })
      assert.throws(setup, /not installed into CLAUDE_PLUGIN_DATA/)
      assert.ok(!existsSync(path.join(artifacts, "specs")))
    })

    it("refuses a template without the placeholder", () => {
      write(path.join(pluginRoot, "tsconfig.template.json"), "{}\n")
      assert.throws(setup, /exactly once/)
    })

    it("refuses a plugin with no readable version", () => {
      write(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "{}")
      assert.throws(setup, /no version/)
    })
  })

  describe(".gitignore and .gitattributes", () => {
    it("appends to existing content and keeps it", () => {
      write(path.join(artifacts, ".gitignore"), "node_modules/\n.env")
      setup()
      assert.equal(read(".gitignore"), "node_modules/\n.env\n/tsconfig.json\n")
    })

    it("does not repeat a line already there, in either spelling", () => {
      for (const existing of ["/tsconfig.json\n", "tsconfig.json\n", "**/tsconfig.json\n"]) {
        write(path.join(artifacts, ".gitignore"), existing)
        setup()
        assert.equal(read(".gitignore"), existing, existing)
      }
    })

    it("keeps CRLF line endings in a file that uses them", () => {
      write(path.join(artifacts, ".gitignore"), "node_modules/\r\n")
      setup()
      assert.equal(read(".gitignore"), "node_modules/\r\n/tsconfig.json\r\n")
    })

    it("adds only the attribute lines that are missing", () => {
      write(path.join(artifacts, ".gitattributes"), "LEDGER.json text eol=lf\n*.png binary\n")
      setup()
      const lines = read(".gitattributes").split("\n").filter(Boolean)
      assert.equal(lines.filter((line) => line.startsWith("LEDGER.json")).length, 1)
      assert.ok(lines.includes("*.png binary"))
      assert.ok(lines.includes("STANDING.md text eol=lf"))
    })

    it("does not add a blanket rule", () => {
      setup()
      assert.ok(!read(".gitattributes").split("\n").some((line) => line.startsWith("*")))
    })
  })

  describe("the registry", () => {
    it("keeps other entries and does not repeat this one", () => {
      write(path.join(pluginData, "known-projects.json"), JSON.stringify(["/elsewhere/centina"]))
      setup()
      setup({})
      assert.deepEqual(registry(), ["/elsewhere/centina", path.resolve(artifacts)])
    })

    it("refuses a registry that is not a list, without overwriting it", () => {
      write(path.join(pluginData, "known-projects.json"), '{"a":1}')
      assert.throws(setup, /not a list/)
      assert.equal(readFileSync(path.join(pluginData, "known-projects.json"), "utf8"), '{"a":1}')
      assert.ok(!existsSync(path.join(artifacts, "specs")))
    })
  })

  describe("a tracked tsconfig.json", { skip: !gitAvailable }, () => {
    it("is reported with the command for the human to run, and not untracked", () => {
      mkdirSync(artifacts, { recursive: true })
      assert.equal(spawnSync("git", ["init", "-q", artifacts]).status, 0)
      write(path.join(artifacts, "tsconfig.json"), "{}\n")
      assert.equal(spawnSync("git", ["-C", artifacts, "add", "tsconfig.json"]).status, 0)
      const { advice } = setup()
      assert.ok(advice.some((note) => note.includes("git rm --cached")), advice.join("\n"))
      assert.equal(spawnSync("git", ["-C", artifacts, "ls-files", "--error-unmatch", "tsconfig.json"]).status, 0)
    })

    it("is not reported when the file is untracked", () => {
      assert.equal(spawnSync("git", ["init", "-q", host]).status, 0)
      assert.deepEqual(setup().advice, [])
    })
  })

  describe("--find", () => {
    const register = (...entries: string[]) => write(path.join(pluginData, "known-projects.json"), JSON.stringify(entries))
    const project = (dir: string) => write(path.join(dir, ".centina", "config.json"), "{}")

    it("finds the project a directory sits under, and the project itself", () => {
      project(artifacts)
      register(artifacts)
      assert.equal(findProject(path.join(artifacts, "specs", "demo"), pluginData), path.resolve(artifacts))
      assert.equal(findProject(artifacts, pluginData), path.resolve(artifacts))
    })

    it("does not match a sibling that only shares a name prefix", () => {
      project(artifacts)
      register(artifacts)
      assert.equal(findProject(`${artifacts}-other`, pluginData), undefined)
    })

    it("prefers the nearest of nested projects", () => {
      const inner = path.join(artifacts, "inner")
      project(artifacts)
      project(inner)
      register(artifacts, inner)
      assert.equal(findProject(path.join(inner, "specs"), pluginData), path.resolve(inner))
    })

    it("skips an entry whose config is gone", () => {
      register(artifacts)
      assert.equal(findProject(artifacts, pluginData), undefined)
    })

    it("finds nothing when there is no registry", () => {
      assert.equal(findProject(artifacts, pluginData), undefined)
    })
  })

  describe("the command", () => {
    const saved = { ...process.env }
    function run(argv: string[], env: Record<string, string | undefined> = {}) {
      const log = console.log
      const error = console.error
      const out: string[] = []
      const err: string[] = []
      console.log = (...args: unknown[]) => out.push(args.join(" "))
      console.error = (...args: unknown[]) => err.push(args.join(" "))
      Object.assign(process.env, { CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PLUGIN_DATA: pluginData, CENTINA_CALLER_CWD: base }, env)
      for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key]
      try {
        return { code: runSetupCommand(argv), out: out.join("\n"), err: err.join("\n") }
      } finally {
        console.log = log
        console.error = error
        for (const key of ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PLUGIN_DATA", "CENTINA_CALLER_CWD"]) {
          if (saved[key] === undefined) delete process.env[key]
          else process.env[key] = saved[key]
        }
      }
    }

    it("resolves relative paths against the caller's directory", () => {
      const { code, out } = run(["--host-root", "host", "host/centina"])
      assert.equal(code, 0, out)
      assert.deepEqual(readConfig(), { hostRoot: "..", artifactsRoot: ".", pluginVersion: "1.2.3" })
      assert.match(out, /setup: wrote centina\.ts/)
    })

    it("says an unchanged project is already current", () => {
      run(["--host-root", "host", "host/centina"])
      const { code, out } = run(["host/centina"])
      assert.equal(code, 0)
      assert.match(out, /already current/)
    })

    it("exits 1 with the message when setup refuses", () => {
      const { code, err } = run(["host/centina"])
      assert.equal(code, 1)
      assert.match(err, /--host-root/)
    })

    it("exits 1 naming the missing variable", () => {
      assert.match(run(["host/centina"], { CLAUDE_PLUGIN_DATA: undefined }).err, /CLAUDE_PLUGIN_DATA is not set/)
      assert.match(run(["host/centina"], { CLAUDE_PLUGIN_ROOT: undefined }).err, /CLAUDE_PLUGIN_ROOT is not set/)
    })

    it("--find needs only DATA, and prints the project or nothing", () => {
      run(["--host-root", "host", "host/centina"])
      const found = run(["--find", "host/centina/specs/demo"], { CLAUDE_PLUGIN_ROOT: undefined })
      assert.equal(found.code, 0)
      assert.equal(found.out, path.resolve(artifacts))
      const none = run(["--find", "somewhere/else"], { CLAUDE_PLUGIN_ROOT: undefined })
      assert.equal(none.code, 0)
      assert.equal(none.out, "")
    })

    it("rejects bad usage", () => {
      assert.equal(run([]).code, 1)
      assert.equal(run(["a", "b"]).code, 1)
      assert.equal(run(["--bogus", "a"]).code, 1)
      assert.equal(run(["--host-root"]).code, 1)
      assert.equal(run(["--find", "--host-root", "x", "a"]).code, 1)
    })
  })
})
