# Plugin distribution and install mechanics (design spec)

Status: design, not yet implemented. Companion to `docs/plugin-file-
layout.md`, `docs/plugin-setup-step.md`, `docs/plugin-checker-install.md`.
Those cover what the plugin contains and how it behaves once installed;
this covers how a user gets it installed at all.

## What a "marketplace" actually is

Not a centralized npm-style registry. A marketplace is a single file —
`.claude-plugin/marketplace.json` — in any git repo, listing plugin
entries (name, source, metadata). Anyone can host one. Anthropic runs two
(`claude-plugins-official`, curated; `claude-plugins-community`, open
submission after review), but self-hosting your own is the documented
standard path for independent distribution, not a fallback.

Three ways a user actually gets a plugin, in increasing order of
distribution reach:

1. **`claude --plugin-dir ./path`** — local directory, no marketplace
   involved at all. Documented as the development/testing path.
2. **`/plugin marketplace add <own-repo>` then `/plugin install
   centina@<marketplace-name>`** — a self-hosted marketplace. Anyone who
   knows the repo URL can add it; no review, no gatekeeper.
3. **Submission to `claude-plugins-community`** — requires passing
   `claude plugin validate` plus Anthropic's review and "automated safety
   screening," for listing in a marketplace Anthropic curates and users
   discover without already knowing about Centina.

## Recommendation for Centina: start at (1), move to (2), defer (3)

Given the project's current state — pre-1.0, single author, checker rules
and even the vocabulary still actively changing — committing to a review
process and public listing now is more machinery than the project needs,
the same reasoning already applied to deferring the raw-TS-vs-precompiled
decision in `plugin-file-layout.md`. Concretely:

- **Now, during development:** `--plugin-dir` against a local checkout.
  Fastest iteration loop, zero distribution ceremony.
- **Once ready to use across machines / share with anyone specific:** a
  self-hosted marketplace — just this repo (or a dedicated one) with a
  `.claude-plugin/marketplace.json` added, no submission process, full
  control over what "installed" means at any moment.
- **Community/official marketplace submission:** not needed unless or
  until broad public discoverability actually matters. Revisit then, not
  before — this is a decision to defer, not one to design around now.

## Updates

`/plugin marketplace update <name>` refreshes the catalog manually.
Auto-update is on by default for official marketplaces, off by default for
third-party ones (including a self-hosted one) — so a self-hosted
marketplace means users must explicitly pull updates unless they opt in.
Version resolution cascades `plugin.json` version → marketplace-entry
version → git commit SHA → archive SHA256 — this is how the bundle's
*own* `.claude-plugin/plugin.json` version field gets set at install/update
time, not something a running skill resolves itself. `pluginVersion` in
`.centina/config.json` (per `plugin-setup-step.md`) is simpler: it's read
directly from that `plugin.json`'s `version` field at config-generation
time, which is just the tail end of this cascade as far as the skill can
observe it.

## One thing this surfaces that affects `plugin-checker-install.md`

Archive-based plugin sources are capped at 256 MiB. Centina's plugin
bundle — source only, no `node_modules` shipped, since `plugin-checker-
install.md` installs dependencies at runtime via the `SessionStart` hook
rather than bundling them — stays trivially under that regardless, so this
isn't a real constraint. Worth noting only because it's a small
retroactive validation that not bundling `node_modules` was the right call
independent of the writability question that originally motivated it.

The more consequential finding: **running `npm install` from inside a
`SessionStart` hook, at plugin load time, isn't explicitly covered by the
distribution/review docs.** It's not prohibited, but it's not confirmed
either — no stated guidance on how (or whether) the "automated safety
screening" mentioned for community-marketplace submission treats a hook
that reaches out to the network and installs packages at runtime. This
doesn't block the (1)/(2) path recommended above, since neither involves
Anthropic review. It does mean: **if Centina is ever submitted to the
community or official marketplace, `plugin-checker-install.md`'s design
needs to be re-verified against whatever that review process actually
checks** — worth flagging now so it isn't rediscovered as a surprise at
submission time.

## Open items

- Exact content/schema of `.claude-plugin/marketplace.json` beyond "name,
  source, metadata" wasn't confirmed in detail — needs a concrete example
  pulled before writing the actual file.
- Whether `claude plugin validate` checks anything relevant to this
  design (e.g., hook behavior, `bin/` conventions) isn't known — worth
  running once the plugin bundle exists, even before any marketplace
  submission is planned, since it's a free correctness check either way.
