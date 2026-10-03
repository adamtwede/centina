// Claude Code mod: a band above the prompt listing the Centina ledger entries
// the current turn's replies cite, with status, an "open in VS Code" button and an
// "ELI5" button (a one-off Haiku explanation, outside the session, in a pane).
// Reads each system's generated LEDGER.json (`centina-check ledger`); never the
// markdown ledger. Display only: nothing here is load-bearing for the skills.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { ELI5_SYSTEM, eli5Prompt, extractCites, references, resolve, sectionAt } from './ledger-cite'
import type { Cite, System } from './ledger-cite'
import type { Eli5, Row } from './types'

const cited = atom({ plugin: 'centina', key: 'cited' } as const, [])
const isHidden = atom({ plugin: 'centina', key: 'isHidden' } as const, false)
const eli5 = atom({ plugin: 'centina', key: 'eli5' } as const, null)

const ELI5_PANE = 'centina-eli5'
const ELI5_TIMEOUT_MS = 20_000

const LEDGER_JSON = 'LEDGER.json'
const SKIP_DIRS = new Set(['node_modules', 'archive', 'transcripts'])
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

async function visit($: EngineInterface, dir: string, depth: number, found: string[]): Promise<void> {
  let entries: { name: string; kind: string }[]
  try {
    entries = await $.fs.list(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.kind === 'file' && entry.name === LEDGER_JSON) found.push(dir)
    else if (
      entry.kind === 'dir' &&
      depth < MAX_DEPTH &&
      !entry.name.startsWith('.') &&
      !SKIP_DIRS.has(entry.name)
    ) {
      await visit($, `${dir}/${entry.name}`, depth + 1, found)
    }
  }
}

async function walk($: EngineInterface): Promise<void> {
  const found: string[] = []
  await visit($, await $.session.cwd(), 0, found)
  dirs = found
  walkedAt = await $.clock.now()
}

async function rowsFor($: EngineInterface): Promise<Row[]> {
  let rows = resolve(turnCites, await readSystems($))
  // A label that resolves nowhere may be in a ledger created since the last
  // walk; look again, at most every REWALK_MS.
  if (rows.some(row => row.problem === 'no-label') && (await $.clock.now()) - walkedAt > REWALK_MS) {
    await walk($)
    rows = resolve(turnCites, await readSystems($))
  }
  return rows
}

/** Folds one reply's text into the turn's citations and refreshes the band's rows. */
async function trackReply($: EngineInterface, text: string): Promise<void> {
  if (text === '') return
  if (isNewTurn) {
    isNewTurn = false
    turnCites = []
    await update($, isHidden, () => false)
  }
  const id = (c: Cite) => `${c.system ?? ''}/${c.key}(${c.part ?? ''})`
  const known = new Set(turnCites.map(id))
  for (const c of extractCites(text)) if (!known.has(id(c))) turnCites.push(c)
  const rows = await rowsFor($)
  await update($, cited, () => rows)
}

/**
 * Asks Haiku, with no session history and nothing written to the transcript, to
 * explain one entry in the ELI5 pane. A newer press supersedes an older one.
 */
async function explain($: EngineInterface, row: Row): Promise<void> {
  const { dir, path, line, key } = row
  if (dir === undefined || path === undefined || line === undefined || key === undefined) return
  const mine = ++asking
  stop.abort()
  stop = new AbortController()
  const show = async (status: Eli5['status'], text: string) => {
    if (mine === asking) await update($, eli5, () => ({ cite: row.cite, status, text }))
  }
  await $.ui.open({ id: ELI5_PANE, title: 'ELI5' })
  await show('asking', '')
  try {
    const system = await readSystem($, dir)
    const section = sectionAt(await $.fs.read(path), line, key)
    if (section === undefined) {
      return show('failed', 'The ledger changed since LEDGER.json was written; re-run `centina-check ledger`.')
    }
    const prompt = eli5Prompt(section, references(section, key, system), row.part)
    const cached = answers.get(prompt)
    if (cached !== undefined) return show('answered', cached)
    const reply = await $.model.complete(
      { model: 'haiku', system: ELI5_SYSTEM, prompt, effort: 'low', maxTokens: 400, timeoutMs: ELI5_TIMEOUT_MS },
      { signal: stop.signal },
    )
    if (!reply.isAnswered) {
      return show('failed', reply.reason === 'aborted' ? 'Timed out.' : `The Haiku call failed (${reply.reason}).`)
    }
    answers.set(prompt, reply.text)
    return show('answered', reply.text)
  } catch {
    return show('failed', `Could not read ${row.cite} from the ledger.`)
  }
}

async function clear($: EngineInterface): Promise<void> {
  turnCites = []
  isNewTurn = true
  await update($, cited, () => [])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await walk($)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await clear($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    isNewTurn = true
    return next(e)
  })

  on('session.append', { door: 'response' }, async ($, e, next) => {
    const stored = await next(e)
    if (e.agentId === undefined) {
      await trackReply($, e.message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('\n'))
    }
    return stored
  })

  on('ui.render', { component: 'Pane', requestId: ELI5_PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const state = await read($, eli5)
    if (state === null) return <Text dimColor>Press ELI5 on a ledger entry.</Text>
    return (
      <Box flexDirection="column">
        <Text bold>{state.cite}</Text>
        {state.status === 'asking' && <Text dimColor>Asking Haiku...</Text>}
        {state.status === 'failed' && <Text color="red">{state.text}</Text>}
        {state.status === 'answered' && <Text>{state.text}</Text>}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rows = await read($, cited)
    if (e.props.hasSurvey || rows.length === 0) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)

    // Hide folds the band to one line rather than removing it, so it can be
    // brought back; the next reply unfolds it again.
    if (await read($, isHidden)) {
      return (
        <Box>
          <Text dimColor>Ledger entries cited this turn ({rows.length}) </Text>
          <Button key="show" label="Show" onPress={() => update($, isHidden, () => false)} />
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
      const isOpened = (await via(['code', '-g', target])) || (await via(['open', `vscode://file${encodeURI(target)}`]))
      if (!isOpened) $.ui.toast(`Could not open ${row.cite} in VS Code`)
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>Ledger entries cited this turn </Text>
          <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
        </Box>
        {shown.map(row => (
          <Box key={`${row.system ?? ''}/${row.cite}`}>
            {/* Never shrinks: when the row is narrow only the title is cut, not the citation. */}
            <Box flexShrink={0}>
              <Text bold>{row.system ? `${row.system}/${row.cite}` : row.cite} </Text>
            </Box>
            {row.problem === 'no-label' ? (
              <Text color="red">not in any ledger</Text>
            ) : (
              <Text wrap="truncate-end">
                {row.problem === 'no-part' ? <Text color="red">no such part </Text> : null}
                <Text dimColor>{row.status ?? '?'}</Text>
                {row.obsoletedBy && row.obsoletedBy.length > 0 ? ` -> ${row.obsoletedBy.join(', ')}` : ''}
                {row.parkedUntil ? ` (parked until ${row.parkedUntil})` : ''}
                {`: ${row.title} `}
              </Text>
            )}
            {row.path !== undefined && (
              <Button key={`open:${row.system ?? ''}/${row.cite}`} label="Open" onPress={() => open(row)} />
            )}
            {row.path !== undefined && (
              <Button key={`eli5:${row.system ?? ''}/${row.cite}`} label="ELI5" onPress={() => explain($, row)} />
            )}
          </Box>
        ))}
        {rows.length > shown.length && <Text dimColor>+{rows.length - shown.length} more</Text>}
      </Box>
    )
  })
}
