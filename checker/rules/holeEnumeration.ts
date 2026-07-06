import { CallExpression, Node, SourceFile, SyntaxKind } from "ts-morph"
import { Finding, Rule } from "../types"
import { isFromVocabulary } from "../vocabulary"

const AGENT_NOTE_PATTERN = /@agent(?:\(([^)]+)\))?:/g
const EXTERNAL_PATTERN = /@external\s+"([^"]+)"/g
const BOUNDARY_TAGS = new Set(["boundary", "datasource", "datasink"])

const DEFERRED_KIND_INFO: Record<
  string,
  { severity: Finding["severity"]; message: string }
> = {
  unmarked: {
    severity: "warning",
    message: "deferred<...>() hole — routing not yet resolved",
  },
  open: {
    severity: "info",
    message:
      'deferred<"open", ...>() hole — left to the implementing agent\'s discretion',
  },
  spec: {
    severity: "info",
    message: 'deferred<"spec", ...>() hole — routed to a separate spec',
  },
  unimplemented: {
    severity: "error",
    message:
      'deferred<"unimplemented", ...>() hole — needs a real function body before planning can begin',
  },
}

function lineAt(sourceFile: SourceFile, pos: number): number {
  return sourceFile.getLineAndColumnAtPos(pos).line
}

function deferredKind(call: CallExpression): string {
  const typeArgs = call.getTypeArguments()
  if (typeArgs.length < 2) return "unmarked"
  const kindArg = typeArgs[0]
  if (!Node.isLiteralTypeNode(kindArg)) return "unmarked"
  const literal = kindArg.getLiteral()
  return Node.isStringLiteral(literal) ? literal.getLiteralValue() : "unmarked"
}

function findDeferredCalls(sourceFile: SourceFile): Finding[] {
  const findings: Finding[] = []
  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  )) {
    const expr = call.getExpression()
    if (expr.getText() !== "deferred") continue
    if (!isFromVocabulary(expr.getSymbol())) continue
    const { severity, message } =
      DEFERRED_KIND_INFO[deferredKind(call)] ?? DEFERRED_KIND_INFO.unmarked
    findings.push({
      rule: "hole-enumeration",
      severity,
      file: sourceFile.getFilePath(),
      line: call.getStartLineNumber(),
      message,
    })
  }
  return findings
}

function findAgentNotes(sourceFile: SourceFile): Finding[] {
  const text = sourceFile.getFullText()
  const findings: Finding[] = []
  for (const match of text.matchAll(AGENT_NOTE_PATTERN)) {
    const label = match[1]
    findings.push({
      rule: "hole-enumeration",
      severity: "info",
      file: sourceFile.getFilePath(),
      line: lineAt(sourceFile, match.index ?? 0),
      message: label
        ? `@agent(${label}): note — direct message to the coding agent`
        : "@agent: note — direct message to the coding agent",
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
