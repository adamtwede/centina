import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

// What a stretch of work cost, from the session transcripts the ledger hook
// copies into `<system>/transcripts/<session-id>.jsonl`. Read as data: only
// each message's time and output-token count are used, never its text.
//
// The transcript copies are large and not committed. So each session's ticks
// are also kept in `<system>/weights/<session-id>.json`, a few KB to tens of
// KB, which is committed. A page can then be regenerated, for resumed work
// or a fresh clone, after the transcripts are gone.

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

const weightsFile = (systemDir: string, session: string) => path.join(systemDir, "weights", `${session}.json`)

function readStored(file: string): Tick[] | undefined {
  try {
    const rows: unknown = JSON.parse(readFileSync(file, "utf8"))
    if (!Array.isArray(rows)) return undefined
    return rows.map(([t, out]) => ({ t, out }))
  } catch {
    return undefined
  }
}

/**
 * The ticks of `sessions`, merged in time order, and the sessions with no data.
 * A session's ticks come from its transcript copy and its stored weights,
 * whichever holds more (a transcript is only ever copied whole, so more is
 * newer). With `save`, the stored weights are brought up to date.
 */
export function loadTicks(systemDir: string, sessions: Iterable<string>, save = false): { ticks: Tick[]; missing: string[] } {
  const ticks: Tick[] = []
  const missing: string[] = []
  for (const session of new Set(sessions)) {
    const transcript = path.join(systemDir, "transcripts", `${session}.jsonl`)
    const file = weightsFile(systemDir, session)
    const stored = readStored(file)
    const fresh = existsSync(transcript) ? readTicks(transcript) : undefined
    const best = fresh && (!stored || fresh.length > stored.length) ? fresh : stored
    if (!best) {
      missing.push(session)
      continue
    }
    if (best === fresh && save) {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(best.map((k) => [k.t, k.out])) + "\n")
    }
    ticks.push(...best)
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
