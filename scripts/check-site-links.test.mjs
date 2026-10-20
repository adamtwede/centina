import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { checkSiteLinks } from "./check-site-links.mjs"

// A docs site shaped like this repo's: public dir "assets", one excluded page.
function site(files) {
  const root = mkdtempSync(path.join(tmpdir(), "site-links-"))
  const all = {
    ".vitepress/config.mjs":
      'export default { vite: { publicDir: "assets" }, srcExclude: ["draft.md"], cleanUrls: true }\n',
    "index.md": "# Home\n",
    "guide.md": "# Guide\n\n## Setup\n",
    "draft.md": "# Draft\n",
    "sub/index.md": "# Sub\n",
    "assets/logo.svg": "<svg/>",
    "assets/files/sample.json": "{}",
    ...files,
  }
  for (const [name, content] of Object.entries(all)) {
    const full = path.join(root, name)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

const found = async (root) =>
  (await checkSiteLinks(root)).map(({ file, line, url }) => `${path.relative(root, file).split(path.sep).join("/")}:${line} ${url}`)

describe("check-site-links", () => {
  it("passes links to pages, public files, fragments and external URLs", async () => {
    const root = site({
      "page.md": [
        "# Page",
        "",
        "[guide](guide.md) [guide](./guide) [setup](guide#setup) [home](/) [sub](sub/) [self](#top)",
        "![logo](/logo.svg) [sample](files/sample.json) [query](/logo.svg?v=2)",
        "[ext](https://example.com/x.ts) [mail](mailto:a@b.c) [proto](//cdn.example.com/x.js)",
        "",
        "<picture>",
        '  <source srcset="/logo.svg 1x, /logo.svg 2x">',
        '  <img src="/logo.svg" :src="computed">',
        "</picture>",
        "",
      ].join("\n"),
      "sub/deep.md": "[up](../guide) [sibling](./) [asset](../logo.svg)\n",
    })
    assert.deepEqual(await found(root), [])
  })

  it("reports a link to a non-page file that is not served, with its line", async () => {
    // The case that slipped through: VitePress skips known file extensions.
    const root = site({ "page.md": "# Page\n\nSee [the vocabulary](centina.ts).\n" })
    const problems = await checkSiteLinks(root)
    assert.equal(problems.length, 1)
    assert.equal(problems[0].line, 3)
    assert.equal(problems[0].url, "centina.ts")
    assert.match(problems[0].message, /"centina\.ts".*neither a page nor a file in .*assets\//)
  })

  it("reports images, src, srcset and href in raw HTML", async () => {
    const root = site({
      "page.md": [
        "# Page", // 1
        "", // 2
        "![missing](/missing.png)", // 3
        "", // 4
        "<picture>", // 5
        '  <source srcset="/logo.svg 1x, /dark.svg 2x">', // 6
        '  <img src="/gone.svg">', // 7
        "</picture>", // 8
        "", // 9
        'Inline <a href="nowhere.pdf">pdf</a> here.', // 10
        "",
      ].join("\n"),
    })
    assert.deepEqual(await found(root), [
      "page.md:3 /missing.png",
      "page.md:6 /dark.svg",
      "page.md:7 /gone.svg",
      "page.md:10 nowhere.pdf",
    ])
  })

  it("reports links to excluded pages, missing pages and paths outside the source", async () => {
    const root = site({ "page.md": "[d](draft.md)\n\n[n](nope)\n\n[out](../README.md)\n" })
    assert.deepEqual(await found(root), ["page.md:1 draft.md", "page.md:3 nope", "page.md:5 ../README.md"])
  })

  it("compares file names case-sensitively, as the published host does", async () => {
    const root = site({ "page.md": "![logo](/Logo.svg)\n" })
    assert.deepEqual(await found(root), ["page.md:1 /Logo.svg"])
  })

  it("puts repeated and multi-line links on their own lines", async () => {
    const root = site({
      "page.md": [
        "[a](x.ts) and [b](/logo.svg)", // 1
        "then [c](x.ts) again,", // 2
        "and [d][ref].", // 3
        "", // 4
        "[ref]: y.ts", // 5
        "",
      ].join("\n"),
    })
    // A reference-style link is reported where its URL is written.
    assert.deepEqual(await found(root), ["page.md:1 x.ts", "page.md:2 x.ts", "page.md:5 y.ts"])
  })

  it("ignores code, HTML comments and Vue bindings", async () => {
    const root = site({
      "page.md": [
        "`[a](x.ts)`",
        "",
        "```md",
        "[b](x.ts)",
        '<img src="x.svg">',
        "```",
        "",
        '<!-- <img src="x.svg"> -->',
        "",
        '<div :href="link"></div>',
        "",
      ].join("\n"),
    })
    assert.deepEqual(await found(root), [])
  })

  it("counts frontmatter lines", async () => {
    const root = site({ "page.md": "---\ntitle: Page\n---\n\n[a](x.ts)\n" })
    assert.deepEqual(await found(root), ["page.md:5 x.ts"])
  })

  it("does not check excluded pages", async () => {
    const root = site({ "draft.md": "[a](x.ts)\n" })
    assert.deepEqual(await found(root), [])
  })

})
