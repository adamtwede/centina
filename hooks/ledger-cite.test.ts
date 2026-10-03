import { expect, test } from 'claude-code/testing'

import { activePhases, bearings, eli5Prompt, extractCites, progressPrompt, references, resolve, sectionAt, tldrPrompt } from './ledger-cite'
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
