import { expect, test } from 'claude-code/testing'

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
  on('state.get', async (_$, e) => ({ value: { value: e.key === 'cited' ? [row] : false, version: 1 } }))
  const ui = await $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
  const shielded = await ui.findAll({ type: 'Box', text: /sz:P1/ })
  expect(JSON.stringify(await ui.drawn())).toContain('"flexShrink":0')
  expect(shielded.length).toBeGreaterThan(0)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: TLDR THIS asks haiku with the reply, the goals and the cited entry's text`, async ($, on) => {
    const reply = 'Choose A or B for sz:P1.'
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
    on('session.cwd', async () => ({ value: '/w' }) as never)
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

test('a reply that cites nothing still gets a band with TLDR THIS, once a ledger is known', async ($, on) => {
  const store = new Map<string, unknown>([['centina/cited', []], ['centina/reply', 'Pick A or B.']])
  on('state.get', async (_$, e) => ({ value: { value: store.get(`${e.plugin}/${e.key}`), version: 1 } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', async () => ({ value: 0 }) as never)
  on('session.cwd', async () => ({ value: '/w' }) as never)
  on('fs.list', async (_$, e) => ({ value: e.path === '/w' ? [{ name: 'LEDGER.json', kind: 'file' }] : [] }) as never)
  const mount = () => $.ui.mount({ plugin: 'centina', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(await (await mount()).find({ key: 'tldr' })).toBeDefined()
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
    on('session.cwd', async () => ({ value: '/w' }) as never)
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
  on('session.cwd', async () => ({ value: '/w' }) as never)
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
