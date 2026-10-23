#!/usr/bin/env node
// Lists the largest tool calls classify.mjs put under one `bucket|sub` key, so
// a classification can be spot-checked by eye. Keys are the raw ones classify
// assigns before grouping, e.g. "P|tool Bash", "CW|ledger reads/queries" or
// "P|tool Write [input]" (an [input] key ranks the calls by what the agent wrote).
//
// Usage:
//   node scripts/context-audit/sample.mjs [--code-dir <regex>] [-n <count>] "<bucket|sub>" <transcript.jsonl>...

import path from "node:path"
import { fileURLToPath } from "node:url"
import { classifyTarget, loadRecords } from "./classify.mjs"

export function sample(key, files, { codeDir, limit = 15 } = {}) {
  const opts = codeDir ? { codeDir } : {}
  const wantInput = key.endsWith(" [input]")
  const items = []
  for (const file of files) {
    const toolUses = {}
    const records = loadRecords(file)
    for (const r of records)
      if (r.type === "assistant")
        for (const b of r.message?.content ?? []) if (b.type === "tool_use") toolUses[b.id] = b
    for (const use of Object.values(toolUses)) {
      const [bucket, sub] = classifyTarget(use.name, use.input, opts)
      if (wantInput && `${bucket}|${sub} [input]` === key) items.push([JSON.stringify(use.input).length, use])
    }
    if (wantInput) continue
    for (const r of records) {
      if (r.type !== "user" || !Array.isArray(r.message?.content)) continue
      for (const b of r.message.content) {
        const use = b.type === "tool_result" && toolUses[b.tool_use_id]
        if (!use) continue
        const [bucket, sub] = classifyTarget(use.name, use.input, opts)
        if (`${bucket}|${sub}` === key) items.push([JSON.stringify(b.content ?? "").length, use])
      }
    }
  }
  items.sort((x, y) => y[0] - x[0])
  const total = items.reduce((sum, [chars]) => sum + chars, 0)
  const lines = [`${key}  calls=${items.length}  chars=${total}`]
  for (const [chars, use] of items.slice(0, limit))
    lines.push(`${String(chars).padStart(8)}  ${use.name}  ${JSON.stringify(use.input).replace(/\s+/g, " ").slice(0, 200)}`)
  return lines.join("\n")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  const opts = {}
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--code-dir" && i + 1 < argv.length) opts.codeDir = new RegExp(argv[++i])
    else if (argv[i] === "-n" && i + 1 < argv.length) opts.limit = Number(argv[++i])
    else rest.push(argv[i])
  }
  const [key, ...files] = rest
  if (!key?.includes("|") || !files.length || !(opts.limit === undefined || opts.limit > 0)) {
    console.error('usage: sample.mjs [--code-dir <regex>] [-n <count>] "<bucket|sub>" <transcript.jsonl>...')
    process.exit(2)
  }
  console.log(sample(key, files, opts))
}
