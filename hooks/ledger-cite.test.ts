import { expect, test } from 'claude-code/testing'

import { activePhases, bearings, currentItem, driftLine, eli5Prompt, extractCites, findingsOf, headOutlineTail, itemDrift, itemProgressPrompt, progressPrompt, references, resolve, reviewPrompt, sectionAt, tldrPrompt } from './ledger-cite'
import type { System } from './ledger-cite'

const entry = (key: string, extra = {}) => ({
  key,
  title: `title of ${key}`,
  status: 'ratified',
  file: 'LEDGER.md',
  line: 10,
  parts: ['a', 'b'],
  obsoletedBy: [],
  ...extra,
})

const alpha: System = { dir: '/w/alpha', json: { system: 'alpha', entries: [entry('sz:P12'), entry('sz:P2')] } }
const beta: System = { dir: '/w/beta', json: { system: 'beta', entries: [entry('sz:P12')] } }

test('extracts qualified citations once each, parts and systems included', () => {
  const text = 'See `sz:P12(a)`, sz:P12(a) again, beta/sz:P12 and task-matcher:Q3.'
  expect(extractCites(text)).toEqual([
    { system: undefined, key: 'sz:P12', part: 'a' },
    { system: 'beta', key: 'sz:P12', part: undefined },
    { system: undefined, key: 'task-matcher:Q3', part: undefined },
  ])
})

test('ignores bare labels, URLs and longer tokens', () => {
  expect(extractCites('P12, http://x:P1, sz:P12x, xsz:P1y')).toEqual([])
})

test('resolves a cite to its entry and opens at the heading line', () => {
  const [row] = resolve(extractCites('sz:P2'), [alpha])
  expect(row).toMatchObject({ cite: 'sz:P2', status: 'ratified', path: '/w/alpha/LEDGER.md', line: 10 })
  expect(row.problem).toBeUndefined()
})

test('flags a missing label and a missing part', () => {
  const rows = resolve(extractCites('sz:P99 sz:P2(z)'), [alpha])
  expect(rows.map(r => r.problem)).toEqual(['no-label', 'no-part'])
})

test('shows the system when an unqualified cite resolves in several, and honours a qualified one', () => {
  expect(resolve(extractCites('sz:P12'), [alpha, beta]).map(r => r.system)).toEqual(['alpha', 'beta'])
  expect(resolve(extractCites('beta/sz:P12'), [alpha, beta]).map(r => r.path)).toEqual(['/w/beta/LEDGER.md'])
  expect(resolve(extractCites('gamma/sz:P12'), [alpha, beta]).map(r => r.problem)).toEqual(['no-label'])
})

const ledgerText = [
  '## Open',
  '### sz:P1: first',
  'cites sz:P2 and sz:P1 and sz:P2 and sz:P9',
  '~~~',
  '# a shell comment, not a heading',
  '~~~',
  '### sz:P2: second',
  'body',
].join('\n')

test('cuts an entry at the next heading, skipping fenced code, and refuses a moved heading', () => {
  expect(sectionAt(ledgerText, 2, 'sz:P1')?.split('\n')).toHaveLength(5)
  expect(sectionAt(ledgerText, 7, 'sz:P2')).toBe('### sz:P2: second\nbody')
  expect(sectionAt(ledgerText, 3, 'sz:P1')).toBeUndefined()
  expect(sectionAt(ledgerText, 2, 'sz:P')).toBeUndefined()
})

test('lists the other entries an entry cites, once each, known ones only', () => {
  const system: System = { dir: '/w', json: { system: 'alpha', entries: [entry('sz:P1'), entry('sz:P2')] } }
  expect(references(sectionAt(ledgerText, 2, 'sz:P1') ?? '', 'sz:P1', system)).toEqual([
    { key: 'sz:P2', title: 'title of sz:P2' },
  ])
})

test('builds the ELI5 prompt from the entry, its references and the cited part', () => {
  const prompt = eli5Prompt('### sz:P1: first', [{ key: 'sz:P2', title: 'second' }], 'b')
  expect(prompt).toContain('### sz:P1: first')
  expect(prompt).toContain('- sz:P2: second')
  expect(prompt).toContain('part (b)')
  expect(eli5Prompt('x', [])).not.toContain('Related entries')
})

test('finds the active phase and active goals, and no others', () => {
  const system: System = {
    dir: '/w',
    json: {
      system: 'alpha',
      entries: [
        entry('sz:W1', { kind: 'phase', status: 'active' }),
        entry('sz:W2', { kind: 'phase', status: 'done' }),
        entry('sz:W3', { kind: 'step', status: 'active' }),
        entry('sz:G1', { status: 'active' }),
        entry('sz:G2', { status: 'retired' }),
        entry('sz:P1', { status: 'active' }),
      ],
    },
  }
  const found = bearings([system])
  expect(found.phase.map(e => e.key)).toEqual(['sz:W1'])
  expect(found.goals.map(e => e.key)).toEqual(['sz:G1'])
})

test('builds the TLDR prompt from the reply, phase, goals and cited entries', () => {
  const prompt = tldrPrompt(
    'Pick A or B (sz:Q1).',
    [{ key: 'sz:Q1', title: 'which one', status: 'open', text: '### sz:Q1: which one\nbody' }],
    [{ key: 'sz:W1', title: 'phase one', status: 'active' }],
    [],
  )
  expect(prompt).toContain('Latest reply:\nPick A or B')
  expect(prompt).toContain('### sz:Q1: which one\nbody')
  expect(prompt).toContain('- sz:W1 (active): phase one')
  expect(prompt).not.toContain('Active goals')
  expect(prompt.indexOf('Active phase')).toBeLessThan(prompt.indexOf('Ledger entries the reply cites'))
})

test('TLDR spends entry text on cited entries first and lists the rest by title', () => {
  const big = (key: string) => ({ key, title: `t ${key}`, status: 'open', text: `### ${key}: t\n${'x'.repeat(2_900)}` })
  const cited = ['sz:Q1', 'sz:Q2', 'sz:Q3', 'sz:Q4', 'sz:Q5', 'sz:Q6', 'sz:Q7', 'sz:Q8'].map(big)
  const prompt = tldrPrompt('r', cited, [{ key: 'sz:W1', title: 'phase one', status: 'active', text: '### sz:W1: phase one\nfull' }], [])
  expect(prompt).toContain('- sz:Q8 (open): t sz:Q8')
  expect(prompt).toContain('- sz:W1 (active): phase one')
  expect(prompt).not.toContain('\nfull')
  expect(prompt.length).toBeLessThan(30_000)
})

test('splits an active phase\'s items into remaining work and the rest, and ignores other phases', () => {
  const system: System = {
    dir: '/w/s',
    json: {
      system: 's',
      entries: [
        entry('sz:W1', { kind: 'phase', status: 'active' }),
        entry('sz:W2', { kind: 'step', status: 'done', phase: 'sz:W1' }),
        entry('sz:W3', { kind: 'step', status: 'blocked', phase: 'sz:W1' }),
        entry('sz:Q1', { status: 'open', phase: 'sz:W1' }),
        entry('sz:Q2', { status: 'answered', phase: 'sz:W1' }),
        entry('sz:W4', { kind: 'phase', status: 'done' }),
        entry('sz:W5', { kind: 'step', status: 'planned', phase: 'sz:W4' }),
      ],
    },
  }
  const [only, ...rest] = activePhases(system)
  expect(rest).toEqual([])
  expect(only.phase.key).toBe('sz:W1')
  expect(only.open.map(e => e.key)).toEqual(['sz:W3', 'sz:Q1'])
  expect(only.closed.map(e => e.key)).toEqual(['sz:W2', 'sz:Q2'])
  expect(activePhases({ dir: '/w/s', json: { system: 's', entries: [entry('sz:W9', { kind: 'phase', status: 'planned' })] } })).toEqual([])
})

test('phase progress prompt gives open items their text and closed items only a title', () => {
  const phase = { key: 'sz:W1', title: 'phase one', status: 'active', text: '### sz:W1: phase one\nthe definition of done' }
  const open = [{ key: 'sz:W3', title: 'wire it', status: 'blocked', text: '### sz:W3: wire it\nwaiting on the harness' }]
  const closed = [{ key: 'sz:W2', title: 'spike it', status: 'done' }]
  const prompt = progressPrompt([{ phase, open, closed }], [{ key: 'sz:G1', title: 'the goal', status: 'active', text: '### sz:G1: the goal\ngoal body' }])
  expect(prompt).toContain('the definition of done')
  expect(prompt).toContain('waiting on the harness')
  expect(prompt).toContain('- sz:W2 (done): spike it')
  expect(prompt).toContain('goal body')
  expect(prompt.indexOf('the definition of done')).toBeLessThan(prompt.indexOf('waiting on the harness'))
  expect(prompt.trimEnd().endsWith("Report on the phase's progress.")).toBe(true)
})

test('the review prompt leads with the reader\'s request, cut when long, and TLDR\'s has none', () => {
  const cited = [{ key: 'sz:Q1', title: 'which one', status: 'open', text: '### sz:Q1: which one\nbody' }]
  const prompt = reviewPrompt('Should we?', 'Yes, sz:Q1.', cited, [], [])
  expect(prompt.startsWith("The reader's last request:\nShould we?\n\nLatest reply:\nYes, sz:Q1.")).toBe(true)
  expect(prompt).toContain('### sz:Q1: which one\nbody')
  expect(prompt.trimEnd().endsWith('Review the latest reply.')).toBe(true)
  expect(reviewPrompt('x'.repeat(10_000), 'r', [], [], []).length).toBeLessThan(4_200)
  expect(tldrPrompt('r', [], [], [])).not.toContain("last request")
})

const chain: System = {
  dir: '/w/s',
  json: {
    system: 's',
    entries: [
      entry('sz:W1', { kind: 'phase', status: 'active', line: 1 }),
      entry('sz:W2', { kind: 'spike', status: 'active', line: 20, dependsOn: ['sz:W1'], phase: 'sz:W1' }),
      entry('sz:W3', { kind: 'spike', status: 'active', line: 40, dependsOn: ['sz:W2'], phase: 'sz:W1' }),
      entry('sz:W4', { kind: 'spike', status: 'done', line: 60, dependsOn: ['sz:W3'], phase: 'sz:W1' }),
      entry('sz:F1', { status: 'measured', line: 70, premises: ['sz:W3', 'sz:A1'] }),
      entry('sz:F2', { status: 'measured', line: 80, premises: ['sz:W2'] }),
    ],
  },
}

test('the current item is the cited active work item, else the end of the active chain, never a phase or a finished item', () => {
  expect(currentItem([chain])?.entry.key).toBe('sz:W3')
  expect(currentItem([chain], ['sz:W1', 'sz:F1', 'sz:W2'])?.entry.key).toBe('sz:W2')
  const only = { dir: '/w/s', json: { system: 's', entries: [entry('sz:W1', { kind: 'phase', status: 'active' }), entry('sz:W4', { kind: 'spike', status: 'done' })] } }
  expect(currentItem([only])).toBeUndefined()
})

test('of several chain ends the one furthest down its file is current', () => {
  const two = { dir: '/w/s', json: { system: 's', entries: [entry('sz:W2', { kind: 'spike', status: 'active', line: 5 }), entry('sz:W3', { kind: 'other', status: 'active', line: 9 })] } }
  expect(currentItem([two])?.entry.key).toBe('sz:W3')
})

test('an item\'s findings are the entries that name it in Premises', () => {
  expect(findingsOf(chain, 'sz:W3').map(e => e.key)).toEqual(['sz:F1'])
  expect(findingsOf(chain, 'sz:W9')).toEqual([])
})

test('a short entry is shown whole; a long one keeps its start, one line per middle paragraph and its end in full', () => {
  expect(headOutlineTail('short entry')).toBe('short entry')
  const paragraphs = Array.from({ length: 200 }, (_, i) => `STEP ${i} ${'detail '.repeat(100)}`)
  const long = ['(a) QUESTION the original question', ...paragraphs, 'RESULT the latest word'].join('\n')
  const shaped = headOutlineTail(long)
  expect(shaped).toContain('(a) QUESTION the original question')
  expect(shaped.endsWith('RESULT the latest word')).toBe(true)
  expect(shaped).toContain('STEP 30 ')
  expect(shaped).toContain('STEP 150 ')
  expect(shaped).not.toContain(paragraphs[100])
  expect(shaped.length).toBeLessThan(24_000)
  expect(shaped.length).toBeLessThan(long.length / 5)
})

test('a very long entry keeps a line for every middle paragraph, each cut shorter, rather than dropping the newest', () => {
  const paragraphs = Array.from({ length: 400 }, (_, i) => `STEP ${i} ${'x'.repeat(300)}`)
  const shaped = headOutlineTail(['head '.repeat(1000), ...paragraphs, 'end'].join('\n'))
  expect(shaped).toContain('STEP 100 ')
  expect(shaped).toContain('STEP 390 ')
  // The floor on a line's length lets an extreme entry run past the usual size.
  expect(shaped.length).toBeLessThan(27_000)
})

test('the item progress prompt shapes the item, lists its findings and ends with the ask', () => {
  const body = ['(a) QUESTION the original question', ...Array.from({ length: 100 }, (_, i) => `STEP ${i} ${'detail '.repeat(100)}`), 'RESULT the latest word'].join('\n')
  const prompt = itemProgressPrompt({
    item: { key: 'sz:W3', title: 'the spike', status: 'active', text: body },
    findings: [{ key: 'sz:F1', title: 'it fails', status: 'measured-false' }],
    phase: { key: 'sz:W1', title: 'phase one', status: 'active', text: '### sz:W1: phase one\nthe definition of done' },
    depends: [{ key: 'sz:W2', title: 'the earlier spike', status: 'active' }],
    goals: [{ key: 'sz:G1', title: 'the goal', status: 'active', text: '### sz:G1: the goal\ngoal body' }],
  })
  expect(prompt).toContain('(a) QUESTION the original question')
  expect(prompt).toContain('RESULT the latest word')
  expect(prompt).toContain('- sz:F1 (measured-false): it fails')
  expect(prompt).toContain('- sz:W2 (active): the earlier spike')
  expect(prompt).toContain('the definition of done')
  expect(prompt).toContain('goal body')
  expect(prompt.trimEnd().endsWith("Report on this work item's progress.")).toBe(true)
})

const sized = (sizes: number[], extra = {}): System => ({
  dir: '/w/s',
  json: {
    system: 's',
    entries: sizes.map((size, i) => entry(`sz:W${i + 1}`, { kind: 'spike', status: 'done', size, date: '2026-10-01', ...extra })),
  },
})

test('an item is compared with the closed items of its kind by text size', () => {
  const sys = sized([8_000, 9_000, 10_000, 60_000])
  const item = (size: number, extra = {}) => entry('sz:W9', { kind: 'spike', status: 'active', size, date: '2026-10-01', ...extra })
  const drift = (size: number) => itemDrift({ dir: sys.dir, json: { ...sys.json, entries: [...sys.json.entries, item(size)] } }, item(size), Date.parse('2026-10-04'))
  expect(drift(12_000).level).toBe('ok')
  expect(drift(40_000).level).toBe('warn')
  expect(drift(275_000).level).toBe('high')
  expect(drift(275_000)).toMatchObject({ size: 275_000, findings: 0, days: 3, typical: { count: 4, median: 9_500, largest: 60_000 } })
})

test('an item with fewer than three closed items to compare with, or no size, gets facts and no level', () => {
  const few = sized([8_000, 9_000])
  const item = entry('sz:W9', { kind: 'spike', status: 'active', size: 275_000 })
  expect(itemDrift({ dir: few.dir, json: { ...few.json, entries: [...few.json.entries, item] } }, item).level).toBe('unknown')
  const many = sized([8_000, 9_000, 10_000])
  const old = entry('sz:W9', { kind: 'spike', status: 'active' })
  expect(itemDrift({ dir: many.dir, json: { ...many.json, entries: [...many.json.entries, old] } }, old)).toMatchObject({ level: 'unknown', size: 0 })
})

test('only done items of the same kind are the baseline, and findings are the entries that name the item', () => {
  const sys: System = { dir: '/w/s', json: { system: 's', entries: [
    entry('sz:W1', { kind: 'spike', status: 'done', size: 1_000 }),
    entry('sz:W2', { kind: 'spike', status: 'done', size: 1_000 }),
    entry('sz:W3', { kind: 'spike', status: 'done', size: 1_000 }),
    entry('sz:W4', { kind: 'spike', status: 'deferred', size: 900_000 }),
    entry('sz:W5', { kind: 'build', status: 'done', size: 900_000 }),
    entry('sz:W9', { kind: 'spike', status: 'active', size: 5_000 }),
    entry('sz:F1', { status: 'measured', premises: ['sz:W9'] }),
  ] } }
  const drift = itemDrift(sys, sys.json.entries.find(e => e.key === 'sz:W9')!)
  expect(drift).toMatchObject({ level: 'high', findings: 1, typical: { count: 3, largest: 1_000 } })
})

test('the drift line gives the item\'s numbers and the closed items\' to compare', () => {
  expect(driftLine({ key: 'sz:W9', size: 275_000, findings: 20, days: 3, level: 'high', typical: { count: 25, median: 9_000, largest: 60_000, findingsMedian: 3 } }))
    .toBe('sz:W9: 275k chars, 20 findings, 3 days; closed 25 of its kind: median 9k chars and 3 findings, largest 60k')
  expect(driftLine({ key: 'sz:W9', size: 800, findings: 0, level: 'unknown' })).toBe('sz:W9: 800 chars, 0 findings')
})
