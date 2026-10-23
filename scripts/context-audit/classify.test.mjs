import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { analyzeTranscript, CHARS_PER_TOKEN, classifyTarget, groupOf, mcpServerOf } from "./classify.mjs"

describe("classifyTarget", () => {
  it("puts plugin doc reads under centina-mandated", () => {
    assert.deepEqual(classifyTarget("Read", { file_path: "C:\\Users\\a\\.claude\\skills\\centina\\docs\\ledger.md" }), [
      "CM",
      "plugin docs/skill reads",
    ])
  })

  it("puts checker runs under workflow even when they mention the plugin root", () => {
    const input = { command: "node ~/.claude/skills/centina/bin/centina-check ledger specs/x" }
    assert.deepEqual(classifyTarget("Bash", input), ["CW", "checker runs"])
  })

  it("tells ledger reads from scripted ledger writes", () => {
    assert.deepEqual(classifyTarget("Read", { file_path: "specs/x/LEDGER-terrain.md", offset: 10, limit: 20 }), [
      "CW",
      "ledger reads/queries",
    ])
    assert.deepEqual(classifyTarget("Bash", { command: "cat > /tmp/scratchpad/e.md <<'EOF'\n### terrain:W46\nEOF" }), [
      "CW",
      "ledger writes via scratchpad",
    ])
  })

  it("counts a ledger id in a command as a ledger query, unless it touches project code", () => {
    assert.deepEqual(classifyTarget("Grep", { pattern: "instruments:W6\\b" }), ["CW", "ledger reads/queries"])
    assert.deepEqual(classifyTarget("Read", { file_path: "prototype/scenes/a.ts" }), ["P", "tool Read"])
  })

  it("tags calls that touch both a ledger and project code as mixed", () => {
    const input = { command: "sed -n 1,9p LEDGER.md; cat prototype/src/a.ts" }
    assert.deepEqual(classifyTarget("Bash", input), ["CW", "ledger reads/queries (mixed w/ code)"])
  })

  it("honours a custom code directory", () => {
    const input = { command: "grep -n sz:G1 src/game.ts" }
    assert.deepEqual(classifyTarget("Bash", input, { codeDir: /src[\\/]/ }), ["P", "tool Bash"])
  })
})

describe("mcpServerOf", () => {
  it("returns the server for MCP tools and null for built-ins", () => {
    assert.equal(mcpServerOf("mcp__serena__find_symbol"), "serena")
    assert.equal(mcpServerOf("mcp__ccd_session__start_session"), "ccd_session")
    assert.equal(mcpServerOf("Read"), null)
  })
})

describe("groupOf", () => {
  it("rolls ledger writes and write-then-check scripts into one row", () => {
    assert.equal(groupOf("CW|ledger writes via scratchpad [input]"), groupOf("CW|checker runs [input]"))
    assert.notEqual(groupOf("CW|checker runs"), groupOf("CW|checker runs [input]"))
  })

  it("gives each watched MCP server its own row", () => {
    assert.equal(groupOf("H|deferred tools: serena"), "H|serena (listing + instructions)")
    assert.equal(groupOf("H|MCP instructions: serena"), "H|serena (listing + instructions)")
    assert.equal(groupOf("H|deferred tools: built-in"), "H|other deferred-tool/MCP listings")
  })
})

describe("analyzeTranscript", () => {
  const usage = (ctx, thinking) => ({
    input_tokens: 0,
    cache_read_input_tokens: ctx,
    cache_creation_input_tokens: 0,
    output_tokens: thinking + 10,
    output_tokens_details: { thinking_tokens: thinking },
  })
  const write = records => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "context-audit-")), "t.jsonl")
    writeFileSync(file, records.map(r => JSON.stringify(r)).join("\n"))
    return file
  }

  it("splits at compactions, dedupes resumed records and counts thinking once per response", () => {
    const read = { type: "tool_use", id: "t1", name: "Read", input: { file_path: "specs/x/LEDGER.md" } }
    const result = {
      uuid: "u2",
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "x".repeat(400) }] },
    }
    const file = write([
      { uuid: "u1", type: "assistant", message: { id: "m1", usage: usage(1000, 50), content: [read] } },
      // The same response split into a second record, sharing id and usage.
      { uuid: "u1b", type: "assistant", message: { id: "m1", usage: usage(1000, 50), content: [] } },
      result,
      result, // a resume replays the record
      { uuid: "c1", type: "system", subtype: "compact_boundary", compactMetadata: { preTokens: 1200 } },
      { uuid: "u3", type: "assistant", message: { id: "m2", usage: usage(800, 20), content: [] } },
      { uuid: "side", isSidechain: true, type: "assistant", message: { id: "m3", usage: usage(9999, 999), content: [] } },
    ])
    const { segments } = analyzeTranscript(file)
    assert.equal(segments.length, 2)
    assert.deepEqual([segments[0].kind, segments[0].start, segments[1].kind, segments[1].start], ["start", 1000, "compact", 800])
    assert.equal(segments[0].add["T|hidden thinking"], 50)
    assert.equal(segments[0].add["CW|ledger reads/queries"], 400 / CHARS_PER_TOKEN)
    assert.equal(segments[1].add["T|hidden thinking"], 20)
  })

  it("leaves the system-prompt snapshot and tool-input bookkeeping out of the count", () => {
    const file = write([
      { uuid: "a1", type: "attachment", attachment: { type: "prompt_snapshot", systemPrompt: ["x".repeat(9000)] } },
      { uuid: "a2", type: "attachment", attachment: { type: "deferred_tools_record", entries: [] } },
      { uuid: "u1", type: "assistant", message: { id: "m1", usage: usage(500, 0), content: [] } },
    ])
    const [seg] = analyzeTranscript(file).segments
    assert.deepEqual(Object.keys(seg.add), ["T|hidden thinking"])
  })
})
