// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.
//
// WordLog — the log of captured words, and (folded in for now) its export.
// Storage-backed. Persistence, the completed-only filtering, and export encoding
// are internal processing, held for fill.
//
// Terminal behind this door: @external storage — a platform-abstracting
// persistence API (Capacitor-family or equivalent; concrete API TBD), NOT a raw
// file: the browser-runtime target can't write one. "Text file under the hood"
// is one backing among several (native file vs IndexedDB/localStorage on web).
// Declared at fill.
//
// Extraction candidate: export is folded in here for immediate simplicity.
// Promote it to its own node when a second consumer appears, Upload lands, or
// formats proliferate (see ARCHITECTURE.md rejected alternatives).

import { LogEntry, ExportFormat } from "./shared"

/**
 * @boundary
 * The word log plus its export, storage-backed.
 *
 * Write door: `writeLogToStorage`, persists an entry. Returns void — the caller
 * verifies the write by reading the entry back (see `readByWord`), the
 * ratified flush-and-pull-back correctness approach.
 *
 * Read doors: `readLog`, the log (completed-only and other filtering is a held
 * detail); `readByWord`, a single entry keyed by its word (word functions as the
 * entry's identity — see hole ledger for the incomplete->complete id-mutation
 * caveat); `export`, the log serialized in a given format.
 */
export declare class WordLog {
  writeLogToStorage(entry: LogEntry): void
  readLog(): LogEntry[]
  readByWord(word: string): LogEntry
  // `export` is a parameterized read: `format` selects an encoding, nothing is
  // stored — which is why it is NOT `exchange*` under the @boundary door-naming
  // convention (read* / write* / exchange*). This is the convention's first
  // real judgment call; kept plain per the human's decision, and a watch item
  // if `exchange` keeps causing friction (see ARCHITECTURE.md risks).
  export(format: ExportFormat): string
}

export const wordLog = new WordLog()
