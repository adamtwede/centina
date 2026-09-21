import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { ts } from "ts-morph"

// Ledger format: docs/ledger-provenance-design.md.

export const LETTERS = ["P", "Q", "F", "O", "W", "G", "R"] as const
export type Letter = (typeof LETTERS)[number]

export const LEDGER_INDEX = "LEDGER-INDEX.md"
export const STANDING = "STANDING.md"

export interface LabelRef {
  /** Set only on cross-system citations (`system/scope:P4`), which are not resolved. */
  system?: string
  scope: string
  letter: Letter
  number: number
  part?: string
}

export interface SourceLine {
  text: string
  line: number
  /** Inside a fenced code block; not scanned for citations. */
  code: boolean
}

export interface Field {
  value: string
  line: number
}

export interface Entry {
  key: string
  ref: LabelRef
  title: string
  file: string
  line: number
  fields: Map<string, Field>
  parts: Set<string>
  body: SourceLine[]
}

export interface ParseProblem {
  file: string
  line: number
  message: string
}

export interface Ledger {
  system: string
  dir: string
  entries: Entry[]
  /** Ledger lines outside any entry (file and section intros). */
  looseLines: { file: string; lines: SourceLine[] }[]
  problems: ParseProblem[]
}

export interface ScannedFile {
  file: string
  lines: SourceLine[]
  /** Scope a bare label resolves to; set only for `<scope>.centina.ts` comments. */
  bareScope?: string
}

export function labelKey(ref: Pick<LabelRef, "scope" | "letter" | "number">): string {
  return `${ref.scope}:${ref.letter}${ref.number}`
}

export function formatRef(ref: LabelRef): string {
  const base = ref.system ? `${ref.system}/${labelKey(ref)}` : labelKey(ref)
  return ref.part ? `${base}(${ref.part})` : base
}

const SCOPE = "[a-z][a-z0-9-]*"
const LABEL = "([PQFOWGR])([1-9]\\d*)(?:\\(([a-z])\\))?"
const QUALIFIED = `(?:(${SCOPE})/)?(${SCOPE}):${LABEL}`
const QUALIFIED_IN_TEXT = new RegExp(`(?<![\\w/:.-])${QUALIFIED}(?!\\w)`, "g")
const BARE_IN_TEXT = new RegExp(`(?<![\\w/:.-])${LABEL}(?!\\w)`, "g")
const QUALIFIED_EXACT = new RegExp(`^${QUALIFIED}$`)

const HEADING = new RegExp(`^### (${SCOPE}):([PQFOWGR])([1-9]\\d*): (\\S.*)$`)
const FIELD_LINE = /^- ([A-Z][A-Za-z-]*): (.*)$/
const PART_LINE = /^\(([a-z])\)\s/
const SECTION_HEADING = /^#{1,2} /
const FENCE = /^(```|~~~)/

export interface TextRef {
  ref: LabelRef
  bare: boolean
}

export function refsInText(text: string): TextRef[] {
  const refs: TextRef[] = []
  for (const m of text.matchAll(QUALIFIED_IN_TEXT)) {
    refs.push({
      ref: { system: m[1], scope: m[2], letter: m[3] as Letter, number: Number(m[4]), part: m[5] },
      bare: false,
    })
  }
  for (const m of text.matchAll(BARE_IN_TEXT)) {
    refs.push({
      ref: { scope: "", letter: m[1] as Letter, number: Number(m[2]), part: m[3] },
      bare: true,
    })
  }
  return refs
}

export function parseQualified(text: string): LabelRef | undefined {
  const m = text.match(QUALIFIED_EXACT)
  if (!m) return undefined
  return { system: m[1], scope: m[2], letter: m[3] as Letter, number: Number(m[4]), part: m[5] }
}

/** Splits a comma-separated label-list field. `invalid` holds tokens that are not qualified labels. */
export function fieldRefs(entry: Entry, name: string): { refs: LabelRef[]; invalid: string[] } {
  const field = entry.fields.get(name)
  const refs: LabelRef[] = []
  const invalid: string[] = []
  if (!field) return { refs, invalid }
  for (const token of field.value.split(",").map((t) => t.trim()).filter(Boolean)) {
    const ref = parseQualified(token)
    if (ref) refs.push(ref)
    else invalid.push(token)
  }
  return { refs, invalid }
}

export function status(entry: Entry): string | undefined {
  return entry.fields.get("Status")?.value
}

export function parseLedgerFile(
  file: string,
  text: string,
): { entries: Entry[]; looseLines: SourceLine[]; problems: ParseProblem[] } {
  const entries: Entry[] = []
  const looseLines: SourceLine[] = []
  const problems: ParseProblem[] = []
  let current: Entry | undefined
  let inHeader = false
  let inFence = false

  text.split(/\r?\n/).forEach((lineText, index) => {
    const line = index + 1

    if (FENCE.test(lineText)) {
      inFence = !inFence
      inHeader = false
      ;(current ? current.body : looseLines).push({ text: lineText, line, code: true })
      return
    }

    if (!inFence && lineText.startsWith("### ")) {
      const m = lineText.match(HEADING)
      if (!m) {
        problems.push({
          file,
          line,
          message: 'malformed entry heading; expected "### <scope>:<letter><number>: <title>"',
        })
        current = undefined
        inHeader = false
        return
      }
      const ref: LabelRef = { scope: m[1], letter: m[2] as Letter, number: Number(m[3]) }
      current = {
        key: labelKey(ref),
        ref,
        title: m[4],
        file,
        line,
        fields: new Map(),
        parts: new Set(),
        body: [],
      }
      entries.push(current)
      inHeader = true
      return
    }

    if (!inFence && SECTION_HEADING.test(lineText)) {
      current = undefined
      inHeader = false
      looseLines.push({ text: lineText, line, code: false })
      return
    }

    if (!current) {
      looseLines.push({ text: lineText, line, code: inFence })
      return
    }

    if (inHeader) {
      const field = lineText.match(FIELD_LINE)
      if (field) {
        if (current.fields.has(field[1])) {
          problems.push({ file, line, message: `duplicate header field "${field[1]}" in ${current.key}` })
        } else {
          current.fields.set(field[1], { value: field[2].trim(), line })
        }
        return
      }
      inHeader = false
    }

    if (!inFence) {
      const part = lineText.match(PART_LINE)
      if (part) current.parts.add(part[1])
    }
    current.body.push({ text: lineText, line, code: inFence })
  })

  return { entries, looseLines, problems }
}

export function isLedgerFileName(name: string): boolean {
  return name === "LEDGER.md" || (name.startsWith("LEDGER-") && name.endsWith(".md") && name !== LEDGER_INDEX)
}

export function readLedger(dir: string): Ledger {
  const ledger: Ledger = { system: path.basename(dir), dir, entries: [], looseLines: [], problems: [] }
  const names = readdirSync(dir).filter(isLedgerFileName).sort()
  for (const name of names) {
    const file = path.join(dir, name)
    const parsed = parseLedgerFile(file, readFileSync(file, "utf8"))
    ledger.entries.push(...parsed.entries)
    ledger.looseLines.push({ file, lines: parsed.looseLines })
    ledger.problems.push(...parsed.problems)
  }
  return ledger
}

function markdownLines(text: string): SourceLine[] {
  let inFence = false
  return text.split(/\r?\n/).map((lineText, index) => {
    if (FENCE.test(lineText)) {
      inFence = !inFence
      return { text: lineText, line: index + 1, code: true }
    }
    return { text: lineText, line: index + 1, code: inFence }
  })
}

/** Every comment in a TypeScript file, split into lines. */
export function commentLines(file: string, text: string): SourceLine[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const seen = new Set<number>()
  const lines: SourceLine[] = []

  const collect = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) {
      if (seen.has(range.pos)) continue
      seen.add(range.pos)
      const startLine = source.getLineAndCharacterOfPosition(range.pos).line + 1
      text
        .slice(range.pos, range.end)
        .split(/\r?\n/)
        .forEach((commentText, offset) => {
          lines.push({ text: commentText, line: startLine + offset, code: false })
        })
    }
  }

  const visit = (node: ts.Node) => {
    collect(ts.getLeadingCommentRanges(text, node.pos))
    collect(ts.getTrailingCommentRanges(text, node.end))
    for (const child of node.getChildren(source)) visit(child)
  }
  visit(source)

  return lines.sort((a, b) => a.line - b.line)
}

const SKIP_DIRS = new Set(["archive", "transcripts", "node_modules"])

/** Files in a system directory that may cite labels, other than the ledger and generated files. */
export function scanSystemFiles(dir: string): ScannedFile[] {
  const scanned: ScannedFile[] = []

  const walk = (current: string) => {
    for (const dirent of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, dirent.name)
      if (dirent.isDirectory()) {
        if (!dirent.name.startsWith(".") && !SKIP_DIRS.has(dirent.name)) walk(full)
        continue
      }
      const topLevel = current === dir
      if (topLevel && (isLedgerFileName(dirent.name) || dirent.name === LEDGER_INDEX || dirent.name === STANDING)) {
        continue
      }
      if (dirent.name.endsWith(".md")) {
        scanned.push({ file: full, lines: markdownLines(readFileSync(full, "utf8")) })
      } else if (dirent.name.endsWith(".ts")) {
        const bareScope = dirent.name.endsWith(".centina.ts")
          ? dirent.name.slice(0, -".centina.ts".length)
          : undefined
        scanned.push({ file: full, lines: commentLines(full, readFileSync(full, "utf8")), bareScope })
      }
    }
  }

  walk(dir)
  return scanned
}

export interface UnbuiltMember {
  /** `Class.member`, for the message. */
  name: string
  /** The member declaration's line; every finding about it reports here. */
  line: number
  /** Every string in the thrown expression. */
  strings: SourceLine[]
}

export interface BuildFile {
  file: string
  comments: SourceLine[]
  unbuilt: UnbuiltMember[]
}

function memberName(node: ts.ClassElement): string | undefined {
  const name = node.name
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined
}

/** The function body of a method, accessor, or a property holding a function. */
function memberBody(node: ts.ClassElement): ts.Block | undefined {
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return node.body
  }
  if (ts.isPropertyDeclaration(node) && node.initializer) {
    const value = node.initializer
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
      return ts.isBlock(value.body) ? value.body : undefined
    }
  }
  return undefined
}

function isStringPart(node: ts.Node): boolean {
  return (
    ts.isStringLiteralLike(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  )
}

/**
 * Members of `implements` classes whose whole body is a `throw`. Such a member
 * is unbuilt by construction, so a label in what it throws names an owner —
 * see docs/ledger.md, "Citations from build code".
 */
export function unbuiltMembers(file: string, text: string): UnbuiltMember[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
  const members: UnbuiltMember[] = []

  const visit = (node: ts.Node) => {
    if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.heritageClauses) {
      const fills = node.heritageClauses.some((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword)
      if (fills) {
        const className = node.name?.text ?? "(anonymous class)"
        for (const member of node.members) {
          const body = memberBody(member)
          if (!body || body.statements.length !== 1) continue
          const [only] = body.statements
          if (!ts.isThrowStatement(only)) continue
          const strings: SourceLine[] = []
          const collect = (child: ts.Node) => {
            if (isStringPart(child)) strings.push({ text: child.getText(source), line: lineOf(child), code: false })
            child.forEachChild(collect)
          }
          collect(only)
          members.push({ name: `${className}.${memberName(member) ?? "(member)"}`, line: lineOf(member), strings })
        }
      }
    }
    node.forEachChild(visit)
  }
  visit(source)

  return members
}

const BUILD_SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage"])

/** TypeScript files under a build tree, with their comments and unbuilt members. */
export function scanBuildRoot(root: string): BuildFile[] {
  const files: BuildFile[] = []

  const walk = (current: string) => {
    for (const dirent of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, dirent.name)
      if (dirent.isDirectory()) {
        if (!dirent.name.startsWith(".") && !BUILD_SKIP_DIRS.has(dirent.name)) walk(full)
        continue
      }
      if (!/\.tsx?$/.test(dirent.name) || dirent.name.endsWith(".d.ts")) continue
      const text = readFileSync(full, "utf8")
      files.push({ file: full, comments: commentLines(full, text), unbuilt: unbuiltMembers(full, text) })
    }
  }

  walk(root)
  return files
}
