export type Severity = "error" | "warning" | "info"

export interface Finding {
  rule: string
  severity: Severity
  file: string
  line: number
  message: string
}

export interface Rule {
  name: string
  check(sourceFiles: import("ts-morph").SourceFile[]): Finding[]
}
