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
