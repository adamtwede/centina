// Checks that every relative link on the docs site points at something the
// published site serves: a built page, or a file in the public directory
// (docs/assets/, served from the site root). VitePress's own dead-link check
// skips any link whose extension it recognizes as a file (.ts, .svg, .json, ...)
// and never looks at raw HTML, so `[centina.ts](centina.ts)` passed the build
// while 404ing on the site. A file kept next to the pages rather than in the
// public directory is reported too: keep served files in docs/assets/.
// Reads the markdown sources, so problems carry file:line. Run by docs:build.

import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createMarkdownRenderer, disposeMdItInstance, resolveConfig } from "vitepress"

// Same test VitePress uses: a scheme (http:, mailto:, ...) or protocol-relative.
const EXTERNAL = /^(?:[a-z]+:|\/\/)/i
// A link-bearing attribute in raw HTML. The leading whitespace keeps out Vue
// bindings like `:src="expr"`, whose value is an expression, not a URL.
const HTML_ATTR = /(?<=\s)(href|src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi

const walkFiles = (dir, base = dir, out = new Set()) => {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walkFiles(full, base, out)
    else out.add(path.relative(base, full).split(path.sep).join("/"))
  }
  return out
}

// The URLs one HTML fragment links to, with each one's offset in the fragment.
// Comments are blanked rather than removed so offsets still line up.
const htmlUrls = (html) => {
  const live = html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "))
  const urls = []
  for (const m of live.matchAll(HTML_ATTR)) {
    const value = m[2] ?? m[3]
    const at = m.index + m[0].length - value.length - 1
    if (m[1].toLowerCase() !== "srcset") {
      urls.push({ url: value.trim(), at })
      continue
    }
    // srcset: comma-separated candidates, each "url [descriptor]".
    let offset = 0
    for (const candidate of value.split(",")) {
      const url = candidate.trim().split(/\s+/)[0]
      if (url) urls.push({ url, at: at + offset + candidate.indexOf(url) })
      offset += candidate.length + 1
    }
  }
  return urls
}

// Every link in one page as { url, line } (1-based, in the source file).
const linksIn = (md, src) => {
  // VitePress strips frontmatter in md.render, not md.parse; render once to
  // learn the body it parses, and offset its line numbers by what it dropped.
  const env = {}
  md.render(src, env)
  const body = env.content ?? src
  const skipped = src.slice(0, src.length - body.length).split("\n").length - 1
  const lines = body.split("\n")
  const links = []

  // Markdown-it maps blocks to lines but not inline tokens; find each inline
  // link's line by searching the block's lines in order, so repeats resolve to
  // successive occurrences. A link whose URL isn't in the block is
  // reference-style: it gets its definition's line, where the URL is written,
  // or failing that the block's first line.
  const locate = (map, cursor, needles) => {
    for (let l = cursor.line; l < map[1]; l++) {
      for (const needle of needles) {
        const col = lines[l].indexOf(needle, l === cursor.line ? cursor.col : 0)
        if (col >= 0) {
          cursor.line = l
          cursor.col = col + needle.length
          return l
        }
      }
    }
    const definition = lines.findIndex((text) => text.includes("]:") && needles.some((n) => text.includes(n)))
    return definition >= 0 ? definition : map[0]
  }

  const visit = (tokens) => {
    for (const token of tokens) {
      if (token.type === "html_block" && token.map) {
        for (const { url, at } of htmlUrls(token.content)) {
          const line = token.map[0] + token.content.slice(0, at).split("\n").length - 1
          links.push({ url, line: skipped + line + 1 })
        }
      } else if (token.type === "inline" && token.map && token.children) {
        const cursor = { line: token.map[0], col: 0 }
        for (const child of token.children) {
          let urls = []
          if (child.type === "link_open") urls = [child.attrGet("href")]
          else if (child.type === "image") urls = [child.attrGet("src")]
          else if (child.type === "html_inline") urls = htmlUrls(child.content).map((u) => u.url)
          for (const url of urls) {
            if (url === null) continue
            const line = locate(token.map, cursor, [url, md.normalizeLinkText(url)])
            links.push({ url, line: skipped + line + 1 })
          }
        }
      }
      if (token.children && token.type !== "inline") visit(token.children)
    }
  }
  visit(md.parse(body, {}))
  return links
}

// Why a site-relative URL from `page` (a path under srcDir) is not served, or
// null if it is.
const problemWith = (url, page, routes, publicFiles, publicLabel) => {
  const clean = url.replace(/[?#].*$/, "")
  if (clean === "") return null // same-page #fragment; check-site-anchors covers it
  let decoded
  try {
    decoded = decodeURIComponent(clean)
  } catch {
    return "is not a valid URL"
  }
  const joined = decoded.startsWith("/")
    ? path.posix.normalize(decoded.slice(1))
    : path.posix.normalize(path.posix.join(path.posix.dirname(page), decoded))
  if (joined === ".." || joined.startsWith("../")) return "resolves outside the site source"
  const target = joined === "." ? "" : joined

  // A page: VitePress's own resolution, with .md/.html optional and a
  // directory meaning its index.
  let route = target.replace(/\.(md|html)$/, "")
  if (route === "" || route.endsWith("/")) route += "index"
  if (routes.has(route) || publicFiles.has(`${route}.html`)) return null
  // A file served from the public directory.
  if (publicFiles.has(target)) return null
  return `resolves to "${target}", which is neither a page nor a file in ${publicLabel}`
}

// Returns every unserved link in the site at `docsRoot` (the directory holding
// .vitepress/), as { file, line, url, message }.
export async function checkSiteLinks(docsRoot) {
  const config = await resolveConfig(docsRoot, "build", "production")
  const publicDirOption = config.vite?.publicDir ?? "public"
  const publicDir = publicDirOption === false ? null : path.resolve(config.srcDir, publicDirOption)
  const publicFiles = publicDir === null ? new Set() : walkFiles(publicDir)
  const publicLabel =
    publicDir === null
      ? "the public directory (disabled)"
      : `${path.relative(process.cwd(), publicDir).split(path.sep).join("/") || "."}/`
  const routes = new Set(config.pages.map((p) => (config.rewrites.map[p] ?? p).replace(/\.md$/, "")))

  const md = await createMarkdownRenderer(config.srcDir, config.markdown, config.site.base, config.logger)
  const problems = []
  try {
    for (const page of config.pages) {
      const file = path.join(config.srcDir, page)
      for (const { url, line } of linksIn(md, readFileSync(file, "utf8"))) {
        if (url === "" || url.startsWith("#") || EXTERNAL.test(url)) continue
        const message = problemWith(url, page.split(path.sep).join("/"), routes, publicFiles, publicLabel)
        if (message) problems.push({ file, line, url, message })
      }
    }
  } finally {
    disposeMdItInstance()
  }
  return problems
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const problems = await checkSiteLinks(path.join(root, "docs"))
  if (problems.length > 0) {
    for (const { file, line, url, message } of problems) {
      console.error(`${path.relative(process.cwd(), file)}:${line}: ${url} ${message}`)
    }
    console.error(`${problems.length} unserved link(s)`)
    process.exitCode = 1
  } else {
    console.log("links ok: every relative link is a page or a public file")
  }
}
