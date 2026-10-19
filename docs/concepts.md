# Concepts

## Centina's answer

### The responsibility split: meaning is the human's, implementation is the agent's

Centina draws a hard line through the planning work:

- **Meaning and intent belong to the human.** *What* the data *is*, the shapes
  it takes, the directions it flows, which decisions are made and which are
  deliberately deferred. This is the human software architect's thinking, and
  it is precisely the part that cannot be delegated without reintroducing the
  entropy above.
- **Implementation belongs to the coding agent.** *How* the pinned intent is
  carried out (the algorithms, the code, aka the *realization*) is where the agent's strength lives
  and where it should be pointed.

The whole medium exists to keep those two separated *continuously*, so that by the time an agent is implementing, there is nothing left for it to invent.

### TypeScript as pseudocode, checked for meaning, but not compiled

A Centina spec is a **valid TypeScript file** (suffix `.centina.ts`) that imports a small vocabulary module (`centina.ts`). There is no new grammar, so every editor on earth already parses, highlights, and completes a spec with no extension installed.

But the point is not to compile it, and not to produce executable code. TypeScript is used here as a **rigorous pseudocode**, a way to state structure (names, shapes, arities, directions, contracts) precisely enough that a machine can check it, while reading like organized prose rather than a program to run. Read a `.centina.ts` file as *authorial intent expressed in typed declarations*, not as code with literal runtime semantics.

> [!CAUTION]
> **A Centina spec is not executable code — do not run it, ship it, or treat it
> as an implementation.** It is a formal *semantic descriptor* for a piece of
> software's design and architecture: an **"intent-as-code" artifact** whose
> whole purpose is to state design intent precisely, with hidden ambiguity
> minimized and every known unknown surfaced as a marked, routed hole. The
> TypeScript grammar is a checkable notation for that intent, nothing more; the
> function bodies, casts, and control flow are pseudocode illustrating *shape
> and intent*, not runtime behavior to be executed.

Two checkers cooperate:

- **`tsc`, run under a deliberately permissive config** (`tsconfig.json`),
  kept for what it is genuinely good at — name resolution, arity, shape — and
  relieved of the duties that fight a spec-writer (unused locals, missing
  implementations; `declare` is legal and encouraged). A clean `tsc` run is
  the necessary floor, not the ceiling.
- **The Centina spec-plane checker** (`checker/`, `npm run check`), which
  layers the rules that are actually Centina's: enumerating typed holes and
  their routing, enforcing boundary direction, assumption-bookkeeping on `as`
  casts, naming-consistency on the free-text namespaces no compiler validates,
  and a "does this spec say what it is for" explanation check. The same rules
  surface live in the editor through a TypeScript language-service plugin, so
  spec diagnostics appear alongside `tsc`'s as you type.

> [!IMPORTANT]
> A spec is not "done" when it compiles. It is done when **every gap in it is
> deliberate, typed, and routed** — deferred to the human, delegated to an
> agent, referenced from external code, or quarantined behind a boundary.

### The spec as a first-class artifact, and PLAN.md as its near-deterministic output

A Centina spec is a durable software artifact in its own right, not a throwaway prompt. Once a spec is clean, the implementation plan (`PLAN.md`) should follow from it *nearly deterministically*; two agents handed the same frozen spec should produce substantially the same plan, because the meaning has already been pinned and only the carrying-out is left, which itself is well-defined, tightly-controlled, and clearly marked.

It is useful to think of a Centina spec as **"code" for a coding-agent "runtime."** The spec is the program; the agent is the interpreter; PLAN.md and the eventual implementation are its output. And like the n-body integrator above, this puts a **re-grounding checkpoint** between intent and implementation: a structured place where accumulated ambiguity is forced to
the surface and corrected *before* it compounds into code. Every iteration on the spec is one short, verified step.

### The restraints on the agent

For that checkpoint to work, the agent has to be kept off the parts that are the human's. Centina's toolchain enforces this through explicit rules of engagement:

- **The agent never decides meaning** (Rule 0). Data nouns, shapes,
  directions, and the resolution of deferred holes are the human's to author.
  The agent supplies *form* — skeletons, syntax, holes, and elicits the rest
  with questions.
- **The agent helps generate the skeleton, not the content.** It may lay down
  typed seams and marked holes that trace to something the human ratified;
  anything the human did *not* decide comes out as a routed hole, never a
  plausible fill. An over-complete skeleton is the bug, not the feature.
- **The agent does not hold the pen on an existing spec** (Rule 0a). During a
  refinement session it surfaces decisions and lets the human write them; if
  asked to edit anyway, it pushes back once (naming the risk that the human may
  be offloading thinking meant to stay theirs), then complies if they persist.

> [!IMPORTANT]
> The agent is a **scribe, not an architect.** Supplying *form* — skeletons,
> syntax, holes — is its job; authoring *meaning* is never delegated. That
> separation is the mechanism that keeps over-competence from getting a
> foothold.

## Caveats

### Who should use it

Anyone can use Centina, but it's not intended for everyone. The value you can expect to get out of Centina is directly proportional to the amount of software design and engineering expertise you bring.

> [!WARNING]
> Inexperienced software developers may find using Centina to be a frustrating
> experience. It will ask you to think carefully about details that may seem abstract,
> tedious, and pedantic. It will push back on choices that don't seem consistent with
> earlier decisions. It will refuse to do your thinking for you.

**Note:** The fact that Centina emits spec artifacts in Typescript does **not** imply it can be used only for Typescript or Javascript projects, or even only for web-based applications. The choice of using Typescript as the spec-language is simply due to its incredibly robust type system (practically a separate language in its own right), and its expressiveness (its widespread popularity is also a huge bonus). A capable agent should have no trouble understanding that the **target** language is not the same as the **spec** language, and that the two are related in terms of intent, not execution.

To summarize: Centina specs can be used for any target language, and that choice would be specified at implementation time, not in the spec itself or during planning phases (as mentioned elsewhere, Centina deliberately avoids specifying the technologies used for implementation).

### When to use it (and when not to)

Centina isn't a good fit for every problem, but is ideal for many. Here's a quick rundown.

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
- projects or solutions with a high level of implementation (lots of computation) and a low level of structure (little in the way of business rules or interactivity)

> [!TIP]
> If you're not sure if your problem is a good fit for Centina, simply start your agent 
> session from within this project and ask. The project is loaded with plenty of context
> for your agent to help you make an assessment.


### What Centina most definitely isn't for

Centina can't, or at least shouldn't:

- help you decide which technologies to use in your project
- help you implement a complex algorithm
- help you write software you don't understand or can't specify
- tell you what good software architecture actually looks like, or how to develop it

> [!CAUTION]
> Centina cannot replace your brain or your experience. (That's what 
> standard agent planning sessions are for 😉) 
> 
> Centina is extra leverage for the experience and competence 
> you *already possess* as a software engineer, with all that implies.
