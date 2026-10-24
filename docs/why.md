# Why

## Why this exists

### The error floor

Start with what a coding agent actually does when you hand it a task. It reads what you wrote and produces the most plausible program it can that fits. The trouble is that prose almost never pins down a single program. Every sentence admits several readings that are all consistent with everything you said, and some of the questions it raises are ones you haven't answered yet, even in your own head. The agent has to pick anyway, and change a word of the prompt and it may well pick differently. It can't tell a decision you made from one you never got around to, because the difference isn't in the text.

That's where the floor comes from. A better model makes better guesses, but a guess at a decision nobody made is still a guess, and no amount of capability recovers information that was never in the input. However sophisticated the model gets, some error will always remain in what it produces. Not because the model is weak, but because the job, as posed, is underdetermined.

Two related things follow, forming a deleterious feedback loop:

1. As the outputs get more sophisticated, the errors get harder to spot. A crude mistake announces itself. A subtle one doesn't. A plausible assumption, an edge case that's quietly wrong, an interface that's *almost* right: these hide inside work that otherwise reads as correct. Perversely, the better the model, the more its errors look like competence.

2. These uncaught errors compound. Each guess becomes context for the next one, so later work gets built on top of decisions nobody checked, invisibly, until it crosses some threshold where the failure is finally obvious. The failure is obvious by then, but where it came from is not. It may be impossible in practice to trace where the error started, and every attempt to fix it, by hand or with an agent, risks adding more. At that point you aren't debugging, you're sifting a mountain of accumulated drift.

So how do you live with that? Other fields have been living with a version of this problem for a long time, and weather forecasting is the clearest example. In the 1960s Edward Lorenz found that even a simple model of the atmosphere is chaotic: tiny differences in the starting conditions grow until, a week or two out, the forecast is worthless. A better model pushes that horizon back, but it can't remove it. So forecasters don't try for one perfect run. Every few hours they fold fresh observations of the real atmosphere back into the model (the field calls this data assimilation) and pull the forecast back toward what's actually happening before the error has room to grow.

Notice what does the correcting. It isn't another model run. Running the same model many times tells you how uncertain you are, but every run shares the same blind spots, so none of them can pull the others back toward the truth. Only a reading from the real thing can do that.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="/error-floor-dark.svg">
    <img src="/error-floor.svg" width="720"
         alt="Three paths cross the same distance. A single heroic leap from prose to code drifts steadily out of the tolerance corridor as error compounds; an army of agents fans out into many paths that scatter out of the corridor in different directions, including agents that try to ground their neighbors but do so against their own drift; a path of small verified steps, each re-grounded back toward the center, stays bounded within the corridor.">
  </picture>
</p>

Centina is a bet that coding with agents needs that same discipline, and that the real thing, here, is you. Your intent is the only place where what you meant actually lives. Not one heroic prompt that leaps from idea to implementation, or an army of agents in the hopes they can keep each other out of trouble (they're all missing the same information, so the best they can do is ground each other against their own drift), but frequent, structured readings of what you meant, taken against something that can be checked, before the errors have room to grow beyond the dragons at the edge of the map.

### The practical failure: over-competence

In day-to-day agentic coding, that abstract problem has a very concrete face, and it isn't incompetence. It's over-competence.

Hand a capable model a problem and it will go solve it, usually by making assumptions, filling in gaps, and building structure you didn't expect, intend, or want. Models have become proficient at asking questions, and planning modes have gotten better, but there's a hard teleological ceiling on what conversational prose can carry. Past a certain level of complexity, prose just isn't precise enough to design a solution that satisfies the original intent. It smooths over exactly the joints where what you meant and what gets built start to drift apart, and it gives the agent room to quietly introduce latent technical entropy: decisions that look settled but were never actually made by a human, and that won't surface as problems until much later, when it may be more expensive to fix them than to simply start over.

A single sentence is enough to show the problem. Picture a planning conversation that settles on "the dashboard shows the user's most recent order." It reads like a tidy decision in a tuxedo, but it's actually three gremlins in a trench coat. What happens when the user has no orders? Does "recent" mean when the order was created, or when it was last touched? And does a draft or a cancelled order count as an order at all? (That last one is a question about the shape of the thing, not just how it behaves.)

Even if the agent stops to ask for clarification, a conversation, even one with structured output mixed in, blurs meaning and intent, and the blur gets worse the longer the session runs and the more complex the design gets. Context grows, you and the agent forget earlier decisions, miss a crucial detail without realizing it, and rot sets in. The agent wants to be helpful, so it will let you sail right past important questions and then answer them itself, silently and plausibly, the moment it drafts a plan or writes code. The human never made any of those calls. Each one would have been far cheaper to catch during early design than to reverse-engineer later from whatever broke.

The insidious part is that an architecture a fluent agent made up looks identical to one it drew out of you. A clean, plausible, well-shaped design doesn't tell you which parts were the human's conviction and which were the agent's guess. So the human signs off on a coherent picture, half of which they never decided, and the entropy is baked in before a single line of real code exists.

This is the compounding-error problem again, arriving one prompt at a time. What it calls for is a way to use what the model is genuinely good at without handing it the one thing it shouldn't have: **authority over meaning**.

## The goals

These four goals are the only things in the project that aren't up for negotiation. Every rule and every primitive is mechanical leverage to reach them. Notice that each goal is comparative. The baseline is conversational prose. Centina produces structured, rule-checked pseudocode that:

1. makes it easier for a human to describe and understand a complex coding
   task, at a given level of detail, to themselves and other humans, than
   conversational prose;
2. makes it more likely that unknowns, ambiguities, and oversights are caught
   during spec-writing and review rather than surviving into implementation;
3. makes it more likely that a coding agent produces an implementation plan
   that accurately reflects the spec-writer's intention;
4. provides a foundation to iterate on, before and after planning and
   implementation.

*Bonus: a spec is a self-documenting record for future reference.*

## What this offers over planning-mode conversation

A good planning conversation and a Centina spec are after the same thing: getting a human and an agent on the same page before any production code is written. The difference is what each one leaves behind, and who holds the authority.

|                           | Planning-mode conversation                                          | Centina spec                                                                                            |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **What it leaves behind** | A transcript in your scrollback. It evaporates.                     | A durable, versioned, mechanically checked artifact that a fresh agent can pick up cold.                |
| **Who decides meaning**   | The agent can slip a decision into fluent prose and nobody notices. | Anything the human didn't decide shows up as a visible hole, and the checker won't pass it as resolved. |
| **Deferral**              | "We'll figure it out later" becomes a dropped thread.               | A typed hole with an explicit route, meticulously tracked in a ledger until it's closed.                |
| **Re-grounding**          | Depends on remembering to be careful.                               | Built into the structure. It's the forecaster's discipline: take a fresh reading before error compounds.                   |

For an experienced developer, this isn't overhead. It's leverage. It's a way to keep a powerful coding model on a short leash while still using everything it's good at, and blows the ceiling off what you can build.
