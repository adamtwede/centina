import { Finding } from "./types"

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const

export function printFindings(findings: Finding[]): void {
  const byFile = new Map<string, Finding[]>()
  for (const finding of findings) {
    const existing = byFile.get(finding.file) ?? []
    existing.push(finding)
    byFile.set(finding.file, existing)
  }

  for (const [file, fileFindings] of [...byFile.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`\n${file}`)
    const sorted = [...fileFindings].sort((a, b) => {
      if (a.rule !== b.rule) return a.rule.localeCompare(b.rule)
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    })
    for (const finding of sorted) {
      console.log(
        `  [${finding.severity}] ${finding.rule} :${finding.line} — ${finding.message}`,
      )
    }
  }
}
