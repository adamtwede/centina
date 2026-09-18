#!/usr/bin/env node
// PreCompact and SessionEnd hook: copies this session's transcript into
// <system>/transcripts/<session-id>.jsonl for every system directory whose
// top-level markdown records the session ID (the Session header skills write
// from ${CLAUDE_SESSION_ID}). Never blocks. Design:
// docs/ledger-provenance-design.md, Item B.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const GENERATED = new Set(["LEDGER-INDEX.md", "STANDING.md"])

function isWithin(child, parent) {
  return child === parent || child.startsWith(parent + path.sep)
}

/** System directories (specs/<system>/ with a LEDGER.md) under registered projects related to `cwd`, and under `cwd`. */
export function candidateSystemDirs(cwd, knownProjects) {
  const roots = new Set([cwd])
  for (const root of knownProjects) {
    if (isWithin(cwd, root) || isWithin(root, cwd)) roots.add(root)
  }

  const dirs = new Set()
  for (const root of roots) {
    const specsDir = path.join(root, "specs")
    if (!existsSync(specsDir)) continue
    for (const dirent of readdirSync(specsDir, { withFileTypes: true })) {
      const dir = path.join(specsDir, dirent.name)
      if (dirent.isDirectory() && existsSync(path.join(dir, "LEDGER.md"))) dirs.add(dir)
    }
  }
  return [...dirs]
}

/** Candidates whose top-level markdown (generated files excluded) contains `sessionId`. */
export function sessionSystemDirs(dirs, sessionId) {
  return dirs.filter((dir) =>
    readdirSync(dir).some(
      (name) =>
        name.endsWith(".md") && !GENERATED.has(name) && readFileSync(path.join(dir, name), "utf8").includes(sessionId),
    ),
  )
}

export function copyTranscript(systemDir, sessionId, transcriptPath) {
  const transcriptsDir = path.join(systemDir, "transcripts")
  mkdirSync(transcriptsDir, { recursive: true })
  const gitignore = path.join(transcriptsDir, ".gitignore")
  if (!existsSync(gitignore)) writeFileSync(gitignore, "*\n")
  const target = path.join(transcriptsDir, `${sessionId}.jsonl`)
  copyFileSync(transcriptPath, target)
  return target
}

function readKnownProjects() {
  const pluginData = process.env.CLAUDE_PLUGIN_DATA
  const registry = pluginData && path.join(pluginData, "known-projects.json")
  if (!registry || !existsSync(registry)) return []
  const parsed = JSON.parse(readFileSync(registry, "utf8"))
  return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : []
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"))
  const { session_id: sessionId, transcript_path: transcriptPath, cwd } = input
  if (!sessionId || !transcriptPath || !cwd || !existsSync(transcriptPath)) return

  const dirs = sessionSystemDirs(candidateSystemDirs(cwd, readKnownProjects()), sessionId)
  for (const dir of dirs) copyTranscript(dir, sessionId, transcriptPath)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(`centina: transcript copy failed: ${error.message}`)
  }
  process.exit(0)
}
