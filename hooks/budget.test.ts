import { expect, test } from 'claude-code/testing'

import { breakItDownBudget, capTokens, countOptions, countTerms, eli5Budget } from './budget'

const words = (n: number) => Array.from({ length: n }, () => 'plain').join(' ')

test('counts the terms a regex can see, once each, outside fenced code', () => {
  const text = 'Use `retryCount` and retryCount, see sz:P12 and sz:P12 again. The API wraps get_all_rows. ```\nignoredName = 1\n```'
  // retrycount, sz:p12, api, get_all_rows
  expect(countTerms(text)).toBe(4)
  expect(countTerms('Just ordinary English here.')).toBe(0)
})

test('counts labelled options at the start of a line, once each', () => {
  const text = ['Choose one:', '**Option A**: keep it', '- Option B: drop it', 'C) split it', 'D. merge it', 'A) again', 'Then 1. step one'].join('\n')
  expect(countOptions(text)).toBe(4)
  expect(countOptions('I prefer A over B in prose.')).toBe(0)
})

test('Break it down: the gist grows slower than the reply and is clamped', () => {
  const small = breakItDownBudget(words(20)).gist
  const mid = breakItDownBudget(words(650)).gist
  const huge = breakItDownBudget(words(5_000)).gist
  expect(small).toBe(80)
  expect(mid).toBeGreaterThan(small)
  expect(mid).toBeLessThan(650 / 2)
  expect(huge).toBe(200)
})

test('Break it down: the cap covers the worst case the prompt asks for, thinking included', () => {
  const four = ['Option A', 'Option B', 'Option C', 'Option D'].map(o => `${o}: ${words(120)}`).join('\n')
  const b = breakItDownBudget(`${words(100)}\n${four}`)
  // The 650-word, four-option reply that was cut off at option 3 under the old 1,200-token cap.
  expect(b.maxTokens).toBeGreaterThan(1_200 + 2_000)
  // What the prompt asks for, in tokens, fits under the cap on top of the thinking allowance.
  const ask = b.gist + 4 * b.perOption + b.perTerm * 4
  expect(b.maxTokens).toBeGreaterThanOrEqual(Math.ceil(ask * 1.6) + 2_000)
})

test('Break it down: a short reply thick with jargon is not capped by its length', () => {
  const dense = 'Set `maxTokens` in hooks.json via centinaCheck(), then rerun TLDR_SYSTEM against sz:P1, sz:P2, sz:Q3, sz:F4, sz:W5.'
  expect(breakItDownBudget(dense).maxTokens).toBeGreaterThan(breakItDownBudget('Fine.').maxTokens)
})

test('ELI5: scales with the entry and its terms, clamped, and the cap covers the ask', () => {
  expect(eli5Budget(words(10)).words).toBe(150)
  expect(eli5Budget(words(1_000)).words).toBeGreaterThan(150)
  expect(eli5Budget(words(100_000)).words).toBe(450)
  const dense = eli5Budget('`a_b` `c_d` `e_f` `g_h` `i_j` `k_l` `m_n` `o_p` ' + words(10))
  expect(dense.words).toBeGreaterThan(150)
  const b = eli5Budget(words(400))
  expect(b.maxTokens).toBeGreaterThan(capTokens(0, 'low'))
  expect(b.maxTokens).toBeGreaterThanOrEqual(Math.ceil(b.words * 1.6) + 500)
})
