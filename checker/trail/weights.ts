import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

// What a stretch of work cost, from the session transcripts the ledger hook
// copies into `<system>/transcripts/<session-id>.jsonl`. Read as data: only
// each message's time and output-token count are used, never its text.

export interface Tick {
  /** Epoch seconds. */
  t: number
  /** Output tokens of an assistant message; 0 for a user message. */
  out: number
}

/** A gap between two messages longer than this is the human away, not work. */
export const GAP_SECONDS = 600

/** Every message of one transcript. An assistant message is written once per content block, so it is counted once by its id. */
export function readTicks(file: string): Tick[] {
  const ticks: Tick[] = []
  const assistant = new Map<string, Tick>()
  for (const text of readFileSync(file, "utf8").split("\n")) {
    const isAssistant = text.includes('"type":"assistant"')
    if (!isAssistant && !text.includes('"type":"user"')) continue
    let row: { type?: string; timestamp?: string; uuid?: string; message?: { id?: string; usage?: { output_tokens?: number } } }
    try {
      row = JSON.parse(text)
    } catch {
      continue
    }
    const t = row.timestamp ? Date.parse(row.timestamp) / 1000 : NaN
    if (Number.isNaN(t)) continue
    if (row.type === "assistant") {
      const id = row.message?.id ?? row.uuid ?? String(t)
      const out = row.message?.usage?.output_tokens ?? 0
      const seen = assistant.get(id)
      if (seen) seen.out = Math.max(seen.out, out)
      else {
        const tick = { t, out }
        assistant.set(id, tick)
        ticks.push(tick)
      }
    } else if (row.type === "user") ticks.push({ t, out: 0 })
  }
  return ticks.sort((a, b) => a.t - b.t)
}

/** The transcripts for `sessions` that exist in `<systemDir>/transcripts/`, merged in time order, and the sessions that had none. */
export function loadTicks(systemDir: string, sessions: Iterable<string>): { ticks: Tick[]; missing: string[] } {
  const ticks: Tick[] = []
  const missing: string[] = []
  for (const session of new Set(sessions)) {
    const file = path.join(systemDir, "transcripts", `${session}.jsonl`)
    if (existsSync(file)) ticks.push(...readTicks(file))
    else missing.push(session)
  }
  return { ticks: ticks.sort((a, b) => a.t - b.t), missing }
}

/** Active minutes (gaps of up to GAP_SECONDS) and output tokens of the messages in [from, to). */
export function weigh(ticks: Tick[], from: number, to: number): { activeMin: number; tokens: number } {
  let active = 0
  let tokens = 0
  let previous = from
  for (const tick of ticks) {
    if (tick.t < from || tick.t >= to) continue
    if (tick.t - previous <= GAP_SECONDS) active += tick.t - previous
    previous = tick.t
    tokens += tick.out
  }
  return { activeMin: Math.round((active / 60) * 10) / 10, tokens }
}
