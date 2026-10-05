import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const ledger = '## Open\n### sz:P1: first\ncites sz:P2\n### sz:P2: second\nbody'
const json = JSON.stringify({ system: 'alpha', entries: [
  { key: 'sz:P1', title: 'first', status: 'open', file: 'LEDGER.md', line: 2, parts: [], obsoletedBy: [] },
  { key: 'sz:P2', title: 'second', status: 'open', file: 'LEDGER.md', line: 4, parts: [], obsoletedBy: [] },
] })
const row = { cite: 'sz:P1', key: 'sz:P1', dir: '/w', path: '/w/LEDGER.md', line: 2, title: 'first', status: 'open' }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: ELI5 asks haiku once with the entry and shows the answer in the pane`, async ($, on) => {
    const store = new Map<string, unknown>([['centina/cited', [row]]])
    const asked: unknown[] = []
    const opened: unknown[] = []
    on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
    on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
    on('fs.read', async (_$, e) => ({ value: String(e.path).endsWith('.json') ? json : ledger }))
    on('ui.open', async (_$, e) => { opened.push(e.id); return { value: { isOpen: true } as never } })
    on('model.complete', async (_$, e) => {
      asked.push(e)
      return { value: { isAnswered: true, text: 'It is a thing.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
    })
    const ui = await $.ui.mount({ plugin: 'centina', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
    await ui.press({ key: 'eli5:/sz:P1' })
    await ui.press({ key: 'eli5:/sz:P1' })
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ model: 'haiku' })
    expect((asked[0] as { prompt: string }).prompt).toContain('- sz:P2: second')
    expect(opened[0]).toBe('centina-eli5')
    expect(store.get('centina/eli5')).toEqual({ cite: 'sz:P1', status: 'answered', text: 'It is a thing.' })
    const pane = await $.ui.mount({ plugin: 'centina', surface, component: 'Pane', requestId: 'centina-eli5', props: {} as never, viewport: { columns: 80, rows: 24 } })
    expect(await pane.findAll({ type: 'Text' })).toHaveLength(2)
  })
}

test('Hide folds the band to one line and Show brings it back', async ($, on) => {
  const store = new Map<string, unknown>([['centina/cited', [row]]])
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
  const mount = () => $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
  await (await mount()).press({ key: 'hide' })
  expect(store.get('centina/isHidden')).toBe(true)
  // The mocked state does not invalidate the first drawing, so draw again.
  const folded = await mount()
  expect(await folded.find({ key: 'eli5:/sz:P1' })).toBeUndefined()
  await folded.press({ key: 'show' })
  expect(store.get('centina/isHidden')).toBe(false)
  expect(await (await mount()).find({ key: 'eli5:/sz:P1' })).toBeDefined()
})

test('the citation never shrinks, so a narrow row cuts the title and not the label', async ($, on) => {
  on('state.get', async (_$, e) => ({ value: { value: e.key === 'cited' ? [row] : e.key === 'reply' ? '' : false, version: 1 } }))
  const ui = await $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
  const shielded = await ui.findAll({ type: 'Box', text: /sz:P1/ })
  expect(JSON.stringify(await ui.drawn())).toContain('"flexShrink":0')
  expect(shielded.length).toBeGreaterThan(0)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: TLDR THIS asks haiku with the reply, the goals and the cited entry's text`, async ($, on) => {
    // TLDR THIS only shows for a reply of over 150 words.
    const reply = `Choose A or B for sz:P1. ${'It holds up against the goal. '.repeat(30)}`
    const files: Record<string, string> = {
      '/w/LEDGER.json': JSON.stringify({ system: 'alpha', entries: [
        { key: 'sz:P1', title: 'first', status: 'open', file: 'LEDGER.md', line: 2, parts: [], obsoletedBy: [] },
        { key: 'sz:W1', title: 'phase one', status: 'active', kind: 'phase', file: 'LEDGER.md', line: 6, parts: [], obsoletedBy: [] },
        { key: 'sz:G1', title: 'the goal', status: 'active', file: 'LEDGER.md', line: 8, parts: [], obsoletedBy: [] },
      ] }),
      '/w/LEDGER.md': '## Open\n### sz:P1: first\ncites sz:P2\n### sz:P2: second\n## Work\n### sz:W1: phase one\nthe phase body\n### sz:G1: the goal\nthe goal body',
    }
    const store = new Map<string, unknown>([['centina/cited', [row]], ['centina/reply', reply]])
    const asked: unknown[] = []
    on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
    on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
    on('session.root', async () => ({ value: '/w' }) as never)
    on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
    on('fs.read', async (_$, e) => ({ value: files[String(e.path)] ?? '' }))
    on('ui.open', async () => ({ value: { isOpen: true } as never }))
    on('model.complete', async (_$, e) => {
      asked.push(e)
      return { value: { isAnswered: true, text: 'Short version.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
    })
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('clock.now', async () => ({ value: 0 }) as never)
    await $.session.start({ cwd: '/w', surface, isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'centina', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
    await ui.press({ key: 'tldr' })
    expect(asked).toHaveLength(1)
    const { prompt } = asked[0] as { prompt: string }
    expect(prompt).toContain(reply)
    expect(prompt).toContain('cites sz:P2')
    expect(prompt).toContain('the phase body')
    expect(prompt).toContain('the goal body')
    expect(store.get('centina/eli5')).toEqual({ cite: 'TLDR of the latest reply', status: 'answered', text: 'Short version.' })
  })
}

test('a shell cd into a subfolder does not hide the ledger', async ($, on) => {
  const store = new Map<string, unknown>([['centina/reply', 'Pick A or B.']])
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', async () => ({ value: 0 }) as never)
  // The shell has moved into a folder under the project; the project root has not.
  on('session.cwd', async () => ({ value: '/w/sub' }) as never)
  on('session.root', async () => ({ value: '/w' }) as never)
  on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
  on('fs.read', async () => ({ value: JSON.stringify({ system: 'alpha', entries: [
    { key: 'sz:W1', title: 'phase one', status: 'active', kind: 'phase', file: 'LEDGER.md', line: 6, parts: [], obsoletedBy: [] },
  ] }) }))
  await $.session.start({ cwd: '/w/sub', surface: 'terminal', isInteractive: true })
  expect(store.get('centina/hasPhase')).toBe(true)
})

test('a reply that cites nothing still gets a band with TLDR THIS, once a ledger is known', async ($, on) => {
  const store = new Map<string, unknown>([['centina/cited', []], ['centina/reply', `Pick A or B. ${'It holds up against the goal. '.repeat(30)}`]])
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', async () => ({ value: 0 }) as never)
  on('session.root', async () => ({ value: '/w' }) as never)
  on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
  const mount = () => $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const ui = await mount()
  expect(await ui.find({ key: 'tldr' })).toBeDefined()
  expect(await ui.find({ key: 'review' })).toBeDefined()
  // A short reply is worth neither.
  store.set('centina/reply', 'Pick A or B.')
  const short = await mount()
  expect(await short.find({ key: 'tldr' })).toBeUndefined()
  expect(await short.find({ key: 'review' })).toBeUndefined()
})

const phaseJson = JSON.stringify({ system: 'alpha', entries: [
  { key: 'sz:W1', title: 'phase one', status: 'active', kind: 'phase', file: 'LEDGER.md', line: 2, parts: [], obsoletedBy: [] },
  { key: 'sz:W2', title: 'spike it', status: 'done', kind: 'spike', phase: 'sz:W1', file: 'LEDGER.md', line: 4, parts: [], obsoletedBy: [] },
  { key: 'sz:W3', title: 'wire it', status: 'blocked', kind: 'step', phase: 'sz:W1', file: 'LEDGER.md', line: 6, parts: [], obsoletedBy: [] },
  { key: 'sz:G1', title: 'the goal', status: 'active', file: 'LEDGER.md', line: 8, parts: [], obsoletedBy: [] },
] })
const phaseLedger = '## Work\n### sz:W1: phase one\nthe definition of done\n### sz:W2: spike it\nthe spike evidence\n### sz:W3: wire it\nwaiting on the harness\n### sz:G1: the goal\nthe goal body'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: Phase progress asks sonnet with the phase, its open items and the goals`, async ($, on) => {
    const files: Record<string, string> = { '/w/LEDGER.json': phaseJson, '/w/LEDGER.md': phaseLedger }
    const store = new Map<string, unknown>([['centina/cited', []]])
    const asked: unknown[] = []
    on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
    on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
    on('session.root', async () => ({ value: '/w' }) as never)
    on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
    on('fs.read', async (_$, e) => ({ value: files[String(e.path)] ?? '' }))
    on('ui.open', async () => ({ value: { isOpen: true } as never }))
    on('model.complete', async (_$, e) => {
      asked.push(e)
      return { value: { isAnswered: true, text: 'Halfway there.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
    })
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('clock.now', async () => ({ value: 0 }) as never)
    await $.session.start({ cwd: '/w', surface, isInteractive: true })
    // The phase is known from the ledger alone: no reply has been written yet.
    expect(store.get('centina/hasPhase')).toBe(true)
    const ui = await $.ui.mount({ plugin: 'centina', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
    expect(await ui.find({ key: 'tldr' })).toBeUndefined()
    await ui.press({ key: 'progress' })
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ model: 'sonnet' })
    const { prompt } = asked[0] as { prompt: string }
    expect(prompt).toContain('the definition of done')
    expect(prompt).toContain('waiting on the harness')
    expect(prompt).toContain('- sz:W2 (done): spike it')
    expect(prompt).not.toContain('the spike evidence')
    expect(prompt).toContain('the goal body')
    expect(store.get('centina/eli5')).toEqual({ cite: 'Phase progress', status: 'answered', text: 'Halfway there.' })
  })
}

test('Phase progress shows only while a ledger phase is active, and does not call the model for a phase with no items', async ($, on) => {
  const stale = JSON.stringify({ system: 'alpha', entries: [
    { key: 'sz:W1', title: 'phase one', status: 'active', kind: 'phase', file: 'LEDGER.md', line: 2, parts: [], obsoletedBy: [] },
  ] })
  const store = new Map<string, unknown>([['centina/cited', []]])
  const asked: unknown[] = []
  let json = JSON.stringify({ system: 'alpha', entries: [
    { key: 'sz:W1', title: 'phase one', status: 'planned', kind: 'phase', file: 'LEDGER.md', line: 2, parts: [], obsoletedBy: [] },
  ] })
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
  on('session.root', async () => ({ value: '/w' }) as never)
  on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
  on('fs.read', async () => ({ value: json }))
  on('ui.open', async () => ({ value: { isOpen: true } as never }))
  on('model.complete', async (_$, e) => { asked.push(e); return { value: { isAnswered: false, reason: 'error' } as never } })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', async () => ({ value: 0 }) as never)
  const mount = () => $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  // A planned phase is not being worked yet.
  expect(store.get('centina/hasPhase')).toBe(false)
  json = stale
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(store.get('centina/hasPhase')).toBe(true)
  const ui = await mount()
  expect(await ui.find({ key: 'progress' })).toBeDefined()
  await ui.press({ key: 'progress' })
  expect(asked).toHaveLength(0)
  expect(store.get('centina/eli5')).toMatchObject({ status: 'failed' })
})

const itemJson = JSON.stringify({ system: 'alpha', entries: [
  { key: 'sz:W1', title: 'phase one', status: 'active', kind: 'phase', file: 'LEDGER.md', line: 2, parts: [], obsoletedBy: [] },
  { key: 'sz:W2', title: 'earlier spike', status: 'done', kind: 'spike', phase: 'sz:W1', file: 'LEDGER.md', line: 4, parts: [], obsoletedBy: [] },
  { key: 'sz:W3', title: 'the spike', status: 'active', kind: 'spike', phase: 'sz:W1', dependsOn: ['sz:W2'], file: 'LEDGER.md', line: 6, parts: [], obsoletedBy: [] },
  { key: 'sz:F1', title: 'it fails at birth', status: 'measured-false', phase: 'sz:W1', premises: ['sz:W3'], file: 'LEDGER.md', line: 8, parts: [], obsoletedBy: [] },
] })
const itemLedger = '## Work\n### sz:W1: phase one\nthe definition of done\n### sz:W2: earlier spike\nold\n### sz:W3: the spike\n(a) QUESTION the original question\nRESULT the latest word\n### sz:F1: it fails at birth\nfinding body'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: Item progress asks sonnet about the active work item and its findings, and shows from the ledger alone`, async ($, on) => {
    const store = new Map<string, unknown>([['centina/cited', []]])
    const asked: unknown[] = []
    on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
    on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
    on('session.root', async () => ({ value: '/w' }) as never)
    on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
    on('fs.read', async (_$, e) => ({ value: String(e.path).endsWith('.json') ? itemJson : itemLedger }))
    on('ui.open', async () => ({ value: { isOpen: true } as never }))
    on('model.complete', async (_$, e) => {
      asked.push(e)
      return { value: { isAnswered: true, text: 'Going nowhere.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
    })
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('clock.now', async () => ({ value: 0 }) as never)
    await $.session.start({ cwd: '/w', surface, isInteractive: true })
    expect(store.get('centina/hasItem')).toBe(true)
    const ui = await $.ui.mount({ plugin: 'centina', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
    await ui.press({ key: 'item-progress' })
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ model: 'sonnet' })
    const { prompt } = asked[0] as { prompt: string }
    expect(prompt).toContain('(a) QUESTION the original question')
    expect(prompt).toContain('RESULT the latest word')
    expect(prompt).toContain('- sz:F1 (measured-false): it fails at birth')
    expect(prompt).toContain('- sz:W2 (done): earlier spike')
    expect(prompt).toContain('the definition of done')
    expect(prompt).not.toContain('finding body')
    expect(store.get('centina/eli5')).toEqual({ cite: 'Item progress', status: 'answered', text: 'Going nowhere.' })
  })
}

test('the band flags a long-running item against the closed items of its kind, and Item progress is told the size', async ($, on) => {
  const closed = [8_000, 9_000, 10_000].map((size, i) => ({ key: `sz:W${i + 10}`, title: `closed ${i}`, status: 'done', kind: 'spike', size, file: 'LEDGER.md', line: 20 + i, parts: [], obsoletedBy: [] }))
  const json = JSON.stringify({ system: 'alpha', entries: [
    ...closed,
    { key: 'sz:W3', title: 'the spike', status: 'active', kind: 'spike', size: 275_000, date: '1970-01-01', file: 'LEDGER.md', line: 6, parts: [], obsoletedBy: [] },
  ] })
  const store = new Map<string, unknown>([['centina/cited', []]])
  const asked: unknown[] = []
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
  on('session.root', async () => ({ value: '/w' }) as never)
  on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
  on('fs.read', async (_$, e) => ({ value: String(e.path).endsWith('.json') ? json : itemLedger }))
  on('ui.open', async () => ({ value: { isOpen: true } as never }))
  on('model.complete', async (_$, e) => { asked.push(e); return { value: { isAnswered: true, text: 'ok', usage } as never } })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', async () => ({ value: 3 * 86_400_000 }) as never)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(store.get('centina/drift')).toMatchObject({ key: 'sz:W3', size: 275_000, level: 'high', days: 3 })
  const ui = await $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
  expect(JSON.stringify(await ui.drawn())).toContain('Long-running ')
  expect(JSON.stringify(await ui.drawn())).toContain('275k chars')
  await ui.press({ key: 'item-progress' })
  expect((asked[0] as { prompt: string }).prompt).toContain('Size, from the ledger and not a verdict')
  expect((asked[0] as { prompt: string }).prompt).toContain('sz:W3: 275k chars')
})

test('Item progress is not offered when no work item is active', async ($, on) => {
  const json = JSON.stringify({ system: 'alpha', entries: [
    { key: 'sz:W1', title: 'phase one', status: 'planned', kind: 'phase', file: 'LEDGER.md', line: 2, parts: [], obsoletedBy: [] },
    { key: 'sz:W2', title: 'spike', status: 'done', kind: 'spike', file: 'LEDGER.md', line: 4, parts: [], obsoletedBy: [] },
  ] })
  const store = new Map<string, unknown>([['centina/cited', []]])
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
  on('session.root', async () => ({ value: '/w' }) as never)
  on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
  on('fs.read', async () => ({ value: json }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', async () => ({ value: 0 }) as never)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(store.get('centina/hasItem')).toBe(false)
})

const usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: Second opinion asks opus with the request and the reply, and sends only when told to`, async ($, on) => {
    // Second opinion only shows for a reply of over 50 words.
    const reply = `Use sz:P1 as written. ${'It holds up against the goal. '.repeat(12)}`
    const files: Record<string, string> = {
      '/w/LEDGER.json': JSON.stringify({ system: 'alpha', entries: [
        { key: 'sz:P1', title: 'first', status: 'open', file: 'LEDGER.md', line: 2, parts: [], obsoletedBy: [] },
        { key: 'sz:G1', title: 'the goal', status: 'active', file: 'LEDGER.md', line: 4, parts: [], obsoletedBy: [] },
      ] }),
      '/w/LEDGER.md': '## Open\n### sz:P1: first\nthe proposal body\n### sz:G1: the goal\nthe goal body',
    }
    const store = new Map<string, unknown>([['centina/cited', [row]], ['centina/reply', reply], ['centina/request', 'Should we do sz:P1?']])
    const asked: unknown[] = []
    const sent: unknown[] = []
    on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
    on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
    on('session.root', async () => ({ value: '/w' }) as never)
    on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
    on('fs.read', async (_$, e) => ({ value: files[String(e.path)] ?? '' }))
    on('ui.open', async () => ({ value: { isOpen: true } as never }))
    on('model.complete', async (_$, e) => {
      asked.push(e)
      return { value: { isAnswered: true, text: 'Errors and flaws: none found.', usage } }
    })
    on('prompt.submit', async (_$, e) => { sent.push(e); return { text: e.text } })
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('clock.now', async () => ({ value: 0 }) as never)
    await $.session.start({ cwd: '/w', surface, isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'centina', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
    await ui.press({ key: 'review' })
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ model: 'opus', effort: 'high' })
    const { prompt } = asked[0] as { prompt: string }
    expect(prompt).toContain("The reader's last request:\nShould we do sz:P1?")
    expect(prompt).toContain(`Latest reply:\n${reply}`)
    expect(prompt).toContain('the proposal body')
    expect(prompt).toContain('the goal body')
    expect(store.get('centina/eli5')).toEqual({ cite: 'Second opinion on the latest reply', status: 'answered', text: 'Errors and flaws: none found.', isSendable: true })
    // The answer waits in the pane: nothing reaches the session until the button is pressed.
    expect(sent).toHaveLength(0)
    const pane = await $.ui.mount({ plugin: 'centina', surface, component: 'Pane', requestId: 'centina-eli5', props: {} as never, viewport: { columns: 80, rows: 24 } })
    await pane.press({ key: 'send' })
    expect(sent).toHaveLength(1)
    const message = sent[0] as { text: string; asUser?: true }
    expect(message.text).toContain('Errors and flaws: none found.')
    expect(message.text).toContain('do not change anything on its say-so alone')
    expect(message.asUser).toBeUndefined()
    // One send per answer.
    expect((store.get('centina/eli5') as { isSendable?: boolean }).isSendable).toBe(false)
  })
}

const paneOf = ($: Engine) =>
  $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'Pane', requestId: 'centina-eli5', props: {} as never, viewport: { columns: 80, rows: 24 } })

test('only a second opinion\'s answer offers Send to session', async ($, on) => {
  const store = new Map<string, unknown>([['centina/eli5', { cite: 'TLDR of the latest reply', status: 'answered', text: 'Short.' }]])
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  expect(await (await paneOf($)).find({ key: 'send' })).toBeUndefined()
})

test('a second opinion\'s answer offers Send to session', async ($, on) => {
  const store = new Map<string, unknown>([['centina/eli5', { cite: 'Second opinion on the latest reply', status: 'answered', text: 'Long.', isSendable: true }]])
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  expect(await (await paneOf($)).find({ key: 'send' })).toBeDefined()
})

test('a prompt the reader typed is kept as the last request; a plugin\'s own is not', async ($, on) => {
  const store = new Map<string, unknown>()
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'from a plugin' } as never)
  expect(store.get('centina/request')).toBeUndefined()
  await $.prompt.submit({ text: 'what I typed', origin: { kind: 'composer' } } as never)
  expect(store.get('centina/request')).toBe('what I typed')
})

const trailJson = JSON.stringify({ system: 'alpha', entries: [
  { key: 'sz:W3', title: 'the spike', status: 'active', kind: 'spike', file: 'LEDGER.md', line: 6, parts: [], obsoletedBy: [] },
] })

const trackerCases = [
  { name: 'regenerates the page with the checker, then opens it', env: '/data', pointer: undefined, runs: true, toast: undefined },
  { name: 'finds the checker through the file the install hook left, when the mod cannot see the variable', env: undefined, pointer: '/data\n', runs: true, toast: undefined },
  { name: 'opens the last page as it stands, and says why, when the checker cannot be found', env: undefined, pointer: undefined, runs: false, toast: 'not refreshed' },
]
for (const c of trackerCases) {
  test(`Tracker ${c.name}`, async ($, on) => {
    const store = new Map<string, unknown>([['centina/cited', []]])
    const ran: { argv: readonly string[]; env?: Record<string, string> }[] = []
    const toasts: string[] = []
    on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
    on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
    on('session.root', async () => ({ value: '/w' }) as never)
    on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }, { name: 'TRAIL.jsonl', kind: 'file' }, { name: 'TRACKER.html', kind: 'file' }] : [] }) as never)
    on('fs.read', async (_$, e) => {
      if (!String(e.path).endsWith('.centina-data')) return { value: trailJson }
      if (c.pointer === undefined) throw new Error('no such file')
      return { value: c.pointer }
    })
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('clock.now', async () => ({ value: 0 }) as never)
    on('env.get', async () => ({ value: c.env }) as never)
    on('process.run', async (_$, e) => { ran.push({ argv: e.argv, env: e.init?.env }); return { value: { exitCode: 0, stdout: '', stderr: '' } } as never })
    on('ui.toast', async (_$, e) => { toasts.push(JSON.stringify(e)); return { value: undefined } as never })
    await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
    expect(store.get('centina/trailDir')).toBe('/w')
    const ui = await $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
    await ui.press({ key: 'tracker' })
    const argvs = ran.map((r) => r.argv.join(' '))
    // The page opens on the item the band is tracking.
    expect(argvs.some((a) => /^node .*bin\/centina-check trail --item sz:W3 \/w$/.test(a))).toBe(c.runs)
    if (c.runs) expect(ran[0].env).toMatchObject({ CLAUDE_PLUGIN_DATA: '/data' })
    expect(argvs).toContain('open /w/TRACKER.html')
    expect(toasts.some((t) => t.includes('not refreshed'))).toBe(c.toast !== undefined)
  })
}

test('/track-item pins the band to an item, shows it as pinned, and auto lets the band choose again', async ($, on) => {
  const store = new Map<string, unknown>([['centina/cited', []]])
  const toasts: string[] = []
  const two = JSON.stringify({ system: 'alpha', entries: [
    { key: 'sz:W3', title: 'the spike', status: 'active', kind: 'spike', file: 'LEDGER.md', line: 6, parts: [], obsoletedBy: [] },
    { key: 'sz:W4', title: 'the next spike', status: 'active', kind: 'spike', file: 'LEDGER.md', line: 20, dependsOn: [], parts: [], obsoletedBy: [] },
  ] })
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
  on('session.root', async () => ({ value: '/w' }) as never)
  on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
  on('fs.read', async () => ({ value: two }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', async () => ({ value: 0 }) as never)
  on('ui.toast', async (_$, e) => { toasts.push(JSON.stringify(e)); return { value: undefined } as never })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect((store.get('centina/drift') as { key: string }).key).toBe('sz:W4')
  await $.command.run({ command: 'track-item', args: 'W3' } as never)
  expect(store.get('centina/pinnedItem')).toBe('sz:W3')
  expect(store.get('centina/drift')).toMatchObject({ key: 'sz:W3', isPinned: true })
  await $.command.run({ command: 'track-item', args: 'sz:W9' } as never)
  expect(store.get('centina/pinnedItem')).toBe('sz:W3')
  expect(toasts.some((t) => t.includes('No work item'))).toBe(true)
  await $.command.run({ command: 'track-item', args: 'auto' } as never)
  expect(store.get('centina/pinnedItem')).toBe(null)
  expect((store.get('centina/drift') as { key: string }).key).toBe('sz:W4')
})

test('Tracker is not offered for a system with no trail', async ($, on) => {
  const store = new Map<string, unknown>([['centina/cited', []]])
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('state.set', async (_$, e) => { store.set(`${e.plugin}/${e.key}`, e.value); return { value: { isSet: true, version: 2 } } })
  on('session.root', async () => ({ value: '/w' }) as never)
  on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
  on('fs.read', async () => ({ value: trailJson }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', async () => ({ value: 0 }) as never)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(store.get('centina/trailDir')).toBe(null)
  const ui = await $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
  expect(await ui.find({ key: 'tracker' })).toBeUndefined()
})
