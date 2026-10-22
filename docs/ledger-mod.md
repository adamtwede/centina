# The ledger mod

The [ledger](/ledger) is where a Centina session keeps its decisions, and it gets long. A mature one runs to hundreds of entries, and the agent cites them as it works ("per `terrain:P12`, we cap the depth at three"). That's fine for the agent, which can look the entry up. It's harder on you. You're reading a reply that leans on three labels you half remember, and the only way to find out what they say is to go digging through a markdown file.

The ledger mod fixes that. It's a small Claude Code mod that ships inside the Centina plugin and draws a band just above your prompt, listing the ledger entries the agent cited this turn, with a row of buttons for asking a model what's going on. It works in the terminal and in the desktop app.

It's display only. Nothing in the skills or the checker depends on it, so if it never loads, or you hide it, Centina works exactly the same. It reads the ledger and never writes to it.

## What you see

Say the agent's latest reply mentions `terrain:P12` and `terrain:W44`. Above your prompt you get a header line, then one row per citation:

```text
Ledger entries cited this turn  [Hide] [Break it down ($)] [Phase progress ($$)] [Item progress ($$)] [Second opinion ($$$)] ◆ [Work item tracker]
Item terrain:W44: 31k chars, 6 findings, 12 days; closed 5 of its kind: median 9k chars and 4 findings, largest 22k
terrain:P12  ratified: cap escalation depth at 3 attempts   [Open] [ELI5]
terrain:W44  active: tune the erosion pass                   [Open] [ELI5]
```

The buttons come and go with what the ledger holds, so you won't always see all of them. A row shows the label as the agent wrote it, the entry's status, its title, and anything worth knowing at a glance: a successor if the entry was superseded (`-> terrain:P19`), or what a parked entry is waiting on (`parked until ...`). The band shows the first six rows and says how many more there are. It folds away with **Hide** and unfolds with **Show**, and the next reply unfolds it again on its own.

Two kinds of row are flagged in red. `not in any ledger` means the agent cited a label that resolves nowhere, which is worth a second look, since a made-up or mistyped label is exactly the kind of error the ledger exists to catch. `no such part` means the entry exists but has no part with that letter (`terrain:P12(c)` when P12 only has (a) and (b)).

**Open** jumps to the entry's heading in VS Code. **ELI5** asks a model to explain that one entry, which is covered below.

## How it finds your ledger

The mod doesn't parse the markdown. It reads `LEDGER.json`, a machine-readable view that `centina-check ledger` generates next to `LEDGER.md` (the mod runs in a sandbox with no Node, so it can't import the checker's parser). At session start it walks your project root looking for folders that hold a `LEDGER.json`, going six levels deep and skipping dot-folders, `node_modules`, `archive` and `transcripts`. If a reply cites a label that resolves nowhere, it walks again in case a ledger was created since, but not more often than every thirty seconds.

That has one consequence worth knowing. `LEDGER.json` is only as fresh as the last checker run. In Claude Code a hook runs the checker after every Write, Edit or MultiEdit inside a system folder, so normally it's current. If you've set `ledgerHook` to `off` in `.centina/config.json`, or the agent appended an entry through the shell (which the hook doesn't see), the band can be a step behind. Run `centina-check ledger <system folder>` and it catches up. ELI5 notices a stale file on its own: it refuses to explain an entry whose heading is no longer at the line `LEDGER.json` recorded, and tells you to regenerate.

## What counts as a citation

A label has a scope, a letter and a number: `terrain:P12`. The letter says what kind of entry it is (A axiom, P proposal, Q question, F finding, O option, W work item, G goal, R standing rule; [the ledger page](/ledger#letters-and-statuses) has the statuses for each). You can add a part, `terrain:P12(a)`, and a system prefix when you're citing across systems, `underworld/terrain:P12`.

The mod only picks up the qualified form. A bare `P12` in a reply is ignored, because that pattern turns up in prose all the time (test names, model numbers). The agent is supposed to write the qualified label anyway, per the ledger's own rules. If the same label exists in two systems, you get a row for each, with the system name shown.

## The buttons that ask a model

Everything below runs a one-off model call from inside the mod. These calls have no session history, nothing is written to your transcript, and the model has no tools, so it works only from what the mod hands it: the reply, the ledger entries around it, and in one case your last request. It can't read your code. The answer appears in a pane beside the chat, with a **Copy response** button (useful in the desktop app, where you can't select the text). Press another button and the new question replaces the old one. An identical question asked twice in a session gets the cached answer, so a repeat press costs nothing.

The dollar signs on the labels are relative cost, not prices: one for Haiku, two for Sonnet, three for Opus. Reasoning counts against the same token cap as the answer, so the heavier buttons spend more than their answers look like they should.

| Button | Model | Shows when | What you get |
|---|---|---|---|
| ELI5 (per row) | Haiku | a row resolved | Plain-words explanation of one entry |
| Break it down ($) | Haiku | the reply is over 150 words | Gist, jargon glossed, options weighed |
| Phase progress ($$) | Sonnet | some phase is `active` | Progress, remaining work, direction |
| Item progress ($$) | Sonnet | some work item is `active` | The line of inquiry so far |
| Second opinion ($$$) | Opus | the reply is over 50 words | A critical review of the reply |

If your organization restricts which models Claude Code may use, a button whose model is blocked fails with "The opus call failed" and the reason. Nothing else is affected.

### ELI5

The small one. It takes the entry's own text from the markdown ledger, plus the titles of up to eight other entries it mentions, and asks Haiku to explain it as if to a five-year-old. The length is a guide that grows with the entry, between 150 and 450 words. If you cited a part (`P12(b)`), it's asked to say what that part decides. Use it when a label comes up and you've lost the thread.

### Break it down

This one works on the whole latest reply rather than a single entry, and it's the button for "I've read this twice and still don't follow." It returns up to three parts, each only when the reply gives occasion for it. The **Gist** is what the reply says and what it asks of you. **Terms** glosses any jargon you wouldn't know, including everyday words used in a project-specific sense. **Options** appears when the reply puts a choice to you: for each option, what choosing it means, the benefits, tradeoffs and risks, weighed against the active phase and the project's goals, and which one the agent itself leaned toward.

The model sees the reply, the active phase, the active goals and the entries the reply cites, in that order of priority. The entries get their full text until a 20,000-character budget runs out, and only titles after that. Unlike the other buttons it also shows for a reply that cites nothing, so long as the mod has found a ledger.

### Phase progress

A phase is a work item with `Kind: phase`, and while it's `active` this button asks Sonnet how far it has got. You get **Progress** (what the phase set out to do against its definition of done, and what's finished), **Remaining work** (each open item with its status and what it's waiting on), and **Direction** (which open items still matter and which could slip, weighed against the phase's goal and the project's). Open items are sent in full while the budget lasts, closed ones by title.

It only knows which items belong to a phase through their `Phase` header, so a phase with no items pointing at it can't be reported on. The button says so instead of paying for an empty answer.

### Item progress

Phase progress shows each entry's oldest few thousand characters, which is the wrong end of a long spike. A work item that's been appended to for weeks starts with its plan and ends with where it stands, and the plan is the part you already know. Item progress exists for that case.

It reports on one work item, chosen in this order: the one you pinned with `/track-item` (below), else the first active work item the latest reply cites, else the end of the active `Depends-on` chain (an active item no other active item depends on). The model gets the item's start, one shortened line per paragraph of the middle so no stage of the work drops out, and the end in full, plus the titles of the entries that cite it as a premise, what it depends on, its phase and the goals. You get **Original question** (what it set out to settle, and whether it ever stated a closing test), **Path so far**, **Progress** (closer, level or further, in the item's own numbers where it gives them), and **Options**: continue, back out to a named earlier point, or park.

### Second opinion

The expensive one. It sends Opus your last typed request, the latest reply and the same ledger context as Break it down, and asks for a review in three parts: **Errors and flaws**, **Gaps and risks**, **Improvements**, most serious first, with "None found." where a part is empty.

Two things to keep in mind. The reviewer can't see your code, so it can argue with the reasoning and the fit against the ledger but not with a claim about what the code does; it's told to say what would need checking instead of asserting. And the answer isn't sent anywhere on its own. It sits in the pane until you decide, and **Send to session** hands it to the main agent as a message from the plugin (not as your own words), prefaced with a note that the reviewer had partial context and the agent should weigh the review, not adopt it. The button disappears once pressed, so an answer goes in once.

## The drift line

While a work item is active, a line under the header says how big it's got. It shows the item's size in characters, how many entries cite it as a premise, its age in days, and what the closed items of the same `Kind` in that system look like: their median size and finding count, and the largest. It turns yellow ("Long-running") past three times the median size and red past the largest closed item. With fewer than three closed items to compare against, it shows the facts and no color.

It uses size because it's the one measure that separates a runaway from a big item that closed fine. A long spike with a lot of findings is normal, but one several times bigger than anything you've ever closed is worth a look. It's a flag for attention and not a verdict, since a long item can still be producing, and it costs nothing: no model call. Item progress is handed the same line as plain facts.

## Pinning an item: `/track-item`

The band picks the current work item itself, and a reply that happens to cite an older item can pull it off the one you're actually working on. `/track-item` settles it.

```text
/track-item terrain:W44    pin the band and the tracker to that item
/track-item 44             the same, when only one ledger has a W44
/track-item auto           let the band choose again
/track-item                say what's tracked, and whether it's pinned
```

If a bare number matches items in more than one ledger, it asks for the full label. A pin that stops resolving (the entry was renamed or removed) is ignored rather than leaving the band empty, and a pinned line starts with "Pinned" in place of "Item".

## The work item tracker

When a system has a `TRAIL.jsonl`, the band also shows **Work item tracker**, marked with a cyan ◆. The [trail](/trail) records the options the agent offered you at each decision and which you took. This button builds the picture of it. It brings the checker's install up to date (a no-op when nothing has changed), runs `centina-check trail` for the tracked item, and opens the resulting `TRACKER.html` in your browser.

If the checker can't run, it opens the last page it generated and says why in a toast. The very first time, the mod needs one session start to learn where the checker lives, because the install hook records that location for it. If the trail has errors, the page is still written and the toast tells you to read them.

### What the page shows

The page is about one work item, named at the top, and its numbers (the tiles, the gates, the standing alternatives, the table) are that item's. The menu switches to another item, or to all of them.

The main picture is the tree of decisions. At each one, the option you took continues the line, and the ones you didn't take hang off it as stubs. A stub is grey, orange when it was a stop or a return, blue when you took it up later, dashed and labeled when it's parked, struck through when it was abandoned, and ticked when it's done. A diamond marks a checkpoint, and a ring marks a decision still waiting on your answer. Each node has its decision's id beside it (`d14`, with its options `d14.1` and so on), so an id you see in a hover can be found on the page. The ledger entries a decision cites are links that open in VS Code.

Usually a decision follows from the one just above it. When it doesn't, a purple arrow runs from it to the decision whose option it follows. A dashed arrow means the work went back to an earlier option. A dotted one means several consecutive decisions were asked together from the same option, and each of them, the first included, gets its own arrow. Hover an arrow to see what it follows, and it thickens along with its target.

A segment's length is the weight of the work after that decision, and you can switch it between active time and output tokens. Two panels sit collapsed below the tree. **Standing alternatives** lists the options that were offered and never taken, merged across decisions by `revives` or by their words, with how often and when each was offered, how much work has gone by since the first offer, and its state. **Gates** shows each gate's readings against its tolerance, and whether the latest one moved toward it or away. Among the tiles are "steps that read a gate" and "steps since a gate was last read".

### Where the weights come from

The weights come from your session transcripts. A plugin hook copies each session's transcript to `<system-dir>/transcripts/<session-id>.jsonl`, and the tracker reads the ones for the sessions the trail names. It reads only each message's time and output-token count, never the text. An assistant message is counted once, and a gap of more than ten minutes counts as you being away. The work after a decision runs from your answer to it until your answer to the next one.

The transcript copies are big (Underworld's come to 127 MB), so they're gitignored. Each time `centina-check trail` writes the page, it also writes `<system-dir>/weights/<session-id>.json` for every session the trail names, holding just the time and output tokens of each message. For all of Underworld that's about 190 KB. Those files are committed, and the page is rebuilt from them when the transcripts are gone, on a fresh clone or when you come back to the work long after. A session's file is replaced only when its transcript holds more messages, so it never shrinks. With neither a transcript copy nor stored weights, the page says so and draws the segments unweighted.

## Setup

There isn't any beyond installing the plugin. The mod is declared in the plugin's `hooks/hooks.json` and loads with it, so [installing Centina](/install-claude-code) is enough. Mods are a Claude Code feature; if your build doesn't load them, you simply won't see the band.

Two things make it more useful. Run a session-zero, iterate or realize session so there's a `LEDGER.json` for it to find. And keep `ledgerHook` at its default so the file stays current.

A few edges: the band follows the main agent's replies only, not a subagent's, and `/clear` resets it. On Windows and Linux, **Open** relies on `code` being on your PATH, since the fallback that opens a `vscode://` link only exists on macOS.

## If you're changing the mod

The source is `hooks/register.tsx` (the band, the buttons and the model calls) and `hooks/ledger-cite.ts` (the pure half: finding citations, resolving them, building prompts), with prompt budgets in `hooks/budget.ts`. The citation pattern in `ledger-cite.ts` is a copy of the checker's, because the mod can't import it, so a change to the grammar has to be made in both. A test in `checker/ledger/ledger.test.ts` compares them. [Contributing](/contributing) has the commands to run before you hand a mod change over.
