import { defineConfig } from "vitepress"

// Source is this docs/ directory. The README-derived pages are generated into
// it by scripts/build-site-pages.mjs (gitignored); the rest are authored here.
// docs-site-ia.md and session-zero-test-cases.md are working docs, not site pages.
export default defineConfig({
  // The README's images live in docs/assets/ and are served from the site root.
  vite: { publicDir: "assets" },
  title: "Centina",
  description: "Spec-flavored TypeScript for writing falsework before a coding task is built.",
  base: "/centina/",
  srcExclude: ["docs-site-ia.md", "session-zero-test-cases.md", "context-audit.md", "skill-text-inventory.md", "skill-history.md", "head-to-head.md"],
  cleanUrls: true,
  // Dead links fail the build. The point of the site is that it stays correct.
  ignoreDeadLinks: false,
  themeConfig: {
    nav: [
      { text: "Why", link: "/why" },
      { text: "Install", link: "/install-claude-code" },
      { text: "Quickstart", link: "/quickstart" },
      { text: "Reference", link: "/reference" },
    ],
    sidebar: [
      { text: "Introduction", link: "/" },
      { text: "Why", link: "/why" },
      { text: "Concepts", link: "/concepts" },
      { text: "Core mechanism", link: "/core-mechanism" },
      { text: "Vocabulary", link: "/vocabulary" },
      {
        text: "Install",
        items: [
          { text: "Claude Code", link: "/install-claude-code" },
          { text: "Other harnesses", link: "/install-other-harnesses" },
          { text: "OpenCode", link: "/opencode-install" },
        ],
      },
      { text: "Quickstart", link: "/quickstart" },
      { text: "Using it", link: "/using-it" },
      {
        text: "Ledger and trail",
        items: [
          { text: "Ledger", link: "/ledger" },
          { text: "Ledger mod", link: "/ledger-mod" },
          { text: "Trail", link: "/trail" },
        ],
      },
      {
        text: "Design rationale",
        items: [
          { text: "Boundaries", link: "/boundaries" },
          { text: "Realize design", link: "/centina-realize-design" },
          { text: "Measurement methodology", link: "/measurement-methodology" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Project state and layout", link: "/reference" },
          { text: "Plugin distribution", link: "/plugin-distribution" },
          { text: "Plugin setup procedure", link: "/plugin-setup-procedure" },
          { text: "The setup command", link: "/centina-check-setup" },
          { text: "Plugin setup step", link: "/plugin-setup-step" },
          { text: "Plugin checker install", link: "/plugin-checker-install" },
          { text: "Plugin file layout", link: "/plugin-file-layout" },
          { text: "Output management", link: "/output-management" },
          { text: "Plan organization", link: "/plan-organization" },
        ],
      },
      { text: "Contributing", link: "/contributing" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/adamtwede/centina" }],
    search: { provider: "local" },
  },
})
