// How long an explanation may be and how many tokens a call may spend on it.
//
// Two separate questions, answered separately. The *cap* (`maxTokens`) is a
// ceiling that costs nothing unused, so it is sized for the worst case the input
// allows and exists to stop a cut-off, not to shape the answer. The *guide* is
// the per-part word counts the prompt gives the model, which is what shapes it.
//
// Neither is a fraction of the input's length: these calls translate and explain
// as much as they condense, and a short reply thick with jargon needs a longer
// answer than a long plain one. So the guide counts what has to be said (terms to
// define, options to weigh) and uses the input's length only for the part that is
// a true summary, where it grows slower than the input.

export type Effort = "low" | "medium" | "high"

const TOKENS_PER_WORD = 1.6
// The model overshoots a guide (a small one by well over half), and the counts below
// miss units; the cap is free when unused, so it allows twice the guide.
const SLACK = 2
// Reasoning is spent from the same cap as the answer. Rough, to be tuned from the
// `usage.output_tokens` of real calls.
const THINKING_TOKENS: Record<Effort, number> = {
  low: 1_000,
  medium: 4_000,
  high: 8_000,
}

/** The cap for an answer of about `words` words, thinking included. */
export function capTokens(words: number, effort: Effort): number {
  return Math.ceil(words * TOKENS_PER_WORD * SLACK) + THINKING_TOKENS[effort]
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length
}

const clamp = (low: number, value: number, high: number) =>
  Math.min(high, Math.max(low, value))
const toTens = (n: number) => Math.round(n / 10) * 10

const FENCED_CODE = /```[\s\S]*?```/g
const TERM_PATTERNS = [
  /`([^`\n]+)`/g, // code spans
  /\b[a-z][a-z0-9-]*:[A-Z]\d+\b/g, // ledger keys: sz:P12
  /\b[A-Z]{2,}\b/g, // acronyms
  /\b[a-z]+(?:[A-Z][a-z0-9]+)+\b/g, // camelCase
  /\b(?:[A-Z][a-z0-9]+){2,}\b/g, // PascalCase
  /\b[a-z0-9]+(?:_[a-z0-9]+)+\b/g, // snake_case
]

/**
 * How many distinct terms of the kinds a regex can see (code identifiers, ledger
 * keys, acronyms) the text uses, ignoring fenced code. Blind to everyday words
 * used in a special sense, so it is a floor for the answer's size, not a list of
 * what to define: the model decides that.
 */
export function countTerms(text: string): number {
  const prose = text.replace(FENCED_CODE, " ")
  const seen = new Set<string>()
  for (const pattern of TERM_PATTERNS)
    for (const m of prose.matchAll(pattern))
      seen.add((m[1] ?? m[0]).trim().toLowerCase())
  return seen.size
}

const OPTION_WORDED = /^\s*[-*>]?\s*(?:\*\*|__)?(?:option|choice|alternative|approach|path)\s+([a-z0-9]+)\b/gim
const OPTION_LETTERED = /^\s*[-*>]?\s*(?:\*\*|__)?\(?([A-F])[.):]\s/gm

/** How many distinct labelled options (`Option B`, `B)`, `**C.**`) start a line of the text. */
export function countOptions(text: string): number {
  const prose = text.replace(FENCED_CODE, " ")
  const labels = new Set<string>()
  for (const m of prose.matchAll(OPTION_WORDED)) labels.add(m[1].toLowerCase())
  for (const m of prose.matchAll(OPTION_LETTERED)) labels.add(m[1].toLowerCase())
  return labels.size
}

/** What a call to "Break it down" tells the model to write, and what it may spend. */
export type BreakItDownBudget = {
  /** The Gist part: the one true summary, so it grows with the square root of the reply. */
  gist: number
  perTerm: number
  perOption: number
  maxTokens: number
}

const GIST_PER_ROOT_WORD = 7
const GIST_MIN = 80
const GIST_MAX = 200
const PER_TERM = 30
// Five things per option (meaning, benefits, tradeoffs, risks, the reply's lean), each weighed twice.
const PER_OPTION = 150
// Floors for the cap only: units the counters cannot see still get room.
const ASSUMED_OPTIONS = 3
const ASSUMED_TERMS = 4
const MAX_TERMS = 12

export function breakItDownBudget(reply: string): BreakItDownBudget {
  const gist = toTens(
    clamp(GIST_MIN, GIST_PER_ROOT_WORD * Math.sqrt(countWords(reply)), GIST_MAX),
  )
  const options = Math.max(countOptions(reply), ASSUMED_OPTIONS)
  const terms = clamp(ASSUMED_TERMS, countTerms(reply), MAX_TERMS)
  return {
    gist,
    perTerm: PER_TERM,
    perOption: PER_OPTION,
    maxTokens: capTokens(
      gist + PER_OPTION * options + PER_TERM * terms,
      "medium",
    ),
  }
}

/** What an ELI5 of one ledger entry tells the model to write, and what it may spend. */
export type Eli5Budget = { words: number; maxTokens: number }

const ELI5_PER_ROOT_WORD = 10
const ELI5_PER_TERM = 20
const ELI5_MIN = 150
const ELI5_MAX = 450

export function eli5Budget(entry: string): Eli5Budget {
  const words = toTens(
    clamp(
      ELI5_MIN,
      ELI5_PER_ROOT_WORD * Math.sqrt(countWords(entry)) +
        ELI5_PER_TERM * Math.min(countTerms(entry), MAX_TERMS),
      ELI5_MAX,
    ),
  )
  return { words, maxTokens: capTokens(words, "low") }
}
