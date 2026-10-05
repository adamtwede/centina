// Claude Code mod: a band above the prompt listing the Centina ledger entries
// the current turn's replies cite, with status, an "open in VS Code" button and an
// "ELI5" button (a one-off Haiku explanation, outside the session, in a pane). A
// "TLDR THIS" button does the same for the latest reply as a whole, weighing any
// options in it against the active phase and the project's goals. While a ledger
// phase is active, a "Phase progress ($$)" button has Sonnet report on how far
// the phase has got and which of its open items matter most; while a work item
// is active, an "Item progress ($$)" button does the same for that one line of
// inquiry: what it set out to settle, what has been tried, and whether it is
// getting closer. Where a system has a TRAIL.jsonl, a "Tracker" button
// regenerates its TRACKER.html (`centina-check trail`) and opens it in the
// browser. A "Second opinion
// ($$$)" button has Opus review the latest reply against the reader's last
// request and the ledger; its answer waits in the pane until a "Send to session"
// button there hands it to the main session.
// Reads each system's generated LEDGER.json (`centina-check ledger`); never the
// markdown ledger. Display only: nothing here is load-bearing for the skills.

import { atom, read, update } from "claude-code"
import type { EngineInterface, Register } from "claude-code"

import {
  ELI5_SYSTEM,
  ITEM_PROGRESS_SYSTEM,
  PROGRESS_SYSTEM,
  REVIEW_SYSTEM,
  TLDR_SYSTEM,
  activePhases,
  bearings,
  currentItem,
  driftLine,
  eli5Prompt,
  extractCites,
  findingsOf,
  itemDrift,
  itemProgressPrompt,
  progressPrompt,
  references,
  resolve,
  reviewPrompt,
  sectionAt,
  tldrPrompt,
} from "./ledger-cite"
import type {
  Cite,
  Context,
  LedgerEntry,
  PhaseContext,
  System,
} from "./ledger-cite"
import type { Eli5, Row } from "./types"

const cited = atom({ plugin: "centina", key: "cited" } as const, [])
const isHidden = atom({ plugin: "centina", key: "isHidden" } as const, false)
const eli5 = atom({ plugin: "centina", key: "eli5" } as const, null)
const latestReply = atom({ plugin: "centina", key: "reply" } as const, "")
const hasPhase = atom({ plugin: "centina", key: "hasPhase" } as const, false)
const hasItem = atom({ plugin: "centina", key: "hasItem" } as const, false)
const drift = atom({ plugin: "centina", key: "drift" } as const, null)
const trailDir = atom({ plugin: "centina", key: "trailDir" } as const, null)
const latestRequest = atom({ plugin: "centina", key: "request" } as const, "")

const ELI5_PANE = "centina-eli5"
const ELI5_TIMEOUT_MS = 20_000
const TLDR_TIMEOUT_MS = 45_000
const PROGRESS_TIMEOUT_MS = 90_000
const REVIEW_TIMEOUT_MS = 180_000

const LEDGER_JSON = "LEDGER.json"
const TRAIL_FILE = "TRAIL.jsonl"
const TRACKER_FILE = "TRACKER.html"
const TRACKER_TIMEOUT_MS = 60_000
const SKIP_DIRS = new Set(["node_modules", "archive", "transcripts"])
const MAX_DEPTH = 6
const REWALK_MS = 30_000
const MAX_ROWS = 6

let dirs: string[] = []
let walkedAt = -Infinity
let isNewTurn = true
let turnCites: Cite[] = []
let asking = 0
let stop = new AbortController()
const answers = new Map<string, string>()

async function readSystem($: EngineInterface, dir: string): Promise<System> {
  return { dir, json: JSON.parse(await $.fs.read(`${dir}/${LEDGER_JSON}`)) }
}

async function readSystems($: EngineInterface): Promise<System[]> {
  const systems: System[] = []
  for (const dir of dirs) {
    try {
      systems.push(await readSystem($, dir))
    } catch {
      // Missing or malformed: the band is a display aid, so skip the system.
    }
  }
  return systems
}

async function visit(
  $: EngineInterface,
  dir: string,
  depth: number,
  found: string[],
): Promise<void> {
  let entries: { name: string; kind: string }[]
  try {
    entries = await $.fs.list(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.kind === "file" && entry.name === LEDGER_JSON) found.push(dir)
    else if (
      entry.kind === "dir" &&
      depth < MAX_DEPTH &&
      !entry.name.startsWith(".") &&
      !SKIP_DIRS.has(entry.name)
    ) {
      await visit($, `${dir}/${entry.name}`, depth + 1, found)
    }
  }
}

async function walk($: EngineInterface): Promise<void> {
  const found: string[] = []
  // The project root, not `cwd()`: that follows a shell `cd`, and a walk from a
  // subfolder finds no ledger and would empty `dirs` for the rest of the session.
  await visit($, await $.session.root(), 0, found)
  dirs = found
  walkedAt = await $.clock.now()
}

async function rowsFor($: EngineInterface): Promise<Row[]> {
  let rows = resolve(turnCites, await readSystems($))
  // A label that resolves nowhere may be in a ledger created since the last
  // walk; look again, at most every REWALK_MS.
  if (
    rows.some((row) => row.problem === "no-label") &&
    (await $.clock.now()) - walkedAt > REWALK_MS
  ) {
    await walk($)
    rows = resolve(turnCites, await readSystems($))
  }
  return rows
}

/**
 * Whether some system has an active phase and whether some work item is active,
 * which is what makes Phase progress and Item progress worth asking, and how
 * long-running that item is (the band's drift line).
 */
async function refreshPhase($: EngineInterface): Promise<void> {
  const systems = await readSystems($)
  await update($, hasPhase, () =>
    systems.some((s) => activePhases(s).length > 0),
  )
  const reply = await read($, latestReply)
  const found = currentItem(
    systems,
    extractCites(reply).map((c) => c.key),
  )
  await update($, hasItem, () => found !== undefined)
  const now = await $.clock.now()
  await update($, drift, () =>
    found ? itemDrift(found.system, found.entry, now) : null,
  )
  // The system the tracker is for: the current item's if it has a trail, else the first that does.
  const withTrail: string[] = []
  for (const system of systems) {
    const names = await $.fs.list(system.dir).catch(() => [])
    if (names.some((n) => n.kind === "file" && n.name === TRAIL_FILE))
      withTrail.push(system.dir)
  }
  await update(
    $,
    trailDir,
    () =>
      withTrail.find((d) => d === found?.system.dir) ?? withTrail[0] ?? null,
  )
}

/** Folds one reply's text into the turn's citations and refreshes the band's rows. */
async function trackReply($: EngineInterface, text: string): Promise<void> {
  if (text === "") return
  if (isNewTurn) {
    isNewTurn = false
    turnCites = []
    await update($, isHidden, () => false)
  }
  const id = (c: Cite) => `${c.system ?? ""}/${c.key}(${c.part ?? ""})`
  const known = new Set(turnCites.map(id))
  for (const c of extractCites(text)) if (!known.has(id(c))) turnCites.push(c)
  const rows = await rowsFor($)
  await update($, cited, () => rows)
  await update($, latestReply, () => text)
  await refreshPhase($)
}

type Question = { prompt: string } | { failure: string }

/**
 * Asks a model, with no session history and nothing written to the transcript, one
 * question and shows the answer in the explanation pane. `build` makes the
 * question, or says why it can't. A newer press supersedes an older one.
 */
async function ask(
  $: EngineInterface,
  o: {
    title: string
    heading: string
    model: "haiku" | "sonnet" | "opus"
    effort: "low" | "medium" | "high"
    system: string
    maxTokens: number
    timeoutMs: number
    unreadable: string
    /** Whether the pane offers to send an answer on to the main session. */
    isSendable?: boolean
    build: () => Promise<Question>
  },
): Promise<void> {
  const mine = ++asking
  stop.abort()
  stop = new AbortController()
  const show = async (status: Eli5["status"], text: string) => {
    if (mine === asking)
      await update($, eli5, () => ({
        cite: o.heading,
        status,
        text,
        ...(o.isSendable && status === "answered" ? { isSendable: true } : {}),
      }))
  }
  await $.ui.open({ id: ELI5_PANE, title: o.title })
  await show("asking", "")
  try {
    const question = await o.build()
    if ("failure" in question) return show("failed", question.failure)
    const { prompt } = question
    const key = `${o.model}\n${prompt}`
    const cached = answers.get(key)
    if (cached !== undefined) return show("answered", cached)
    const reply = await $.model.complete(
      {
        model: o.model,
        system: o.system,
        prompt,
        effort: o.effort,
        maxTokens: o.maxTokens,
        timeoutMs: o.timeoutMs,
      },
      { signal: stop.signal },
    )
    if (!reply.isAnswered) {
      return show(
        "failed",
        reply.reason === "aborted"
          ? "Timed out."
          : `The ${o.model} call failed (${reply.reason}).`,
      )
    }
    answers.set(key, reply.text)
    return show("answered", reply.text)
  } catch {
    return show("failed", o.unreadable)
  }
}

async function explain($: EngineInterface, row: Row): Promise<void> {
  const { dir, path, line, key } = row
  if (
    dir === undefined ||
    path === undefined ||
    line === undefined ||
    key === undefined
  )
    return
  await ask($, {
    title: "ELI5",
    heading: row.cite,
    model: "haiku",
    effort: "low",
    system: ELI5_SYSTEM,
    maxTokens: 800,
    timeoutMs: ELI5_TIMEOUT_MS,
    unreadable: `Could not read ${row.cite} from the ledger.`,
    build: async () => {
      const system = await readSystem($, dir)
      const section = sectionAt(await $.fs.read(path), line, key)
      if (section === undefined) {
        return {
          failure:
            "The ledger changed since LEDGER.json was written; re-run `centina-check ledger`.",
        }
      }
      return {
        prompt: eli5Prompt(section, references(section, key, system), row.part),
      }
    },
  })
}

/**
 * Reads ledger entries as context: title and status always, the entry's text
 * when its file can be read and still has the entry at that line. Each file is
 * read once per reader.
 */
function entryReader(
  $: EngineInterface,
): (dir: string, entry: LedgerEntry, hasText?: boolean) => Promise<Context> {
  const files = new Map<string, Promise<string>>()
  return async (dir, entry, hasText = true) => {
    const context: Context = {
      key: entry.key,
      title: entry.title,
      status: entry.status,
    }
    if (!hasText) return context
    const path = `${dir}/${entry.file}`
    if (!files.has(path)) files.set(path, $.fs.read(path))
    // A stale or unreadable ledger costs the entry its text, not the answer its title.
    return {
      ...context,
      text: sectionAt(
        await files.get(path)!.catch(() => ""),
        entry.line,
        entry.key,
      ),
    }
  }
}

/**
 * The latest reply with the ledger context around it: the entries it cites, each
 * by title and, while there is room, in full (one call can't fetch more
 * mid-answer, so "full text if necessary" is decided by the budget in
 * `replyPrompt`, not by the model), the active phase and the active goals of the
 * systems the reply is about. Undefined when there is no reply yet.
 */
async function replyContext(
  $: EngineInterface,
): Promise<
  | { reply: string; cites: Context[]; phase: Context[]; goals: Context[] }
  | undefined
> {
  const reply = await read($, latestReply)
  if (reply === "") return undefined
  const systems = await readSystems($)
  const rows = resolve(extractCites(reply), systems).filter(
    (row) => row.path !== undefined,
  )
  // Weigh against the systems the reply is about; with no citations, all of them.
  const scope =
    rows.length > 0
      ? systems.filter((s) => rows.some((row) => row.dir === s.dir))
      : systems
  const contextOf = entryReader($)
  const seen = new Set<string>()
  const fresh = (system: System, entry: LedgerEntry) => {
    const id = `${system.dir}/${entry.key}`
    return seen.has(id) ? false : (seen.add(id), true)
  }
  const cites: Context[] = []
  for (const row of rows) {
    const system = systems.find((s) => s.dir === row.dir)
    const entry = system?.json.entries.find((e) => e.key === row.key)
    if (system && entry && fresh(system, entry))
      cites.push(await contextOf(system.dir, entry))
  }
  const phase: Context[] = []
  const goals: Context[] = []
  for (const system of scope) {
    const active = bearings([system])
    for (const entry of active.phase)
      if (fresh(system, entry)) phase.push(await contextOf(system.dir, entry))
    for (const entry of active.goals)
      if (fresh(system, entry)) goals.push(await contextOf(system.dir, entry))
  }
  return { reply, cites, phase, goals }
}

/** TLDR of the latest reply, by Haiku. */
async function tldr($: EngineInterface): Promise<void> {
  await ask($, {
    title: "TLDR",
    heading: "TLDR of the latest reply",
    model: "haiku",
    effort: "medium",
    system: TLDR_SYSTEM,
    maxTokens: 1_200,
    timeoutMs: TLDR_TIMEOUT_MS,
    unreadable: "Could not read the ledger.",
    build: async () => {
      const context = await replyContext($)
      if (context === undefined)
        return { failure: "There is no reply to explain yet." }
      const { reply, cites, phase, goals } = context
      return { prompt: tldrPrompt(reply, cites, phase, goals) }
    },
  })
}

/**
 * Second opinion: Opus gets the reader's last request, the latest reply and the
 * same ledger context as TLDR, and reviews the reply for errors, gaps and
 * improvements. It has no tools, so it reasons about what it is shown and can't
 * check the reply against the code. The answer is shown, not sent: the pane's
 * "Send to session" button does that, so the reader decides what the main
 * session acts on. Costliest of the buttons, hence high effort and a long timeout.
 */
async function secondOpinion($: EngineInterface): Promise<void> {
  await ask($, {
    title: "Second opinion",
    heading: "Second opinion on the latest reply",
    model: "opus",
    effort: "high",
    system: REVIEW_SYSTEM,
    // Thinking at high effort counts against the cap as well as the 400 words.
    maxTokens: 16_000,
    timeoutMs: REVIEW_TIMEOUT_MS,
    unreadable: "Could not read the ledger.",
    isSendable: true,
    build: async () => {
      const context = await replyContext($)
      if (context === undefined)
        return { failure: "There is no reply to review yet." }
      const { reply, cites, phase, goals } = context
      const request = await read($, latestRequest)
      return { prompt: reviewPrompt(request, reply, cites, phase, goals) }
    },
  })
}

/**
 * Hands the pane's answer to the main session as a message from this plugin
 * (not as the reader's own words), with a line saying where it came from and
 * that it is to be weighed, not adopted.
 */
async function sendToSession($: EngineInterface): Promise<void> {
  const state = await read($, eli5)
  if (state === null || state.status !== "answered" || !state.isSendable) return
  await update($, eli5, (current) =>
    current === null ? current : { ...current, isSendable: false },
  )
  await $.prompt.submit({
    text: [
      "Second opinion on your latest reply with partial context from a one-off agent review that saw only the reader's last request, your reply and the currently-cited ledger entries, not the code.",
      "Please note that the reviewer does not have as much context as you do, so weigh it against what you know and say where you disagree; do not change anything on its say-so alone.",
      "",
      state.text,
    ].join("\n"),
  })
  $.ui.toast("Sent to the session")
}

/**
 * Phase progress: Sonnet gets each active phase's own entry (goal, definition of
 * done, scope), its open items in full while there is room, its closed items by
 * title, and the active goals, and says how far the phase has got, what is left
 * and which of that matters most. Costlier than the ELI5 and TLDR buttons, hence the
 * bigger budget and the guard against paying for an empty answer.
 */
async function progress($: EngineInterface): Promise<void> {
  await ask($, {
    title: "Phase progress",
    heading: "Phase progress",
    model: "sonnet",
    effort: "high",
    system: PROGRESS_SYSTEM,
    maxTokens: 8_000,
    timeoutMs: PROGRESS_TIMEOUT_MS,
    unreadable: "Could not read the ledger.",
    build: async () => {
      const systems = await readSystems($)
      const contextOf = entryReader($)
      const phases: PhaseContext[] = []
      const goals: Context[] = []
      let items = 0
      for (const system of systems) {
        const active = activePhases(system)
        if (active.length === 0) continue
        for (const { phase, open, closed } of active) {
          items += open.length + closed.length
          phases.push({
            phase: await contextOf(system.dir, phase),
            open: await Promise.all(open.map((e) => contextOf(system.dir, e))),
            closed: await Promise.all(
              closed.map((e) => contextOf(system.dir, e, false)),
            ),
          })
        }
        for (const entry of bearings([system]).goals)
          goals.push(await contextOf(system.dir, entry))
      }
      if (phases.length === 0)
        return { failure: "No phase is active in the ledger." }
      if (items === 0) {
        return {
          failure:
            "No items point at the active phase. If some do, re-run `centina-check ledger` to refresh LEDGER.json.",
        }
      }
      return { prompt: progressPrompt(phases, goals) }
    },
  })
}

/**
 * Item progress: Sonnet gets the work item the reply is about (or else the one
 * the active spike chain has reached): its start, an outline of everything
 * between and its end in full, the titles of the entries that rest on it, its
 * phase and the active goals. It says what the line set out to settle, what has
 * been tried, whether it is getting closer and what the options are. The
 * counterpart of Phase progress for a line of inquiry too long for the phase's
 * budget to show.
 */
async function itemProgress($: EngineInterface): Promise<void> {
  await ask($, {
    title: "Item progress",
    heading: "Item progress",
    model: "sonnet",
    effort: "high",
    system: ITEM_PROGRESS_SYSTEM,
    maxTokens: 8_000,
    timeoutMs: PROGRESS_TIMEOUT_MS,
    unreadable: "Could not read the ledger.",
    build: async () => {
      const systems = await readSystems($)
      const reply = await read($, latestReply)
      const found = currentItem(
        systems,
        extractCites(reply).map((c) => c.key),
      )
      if (found === undefined)
        return { failure: "No work item is active in the ledger." }
      const { system, entry } = found
      const contextOf = entryReader($)
      const byKey = (key: string) =>
        system.json.entries.find((e) => e.key === key)
      const phase = entry.phase ? byKey(entry.phase) : undefined
      const depends = (entry.dependsOn ?? []).flatMap((k) => byKey(k) ?? [])
      return {
        prompt: itemProgressPrompt({
          item: await contextOf(system.dir, entry),
          findings: await Promise.all(
            findingsOf(system, entry.key).map((e) =>
              contextOf(system.dir, e, false),
            ),
          ),
          phase: phase && (await contextOf(system.dir, phase)),
          depends: await Promise.all(
            depends.map((e) => contextOf(system.dir, e, false)),
          ),
          drift: itemDrift(system, entry, await $.clock.now()),
          goals: await Promise.all(
            bearings([system]).goals.map((e) => contextOf(system.dir, e)),
          ),
        }),
      }
    },
  })
}

/**
 * Tracker: regenerates the system's TRACKER.html with `centina-check trail` and
 * opens it. The checker runs from the plugin's data folder, which the mod only
 * sees if the environment names it; without it the last generated page is
 * opened as it stands. The page is written even when the trail has errors, so
 * the toast says to read them.
 */
async function openTracker($: EngineInterface): Promise<void> {
  const dir = await read($, trailDir)
  if (dir === null) return
  const page = `${dir}/${TRACKER_FILE}`
  const data = await $.env.get("CLAUDE_PLUGIN_DATA")
  let refreshed = false
  if (data) {
    const root = $.plugin.root
    const ran = await $.process
      .run(["node", `${root}/bin/centina-check`, "trail", dir], {
        env: { CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: data },
        timeoutMs: TRACKER_TIMEOUT_MS,
      })
      .catch(() => undefined)
    refreshed = ran !== undefined
    if (ran !== undefined && ran.exitCode !== 0)
      $.ui.toast(`The trail has errors; run centina-check trail ${dir}`)
  }
  const names = await $.fs.list(dir).catch(() => [])
  if (!names.some((n) => n.kind === "file" && n.name === TRACKER_FILE)) {
    $.ui.toast(`No ${TRACKER_FILE} yet; run centina-check trail ${dir}`)
    return
  }
  const via = async (argv: string[]) => {
    const ran = await $.process.run(argv).catch(() => undefined)
    return ran !== undefined && ran.exitCode === 0
  }
  if (!(await via(["open", page])) && !(await via(["xdg-open", page])))
    $.ui.toast(`Could not open ${page}`)
  else if (!refreshed) $.ui.toast("Opened the last generated tracker, not refreshed")
}

async function clear($: EngineInterface): Promise<void> {
  turnCites = []
  isNewTurn = true
  await update($, cited, () => [])
  await update($, latestReply, () => "")
  await update($, latestRequest, () => "")
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await walk($)
    await refreshPhase($)
    return next(e)
  })

  on("session.end", async ($, e, next) => {
    if (e.reason === "clear") await clear($)
    return next(e)
  })

  on("prompt.submit", async ($, e, next) => {
    isNewTurn = true
    // What the reader typed, for Second opinion; not a notification, a peer's
    // message or a scheduled prompt. A plugin's own submit skips this hook.
    if (e.origin.kind === "composer" || e.origin.kind === "bridge")
      await update($, latestRequest, () => e.text)
    return next(e)
  })

  on("session.append", { door: "response" }, async ($, e, next) => {
    const stored = await next(e)
    if (e.agentId === undefined) {
      await trackReply(
        $,
        e.message.content
          .flatMap((b) => (b.type === "text" ? [b.text] : []))
          .join("\n"),
      )
    }
    return stored
  })

  on("ui.render", { component: "Pane", requestId: ELI5_PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const state = await read($, eli5)
    if (state === null)
      return (
        <Text dimColor>
          Press ELI5 on a ledger entry, TLDR THIS, Second opinion, Phase
          progress or Item progress.
        </Text>
      )
    return (
      <Box flexDirection="column">
        <Text bold>{state.cite}</Text>
        {state.status === "asking" && <Text dimColor>Asking...</Text>}
        {state.status === "failed" && <Text color="red">{state.text}</Text>}
        {state.status === "answered" && <Text>{state.text}</Text>}
        {state.status === "answered" && state.isSendable && (
          <Button
            key="send"
            label="Send to session"
            onPress={() => sendToSession($)}
          />
        )}
      </Box>
    )
  })

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const rows = await read($, cited)
    // TLDR THIS needs a reply to explain and a ledger to weigh it against, so the
    // band also shows, with just that button, for a reply that cites nothing.
    const reply = await read($, latestReply)
    const secondOpinionWorthy = reply.split(/\s+/).length > 50
    const tldrWorthy = reply.split(/\s+/).length > 150
    const isExplainable = dirs.length > 0 && reply !== ""
    // Phase progress needs an active phase in the ledger, whatever the reply cites.
    const isPhaseActive = await read($, hasPhase)
    const isItemActive = await read($, hasItem)
    const isTrailKept = (await read($, trailDir)) !== null
    const longRunning = await read($, drift)
    if (
      e.props.hasSurvey ||
      (rows.length === 0 &&
        !isExplainable &&
        !isPhaseActive &&
        !isItemActive &&
        !isTrailKept)
    )
      return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const buttons = [
      isExplainable && tldrWorthy && (
        <Button key="tldr" label="TLDR THIS ($)" onPress={() => tldr($)} />
      ),
      isPhaseActive && (
        <Button
          key="progress"
          label="Phase progress ($$)"
          onPress={() => progress($)}
        />
      ),
      isItemActive && (
        <Button
          key="item-progress"
          label="Item progress ($$)"
          onPress={() => itemProgress($)}
        />
      ),
      isTrailKept && (
        <Button
          key="tracker"
          label="Tracker"
          onPress={() => openTracker($)}
        />
      ),
      isExplainable && secondOpinionWorthy && (
        <Button
          key="review"
          label="Second opinion ($$$)"
          onPress={() => secondOpinion($)}
        />
      ),
    ]

    // Hide folds the band to one line rather than removing it, so it can be
    // brought back; the next reply unfolds it again.
    if (await read($, isHidden)) {
      return (
        <Box>
          <Text dimColor>Ledger entries cited this turn ({rows.length}) </Text>
          <Button
            key="show"
            label="Show"
            onPress={() => update($, isHidden, () => false)}
          />
          {buttons}
        </Box>
      )
    }
    const shown = rows.slice(0, MAX_ROWS)

    // `code` is often not on PATH (macOS needs "Install 'code' command" first);
    // the vscode:// URL scheme works wherever VS Code is installed, `open` being macOS's.
    const open = async (row: Row) => {
      const target = `${row.path}:${row.line}`
      const via = async (argv: string[]) => {
        const ran = await $.process.run(argv).catch(() => undefined)
        return ran !== undefined && ran.exitCode === 0
      }
      const isOpened =
        (await via(["code", "-g", target])) ||
        (await via(["open", `vscode://file${encodeURI(target)}`]))
      if (!isOpened) $.ui.toast(`Could not open ${row.cite} in VS Code`)
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>
            {rows.length > 0
              ? "Ledger entries cited this turn "
              : isExplainable
                ? "Latest reply cites no ledger entries "
                : "Ledger "}
          </Text>
          <Button
            key="hide"
            label="Hide"
            onPress={() => update($, isHidden, () => true)}
          />
          {buttons}
        </Box>
        {longRunning && (
          <Text
            wrap="truncate-end"
            color={
              longRunning.level === "high"
                ? "red"
                : longRunning.level === "warn"
                  ? "yellow"
                  : undefined
            }
            dimColor={longRunning.level === "ok" || longRunning.level === "unknown"}
          >
            {longRunning.level === "high" || longRunning.level === "warn"
              ? "Long-running "
              : "Item "}
            {driftLine(longRunning)}
          </Text>
        )}
        {shown.map((row) => (
          <Box key={`${row.system ?? ""}/${row.cite}`}>
            {/* Never shrinks: when the row is narrow only the title is cut, not the citation. */}
            <Box flexShrink={0}>
              <Text bold>
                {row.system ? `${row.system}/${row.cite}` : row.cite}{" "}
              </Text>
            </Box>
            {row.problem === "no-label" ? (
              <Text color="red">not in any ledger</Text>
            ) : (
              <Text wrap="truncate-end">
                {row.problem === "no-part" ? (
                  <Text color="red">no such part </Text>
                ) : null}
                <Text dimColor>{row.status ?? "?"}</Text>
                {row.obsoletedBy && row.obsoletedBy.length > 0
                  ? ` -> ${row.obsoletedBy.join(", ")}`
                  : ""}
                {row.parkedUntil ? ` (parked until ${row.parkedUntil})` : ""}
                {`: ${row.title} `}
              </Text>
            )}
            {row.path !== undefined && (
              <Button
                key={`open:${row.system ?? ""}/${row.cite}`}
                label="Open"
                onPress={() => open(row)}
              />
            )}
            {row.path !== undefined && (
              <Button
                key={`eli5:${row.system ?? ""}/${row.cite}`}
                label="ELI5"
                onPress={() => explain($, row)}
              />
            )}
          </Box>
        ))}
        {rows.length > shown.length && (
          <Text dimColor>+{rows.length - shown.length} more</Text>
        )}
      </Box>
    )
  })
}
