# Why

## Why this exists

### The error floor

Start with what an AI model *is*. A coding agent is a pattern-recognizer trained on enormous quantities of noisy, chaotic data. That training is what makes it powerful, and it is also what makes it, formally, a **chaotic system**, one whose outputs are exquisitely sensitive to conditions we can neither fully specify nor fully observe. Chaotic systems have a property that
no amount of engineering removes: a **floor on how much error you can eliminate**. However sophisticated the model becomes, some irreducible error remains in its outputs in the aggregate.

Two consequences follow, and they compound each other:

1. **As outputs grow more sophisticated, their errors grow harder to
   detect.** A crude mistake announces itself. A subtle one, a plausible
   assumption, a quietly-wrong edge case, an interface that is *almost*
   right, hides inside work that otherwise reads as correct. The better the
   model, the more its errors look like competence.

2. **Undetected marginal errors compound invisibly** until they cross a
   visibility threshold, at which point the failure is finally obvious, but
   its *origin* is not. By then it may be genuinely intractable to trace where
   the error started, and any attempt to correct it manually or with an agent
   risks introducing still more error. You are debugging accumulated drift,
   not a bug.

How to live with this is an open question, but other disciplines that grapple with chaotic systems offer a cue. Consider the **n-body problem** in astrophysics: how bodies move under their mutual gravitation. For three or more bodies there is no general analytical solution. The problem is worked **numerically**, which means it is solved again and again over short intervals of time, re-grounding the trajectory at every step so that error never has room to grow large before it is corrected. There is no closed form that gets you to the answer in one leap; there is only the discipline of taking small, verified steps.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="/error-floor-dark.svg">
    <img src="/error-floor.svg" width="720"
         alt="Two paths cross the same distance. A single heroic leap from prose to code drifts steadily out of the tolerance corridor as error compounds; a path of small verified steps, each re-grounded back toward the center, stays bounded within the corridor.">
  </picture>
</p>

The wager of Centina is that the new human–agent coding paradigm needs some form of the same discipline: **frequent, structured re-grounding of intent against a checkable artifact, before error has room to compound** — not one heroic prompt that leaps from idea to implementation.

### The practical failure: over-competence

That abstract problem has a very concrete daily face in agentic coding, and it is not incompetence. It is **over**competence.

Hand a capable model a problem and it will go and solve it, often by making assumptions, filling gaps, and generating structure you did not expect, intend, or want. Models have gotten better at asking questions, and planning modes have grown more capable, but there is a ceiling on what conversational prose can carry. Past a certain complexity, prose is simply not a precise enough medium to *design* a solution in. It smooths over exactly the seams where intent and implementation diverge, and it lets the agent quietly introduce **latent technical entropy**, decisions that look settled but were never actually made by a human that will not surface as a problem until much later, when it is far more expensive to address.

**A single sentence can demonstrate the problem**. Picture a planning conversation settling on *"the dashboard shows the user's most recent order."* It reads like a decision, but it is three undecided ones in a trench coat: what happens when the user has **no** orders (the empty case), whether *"recent"* sorts by when the order was created or when it was last touched, and whether a draft or cancelled order counts as an order at all, a question about the *shape* of the thing. Even if the agent asks for clarification, conversational prose, even interspersed with structured outputs, obfuscates meaning and intent, which will end up accumulating the longer the session and the more complex the design becomes. The agent wants to be helpful, so it will let you sail past critical questions over meaning and intent, answering them silently and plausibly the moment it drafts an implementation plan or writes code; none was ever the human's call, and each is far, far cheaper to uncover during early design than to reverse-engineer from later failures.

The insidious part is that a fluent agent's confabulated architecture looks *identical* to an elicited one. A clean, plausible, well-shaped design disguises which parts were the human's conviction and which were the agent's guess. The human then ratifies a coherent picture, half of which they never decided, and the entropy is baked in before a line of real code exists.

This is the compounding-error problem arriving one prompt at a time. It demands an approach that harnesses what the model is genuinely good at without handing it the one thing it should not hold: authority over *meaning*.

---

## The goals (the invariant everything else serves)

The four goals are the project's *only* invariant; every rule and primitive is a means under test against them. Note that each is **comparative**. The baseline is conversational prose. Centina produces structured, rule-checked pseudocode that:

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

A good planning-mode conversation and a Centina spec both aim to align a human
and an agent before code is written. The difference is what each *leaves
behind* and where the authority sits:

| | Planning-mode conversation | Centina spec |
|---|---|---|
| **What it leaves behind** | a transcript in a scrollback — it evaporates | a durable, versioned, mechanically checked artifact a fresh agent picks up cold |
| **The meaning/impl line** | the agent can smuggle a decision into fluent prose, unnoticed | anything the human didn't decide is a *visible hole* the checker won't pass as resolved |
| **Deferral** | "we'll figure it out later" is a dropped thread | a typed hole with an explicit route, tracked in a ledger until it's closed |
| **Re-grounding** | a matter of remembering to be careful | structural — the n-body discipline, correct-before-compounding, built in |

For an experienced developer this is leverage, not overhead: it is a way to
**keep a powerful coding model appropriately restrained while still harnessing
its strengths**, and thereby to raise the ceiling on the software they can
reliably produce with it.

---
