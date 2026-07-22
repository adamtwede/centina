import { Node, SourceFile, SyntaxKind } from "ts-morph"
import { Finding, Rule } from "../types"
import { isFromVocabulary } from "../vocabulary"

// Ports the AISL v0 typo/drift idea (see ROADMAP.md's history section): collect
// every occurrence of a compiler-invisible free-text name, group by spelling,
// and flag a less-common spelling that's a near-miss of a strictly more
// common one as a likely typo/drift — not something the checker resolves on
// its own. Under tsc, ordinary property access on a named type is already
// checked structurally, so the two namespaces worth watching here are the
// ones no compiler pass ever validates: Unshaped<"..."> brand literals and
// @external "<source>" strings.

interface NameUsage {
  name: string
  file: string
  line: number
}

const EXTERNAL_SOURCE_PATTERN = /@external\s+"([^"]+)"/g
const AGENT_LABEL_PATTERN = /@agent\(([^)]+)\)/g

function collectUnshapedUsages(sourceFiles: SourceFile[]): NameUsage[] {
  const usages: NameUsage[] = []
  for (const sourceFile of sourceFiles) {
    for (const typeRef of sourceFile.getDescendantsOfKind(
      SyntaxKind.TypeReference,
    )) {
      if (typeRef.getTypeName().getText() !== "Unshaped") continue
      if (!isFromVocabulary(typeRef.getTypeName().getSymbol())) continue
      const [arg] = typeRef.getTypeArguments()
      if (!arg || !Node.isLiteralTypeNode(arg)) continue
      const literal = arg.getLiteral()
      if (!Node.isStringLiteral(literal)) continue
      usages.push({
        name: literal.getLiteralText(),
        file: sourceFile.getFilePath(),
        line: typeRef.getStartLineNumber(),
      })
    }
  }
  return usages
}

function collectExternalSourceUsages(sourceFiles: SourceFile[]): NameUsage[] {
  const usages: NameUsage[] = []
  for (const sourceFile of sourceFiles) {
    const text = sourceFile.getFullText()
    for (const match of text.matchAll(EXTERNAL_SOURCE_PATTERN)) {
      usages.push({
        name: match[1],
        file: sourceFile.getFilePath(),
        line: sourceFile.getLineAndColumnAtPos(match.index ?? 0).line,
      })
    }
  }
  return usages
}

function collectAgentLabelUsages(sourceFiles: SourceFile[]): NameUsage[] {
  const usages: NameUsage[] = []
  for (const sourceFile of sourceFiles) {
    const text = sourceFile.getFullText()
    for (const match of text.matchAll(AGENT_LABEL_PATTERN)) {
      usages.push({
        name: match[1],
        file: sourceFile.getFilePath(),
        line: sourceFile.getLineAndColumnAtPos(match.index ?? 0).line,
      })
    }
  }
  return usages
}

/** Restricted edit distance (Levenshtein + adjacent transposition) — catches the "teh"/"the" typo shape, not just insert/delete/substitute. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (let i = 0; i < rows; i++) dp[i][0] = i
  for (let j = 0; j < cols; j++) dp[0][j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
      }
    }
  }
  return dp[rows - 1][cols - 1]
}

function isLikelyTypo(a: string, b: string): boolean {
  const distance = editDistance(a, b)
  const threshold = Math.max(1, Math.floor(Math.min(a.length, b.length) / 4))
  return distance > 0 && distance <= threshold
}

function findDrift(
  usages: NameUsage[],
  format: (name: string) => string,
): Finding[] {
  const byName = new Map<string, NameUsage[]>()
  for (const usage of usages) {
    const existing = byName.get(usage.name) ?? []
    existing.push(usage)
    byName.set(usage.name, existing)
  }

  const findings: Finding[] = []
  for (const [name, occurrences] of byName) {
    const moreCommon = [...byName.entries()].find(
      ([candidate, candidateOccurrences]) =>
        candidate !== name &&
        candidateOccurrences.length > occurrences.length &&
        isLikelyTypo(name, candidate),
    )
    if (!moreCommon) continue
    const [moreCommonName, moreCommonOccurrences] = moreCommon
    const [first, ...rest] = occurrences
    const alsoAt =
      rest.length > 0
        ? ` (also at ${rest.map((o) => `${o.file}:${o.line}`).join(", ")})`
        : ""
    findings.push({
      rule: "naming-consistency",
      severity: "warning",
      file: first.file,
      line: first.line,
      message: `${format(name)} (${occurrences.length} use(s)) is a near-miss of the more common ${format(moreCommonName)} (${moreCommonOccurrences.length} use(s)) — likely a typo/drift, not a deliberately distinct name${alsoAt}`,
    })
  }
  return findings
}

// Unlike Unshaped brands and @external sources, an @agent label's whole purpose
// is to be a stable, unambiguous reference — so two notes in the same file
// claiming the same label is a genuine conflict, not a drift candidate to
// weigh against a "more common" spelling. Scoped per file: the same label in
// two unrelated specs isn't a conflict, since each spec is its own document.
function findDuplicateLabels(usages: NameUsage[]): Finding[] {
  const byFileAndName = new Map<string, NameUsage[]>()
  for (const usage of usages) {
    const key = `${usage.file}\0${usage.name}`
    const existing = byFileAndName.get(key) ?? []
    existing.push(usage)
    byFileAndName.set(key, existing)
  }

  const findings: Finding[] = []
  for (const occurrences of byFileAndName.values()) {
    if (occurrences.length < 2) continue
    const [first, ...rest] = occurrences
    findings.push({
      rule: "naming-consistency",
      severity: "error",
      file: first.file,
      line: first.line,
      message: `@agent(${first.name}) is used ${occurrences.length} times in this file — a label must be unique to stay a stable reference (also at ${rest
        .map((o) => `:${o.line}`)
        .join(", ")})`,
    })
  }
  return findings
}

export const namingConsistencyRule: Rule = {
  name: "naming-consistency",
  check(sourceFiles) {
    return [
      ...findDrift(collectUnshapedUsages(sourceFiles), (name) => `Unshaped<"${name}">`),
      ...findDrift(
        collectExternalSourceUsages(sourceFiles),
        (name) => `@external "${name}"`,
      ),
      ...findDuplicateLabels(collectAgentLabelUsages(sourceFiles)),
    ]
  },
}
