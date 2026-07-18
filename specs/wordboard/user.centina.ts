// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.
//
// User — the human on the far side of WordboardMain, modeled as a boundary
// ("boundary-as-user"). Its doors are intent-level affordances, NOT UI widgets:
// "choose a suggestion", not "render a list and read a tap". Direction is
// inferred from the return type — read* pulls intent FROM the user, write*
// pushes TO the user, exchange* does both in one prompt-and-return.
//
// This is an experiment: both the boundary-as-user modeling and the
// read*/write*/exchange* naming convention (scoped to @boundary doors, where the
// class tag doesn't disambiguate direction) are first-use and under test. See
// ARCHITECTURE.md risks.

import { Suggestion, Definition, ExportFormat, InferenceOutcome } from "./shared"

/**
 * @boundary
 * The user, as WordboardMain's far side. Read doors capture user intent, write
 * doors present to the user, exchange doors prompt-and-return.
 */
export declare class User {
  // Mode 1: the user's spelling attempt.
  readWord(): string
  // Mode 2: context (required) plus an optional attempt, for inference. The
  // attempt is optional here — inference doesn't require it; the *forced* attempt
  // lives on the save-incomplete path (`readWordAttempt`).
  readContext(): { context: string; wordAttempt?: string }
  // Present suggestions; return the user's pick, or null if they dismiss/go back.
  exchangeSuggestion(suggestions: Suggestion[]): Suggestion | null
  // Present a resolved word + definition; return whether the user confirms it.
  exchangeConfirmation(word: string, definition: Definition): boolean
  // On empty inference: retry (add context), save-incomplete, or discard.
  readInferenceOutcome(): InferenceOutcome
  // On save-incomplete: the user must commit a spelling attempt to latch onto.
  // Distinct from `readWord` (Mode-1 initiation) — different timing, intent, and
  // reason for being populated, even where the typed value coincides.
  readWordAttempt(): string
  // Present the available formats; return the user's pick.
  exchangeExportFormat(formats: ExportFormat[]): ExportFormat
  // Deliver the exported log to the user (hand off / share / download — the
  // transport is realization behind the door). Named ...ToUser to disambiguate
  // from WordLog.writeLogToStorage.
  writeLogToUser(formattedLog: string): void
}

export const user = new User()
