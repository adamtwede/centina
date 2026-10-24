# Concepts

## Centina's answer

### Meaning is the human's, implementation is the agent's

Centina draws a hard line through the planning work.

On one side is meaning and intent, and that belongs to the human. What the data *is*, what shapes it takes, which direction it flows, which decisions get made now and which get deliberately put off. This is the software architect's thinking, and it's exactly the part you can't hand off without letting the entropy described in [Why](/why#the-practical-failure-over-competence) right back in.

On the other side is implementation, and that belongs to the coding agent. *How* the pinned-down intent actually gets carried out (the algorithms, the code, what Centina calls the *realization*) is where the agent is strong, and it's where that strength should be pointed.

The whole medium exists to keep those two apart, continuously, so that by the time an agent starts implementing, there's nothing left for it to invent.

### TypeScript as pseudocode: checked, not compiled

A Centina spec is a valid TypeScript file with the suffix `.centina.ts`, and it imports a small vocabulary module (`centina.ts`). There's no new grammar to learn, which means any editor that understands TypeScript can already parse, highlight, and autocomplete a spec without installing anything.

But the point isn't to compile it, and it isn't to produce code you can run. TypeScript is being used here as rigorous pseudocode. It lets you state structure (names, shapes, arities, directions, contracts) precisely enough for a machine to check, while still reading more like organized prose than a program. When you read a `.centina.ts` file, read it as the author's intent written down in typed declarations, not as code with literal runtime behavior.

> [!CAUTION]
> **A Centina spec is not executable code. Don't run it, don't ship it, and
> don't treat it as an implementation.** It's an "intent-as-code" artifact: its
> whole job is to state design intent precisely, with as little hidden
> ambiguity as possible and every known unknown marked as a routed hole. The
> TypeScript grammar is just a checkable notation for that intent. Function
> bodies, casts, and control flow in a spec are pseudocode showing shape and
> intent, not behavior meant to execute.

Two checkers work together.

The first is `tsc`, run under a deliberately permissive config (`tsconfig.json`). It's kept around for what it's genuinely good at, which is name resolution, arity, and shape, and it's let off the hook for the checks that fight a spec-writer, like unused locals and missing implementations. (`declare` is legal, and encouraged.) A clean `tsc` run is the floor, not the ceiling.

The second is Centina's own spec-plane checker (`checker/`, run with `npm run check`), and this is where the rules that are actually Centina's live. It enumerates the typed holes and checks how each one is routed. It enforces boundary direction. It keeps the books on assumptions, so every `as` cast is on record. It checks naming consistency across the free-text namespaces no compiler looks at. And it checks that each spec says what it's for. The same rules show up live in your editor through a TypeScript language-service plugin, so spec diagnostics appear right alongside `tsc`'s as you type.

> [!IMPORTANT]
> A spec isn't done when it compiles. It's done when **every gap in it is
> deliberate, typed, and routed**: deferred to the human, delegated to an
> agent, referenced from external code, or quarantined behind a boundary.

### The spec is the artifact, and PLAN.md follows from it

A Centina spec is a durable piece of software in its own right, not a throwaway prompt. Once a spec is clean, the implementation plan (`PLAN.md`) should follow from it *pseudo*deterministically (the *details* might differ, but the *meaning* is the same). Hand the same frozen spec to two different agents and they should come back with substantially the same plan, because the meaning has already been pinned down. All that's left is carrying it out, and even that part is well-defined, tightly controlled, and clearly marked.

It helps to think of a Centina spec as "code" for a coding-agent "runtime." The spec is the program, the agent is the interpreter, and PLAN.md and the eventual implementation are the output. Like the forecast cycle in [Why](/why#the-error-floor), this puts a re-grounding checkpoint between intent and implementation, a structured place where accumulated ambiguity gets forced to the surface and corrected before it compounds into code. Every iteration on the spec is one short, verified step.

### Keeping the agent in its lane

For that checkpoint to work, the agent has to stay off the parts that belong to the human. Centina's toolchain enforces this with a few explicit rules of engagement:

- **The agent never decides meaning** (Rule 0). Data nouns, shapes,
  directions, and how deferred holes get resolved are the human's to author.
  The agent supplies the form (skeletons, syntax, holes) and asks questions to
  draw out the rest.
- **The agent helps build the skeleton, not the content.** It can lay down
  typed seams and marked holes, as long as they trace back to something the
  human signed off on. Anything the human *didn't* decide comes out as a routed
  hole, never a plausible-looking fill. A skeleton that's too complete is a
  bug, not a feature.
- **The agent doesn't hold the pen on an existing spec** (Rule 0a). During a
  refinement session it points out decisions and lets the human write them.
  If the human asks it to make the edit anyway, it pushes back once, naming
  the risk that they may be offloading thinking that's meant to stay theirs.
  If they still want it, it goes along.

> [!IMPORTANT]
> The agent is a **scribe, not an architect.** Form is its job. Meaning never
> gets delegated. That separation is what keeps over-competence from getting a
> foothold.

## Caveats

### Who should use it

Anyone can use Centina, but it's not meant for everyone. How much you get out of it is directly proportional to how much software design and engineering experience you bring to it.

> [!WARNING]
> Inexperienced developers may find Centina frustrating. It will ask you to
> think carefully about details that can seem abstract, tedious, and pedantic.
> It will push back on choices that don't line up with decisions you made
> earlier. Most annoyingly, it will refuse to do your thinking for you. That's 
> also its best feature.

**Note:** Centina specs are written in TypeScript, but that does **not** mean Centina is only for TypeScript or JavaScript projects, or only for web apps. TypeScript was chosen as the spec language because its type system is incredibly robust (practically a language of its own) and expressive, and its popularity is a huge bonus. A capable agent has no trouble understanding that the **target** language isn't the same as the **spec** language, and that the two are connected by intent, not execution.

In short, a Centina spec can target any language. That choice gets made at implementation time, not in the spec and not during planning. Centina deliberately stays out of choosing your technologies (more on that below).

### When to use it (and when not to)

Centina isn't a good fit for every problem, but it's ideal for a lot of them. Here's a quick rundown.

Best fit:

- new projects of moderate-to-high complexity
- new features of moderate-to-high complexity in existing projects
- new features of moderate-to-high complexity in under-development projects

Likely fit:

- full rewrites of major components in existing projects
- ground-up rewrites of existing projects
- refactors of large or complex, highly-decoupled components in existing projects

Unlikely fit:

- small or simple projects with low complexity and/or few unknowns, or that tread well-established ground
- small or simple maintenance tasks in existing projects
- refactors of large or complex but highly-coupled components in existing projects
- projects or solutions with a lot of implementation (heavy computation) and not much structure (little in the way of business rules or interactivity)

> [!TIP]
> If you're not sure whether your problem is a good fit, start an agent session
> inside a clone of the Centina repo and ask. The repo carries plenty of
> context for your agent to help you make the call.

### What Centina most definitely isn't for

Centina can't, or at least shouldn't:

- help you decide which technologies to use in your project
- help you implement a complex algorithm
- help you write software you yourself don't adequately understand or can't specify
- tell you what good software architecture actually looks like, or how to develop it

> [!CAUTION]
> Centina can't replace your brain or your experience. (That's what standard
> agent planning sessions are for 😉)
>
> Centina is extra leverage for the experience and competence you *already
> have* as a software engineer, with all that implies.
