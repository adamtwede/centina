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

Four ways a user actually gets a plugin. The first two are single-machine,
single-user mechanisms that differ only in whether the load has to be
requested every session; the last two are what actually extends reach to
other people or other machines:

1. **`claude --plugin-dir ./path`** — local directory, no marketplace
   involved at all, but scoped to that one invocation: `claude --help`
   states it plainly ("for this session only"). Documented as the
   development/testing path. Fastest to start from — no filesystem changes
   outside the checkout itself — but repeats the flag every session.
2. **`~/.claude/skills/<name>/`** — auto-loads every session with no flag,
   as `<name>@skills-dir`. Confirmed empirically (2026-08,
   `~/.claude/skills/centina -> <checkout>`): the `SessionStart` hook fires
   exactly as it does under `--plugin-dir`, correctly resolving
   `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}` and populating a
   name-keyed data directory (`centina-skills-dir`, distinct from
   `centina-inline`'s under `--plugin-dir`) with the checker fully
   installed — no skill invocation needed to trigger it. Two ways to
   populate this location, with a real difference in what they depend on
   afterward:
   - **Symlink to the checkout.** Fastest to set up, but keeps the
     checkout a live dependency: move, rename, or delete it and the plugin
     stops loading at the next session (the same silent-until-next-session
     failure shape `docs/plugin-setup-step.md` already worried about for a
     generated project's `tsconfig.json`, except here it's the plugin's
     own load that breaks, not one project's checking).
   - **A real copy, via the checkout's `install.sh`.** Copies exactly the
     plugin-bundle subset (the tree in `docs/plugin-file-layout.md`) into
     the destination as a standalone directory — no symlink, no reference
     back to the checkout. Verified the copy contains no hardcoded path to
     the original checkout anywhere (`grep`'d the installed tree for the
     checkout's absolute path: no hits) — everything in it resolves
     through `${CLAUDE_PLUGIN_ROOT}` (now the install location itself) or
     `${CLAUDE_PLUGIN_DATA}` (already checkout-location-independent per
     `docs/plugin-setup-step.md`'s Step 4). Once run, **the checkout is
     genuinely disposable.** Trade-off to know: this is a frozen snapshot,
     not a live link — pulling an update in the checkout does nothing
     until `install.sh` is re-run, matching how `claude plugin update`
     already works for marketplace installs (an explicit action, not
     automatic git-tracking).

   Either way this is the better default for a single user's own
   daily-driver machine: same zero-ceremony, directory-based install as
   (1), minus the per-session flag. Still doesn't help anyone else — the
   destination has to exist on that same machine.
3. **`/plugin marketplace add <own-repo>` then `/plugin install
   centina@<marketplace-name>`** — a self-hosted marketplace. Anyone who
   knows the repo URL can add it; no review, no gatekeeper. The first
   option that actually reaches another person or machine.
4. **Submission to `claude-plugins-community`** — requires passing
   `claude plugin validate` plus Anthropic's review and "automated safety
   screening," for listing in a marketplace Anthropic curates and users
   discover without already knowing about Centina.

## Recommendation for Centina: (2) for personal use now, (3) to share, defer (4)

Given the project's current state — pre-1.0, single author, checker rules
and even the vocabulary still actively changing — committing to a review
process and public listing now is more machinery than the project needs,
the same reasoning already applied to deferring the raw-TS-vs-precompiled
decision in `plugin-file-layout.md`. Concretely:

- **Now, for your own use:** `install.sh` into `~/.claude/skills/<name>/` —
  same zero-ceremony directory install as `--plugin-dir`, without
  re-typing the flag every session, and without keeping the checkout
  around afterward. The symlink variant is fine for a quick look, but the
  real-copy install is what actually delivers "clone once, use forever" —
  `--plugin-dir` itself stays useful for
  a one-off session against a plugin you don't want auto-loading by
  default (e.g. testing an alternate branch/checkout).
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
