// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.
//
// DefinitionLookup — resolves a definition for a selected word. Pulled only at
// selection time, never attached to a Suggestion (the ratified two-mode design).
//
// Terminal behind this door: @external dictionary — the same terminal the
// AlgorithmicSuggester reads (concrete source TBD). Declared at fill.

import { Definition } from "./shared"

/**
 * @datasource
 * Definition resolution, dictionary-backed.
 *
 * Read door: `lookup`, the definition for a resolved dictionary word. Callers
 * reach this only for a word already selected from suggestions, so a definition
 * is assumed present; the not-found case was not elicited and is a hole if that
 * assumption ever breaks (see hole ledger).
 */
export declare class DefinitionLookup {
  lookup(word: string): Definition
}

export const definitionLookup = new DefinitionLookup()
