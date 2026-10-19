// Generates the README-derived pages of the docs site into docs/. The README
// stays the single source: each page is a heading-bounded slice of it, so the
// site cannot drift from the README. Generated files are gitignored; run this
// before `vitepress build` (npm run docs:build does both).
//
// Pages are located by heading text, not line number, so edits to the README
// elsewhere don't shift them. Heading and link rewriting keeps the README's
// own `#anchor` links working across the split.

import { cpSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const docs = path.join(root, "docs")

// Each page: file, title, and README ranges as [start heading, end heading]
// (end exclusive; null = end of file). The ranges are concatenated in order.
// The index is the README intro before "## Contents" and is handled separately.
const SLICES = [
  {
    file: "why.md",
    title: "Why",
    ranges: [
      ["## Why this exists", "## Centina's answer"],
      ["## The goals (the invariant everything else serves)", "## State of the project"],
    ],
  },
  { file: "concepts.md", title: "Concepts", ranges: [["## Centina's answer", "## Getting started"]] },
  { file: "install-claude-code.md", title: "Install: Claude Code", ranges: [["## Getting started", "### Using Centina without Claude Code"]] },
  {
    file: "install-other-harnesses.md",
    title: "Install: other harnesses",
    ranges: [["### Using Centina without Claude Code", "## What to do first"]],
  },
  { file: "quickstart.md", title: "Quickstart", ranges: [["## What to do first", "## Documentation"]] },
  {
    file: "core-mechanism.md",
    title: "Core mechanism",
    ranges: [["### The core mechanism: the typed hole with routing", "### The vocabulary, primitive by primitive"]],
  },
  {
    file: "vocabulary.md",
    title: "Vocabulary",
    ranges: [["### The vocabulary, primitive by primitive", "## How to actually use it"]],
  },
  { file: "using-it.md", title: "Using it", ranges: [["## How to actually use it", "## The goals (the invariant everything else serves)"]] },
  { file: "reference.md", title: "Reference: project state and layout", ranges: [["## State of the project", null]] },
]

// GitHub's heading-to-anchor rule, as the README's own TOC uses it.
const slug = (heading) =>
  heading
    .replace(/^#+\s*/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-")

const readme = readFileSync(path.join(root, "README.md"), "utf8").split("\n")

const indexOfLine = (text) => {
  const i = readme.findIndex((line) => line === text)
  if (i < 0) throw new Error(`README heading not found: ${text}`)
  return i
}

const introEnd = indexOfLine("## Contents")
const intro = readme.slice(0, introEnd)

// Map each README heading's anchor to the page that now holds it, so the
// README's `#anchor` links can be rewritten to the right page.
const anchorPage = new Map()
const pages = []

pages.push({ file: "index.md", lines: intro, title: null })
for (const line of intro) if (/^#{1,6} /.test(line)) anchorPage.set(slug(line), "index.md")

for (const { file, title, ranges } of SLICES) {
  const lines = ranges.flatMap(([start, end]) => {
    const from = indexOfLine(start)
    const to = end === null ? readme.length : indexOfLine(end)
    return readme.slice(from, to)
  })
  pages.push({ file, title, lines })
  for (const line of lines) if (/^#{1,6} /.test(line)) anchorPage.set(slug(line), file)
}

// Link rewriting shared by README slices and the copied CONTRIBUTING.md.
// Inside docs/ the README's `docs/...` paths become page-relative.
const rewrite = (text, currentFile) =>
  text
    .replace(/\]\(#([^)\s]+)\)/g, (match, anchor) => {
      const target = anchorPage.get(anchor)
      if (!target) return match
      return target === currentFile ? `](#${anchor})` : `](${target}#${anchor})`
    })
    .replace(/\]\(CONTRIBUTING\.md([^)]*)\)/g, "](contributing.md$1)")
    .replace(/\]\(docs\//g, "](")
    // Repo files that are not site pages (specs, checker source, skills) link to GitHub.
    .replace(
      /\]\(((?:specs|checker|skills|bin|hooks|scripts)\/[^)\s]+)\)/g,
      "](https://github.com/adamtwede/centina/blob/main/$1)",
    )
    // Images are served from docs/public/ (copied below), so they need an
    // absolute path; a relative src is read as a module import by Vite.
    .replace(/(src|srcset)="docs\//g, '$1="/')

// The README's images live in docs/assets/. VitePress serves static files from
// docs/public/, so the generated copy goes there (gitignored).
cpSync(path.join(docs, "assets"), path.join(docs, "public", "assets"), { recursive: true })

const generated = []
for (const page of pages) {
  const body = rewrite(page.lines.join("\n").trimEnd(), page.file)
  const header = page.title === null ? "" : `# ${page.title}\n\n`
  const content = page.title === null && page.file === "index.md" ? body : header + body
  writeFileSync(path.join(docs, page.file), content + "\n")
  generated.push(page.file)
}

const contributing = readFileSync(path.join(root, "CONTRIBUTING.md"), "utf8")
writeFileSync(path.join(docs, "contributing.md"), rewrite(contributing.trimEnd(), "contributing.md") + "\n")
generated.push("contributing.md")

console.log(`generated ${generated.length} pages: ${generated.join(", ")}`)
