import { ClassDeclaration, JSDocTag, MethodDeclaration } from "ts-morph"
import { Finding, Rule } from "../types"

type Direction = "read" | "write"

function boundaryTag(cls: ClassDeclaration): JSDocTag | undefined {
  if (!cls.hasDeclareKeyword()) return undefined
  const tags = cls.getJsDocs().flatMap((doc) => doc.getTags())
  return tags.find((tag) =>
    ["boundary", "datasource", "datasink"].includes(tag.getTagName()),
  )
}

function direction(method: MethodDeclaration): Direction {
  const returnTypeText =
    method.getReturnTypeNode()?.getText() ?? method.getReturnType().getText()
  return returnTypeText === "void" ? "write" : "read"
}

export const boundaryDirectionRule: Rule = {
  name: "boundary-direction",
  check(sourceFiles) {
    const findings: Finding[] = []
    for (const sourceFile of sourceFiles) {
      for (const cls of sourceFile.getClasses()) {
        const tag = boundaryTag(cls)
        if (!tag) continue
        const kind = tag.getTagName()
        const methods = cls.getMethods()
        const directions = methods.map((method) => ({
          method,
          direction: direction(method),
        }))

        if (kind === "datasource") {
          for (const { method, direction: d } of directions) {
            if (d !== "read") {
              findings.push({
                rule: "boundary-direction",
                severity: "error",
                file: sourceFile.getFilePath(),
                line: method.getStartLineNumber(),
                message: `@datasource door "${method.getName()}" returns void — datasource doors must return data`,
              })
            }
          }
        } else if (kind === "datasink") {
          for (const { method, direction: d } of directions) {
            if (d !== "write") {
              findings.push({
                rule: "boundary-direction",
                severity: "error",
                file: sourceFile.getFilePath(),
                line: method.getStartLineNumber(),
                message: `@datasink door "${method.getName()}" returns data — datasink doors must return void`,
              })
            }
          }
        } else if (kind === "boundary" && directions.length > 0) {
          const allSameDirection = directions.every(
            ({ direction: d }) => d === directions[0].direction,
          )
          if (allSameDirection) {
            findings.push({
              rule: "boundary-direction",
              severity: "info",
              file: sourceFile.getFilePath(),
              line: cls.getStartLineNumber(),
              message: `@boundary "${cls.getName() ?? "<anonymous>"}" — every door is ${directions[0].direction}-only; @data${directions[0].direction === "read" ? "source" : "sink"} may fit better`,
            })
          }
        }
      }
    }
    return findings
  },
}
