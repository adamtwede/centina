import { SourceFile, SyntaxKind } from "ts-morph"
import { Finding, Rule } from "../types"

const AGENT_NOTE_PATTERN = /@agent:/g
const EXTERNAL_PATTERN = /@external\s+"([^"]+)"/g
const BOUNDARY_TAGS = new Set(["boundary", "datasource", "datasink"])

function lineAt(sourceFile: SourceFile, pos: number): number {
  return sourceFile.getLineAndColumnAtPos(pos).line
}

function findDeferredCalls(sourceFile: SourceFile): Finding[] {
  const findings: Finding[] = []
  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  )) {
    const expr = call.getExpression()
    if (expr.getText() !== "deferred") continue
    const referenceSymbol = expr.getSymbol()
    const targetSymbol = referenceSymbol?.getAliasedSymbol() ?? referenceSymbol
    const declarations = targetSymbol?.getDeclarations() ?? []
    const fromVocabulary = declarations.some((declaration) =>
      declaration.getSourceFile().getFilePath().endsWith("/centina.ts"),
    )
    if (!fromVocabulary) continue
    findings.push({
      rule: "hole-enumeration",
      severity: "info",
      file: sourceFile.getFilePath(),
      line: call.getStartLineNumber(),
      message: "deferred<...>() hole — routing not yet resolved",
    })
  }
  return findings
}

function findAgentNotes(sourceFile: SourceFile): Finding[] {
  const text = sourceFile.getFullText()
  const findings: Finding[] = []
  for (const match of text.matchAll(AGENT_NOTE_PATTERN)) {
    findings.push({
      rule: "hole-enumeration",
      severity: "info",
      file: sourceFile.getFilePath(),
      line: lineAt(sourceFile, match.index ?? 0),
      message: "@agent: note — direct message to the coding agent",
    })
  }
  return findings
}

function findExternals(sourceFile: SourceFile): Finding[] {
  const text = sourceFile.getFullText()
  const findings: Finding[] = []
  for (const match of text.matchAll(EXTERNAL_PATTERN)) {
    findings.push({
      rule: "hole-enumeration",
      severity: "info",
      file: sourceFile.getFilePath(),
      line: lineAt(sourceFile, match.index ?? 0),
      message: `@external "${match[1]}" — reference to code outside the spec`,
    })
  }
  return findings
}

function findBoundaryClasses(sourceFile: SourceFile): Finding[] {
  const findings: Finding[] = []
  for (const cls of sourceFile.getClasses()) {
    if (!cls.hasDeclareKeyword()) continue
    const tags = cls.getJsDocs().flatMap((doc) => doc.getTags())
    const boundaryTag = tags.find((tag) => BOUNDARY_TAGS.has(tag.getTagName()))
    if (!boundaryTag) continue
    findings.push({
      rule: "hole-enumeration",
      severity: "info",
      file: sourceFile.getFilePath(),
      line: cls.getStartLineNumber(),
      message: `@${boundaryTag.getTagName()} boundary "${cls.getName() ?? "<anonymous>"}"`,
    })
  }
  return findings
}

export const holeEnumerationRule: Rule = {
  name: "hole-enumeration",
  check(sourceFiles) {
    return sourceFiles.flatMap((sourceFile) => [
      ...findDeferredCalls(sourceFile),
      ...findAgentNotes(sourceFile),
      ...findExternals(sourceFile),
      ...findBoundaryClasses(sourceFile),
    ])
  },
}
