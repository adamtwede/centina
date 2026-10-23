#!/usr/bin/env node
// Attributes everything that enters a Claude Code session's context to a
// bucket, per compaction segment (session start or compaction, to the next
// compaction). The method and the findings it produced are in
// docs/context-audit.md.
//
//   T   thinking          the model's hidden reasoning (from usage, retained in context)
//   H   harness           Claude Code itself, MCP servers, user-level config
//   CM  centina-mandated  content a Centina skill or doc makes the agent load
//   CW  centina-workflow  content from doing Centina's process (ledger, trail, specs, checker)
//   P   project           the work itself (code, tests, Bash output, conversation)
//
// Sizes are estimates: characters / CHARS_PER_TOKEN, images at a flat
// IMAGE_TOKENS. The report prints how much of the observed context growth the
// estimates explain, so a rerun shows whether the calibration still holds.
//
// Usage:
//   node scripts/context-audit/classify.mjs [--code-dir <regex>] [--mcp <a,b>] [--json <out>] <transcript.jsonl>...

import { readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const CHARS_PER_TOKEN = 4.0 // calibrated against the Chrysalis transcripts' reported usage
export const IMAGE_TOKENS = 1600

export const BUCKETS = { T: "thinking", H: "harness", CM: "centina-mandated", CW: "centina-workflow", P: "project" }

const PLUGIN_DOC =
  /\.claude[\\/]+skills[\\/]+centina|plugins[\\/]+(cache|marketplaces)[\\/]+[^"]*centina|CLAUDE_PLUGIN_ROOT[^"]*\/(docs|skills)\//i
const CHECKER = /centina-check|CLAUDE_PLUGIN_DATA|checker[\\/]+cli/i
const LEDGER = /LEDGER[-.A-Za-z]*\.(md|json)|TRAIL\.jsonl|ledger-hook/
const STATE = /ARCHITECTURE\.md|REALIZE-STATE\.md|DAG-DRAFT\.md|STANDING\.md|PLAN\.md/
const SPEC = /\.centina\.ts/
const SPECS_DIR = /centina[\\/]+specs[\\/]/
const ENTRY_HEADING = /^#{2,3} [a-z][a-z-]*:[A-Z]+\d+/m
const LEDGER_ID = /\b[a-z][a-z-]+:[A-Z]{1,2}\d+\b/ // e.g. sensor-door:Q15, instruments:W6
const SCRIPTED_WRITE = /cat >|<<'?EOF|writeFileSync/
const USER_CLAUDE_MD = path.join(homedir(), ".claude", "CLAUDE.md").toLowerCase()

/**
 * Classifies one tool call by what it touches. `codeDir` matches the project's
 * own source tree; a call that touches it and a Centina artifact is still
 * workflow, tagged "(mixed w/ code)", so workflow is if anything overstated.
 */
export function classifyTarget(name, input, { codeDir = /prototype[\\/]/ } = {}) {
  const s = JSON.stringify(input ?? {})
  if (name === "Skill") return ["CM", "Skill tool load"]
  if (PLUGIN_DOC.test(s) && !CHECKER.test(s)) return ["CM", "plugin docs/skill reads"]
  const isWrite = name === "Write" || name === "Edit" || name === "MultiEdit"
  const scratch = /scratchpad/i.test(input?.file_path || input?.command || "")
  const touchesCode = codeDir.test(s)
  const workflow = sub => ["CW", touchesCode ? `${sub} (mixed w/ code)` : sub]
  if (CHECKER.test(s)) return workflow("checker runs")
  const ledgerish =
    LEDGER.test(s) || (scratch && ENTRY_HEADING.test(s)) || (!touchesCode && (SPECS_DIR.test(s) || LEDGER_ID.test(s)))
  if (ledgerish) {
    if (isWrite || SCRIPTED_WRITE.test(s)) return workflow(scratch ? "ledger writes via scratchpad" : "ledger writes")
    return workflow("ledger reads/queries")
  }
  if (STATE.test(s)) return workflow("ARCHITECTURE/REALIZE-STATE/PLAN")
  if (SPEC.test(s)) return workflow(isWrite ? "spec edits" : "spec reads")
  if (name.startsWith("mcp__")) return ["P", `mcp ${name.split("__")[1]}`]
  if (name === "Agent" || name === "Task") return ["P", "subagent results"]
  return ["P", `tool ${name}`]
}

/** The MCP server a tool name belongs to (`mcp__<server>__<tool>`), or null for a built-in. */
export function mcpServerOf(toolName) {
  const m = /^mcp__(.+?)__/.exec(toolName)
  return m ? m[1] : null
}

/**
 * Reads a transcript's main-thread records. Resumed sessions append the
 * conversation again, so records are deduplicated by uuid, first one wins.
 */
export function loadRecords(file) {
  const seen = new Set()
  const records = []
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line) continue
    let r
    try {
      r = JSON.parse(line)
    } catch {
      continue
    }
    if (r.isSidechain) continue
    if (r.uuid) {
      if (seen.has(r.uuid)) continue
      seen.add(r.uuid)
    }
    records.push(r)
  }
  return records
}

const charLength = c => (typeof c === "string" ? c.length : JSON.stringify(c ?? "").length)
const isImageResult = content => JSON.stringify(content ?? "").includes('"type":"image"')

/**
 * Splits one transcript into segments and sums, per segment, the estimated
 * tokens each `bucket|sub` added. `start`/`end` are the context sizes the API
 * reported at the segment's first and last response.
 */
export function analyzeTranscript(file, { codeDir, mcp = ["serena", "headroom"] } = {}) {
  const records = loadRecords(file)
  const classify = (name, input) => classifyTarget(name, input, codeDir ? { codeDir } : {})
  const toolUses = {}
  for (const r of records)
    if (r.type === "assistant") for (const b of r.message?.content ?? []) if (b.type === "tool_use") toolUses[b.id] = b

  const segments = []
  const seenMessages = new Set()
  let seg
  const newSegment = kind => {
    seg = { kind, start: null, end: null, add: {} }
    segments.push(seg)
  }
  const addTokens = (bucket, sub, tokens) => {
    const key = `${bucket}|${sub}`
    seg.add[key] = (seg.add[key] ?? 0) + tokens
  }
  const addChars = (bucket, sub, chars) => addTokens(bucket, sub, chars / CHARS_PER_TOKEN)
  const mcpLabel = server => (server && mcp.includes(server) ? server : "other MCP")
  newSegment("start")

  for (const r of records) {
    if (r.type === "system" && r.subtype === "compact_boundary") {
      newSegment("compact")
      continue
    }

    if (r.type === "assistant") {
      const u = r.message?.usage
      if (u) {
        const ctx = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
        seg.start ??= ctx
        seg.end = ctx
        // One response is written as several records sharing an id and a usage block.
        if (!seenMessages.has(r.message.id)) {
          seenMessages.add(r.message.id)
          addTokens("T", "hidden thinking", u.output_tokens_details?.thinking_tokens ?? 0)
        }
      }
      for (const b of r.message?.content ?? []) {
        if (b.type === "text") addChars("P", "assistant prose", b.text.length)
        else if (b.type === "tool_use") {
          const [bucket, sub] = classify(b.name, b.input)
          addChars(bucket, `${sub} [input]`, charLength(b.input))
        }
      }
      continue
    }

    if (r.type === "user") {
      const c = r.message?.content
      for (const b of typeof c === "string" ? [{ type: "text", text: c }] : (c ?? [])) {
        if (b.type === "tool_result") {
          const use = toolUses[b.tool_use_id]
          const [bucket, sub] = use ? classify(use.name, use.input) : ["P", "tool ?"]
          if (isImageResult(b.content)) addTokens(bucket, `${sub} [image]`, IMAGE_TOKENS)
          else addChars(bucket, sub, charLength(b.content))
        } else if (b.type === "text") {
          const t = b.text
          if (t.startsWith("This session is being continued")) addChars("H", "compaction summary", t.length)
          else if (t.includes("Base directory for this skill"))
            addChars(/skills[\\/]+centina/i.test(t) ? "CM" : "H", "slash-command skill body", t.length)
          else if (t.startsWith("<system-reminder>")) addChars("H", "system reminders in user turn", t.length)
          else addChars("P", "user messages", t.length)
        } else if (b.type === "image") addTokens("P", "user images", IMAGE_TOKENS)
      }
      continue
    }

    if (r.type !== "attachment") continue
    const a = r.attachment
    const size = charLength(a)
    switch (a.type) {
      case "prompt_snapshot": // a copy of the system prompt, already in the fixed prefix
      case "deferred_tools_record": // bookkeeping for tool-input copies, not context
        break
      case "skill_listing": {
        const text = a.content ?? ""
        const centina = (text.match(/- centina:[^\n]*(\n(?!- )[^\n]*)*/g) ?? []).join("").length
        addChars("CM", "skill listing (centina entries)", centina)
        addChars("H", "skill listing (other skills)", size - centina)
        break
      }
      case "invoked_skills":
        for (const sk of a.skills ?? []) {
          if (/^centina:/.test(sk.name)) addChars("CM", `skill body re-injected: ${sk.name}`, charLength(sk.content))
          else addChars("H", "skill body re-injected (other)", charLength(sk.content))
        }
        break
      case "instructions":
        for (const f of a.files ?? []) {
          const p = f.path ?? ""
          if (/STANDING\.md$/.test(p)) addChars("CM", "STANDING.md (@import Centina offers)", charLength(f.content))
          else if (p.toLowerCase() === USER_CLAUDE_MD) addChars("H", "user CLAUDE.md", charLength(f.content))
          else addChars("P", "project CLAUDE.md", charLength(f.content))
        }
        break
      case "nested_memory":
        addChars("P", "nested CLAUDE.md", size)
        break
      case "file":
      case "edited_text_file":
      case "compact_file_reference": {
        const [bucket, sub] = classify("Read", {
          file_path: a.filename ?? a.path ?? "",
          content: a.content?.file?.content ?? a.content,
        })
        addChars(bucket, `${sub} [${a.type === "edited_text_file" ? "edit echo" : "file restore"}]`, size)
        break
      }
      case "deferred_tools_delta": {
        const names = a.addedNames ?? []
        if (!names.length) {
          addChars("H", "deferred tool listing", size)
          break
        }
        for (const n of names) {
          const server = mcpServerOf(n)
          addChars("H", `deferred tools: ${server ? mcpLabel(server) : "built-in"}`, size / names.length)
        }
        break
      }
      case "mcp_instructions_delta":
        ;(a.addedBlocks ?? []).forEach((block, i) => {
          addChars("H", `MCP instructions: ${mcpLabel((a.addedNames ?? [])[i])}`, block.length)
        })
        break
      case "hook_success":
      case "hook_additional_context":
      case "hook_blocking_error":
      case "hook_non_blocking_error": {
        const text = JSON.stringify(a)
        if (/CAVEMAN/i.test(text)) addChars("H", "caveman hooks", size)
        else if (/ledger|centina/i.test(text)) addChars("CW", `Centina hook output: ${a.hookName ?? a.type}`, size)
        else addChars("H", `other hook output: ${a.hookName ?? a.type}`, size)
        break
      }
      default:
        addChars("H", `attachment: ${a.type}`, size)
    }
  }
  return { file: path.basename(file), segments: segments.filter(s => s.start != null) }
}

/** Report rows: each `bucket|sub` lands in the first group whose pattern matches. */
const GROUPS = [
  ["T", /./, "hidden thinking"],
  ["H", /compaction summary/, "compaction summary"],
  ["H", /skill listing|skill body re-injected \(other\)|slash-command/, "skill listing (non-Centina skills)"],
  ["H", /deferred tools|MCP instructions/, null], // labelled per server below
  ["H", /caveman/, "caveman hooks"],
  ["H", /user CLAUDE/, "user CLAUDE.md"],
  ["H", /./, "other harness reminders/attachments"],
  ["CM", /STANDING/, "STANDING.md @import"],
  ["CM", /re-injected/, "skill bodies re-injected after compaction"],
  ["CM", /slash-command|Skill tool/, "skill body on first load"],
  ["CM", /plugin docs/, "plugin doc/SKILL.md reads"],
  ["CM", /listing/, "skill listing (Centina entries)"],
  ["CM", /./, "other"],
  ["CW", /ledger writes|checker runs.*\[input\]/, "ledger writes (drafts, splice scripts, write+check scripts)"],
  ["CW", /ledger reads/, "ledger reads/queries"],
  ["CW", /checker runs/, "checker output"],
  ["CW", /spec/, "spec reads/edits"],
  ["CW", /ARCHITECTURE|STATE|PLAN/, "ARCHITECTURE/REALIZE-STATE/PLAN"],
  ["CW", /hook/, "ledger-hook output"],
  ["CW", /./, "other"],
  ["P", /assistant prose/, "assistant prose"],
  ["P", /user messages|user images/, "user messages"],
  ["P", /CLAUDE/, "project CLAUDE.md files"],
  ["P", /\[image\]/, "images/screenshots"],
  ["P", /\[input\]/, "tool inputs (code written, scripts)"],
  ["P", /\[file restore\]|\[edit echo\]/, "file restores after compaction"],
  ["P", /./, "tool output (code reads, Bash, test runs)"],
]

export function groupOf(key) {
  const bucket = key.slice(0, key.indexOf("|"))
  const sub = key.slice(key.indexOf("|") + 1)
  const [, , label] = GROUPS.find(([b, re]) => b === bucket && re.test(sub))
  if (label) return `${bucket}|${label}`
  // Deferred-tool listings and MCP instructions, one row per server.
  const server = /: (.+)$/.exec(sub)?.[1]
  return `${bucket}|${server === "built-in" || server === "other MCP" ? "other deferred-tool/MCP listings" : `${server} (listing + instructions)`}`
}

/** Renders the audit report for a set of analyzed transcripts. */
export function report(results) {
  const segments = results.flatMap(r => r.segments)
  const rows = {}
  let estimated = 0
  let observed = 0
  for (const s of segments) {
    observed += s.end - s.start
    for (const [key, tokens] of Object.entries(s.add)) {
      const g = groupOf(key)
      rows[g] = (rows[g] ?? 0) + tokens
      estimated += tokens
    }
  }
  const k = n => `${(n / 1000).toFixed(1)}k`
  const pct = n => `${((n / estimated) * 100).toFixed(1)}%`
  const lines = [
    `transcripts=${results.length} segments=${segments.length}`,
    `estimated tokens added ${k(estimated)}; observed context growth ${k(observed)}; estimates explain ${((estimated / observed) * 100).toFixed(0)}%`,
  ]
  for (const [bucket, name] of Object.entries(BUCKETS)) {
    const own = Object.entries(rows).filter(([g]) => g.startsWith(`${bucket}|`))
    const total = own.reduce((sum, [, v]) => sum + v, 0)
    lines.push("", `${name}: ${k(total)}  ${pct(total)}  ${k(total / segments.length)}/segment`)
    for (const [g, v] of own.sort((x, y) => y[1] - x[1]))
      lines.push(`  ${k(v).padStart(8)}  ${pct(v).padStart(6)}  ${k(v / segments.length).padStart(7)}/seg  ${g.slice(bucket.length + 1)}`)
  }
  const median = xs => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)]
  lines.push("", "segment floor (context at first response):")
  for (const kind of ["start", "compact"]) {
    const starts = segments.filter(s => s.kind === kind).map(s => s.start)
    if (starts.length)
      lines.push(`  ${kind}: n=${starts.length} median=${median(starts)} min=${Math.min(...starts)} max=${Math.max(...starts)}`)
  }
  lines.push("", "per transcript (segments, median start -> end context):")
  for (const r of results) {
    const starts = r.segments.map(s => s.start)
    const ends = r.segments.map(s => s.end)
    lines.push(`  ${r.file}  segments=${r.segments.length}  ${median(starts)} -> ${median(ends)}`)
  }
  return lines.join("\n")
}

function main(argv) {
  const opts = {}
  let jsonOut
  const files = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`)
      return argv[++i]
    }
    if (arg === "--code-dir") opts.codeDir = new RegExp(value())
    else if (arg === "--mcp") opts.mcp = value().split(",").filter(Boolean)
    else if (arg === "--json") jsonOut = value()
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`)
    else files.push(arg)
  }
  if (!files.length) throw new Error("no transcripts given")
  const results = files.map(f => analyzeTranscript(f, opts))
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 1))
  console.log(report(results))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (err) {
    console.error(`${err.message}\nusage: classify.mjs [--code-dir <regex>] [--mcp <a,b>] [--json <out>] <transcript.jsonl>...`)
    process.exit(2)
  }
}
