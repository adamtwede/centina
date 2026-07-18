import { AsExpression, Node, Type } from "ts-morph"
import { SyntaxKind } from "ts-morph"
import { Finding, Rule } from "../types"

function isOpaqueSource(type: Type): boolean {
  return type.isUnknown() || type.isAny()
}

/** `unknown`/`any` targets are never a shape assumption — they opacify a value, they don't fabricate one. */
function isOpaqueTarget(cast: AsExpression): boolean {
  const text = cast.getTypeNode().getText()
  return text === "unknown" || text === "any"
}

/** Peel through throwaway `as unknown`/`as any` steps (the `x as unknown as T` pattern) to the real underlying expression, so a laundered cast can't hide behind an intermediate opaque type. */
function realOperandOf(cast: AsExpression): Node {
  let current: Node = cast.getExpression()
  while (Node.isAsExpression(current) && isOpaqueTarget(current)) {
    current = current.getExpression()
  }
  return current
}

export const assumptionBookkeepingRule: Rule = {
  name: "assumption-bookkeeping",
  check(sourceFiles) {
    const findings: Finding[] = []
    for (const sourceFile of sourceFiles) {
      for (const cast of sourceFile.getDescendantsOfKind(
        SyntaxKind.AsExpression,
      )) {
        if (isOpaqueTarget(cast)) continue

        const targetTypeText = cast.getTypeNode().getText()
        const line = cast.getStartLineNumber()
        const realOperand = realOperandOf(cast)
        const realOperandType = realOperand.getType()

        if (isOpaqueSource(realOperandType)) {
          findings.push({
            rule: "assumption-bookkeeping",
            severity: "info",
            file: sourceFile.getFilePath(),
            line,
            message: `assumption: unknown value cast to "${targetTypeText}"`,
          })
        } else if (Node.isObjectLiteralExpression(realOperand)) {
          findings.push({
            rule: "assumption-bookkeeping",
            severity: "info",
            file: sourceFile.getFilePath(),
            line,
            message: `assumption: stub object cast to "${targetTypeText}" — fields expected to be committed before use`,
          })
        } else {
          findings.push({
            rule: "assumption-bookkeeping",
            severity: "warning",
            file: sourceFile.getFilePath(),
            line,
            message: `cast to "${targetTypeText}" narrows a value whose type is already "${realOperandType.getText()}" — not from unknown/any or a stub object; verify this isn't laundering shape without a source`,
          })
        }
      }
    }
    return findings
  },
}
