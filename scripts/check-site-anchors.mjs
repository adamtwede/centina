// Checks that every internal #fragment on the built docs site resolves to an id
// on its target page. VitePress checks that pages exist but not that anchors do,
// and the README-derived pages depend on anchors crossing page boundaries.
// Run after `vitepress build` (see the docs:build script).

import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dist = path.join(root, "docs", ".vitepress", "dist")
const BASE = "/centina/"

const htmlFiles = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (name.endsWith(".html")) htmlFiles.push(full)
  }
}
walk(dist)
if (htmlFiles.length === 0) {
  console.error(`no built pages under ${dist}; run vitepress build first`)
  process.exit(1)
}

// Page path (as served, without base) -> set of ids on that page.
const idsByPage = new Map()
const pageKey = (file) => {
  const rel = path.relative(dist, file).split(path.sep).join("/")
  if (rel === "index.html") return "/"
  if (rel.endsWith("/index.html")) return "/" + rel.slice(0, -"/index.html".length) + "/"
  return "/" + rel.slice(0, -".html".length)
}
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))

for (const file of htmlFiles) {
  idsByPage.set(pageKey(file), idsOf(readFileSync(file, "utf8")))
}

// Resolve a served page path to the key used above, with cleanUrls.
const resolvePage = (pagePath) => {
  if (idsByPage.has(pagePath)) return pagePath
  if (idsByPage.has(pagePath + "/")) return pagePath + "/"
  return null
}

const problems = []
for (const file of htmlFiles) {
  const from = pageKey(file)
  const html = readFileSync(file, "utf8")
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (/^(https?:|mailto:)/.test(href)) continue
    const [target, fragment] = href.split("#")
    if (fragment === undefined || fragment === "") continue
    let page
    if (target === "") page = from
    else if (target.startsWith(BASE)) page = resolvePage("/" + target.slice(BASE.length).replace(/\/$/, ""))
    else continue
    if (page === null) {
      problems.push(`${from}: #${fragment} points at missing page ${href}`)
      continue
    }
    if (!idsByPage.get(page).has(fragment)) {
      problems.push(`${from}: ${href} — no id "${fragment}" on ${page}`)
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"))
  console.error(`${problems.length} broken anchor(s)`)
  process.exitCode = 1
} else {
  console.log(`anchors ok across ${htmlFiles.length} pages`)
}
