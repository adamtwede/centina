import { Finding } from "../types"
import {
  Entry,
  LabelRef,
  Ledger,
  Letter,
  ScannedFile,
  SourceLine,
  fieldRefs,
  formatRef,
  labelKey,
  refsInText,
  status,
} from "./parse"

export const STATUSES: Record<Letter, string[]> = {
  P: ["open", "ratified", "rejected", "withdrawn", "superseded"],
  Q: ["open", "answered", "withdrawn", "superseded"],
  F: ["hypothesis", "predicted", "measured", "measured-false", "withdrawn", "superseded"],
  O: ["open", "chosen", "declined", "superseded"],
  W: ["planned", "active", "blocked", "deferred", "done", "withdrawn", "superseded"],
  G: ["active", "deferred", "retired", "superseded"],
  R: ["provisional", "ratified", "retired", "superseded"],
}

const KINDS: Partial<Record<Letter, string[]>> = {
  W: ["phase", "step", "spike", "change-request", "other"],
  R: ["structural", "design", "method", "process"],
}

/** Statuses meaning the entry no longer holds; citing one from a current-state file is an error. */
export const NOT_HOLDING = new Set(["superseded", "withdrawn", "rejected", "measured-false", "retired", "declined"])

interface ListFieldSpec {
  single?: boolean
  parts: boolean
  /** Whether cited labels must exist. `Renumbered-from` names a label that no longer does. */
  resolve: boolean
}

const LIST_FIELDS: Record<string, ListFieldSpec> = {
  Phase: { single: true, parts: false, resolve: true },
  Obsoletes: { parts: false, resolve: true },
  Updates: { parts: true, resolve: true },
  "Obsoleted-by": { parts: false, resolve: true },
  "Updated-by": { parts: false, resolve: true },
  "Depends-on": { parts: true, resolve: true },
  Premises: { parts: true, resolve: true },
  Constraints: { parts: false, resolve: true },
  "Renumbered-from": { single: true, parts: false, resolve: false },
}

const KNOWN_FIELDS = new Set([
  "Date",
  "Session",
  "Status",
  "Kind",
  "Review",
  "Enforced-by",
  "Evidence",
  ...Object.keys(LIST_FIELDS),
])

const FIELD_LETTERS: Record<string, Letter[]> = {
  Kind: ["W", "R"],
  "Depends-on": ["W"],
  Premises: ["W"],
  Constraints: ["W"],
  Review: ["R"],
  "Enforced-by": ["R"],
  Evidence: ["F"],
}

export function checkLedger(ledger: Ledger, scanned: ScannedFile[]): Finding[] {
  const findings: Finding[] = []
  const seen = new Set<string>()
  const error = (rule: string, file: string, line: number, message: string) => {
    const id = `${rule}|${file}|${line}|${message}`
    if (seen.has(id)) return
    seen.add(id)
    findings.push({ rule, severity: "error", file, line, message })
  }

  for (const problem of ledger.problems) {
    error("ledger-malformed", problem.file, problem.line, problem.message)
  }

  const byKey = new Map<string, Entry>()
  for (const entry of ledger.entries) {
    const existing = byKey.get(entry.key)
    if (existing) {
      error(
        "ledger-duplicate-label",
        entry.file,
        entry.line,
        `${entry.key} is already defined at ${existing.file}:${existing.line}`,
      )
    } else {
      byKey.set(entry.key, entry)
    }
  }
  const resolve = (ref: LabelRef) => byKey.get(labelKey(ref))

  const checkResolved = (ref: LabelRef, file: string, line: number) => {
    if (ref.system) return
    const target = resolve(ref)
    if (!target) {
      error("ledger-undefined-label", file, line, `${formatRef(ref)} is not defined in the ${ledger.system} ledger`)
    } else if (ref.part && !target.parts.has(ref.part)) {
      error("ledger-undefined-label", file, line, `${target.key} has no part (${ref.part})`)
    }
  }

  for (const entry of ledger.entries) {
    checkHeader(entry, error, checkResolved, resolve)
  }
  checkReciprocity(ledger.entries, error, resolve)

  const checkLedgerLines = (file: string, lines: SourceLine[]) => {
    for (const sourceLine of lines) {
      if (sourceLine.code) continue
      for (const { ref, bare } of refsInText(sourceLine.text)) {
        if (bare) {
          error("ledger-bare-label", file, sourceLine.line, `bare label ${formatRef(ref)}; qualify it with its scope`)
        } else {
          checkResolved(ref, file, sourceLine.line)
        }
      }
    }
  }
  for (const entry of ledger.entries) checkLedgerLines(entry.file, entry.body)
  for (const { file, lines } of ledger.looseLines) checkLedgerLines(file, lines)

  for (const scannedFile of scanned) {
    for (const sourceLine of scannedFile.lines) {
      if (sourceLine.code) continue
      const refs = refsInText(sourceLine.text).flatMap(({ ref, bare }) => {
        if (!bare) return [ref]
        if (scannedFile.bareScope) return [{ ...ref, scope: scannedFile.bareScope }]
        error(
          "ledger-bare-label",
          scannedFile.file,
          sourceLine.line,
          `bare label ${formatRef(ref)} outside a component spec; qualify it with its scope`,
        )
        return []
      })
      const keysOnLine = new Set(refs.filter((ref) => !ref.system).map(labelKey))

      for (const ref of refs) {
        checkResolved(ref, scannedFile.file, sourceLine.line)
        const target = ref.system ? undefined : resolve(ref)
        if (!target) continue
        checkStale(ref, target, keysOnLine, ledger.entries, (message) =>
          error("ledger-stale-citation", scannedFile.file, sourceLine.line, message),
        )
      }
    }
  }

  return findings
}

type ErrorFn = (rule: string, file: string, line: number, message: string) => void

function checkHeader(
  entry: Entry,
  error: ErrorFn,
  checkResolved: (ref: LabelRef, file: string, line: number) => void,
  resolve: (ref: LabelRef) => Entry | undefined,
): void {
  const { letter } = entry.ref

  for (const [name, field] of entry.fields) {
    if (!KNOWN_FIELDS.has(name)) {
      error("ledger-unknown-field", entry.file, field.line, `unknown header field "${name}" in ${entry.key}`)
      continue
    }
    const letters = FIELD_LETTERS[name]
    if (letters && !letters.includes(letter)) {
      error(
        "ledger-field-not-applicable",
        entry.file,
        field.line,
        `"${name}" does not apply to ${letter} entries (${entry.key})`,
      )
    }
    const spec = LIST_FIELDS[name]
    if (!spec) continue
    const { refs, invalid } = fieldRefs(entry, name)
    for (const token of invalid) {
      error("ledger-malformed", entry.file, field.line, `"${name}" value "${token}" is not a qualified label`)
    }
    if (spec.single && refs.length > 1) {
      error("ledger-malformed", entry.file, field.line, `"${name}" takes one label`)
    }
    for (const ref of refs) {
      if (ref.part && !spec.parts) {
        error("ledger-malformed", entry.file, field.line, `"${name}" cannot cite a part (${formatRef(ref)})`)
      }
      if (spec.resolve) checkResolved(ref, entry.file, field.line)
    }
  }

  const statusValue = status(entry)
  if (statusValue === undefined) {
    error("ledger-invalid-status", entry.file, entry.line, `${entry.key} has no Status`)
  } else if (!STATUSES[letter].includes(statusValue)) {
    error(
      "ledger-invalid-status",
      entry.file,
      entry.fields.get("Status")!.line,
      `"${statusValue}" is not a valid status for ${letter} entries; expected one of: ${STATUSES[letter].join(", ")}`,
    )
  }

  const kinds = KINDS[letter]
  const kind = entry.fields.get("Kind")
  if (kinds && !kind) {
    error("ledger-invalid-kind", entry.file, entry.line, `${entry.key} has no Kind`)
  } else if (kinds && kind && !kinds.includes(kind.value)) {
    error(
      "ledger-invalid-kind",
      entry.file,
      kind.line,
      `"${kind.value}" is not a valid Kind for ${letter} entries; expected one of: ${kinds.join(", ")}`,
    )
  }

  const requires = (condition: boolean, field: string, message: string) => {
    if (condition && !entry.fields.has(field)) {
      error("ledger-missing-field", entry.file, entry.line, message)
    }
  }
  requires(
    letter === "F" && (statusValue === "measured" || statusValue === "measured-false"),
    "Evidence",
    `${entry.key} is ${statusValue} but has no Evidence`,
  )
  requires(letter === "W" && statusValue === "blocked", "Depends-on", `${entry.key} is blocked but has no Depends-on`)
  requires(letter === "R" && statusValue === "provisional", "Review", `${entry.key} is provisional but has no Review`)

  const obsoletedBy = entry.fields.get("Obsoleted-by")
  if (statusValue === "superseded" && !obsoletedBy) {
    error("ledger-supersession", entry.file, entry.line, `${entry.key} is superseded but has no Obsoleted-by`)
  }
  if (obsoletedBy && statusValue !== "superseded") {
    error("ledger-supersession", entry.file, obsoletedBy.line, `${entry.key} has Obsoleted-by but its status is not superseded`)
  }

  const constraints = entry.fields.get("Constraints")
  if (constraints && kind?.value !== "phase") {
    error("ledger-field-not-applicable", entry.file, constraints.line, `"Constraints" applies only to phase work items (${entry.key})`)
  }
  for (const ref of fieldRefs(entry, "Constraints").refs) {
    if (ref.letter !== "R") {
      error("ledger-malformed", entry.file, constraints!.line, `"Constraints" must cite R entries, not ${formatRef(ref)}`)
    }
  }

  const phase = entry.fields.get("Phase")
  for (const ref of fieldRefs(entry, "Phase").refs) {
    const target = resolve(ref)
    if (target && (target.ref.letter !== "W" || target.fields.get("Kind")?.value !== "phase")) {
      error("ledger-malformed", entry.file, phase!.line, `"Phase" must cite a W entry with Kind: phase, not ${target.key}`)
    }
  }
}

function checkReciprocity(
  entries: Entry[],
  error: ErrorFn,
  resolve: (ref: LabelRef) => Entry | undefined,
): void {
  const pairs: [forward: string, reverse: string][] = [
    ["Obsoletes", "Obsoleted-by"],
    ["Updates", "Updated-by"],
  ]
  const cites = (entry: Entry, field: string, key: string) =>
    fieldRefs(entry, field).refs.some((ref) => labelKey(ref) === key)

  for (const entry of entries) {
    for (const [forward, reverse] of pairs) {
      for (const ref of fieldRefs(entry, forward).refs) {
        const target = resolve(ref)
        if (target && !cites(target, reverse, entry.key)) {
          error(
            "ledger-supersession",
            entry.file,
            entry.fields.get(forward)!.line,
            `${entry.key} ${forward.toLowerCase()} ${target.key}, but ${target.key} has no "${reverse}: ${entry.key}"`,
          )
        }
      }
      for (const ref of fieldRefs(entry, reverse).refs) {
        const source = resolve(ref)
        if (source && !cites(source, forward, entry.key)) {
          error(
            "ledger-supersession",
            entry.file,
            entry.fields.get(reverse)!.line,
            `${entry.key} has "${reverse}: ${source.key}", but ${source.key} has no "${forward}: ${entry.key}"`,
          )
        }
      }
    }
  }
}

function checkStale(
  ref: LabelRef,
  target: Entry,
  keysOnLine: Set<string>,
  entries: Entry[],
  report: (message: string) => void,
): void {
  const targetStatus = status(target)
  if (targetStatus && NOT_HOLDING.has(targetStatus)) {
    const successors = fieldRefs(target, "Obsoleted-by").refs.map(labelKey)
    if (!successors.some((key) => keysOnLine.has(key))) {
      report(
        successors.length > 0
          ? `${formatRef(ref)} is ${targetStatus}; cite its successor (${successors.join(", ")}) on the same line`
          : `${formatRef(ref)} is ${targetStatus}`,
      )
    }
  }

  if (!ref.part) return
  for (const updater of entries) {
    const updatesPart = fieldRefs(updater, "Updates").refs.some(
      (updated) => labelKey(updated) === target.key && updated.part === ref.part,
    )
    if (updatesPart && !keysOnLine.has(updater.key)) {
      report(`${formatRef(ref)} was updated by ${updater.key}; cite it on the same line`)
    }
  }
}
