#!/usr/bin/env node
// One-time installer: copies the plugin bundle (the same subset described in
// docs/plugin-file-layout.md's directory tree) into a durable location Claude
// Code auto-loads every session, so the checkout this script runs from is no
// longer needed afterward — it's a distribution artifact, not the install.
//
// Plain Node, so it runs the same on Windows, macOS and Linux; Node is already
// a hard requirement of the plugin (the hooks and the checker are Node).
// install.sh is a thin wrapper around this file.
//
// Usage: node install.mjs [--yes] [destination]
//   destination  default: <Claude config dir>/skills/centina, where the config
//                dir is $CLAUDE_CONFIG_DIR, else ~/.claude
//   --yes, -y    overwrite a non-empty destination without asking

import { cpSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

/**
 * What gets installed. Keep `docs` in step with docs/plugin-file-layout.md's
 * directory tree; scripts/bundle.test.mjs asserts the two agree.
 */
export const BUNDLE = {
  dirs: [".claude-plugin", "hooks", "skills", "bin", "scripts", "checker"],
  files: ["centina.ts", "conformance.ts", "tsconfig.template.json"],
  docs: [
    "plugin-setup-procedure.md",
    "output-management.md",
    "ledger.md",
    "measurement-methodology.md",
    "realize-conformance.md",
    "trail.md",
    "session-zero-routing.md",
    "session-zero-reference.md",
    "iterate-reference.md",
  ],
}

// `node_modules` anywhere, plus these source-relative paths. checker/'s
// node_modules and package-lock.json, if present from local dev use, are
// install-time artifacts the SessionStart hook regenerates in
// CLAUDE_PLUGIN_DATA on first use — don't ship a stale copy. The engine lays
// dev types into .claude-plugin/types for tsconfig.hooks.json; not the bundle.
const EXCLUDED = new Set([".claude-plugin/types", "checker/package-lock.json"])

/** Written beside the installed plugin by scripts/session-start-install.mjs; read by hooks/register.tsx. */
const DATA_POINTER = ".centina-data"

export function defaultDestination() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude")
  return path.join(configDir, "skills", "centina")
}

/** PowerShell (and cmd) pass `~` through unexpanded, unlike a POSIX shell. */
function expandHome(p) {
  return p === "~" || /^~[\\/]/.test(p) ? path.join(homedir(), p.slice(1)) : p
}

const inside = (child, parent) => {
  const rel = path.relative(parent, child)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

const isSymlink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

const realOr = (p) => {
  try {
    return realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}

/**
 * Installing deletes the destination first, so refuse any destination whose
 * deletion would take the checkout (or the user's home) with it, and any one
 * inside the checkout, which would be copied into itself. A symlink at the
 * destination (the documented "symlink to checkout" install) is replaced, not
 * followed, so it is judged by where it sits, not by what it points at.
 */
export function assertSafeDestination(src, dest) {
  const source = realOr(src)
  const target = isSymlink(dest) ? path.resolve(dest) : realOr(dest)
  if (inside(source, target)) {
    throw new Error(`${dest} is, or contains, the checkout (${source}); installing there would delete it.`)
  }
  if (inside(target, source)) {
    throw new Error(`${dest} is inside the checkout (${source}); install somewhere outside it.`)
  }
  if (inside(realOr(homedir()), target)) {
    throw new Error(`${dest} is, or contains, your home directory; installing there would delete it.`)
  }
}

/** True when installing would overwrite something worth asking about. */
export function needsConfirmation(dest) {
  let stat
  try {
    stat = lstatSync(dest)
  } catch {
    return false
  }
  if (stat.isSymbolicLink()) return false
  return stat.isDirectory() ? readdirSync(dest).length > 0 : true
}

/** Replaces `dest` with the bundle from the checkout at `src`. */
export function install(src, dest) {
  assertSafeDestination(src, dest)
  // The SessionStart hook leaves the plugin-data path here for the Work item tracker button
  // (hooks/register.tsx), which cannot see CLAUDE_PLUGIN_DATA itself. The path does not change
  // when the plugin is reinstalled, and nothing else rewrites it until the next session starts.
  let dataPointer
  try {
    dataPointer = readFileSync(path.join(dest, DATA_POINTER), "utf8")
  } catch {}
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  if (dataPointer) writeFileSync(path.join(dest, DATA_POINTER), dataPointer)

  const filter = (source) => {
    const rel = path.relative(src, source).split(path.sep).join("/")
    return path.basename(source) !== "node_modules" && !EXCLUDED.has(rel)
  }
  for (const dir of BUNDLE.dirs) {
    cpSync(path.join(src, dir), path.join(dest, dir), { recursive: true, filter })
  }
  for (const file of BUNDLE.files) {
    cpSync(path.join(src, file), path.join(dest, file))
  }
  mkdirSync(path.join(dest, "docs"), { recursive: true })
  for (const doc of BUNDLE.docs) {
    cpSync(path.join(src, "docs", doc), path.join(dest, "docs", doc))
  }
}

function parseArgs(argv) {
  const opts = { yes: false, help: false, dest: undefined }
  for (const arg of argv) {
    if (arg === "--yes" || arg === "-y") opts.yes = true
    else if (arg === "--help" || arg === "-h") opts.help = true
    else if (arg.startsWith("-")) throw new Error(`unknown option ${arg}`)
    else if (opts.dest === undefined) opts.dest = arg
    else throw new Error("expected at most one destination")
  }
  return opts
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return /^y/i.test((await rl.question(question)).trim())
  } finally {
    rl.close()
  }
}

async function main() {
  const src = path.dirname(fileURLToPath(import.meta.url))
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`install: ${error.message}\nUsage: node install.mjs [--yes] [destination]`)
    return 2
  }
  if (opts.help) {
    console.log("Usage: node install.mjs [--yes] [destination]")
    console.log(`Default destination: ${defaultDestination()}`)
    return 0
  }
  const dest = path.resolve(expandHome(opts.dest ?? defaultDestination()))

  try {
    assertSafeDestination(src, dest)
    if (!opts.yes && needsConfirmation(dest)) {
      if (!process.stdin.isTTY) {
        console.error(`install: ${dest} already exists and is non-empty; pass --yes to overwrite it.`)
        return 1
      }
      if (!(await confirm(`${dest} already exists and is non-empty. Overwrite? [y/N] `))) {
        console.log("Aborted.")
        return 1
      }
    }
    install(src, dest)
  } catch (error) {
    console.error(`install: ${error.message}`)
    return 1
  }

  console.log(`Centina installed to ${dest}`)
  console.log(`This checkout (${src}) is no longer required — Claude Code will load the`)
  console.log(`plugin from ${dest} every session from now on. Re-run this script after`)
  console.log("pulling updates; nothing here tracks the checkout automatically.")
  console.log()
  console.log("Claude Code skills invoke the checker via ${CLAUDE_PLUGIN_ROOT} — nothing to")
  console.log("do there. To run it yourself from a terminal it needs CLAUDE_PLUGIN_ROOT and")
  console.log("CLAUDE_PLUGIN_DATA set, which only Claude Code sets; see README.md, \"Claude")
  console.log("Code setup\" (\"Running it yourself from a terminal\").")
  return 0
}

// Run only when executed directly, so tests can import the functions above.
let direct = false
try {
  direct = fileURLToPath(import.meta.url) === realpathSync(path.resolve(process.argv[1] ?? ""))
} catch {}
if (direct) process.exitCode = await main()
