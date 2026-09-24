#!/usr/bin/env node
// Bumps package.json and .claude-plugin/plugin.json together — they
// represent one release. checker/package.json is versioned independently
// (private workspace member, already diverged) and is not touched here.
// Run manually at a release boundary: `npm run bump-version [major|minor|patch|hotfix]`.
// With no argument, prompts interactively. Never commits — review the diff yourself.

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const FILES = [path.join(ROOT, "package.json"), path.join(ROOT, ".claude-plugin", "plugin.json")]
const VERSION_RE = /"version":\s*"(\d+)\.(\d+)\.(\d+)"/
const LEVELS = new Set(["major", "minor", "patch", "hotfix"])

export function nextVersion(current, level) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current)
  if (!match) throw new Error(`Not a semver string: ${current}`)
  const [major, minor, patch] = match.slice(1, 4).map(Number)
  if (level === "major") return `${major + 1}.0.0`
  if (level === "minor") return `${major}.${minor + 1}.0`
  if (level === "patch" || level === "hotfix") return `${major}.${minor}.${patch + 1}`
  throw new Error(`Unknown bump level: ${level}`)
}

export function currentVersion(file) {
  const match = VERSION_RE.exec(readFileSync(file, "utf8"))
  if (!match) throw new Error(`No "version" field found in ${file}`)
  return match.slice(1, 4).join(".")
}

export function writeVersion(file, next) {
  const text = readFileSync(file, "utf8")
  writeFileSync(file, text.replace(VERSION_RE, `"version": "${next}"`))
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve))
}

async function main() {
  const versions = FILES.map(currentVersion)
  if (versions[0] !== versions[1]) {
    console.error(
      `package.json (${versions[0]}) and plugin.json (${versions[1]}) are out of sync — reconcile by hand before bumping.`,
    )
    return 1
  }
  const current = versions[0]

  let level = process.argv[2]
  if (!level) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const proceed = await ask(rl, `Bump version (currently ${current})? [y/N] `)
    if (!/^y(es)?$/i.test(proceed.trim())) {
      rl.close()
      console.log("Skipped.")
      return 0
    }
    level = (await ask(rl, "major, minor, or hotfix? ")).trim().toLowerCase()
    rl.close()
  }

  if (!LEVELS.has(level)) {
    console.error(`Unknown bump level "${level}". Use major, minor, patch, or hotfix.`)
    return 1
  }

  const next = nextVersion(current, level)
  for (const file of FILES) writeVersion(file, next)

  console.log(`Bumped ${current} -> ${next} in package.json and plugin.json.`)
  console.log("Not committed — review the diff and commit when ready.")
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code))
}
