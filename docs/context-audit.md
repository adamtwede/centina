# Context audit: Centina sessions on Chrysalis Underworld

Audit of 2026-10-22. It answers one question: when a Centina session on a big
project fills its context window in a handful of turns, what is actually filling
it, and which parts can Centina trim without losing anything it needs?

The short answer: about a quarter of each window is Centina's (16–17% in the
ledger files, 7% in skills and the docs they make the agent read). Another
quarter is the model's own hidden reasoning, and the rest is the project work
itself plus Claude Code's overhead. The biggest single place Centina can cut is
how the agent reads and writes ledger entries. Right now it does that with
grep, `sed` and one-off splice scripts, against files too large for the Read and
Edit tools.

## How this was measured

No new sessions were run. The audit covers the nine Chrysalis transcripts already
on disk (`~/.claude/projects/C--Users-adamt-Projects-chrysalis*`), four of them
long `centina-realize`/`centina-spike`/`centina-iterate` runs. Together they span
37 context segments, where a segment runs from a session start or a compaction
to the next compaction.

Every piece of content entering a segment's context was attributed to one of
five buckets:

- **Thinking**: the model's hidden reasoning, from each response's
  `thinking_tokens` usage field.
- **Harness**: Claude Code itself (system reminders, tool and skill listings,
  compaction summaries), MCP servers, and user-level config.
- **Centina-mandated**: content a Centina skill or doc makes the agent load:
  skill bodies, the docs the skills say to read, the `STANDING.md` import the
  ledger doc offers to set up.
- **Centina-workflow**: content that comes from doing Centina's process: ledger
  reads and writes, `TRAIL.jsonl`, spec reads and edits, checker runs.
- **Project**: the work itself: prototype code, tests, Bash output, screenshots,
  your messages and the agent's prose.

Tool calls were sorted by what they touch. A read of a `LEDGER-*.md`, a command
mentioning a ledger id like `instruments:W6`, or a scratchpad file holding a
ledger entry counts as workflow. A command touching both a ledger and
`prototype/` counts as workflow too, so workflow is if anything slightly
overstated.

Sizes are estimates at 4 characters per token, with images at a flat 1,600. That
ratio was calibrated against the sessions' own usage numbers: the estimates
account for 85% of the context growth the API actually reported (4.44M of
5.24M tokens). Code and JSON tokenize denser than prose, which likely explains
the rest. Treat every number here as plus or minus 15%.

Thinking only closes the calibration gap if earlier turns' thinking stays in
context. Without it, the estimates would explain only 62% of observed growth.
So this audit treats retained thinking as an inference from the data, not
something read from a spec.

The transcripts repeat records whenever a session is resumed. The 98 MB
Underworld file holds 22,807 records, of which 14,000 are repeats. Everything
was deduplicated by record id before counting.

The analyzer is `scripts/context-audit/classify.mjs`, which prints every table
below:

```bash
node scripts/context-audit/classify.mjs ~/.claude/projects/C--Users-adamt-Projects-chrysalis*/*.jsonl
```

`--code-dir <regex>` names the project's source tree (the default,
`prototype/`, is Chrysalis's), and `--json <file>` writes the per-segment detail.
`scripts/context-audit/sample.mjs` lists the largest calls under one raw key,
for example `"CW|ledger reads/queries"`, which is how the classification was
spot-checked. Its tests are in `classify.test.mjs`.

## Where a window goes

| Bucket | Share of everything added | Average per segment |
|---|---|---|
| Thinking | 26.5% | 31.8k |
| Harness | 16.0% | 19.2k |
| Centina-mandated | 6.9% | 8.2k |
| Centina-workflow | 19.3% | 23.2k |
| Project | 31.4% | 37.7k |

The per-segment averages include five short single-segment sessions. In the four
long sessions a segment grows by 140–160k tokens before compaction. The
percentages hold up better than the averages.

On top of what's added, every turn carries a fixed prefix of about 42k tokens:
the system prompt and tool schemas, which Centina can't touch. A fresh session
starts at a median of 70k tokens. A compacted one restarts at 88k (range 73k to
104k), because Claude Code puts back the summary, every skill invoked so far,
and the most recently read files. So the 90k floor you see after compaction is
mostly not Centina's doing. Centina's share of it is the re-injected skill
bodies and `STANDING.md`, about 5k tokens.

## Centina-workflow: 19.3%

| Item | Share | Per segment |
|---|---|---|
| Ledger reads and queries | 9.4% | 11.3k |
| Ledger writes (drafts, splice scripts, write-then-check scripts) | 7.3% | 8.8k |
| Checker output | 1.6% | 2.0k |
| Spec reads and edits | 0.7% | 0.9k |
| `ARCHITECTURE.md`, `REALIZE-STATE.md`, ledger-hook output | 0.2% | 0.2k |

Specs and the checker are cheap. The ledger is the cost, and it's expensive
because of how the agent gets at it, not because it reads entries it shouldn't.

**Ledger files outgrew the tools.** `LEDGER-terrain.md` is 1.28 MB and 9,506
lines. `LEDGER-instruments.md` is 237 KB and `LEDGER-sensor-door.md` is 243 KB.
Read caps output by lines, and the terrain ledger has 65 lines over 2,000
characters, the longest at 8,093 (numbered spike paragraphs written as one line
each). One `Read` of 20 lines at offset 9268 returned 40k characters, about
10k tokens. Edit has to read the whole file first, which nobody wants to do to a
1.28 MB file.

**So the agent works around both tools.** For reads, it greps for a heading,
reads a range with `sed`, or writes a `node -e` that parses `LEDGER.json` to pull
one entry. Each of these is improvised fresh every time and often overshoots. For
writes, it drafts the entry in a scratchpad `.md`, then writes a custom `.js` or
`.py` script to splice it in, often with `centina-check ledger` chained on the end.
The entry's text enters context at least twice (draft, then script), and the
scripts themselves are pure overhead. Across the four long sessions the agent
wrote scratchpad scripts named things like `ledger-w2.js`, `dl-edit.js`,
`p7-ratify.js` and `d22apply.py`.

**Entries are big, too.** In `LEDGER-instruments.md` the median entry is about
1.2k tokens, the 90th percentile 2.5k, and the largest 4.4k. Whether they should
be shorter is your call. It's spec meaning, not form.

## Centina-mandated: 6.9%

| Item | Share | Per segment |
|---|---|---|
| Skill bodies re-injected after compaction | 3.0% | 3.6k |
| Reads of plugin docs and `SKILL.md` | 1.5% | 1.9k |
| `STANDING.md`, through the `@import` in Chrysalis's CLAUDE.md | 1.4% | 1.7k |
| Skill body on first load | 0.6% | 0.7k |
| Centina's entries in the skill listing | 0.3% | 0.4k |

**Every invoked skill comes back after every compaction, in full.**
`centina-realize` (19k chars), `centina-iterate` (19.5k) and `centina-spike`
(13.8k) are each re-injected whole, and nothing unloads a skill once its work
is done. In the longest Underworld session, realize and iterate came back
together after 11–12 of its 13 compactions. In two other sessions, spike came
back after four compactions each.

**The setup reads are large, and the agent keeps going back to them.** realize
and spike both start by reading `plugin-setup-procedure.md` (10k chars),
`ledger.md` (30.6k) and `trail.md` (15.7k), and realize adds
`realize-conformance.md`. Those three come to about 14k tokens before any work.
Then, mid-run, the agent goes back with `sed -n` and `grep` to find one
procedure: "Read change-request procedure", "Read trail format reference", "Find
phase-close rules", even `cat SKILL.md | head -250` on a skill that was already
loaded. That's the docs being organized for a first read rather than for lookup.

`STANDING.md` is working as designed. It's 6.6k characters loaded on every turn
and after every compaction. It's worth watching as the goal and rule list grows,
but it isn't a target now.

## Harness: 16.0%

| Item | Share | Per segment |
|---|---|---|
| Reminders, environment and other attachments | 4.8% | 5.8k |
| Compaction summaries | 2.7% | 3.3k |
| Skill listing, non-Centina skills | 2.8% | 3.3k |
| Deferred-tool and MCP listings (Chrome, Docs, app tools) | 2.3% | 2.8k |
| Caveman hooks | 1.8% | 2.2k |
| User CLAUDE.md (mostly the RTK block) | 1.1% | 1.3k |
| serena (tool names and instructions) | 0.4% | 0.5k |
| headroom | 0.1% | 0.1k |

You're already removing caveman and RTK, which frees about 3.5k per segment.

**serena isn't part of Claude Code.** It's a third-party MCP server added at
user scope in `~/.claude.json`, which is why it shows up in every project. Across
all nine Chrysalis sessions it was called zero times, and so was headroom.
Removing them is safe as far as Centina and Chrysalis go, and the savings are
small (about 0.6k per segment). There's a better reason to look at serena,
though. It's launched as `uvx --from git+https://github.com/oraios/serena`,
which fetches and runs whatever is on that repo's default branch at every start,
unpinned. If you don't use it elsewhere, remove it:

```bash
claude mcp remove serena -s user
```

```bash
claude mcp remove headroom -s user
```

The non-Centina skill listing (anthropic-skills, cowork-plugin-management and
so on) costs 3.3k per segment. Disabling plugins you don't use in Chrysalis
would trim it, but that's a preference, not a finding.

## Thinking: 26.5%

The single largest bucket is the model's hidden reasoning, about 32k per
segment. The transcripts redact it, so there's no way to say how much of it is
about Centina's process and how much about acoustics. The only lever is effort
level, and turning it down on spec and ledger work trades away the care Centina
depends on. It's noted here so the other numbers are read in proportion, not as a
recommendation.

## Project: 31.4%

Mostly what you'd expect: reading prototype code and Bash and test output
(17.9k per segment), code and scripts the agent wrote (9.8k), the agent's prose
(3.2k), and the project CLAUDE.md files (3.0k). One oddity is worth a look on
the Chrysalis side. The agent often edits TypeScript through Python or Node
string-substitution heredocs instead of Edit, some of them handling CRLF
explicitly. That's likely a line-ending friction in that repo, and it costs
tokens the same way the ledger splice scripts do.

## What to change, in order

Savings are rough ranges against the per-segment averages above.

1. **Ledger entry commands in the checker.** Add a `centina-check ledger show
   <id>` command that prints one entry (from `LEDGER.json` or by parsing), and
   `ledger add` / `ledger amend <id>` commands that take the entry from a file,
   validate it, splice it in and regenerate. Then have the skills tell the agent
   to use them instead of grep, `sed` or Read. This attacks both of the
   biggest Centina rows at the root: no more improvised lookups, no more splice
   scripts, and the entry text enters context once. Likely 6–10k per segment.
2. **Bound ledger line length.** The checker could flag ledger lines over some
   width, or `ledger add` could wrap on write, so a Read with a line limit
   actually bounds what it returns. It's a small change that keeps the 40k-from-20-lines
   case from happening again. When to partition a 1.28 MB ledger stays the
   human's decision, as `ledger.md` already says.
3. **Split `ledger.md` and `trail.md` into an operating card plus a reference.**
   The card is what the agent needs at the start of every run. The reference is
   in sections with stable headings, which the skill points into by name ("for
   a change request, read the 'Change requests' section of `ledger.md`"). This
   cuts setup reads (about 14k at session start) and turns the mid-run `sed -n`
   hunting into reads of one section. Likely 2–4k per segment, more at session
   start.
4. **Slim the `SKILL.md` bodies.** They come back after every compaction, so each
   kilobyte cut pays off again and again. Keep the operating loop and the gates
   in `SKILL.md` and move worked examples and rationale to docs. Spike, which
   outlives its own use, is the first candidate. Likely 1–2k per segment, more in
   sessions that invoked several skills.
5. **Leave alone:** checker output (2k per segment, and it's the arbiter's
   voice), spec reads (under 1k), `STANDING.md` (doing its job).

Together, items 1 to 4 plausibly take 10–15k out of each segment, about 7–10% of
a long session's growth between compactions. Add the 4k from caveman, RTK,
serena and headroom, and compaction would come noticeably later. It won't stop
happening. Most of the window is thinking and project work, and that's the
work.

## Next

Each change above can be checked with a before-and-after on a fixed task:
a headless `claude -p` run against a throwaway Chrysalis worktree, with
`--plugin-dir` pointed at the Centina checkout under test, measuring the same
buckets with `scripts/context-audit/classify.mjs`. Item 1 is the one worth testing first, since
it's the largest and touches the checker, the skills and `ledger.md` at once.
