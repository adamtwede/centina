import {
  ClassDeclaration,
  JSDocTag,
  MethodDeclaration,
  Node,
  Type,
  TypeNode,
} from "ts-morph"
import { Finding, Rule } from "../types"

function boundaryTag(cls: ClassDeclaration): JSDocTag | undefined {
  if (!cls.hasDeclareKeyword()) return undefined
  const tags = cls.getJsDocs().flatMap((doc) => doc.getTags())
  return tags.find((tag) =>
    ["boundary", "datasource", "datasink"].includes(tag.getTagName()),
  )
}

function flattenType(type: Type): Type[] {
  if (type.isUnion()) return type.getUnionTypes().flatMap(flattenType)
  if (type.isArray()) return flattenType(type.getArrayElementTypeOrThrow())
  return [type]
}

/** Is this type's alias a `Noun<...>` brand from centina.ts? Opaque by design — exempt regardless of where it's declared. */
function isNounBrand(type: Type): boolean {
  const aliasSymbol = type.getAliasSymbol()
  if (!aliasSymbol) return false
  return aliasSymbol.getDeclarations().some((declaration) => {
    if (!Node.isTypeAliasDeclaration(declaration)) return false
    const typeNode = declaration.getTypeNode()
    if (!typeNode || !Node.isTypeReference(typeNode)) return false
    if (typeNode.getTypeName().getText() !== "Noun") return false
    const referenceSymbol = typeNode.getTypeName().getSymbol()
    const targetSymbol = referenceSymbol?.getAliasedSymbol() ?? referenceSymbol
    const targetDeclarations = targetSymbol?.getDeclarations() ?? []
    return targetDeclarations.some((d) =>
      d.getSourceFile().getFilePath().endsWith("/centina.ts"),
    )
  })
}

/** Primitives, `unknown`/`any`/`never`, enums, and Noun brands carry no shape for a boundary to depend on. */
function isExempt(type: Type): boolean {
  if (type.isAny() || type.isUnknown() || type.isNever()) return true
  if (type.isVoid() || type.isUndefined() || type.isNull()) return true
  if (type.isString() || type.isNumber() || type.isBoolean()) return true
  if (
    type.isStringLiteral() ||
    type.isNumberLiteral() ||
    type.isBooleanLiteral()
  )
    return true
  if (type.isEnum() || type.isEnumLiteral()) return true
  if (isNounBrand(type)) return true
  return false
}

/** A structured (interface / object type-alias) type declared in the same file as the boundary depending on it. */
function isStructuredLocalType(type: Type, boundaryFilePath: string): boolean {
  const symbol = type.getAliasSymbol() ?? type.getSymbol()
  if (!symbol) return false
  return symbol.getDeclarations().some((declaration) => {
    if (declaration.getSourceFile().getFilePath() !== boundaryFilePath)
      return false
    return (
      Node.isInterfaceDeclaration(declaration) ||
      Node.isTypeAliasDeclaration(declaration)
    )
  })
}

function checkTypeNode(
  typeNode: TypeNode,
  boundaryFilePath: string,
): Type[] {
  return flattenType(typeNode.getType()).filter(
    (type) => !isExempt(type) && isStructuredLocalType(type, boundaryFilePath),
  )
}

function checkMethod(
  method: MethodDeclaration,
  boundaryFilePath: string,
): Finding[] {
  const findings: Finding[] = []
  const sourceFile = method.getSourceFile()

  const typeNodes: { label: string; typeNode: TypeNode }[] = []
  for (const param of method.getParameters()) {
    const typeNode = param.getTypeNode()
    if (typeNode) typeNodes.push({ label: `parameter "${param.getName()}"`, typeNode })
  }
  const returnTypeNode = method.getReturnTypeNode()
  if (returnTypeNode) typeNodes.push({ label: "return type", typeNode: returnTypeNode })

  for (const { label, typeNode } of typeNodes) {
    const offenders = checkTypeNode(typeNode, boundaryFilePath)
    for (const offender of offenders) {
      findings.push({
        rule: "boundary-dependency",
        severity: "error",
        file: sourceFile.getFilePath(),
        line: method.getStartLineNumber(),
        message: `door "${method.getName()}" ${label} depends on "${offender.getText()}", a structured type declared in this same boundary file — boundaries must not depend on their consumer's local types`,
      })
    }
  }
  return findings
}

export const boundaryDependencyRule: Rule = {
  name: "boundary-dependency",
  check(sourceFiles) {
    const findings: Finding[] = []
    for (const sourceFile of sourceFiles) {
      const boundaryFilePath = sourceFile.getFilePath()
      for (const cls of sourceFile.getClasses()) {
        if (!boundaryTag(cls)) continue
        for (const method of cls.getMethods()) {
          findings.push(...checkMethod(method, boundaryFilePath))
        }
      }
    }
    return findings
  },
}
