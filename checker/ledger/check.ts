import { Finding } from "../types"
import {
  BuildFile,
  Entry,
  LabelRef,
  Ledger,
  Letter,
  ScannedFile,
  SourceLine,
  fieldRefs,
  formatRef,
  labelKey,
  parseQualified,
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
  R: ["structural", "design", "method", "process", "limit"],
}

const AGENT_LABEL = /@agent\(([^)]*)\)/g
const BARE_LABEL_EXACT = /^[PQFOWGR][1-9]\d*$/

function isLedgerLabel(text: string): boolean {
  return BARE_LABEL_EXACT.test(text) || parseQualified(text) !== undefined
}

/** Statuses meaning the entry no longer holds; citing one from a current-state file is an error. */
export const NOT_HOLDING = new Set(["superseded", "withdrawn", "rejected", "measured-false", "retired", "declined"])

/** Work-item statuses an unbuilt member may name as its owner. */
export const OPEN_WORK = new Set(["planned", "active", "blocked", "deferred"])

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

export function checkLedger(ledger: Ledger, scanned: ScannedFile[], build: BuildFile[] = []): Finding[] {
  const findings: Finding[] = []
  const seen = new Set<string>()
  const error: ErrorFn = (rule, file, line, message, severity = "error") => {
    const id = `${rule}|${file}|${line}|${message}`
    if (seen.has(id)) return
    seen.add(id)
    findings.push({ rule, severity, file, line, message })
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

  const allScanned = [...scanned, ...build.map((buildFile) => ({ file: buildFile.file, lines: buildFile.comments }))]
  for (const scannedFile of allScanned) {
    // `@agent:` notes are spec-authoring metadata, so the rule covers specs only.
    const isSpec = scannedFile.file.endsWith(".centina.ts")
    for (const sourceLine of scannedFile.lines) {
      if (sourceLine.code) continue
      if (isSpec) {
        for (const note of sourceLine.text.matchAll(AGENT_LABEL)) {
          if (!isLedgerLabel(note[1])) {
            error(
              "ledger-agent-label",
              scannedFile.file,
              sourceLine.line,
              `@agent(${note[1]}) is not a ledger label; in a system with a ledger, label notes with the entry they belong to`,
            )
          }
        }
      }
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

  checkOwnership(ledger, build, error, resolve)

  return findings
}

/**
 * Ownership citations: a throw-only member of an `implements` class is unbuilt
 * by construction, so the label it throws names the work item that will fill
 * it. See docs/ledger.md, "Citations from build code".
 */
function checkOwnership(
  ledger: Ledger,
  build: BuildFile[],
  error: ErrorFn,
  resolve: (ref: LabelRef) => Entry | undefined,
): void {
  for (const buildFile of build) {
    for (const member of buildFile.unbuilt) {
      const report = (message: string, severity?: Finding["severity"]) =>
        error("ledger-unbuilt-owner", buildFile.file, member.line, message, severity)
      const refs: LabelRef[] = []
      let sawBare = false
      for (const sourceLine of member.strings) {
        for (const { ref, bare } of refsInText(sourceLine.text)) {
          if (bare) {
            sawBare = true
            error(
              "ledger-bare-label",
              buildFile.file,
              sourceLine.line,
              `bare label ${formatRef(ref)} in build code; qualify it with its scope`,
            )
          } else if (!ref.system) {
            refs.push(ref)
          }
        }
      }

      // A bare label already reported what is wrong; do not also call it missing.
      if (refs.length === 0 && sawBare) continue
      // A missing owner is a warning, not an error. Blocking here would push
      // an author to cite whichever W is handy for a member no phase covers
      // yet, and a citation nobody means is the failure this check exists to
      // catch. A label that is wrong stays an error.
      if (refs.length === 0) {
        report(
          `${member.name} is unbuilt and names no work item; throw a message naming the W that fills it`,
          "warning",
        )
        continue
      }
      if (refs.length > 1) {
        report(
          `${member.name} names ${refs.map(formatRef).join(", ")}; an unbuilt member has one owner`,
        )
        continue
      }

      const [ref] = refs
      if (ref.part) {
        report(`${member.name} names ${formatRef(ref)}; an owner is a whole work item, not a part of one`)
        continue
      }
      const target = resolve(ref)
      if (!target) {
        error(
          "ledger-undefined-label",
          buildFile.file,
          member.line,
          `${formatRef(ref)} is not defined in the ${ledger.system} ledger`,
        )
        continue
      }
      if (target.ref.letter !== "W") {
        report(`${member.name} names ${target.key}, which is not a work item; an unbuilt member is owned by a W`)
        continue
      }
      const targetStatus = status(target) ?? ""
      if (!OPEN_WORK.has(targetStatus)) {
        report(
          `${member.name} names ${target.key}, which is ${targetStatus}; retarget it to the work item that will fill this member`,
        )
      }
    }
  }
}

const PROPOSAL_TAG = /@proposal\(([^)]*)\)/g
const CLOSED_CHANGE_REQUEST = new Set(["done", "withdrawn", "superseded"])

/**
 * Enumerates `@proposal(<label>)` overrides in a centina-realize contracts
 * module. Each must cite a change-request work item; an override whose change
 * request is closed should have been removed.
 */
export function checkProposals(ledger: Ledger, contractsFile: string, lines: SourceLine[]): Finding[] {
  const byKey = new Map<string, Entry>()
  for (const entry of ledger.entries) if (!byKey.has(entry.key)) byKey.set(entry.key, entry)

  const findings: Finding[] = []
  const report = (severity: Finding["severity"], rule: string, line: number, message: string) =>
    findings.push({ rule, severity, file: contractsFile, line, message })

  for (const sourceLine of lines) {
    for (const tag of sourceLine.text.matchAll(PROPOSAL_TAG)) {
      const ref = parseQualified(tag[1])
      if (!ref || ref.part || ref.system) {
        report("error", "ledger-proposal", sourceLine.line, `@proposal(${tag[1]}) must cite a qualified change-request label`)
        continue
      }
      const target = byKey.get(labelKey(ref))
      if (!target) {
        report("error", "ledger-undefined-label", sourceLine.line, `${labelKey(ref)} is not defined in the ${ledger.system} ledger`)
        continue
      }
      if (target.ref.letter !== "W" || target.fields.get("Kind")?.value !== "change-request") {
        report("error", "ledger-proposal", sourceLine.line, `@proposal must cite a W entry with Kind: change-request, not ${target.key}`)
        continue
      }
      const targetStatus = status(target) ?? ""
      if (CLOSED_CHANGE_REQUEST.has(targetStatus)) {
        report("error", "ledger-proposal", sourceLine.line, `${target.key} is ${targetStatus}; remove this override`)
      } else {
        report("info", "ledger-proposal", sourceLine.line, `open override for ${target.key} (${targetStatus}): ${target.title}`)
      }
    }
  }
  return findings
}

type ErrorFn = (
  rule: string,
  file: string,
  line: number,
  message: string,
  severity?: Finding["severity"],
) => void

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
