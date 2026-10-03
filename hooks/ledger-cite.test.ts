import { expect, test } from 'claude-code/testing'

import { bearings, eli5Prompt, extractCites, references, resolve, sectionAt, tldrPrompt } from './ledger-cite'
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
