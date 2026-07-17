// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.
//
// InferredSuggester — Mode-2 suggestions. Given context (required) and an
// optional spelling attempt, returns candidate words via AI inference. The
// inference call is internal processing, held for fill.
//
// Terminal behind this door: @external AI model — a cloud-native LLM API by
// default (provider and the rest TBD; see ARCHITECTURE.md). Declared at fill.
//
// Deferred: aligning AI output against the dictionary / flagging words the model
// produced that aren't dictionary words (a future Suggestion flag plus an
// InferredSuggester -> dictionary seam). See hole ledger.

import { Suggestion } from "./shared"

/**
 * @datasource
 * Mode-2 inferred suggestion, AI-model-backed.
 *
 * Read door: `infer`, candidate words for a context and an optional spelling
 * attempt. Context is required; the attempt is optional. An empty array means
 * the model returned nothing — the user then chooses an InferenceOutcome.
 */
export declare class InferredSuggester {
  infer(context: string, attempt?: string): Suggestion[]
}

export const inferredSuggester = new InferredSuggester()
