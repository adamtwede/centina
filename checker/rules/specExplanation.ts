import { Finding, Rule } from "../types"

const MIN_EXPLANATION_LENGTH = 40

/**
 * A spec's code alone doesn't establish what it exists to describe — this
 * rule checks (heuristically, by length only) that the first statement is
 * preceded by a real leading comment, not that the comment says anything
 * true or useful. Presence, not quality — same posture as the other rules.
 */
export const specExplanationRule: Rule = {
  name: "spec-explanation",
  check(sourceFiles) {
    const findings: Finding[] = []
    for (const sourceFile of sourceFiles) {
      const [firstStatement] = sourceFile.getStatements()
      const leadingLength = (firstStatement?.getLeadingCommentRanges() ?? [])
        .map((comment) => comment.getText().length)
        .reduce((total, length) => total + length, 0)

      if (leadingLength < MIN_EXPLANATION_LENGTH) {
        findings.push({
          rule: "spec-explanation",
          severity: "warning",
          file: sourceFile.getFilePath(),
          line: 1,
          message:
            "no top-level explanation — a spec should open with a comment describing what it exists to describe",
        })
      }
    }
    return findings
  },
}
