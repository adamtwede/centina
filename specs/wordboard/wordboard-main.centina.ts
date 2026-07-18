// WordboardMain — the orchestrator. A thin coordinator over five mutually
// ignorant boundaries (the star DAG): AlgorithmicSuggester, InferredSuggester,
// DefinitionLookup, WordLog, and the User boundary. It holds NO domain logic of
// its own; its capture and export flows are internal processing — authored by
// the human at fill (centina-iterate), never by the session-zero scribe. That
// is why this file is almost entirely holes: by design.
//
// The three flows below trace to the ratified concepts (Mode 1, Mode 2, and
// export). They are "unimplemented" holes — the fill targets that remain before
// Wordboard can be planned. Their decomposition into exactly these three is a
// starting cut, and the human's to revise at fill (the boundary references named
// in each comment are the intended wiring, not yet imported/called).
//
// Risk / watch-item: keep this a COORDINATOR. Logic that belongs to a component
// must not accrete here (the thin-UI risk; see ARCHITECTURE.md).

import { deferred } from "../../centina"

// Mode 1 — algorithmic capture. Wiring: User (readWord, exchangeSuggestion,
// exchangeConfirmation), AlgorithmicSuggester (suggest), DefinitionLookup
// (lookup), WordLog (writeLogToStorage, readByWord). Flow held.
const runAlgorithmicCapture = deferred<"unimplemented", () => void>()

// Mode 2 — inferred capture. Wiring: User (readContext, exchangeSuggestion,
// exchangeConfirmation, readInferenceOutcome, readWordAttempt), InferredSuggester
// (infer), DefinitionLookup (lookup), WordLog (writeLogToStorage, readByWord).
// Includes the empty-inference branch (retry / save-incomplete / discard). Flow held.
const runInferredCapture = deferred<"unimplemented", () => void>()

// Export. Wiring: User (exchangeExportFormat, writeLogToUser), WordLog (export).
// Flow held.
const runExport = deferred<"unimplemented", () => void>()
