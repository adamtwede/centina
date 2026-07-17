// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.
//
// AlgorithmicSuggester — Mode-1 suggestions. Given the user's spelling attempt,
// returns candidate words. Deterministic (the human's framing: Levenshtein
// distance over a dictionary); the matching logic is internal processing, held
// for fill.
//
// Terminal behind this door: @external dictionary — concrete source TBD (one or
// two sources open: a wordlist for matching, possibly a separate definitions
// source; see ARCHITECTURE.md). Declared at fill, where the matching logic that
// calls it is written — not reached through the door here.

import { Suggestion } from "./shared"

/**
 * @datasource
 * Mode-1 algorithmic suggestion, dictionary-backed.
 *
 * Read door: `suggest`, candidate words for a spelling attempt. An empty array
 * means no matches were found (ratified empty-case).
 */
export declare class AlgorithmicSuggester {
  suggest(word: string): Suggestion[]
}

export const algorithmicSuggester = new AlgorithmicSuggester()
