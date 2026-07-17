// Wordboard — cross-seam vocabulary. Every type here was ratified during the
// session-zero elicitation; see ARCHITECTURE.md's contract ledger for the
// decision trail. Mirrors the hill-climbing-loop convention of a plain
// `shared.ts` holding the vocabulary the DAG traffics in across seams.

export type InitiationMode = "algorithmic" | "inferred"

// A suggested word. Deliberately minimal for now — matchKind / relevantContext
// were considered and dropped, re-addable later (see hole ledger).
export type Suggestion = { word: string }

// Raw dictionary text: whatever the dictionary terminal returns. Format
// variability across sources is a known caveat (see hole ledger).
export type Definition = string

export enum ExportFormat {
  TEXT,
  MARKDOWN,
  CANONICAL,
}

// The user's choice when inference returns nothing.
export enum InferenceOutcome {
  RETRY,
  SAVE_AS_INCOMPLETE,
  DISCARD,
}

// A logged word, discriminated on `status`. A single physical log holds both
// kinds (two-physical-stores was considered and rejected — see rejected
// alternatives).
export type CompleteEntry = {
  status: "complete"
  word: string // resolved dictionary word; also the entry's identity (word-as-id — see hole ledger)
  definition: string
  timestamp: number
  mode: InitiationMode
}
export type IncompleteEntry = {
  status: "incomplete"
  word: string // the user's committed spelling attempt (required — saving forces an attempt)
  context: string // stands in for the definition
  timestamp: number
  mode: "inferred" // incomplete entries only arise from Mode 2
}
export type LogEntry = CompleteEntry | IncompleteEntry
