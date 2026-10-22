# Vocabulary

The typed hole gets most of the attention, but a spec uses a handful of other primitives too. They come in two kinds. Some are **domain content**: they describe the real system the spec is about. Others are **authoring markers**: notes addressed to the checker and the coding agent, which are never part of what the spec models. All of them are ordinary TypeScript, and you can see the whole vocabulary in one place in [centina.ts](https://github.com/adamtwede/centina/blob/main/centina.ts).

## Domain content: describing the system

### `Unshaped<Name>` — an opaque domain noun

`Unshaped` is for a thing the spec talks about without committing to what it looks like. The brand makes it a purely named, or *nominal*, type. An `Unshaped<"Formula">` can never be mistaken for an `Unshaped<"Feedback">`, and no ordinary object will satisfy either one by accident. A value of an `Unshaped` type can only get into the spec through a declared source (a door, an `@external`, or an `Agent` cast), and that entry point is its record of where it came from.

```ts
type Formula = Unshaped<"Formula">
// A Formula can't be conjured out of a literal. It has to arrive from a
// declared source, like the agent below, where the `as` records the shape
// assumption.
```

### `Agent<Model>` — the model a spec talks to

`Agent` is the one boundary Centina ships ready-made. Its `prompt` and `review` methods return `unknown`, so every time you call one, you record the shape you're assuming the answer has with an `as`. Again, that's bookkeeping, not prohibition. The `Model` parameter carries the agent's identity through without a cast: an `Agent<ModelId>` hands the same `ModelId` back from `.modelId`.

```ts
const agent = new Agent(ModelId.CLAUDE_OPUS)
const someFormula = agent.prompt("Generate a random formula.") as Formula
//                                                             ^ recorded assumption
```

> [!IMPORTANT]
> `Agent` is the model the *finished system* will talk to at runtime. It is
> **never** the coding agent helping you write the spec. That second channel,
> the one you use while authoring, is the `@agent:` comment further down. Same
> word, unrelated concepts.

### `Skill<In, Out>` — a delegated capability with a contract

A `Skill` is a named capability the spec's `Agent` can invoke, as opposed to a raw `prompt`. Its type parameters are its contract. You declare them once, and they're enforced at every call site: pass the `Skill` as the first argument to `invokeSkill`, and the remaining arguments are checked against `In` while the result comes back typed as `Out`, no cast needed. With a raw `prompt`, the shape assumption gets recorded at every call. With a skill, it's recorded once, where the skill is declared, so two call sites can't quietly disagree about its shape.

```ts
// skill declaration:
const explain: Skill<[Formula, FormulaType], string> = { name: "formula-explanation" } // `name` corresponds to actual skill name that agent can invoke
//           input types ^   and   ^           ^ output type

// skill usage:
const explanation = agent.invokeSkill(explain, someFormula, FormulaType.UNKNOWN)
//              skill (from declaration) ^          ^ input (Formula)   ^ input (FormulaType)
// `explanation` is typed as string, from the output type
```

## Authoring markers: notes for the checker and the agent

### `deferred<…>()` — the typed hole

The signature is real and type-checks its callers. What varies is the routing. A bare `deferred` means the routing is still owed, and the checker warns about it. The three kinds settle it. (The full table is in [Core mechanism](/core-mechanism#the-typed-hole).)

```ts
const score  = deferred<(step: Step, output: string) => Score>()   // routing owed → warning
const rank   = deferred<"spec", (c: Candidate[]) => Candidate>()   // its own spec, unwritten
const decide = deferred<"open", (node: Node) => Decision>()        // implementer's discretion
const lookup = deferred<"unimplemented", (n: Name) => Row>()       // hard stop until a body exists
```

### `@external "src"` — a reference into existing code

A plain `declare`, tagged with where it comes from. The declaration is where your assumption about the outside world gets recorded, and call sites then use the declared type without a cast. This is the primary way of connecting your spec to existing code or APIs. Point `src` at the artifact (library file, REST endpoint, whatever) and define the subordinate operation by symbol name and mock its signature. It can be any machine-readable symbol. It doesn't need to be exact, it just needs to be complete enough for an agent to find it and wire it up during later spec sessions or implementation.

```ts
/** @external "node:crypto" */
declare function randomUUID(): string
```

A more comprehensive treatment would be to wrap your `@external`s in a boundary (see below) to fully namespace the external system and give it a data-flow direction (source, sink, or both).

### `@datasource`, `@datasink`, `@boundary` — boundaries

A boundary is a declared, black-box seam for data, written as a JSDoc tag on a `declare class`. Direction is inferred from each door's return type (`void` means write, anything else means read), never from its name. A `@datasource` is read-only, a `@datasink` is write-only, and a `@boundary` goes both ways. [Boundaries](/boundaries) has the full design.

```ts
/** @datasource The store of placed orders. */
export declare class OrderStore {
  readMostRecent(customer: string): RecentOrder // non-void ⇒ a read door
}
```

### `@agent:` and `@agent(label):` — a note to the coding agent

This is the channel between you and whichever agent is running a spec-writing session with you. A note gets resolved while you're iterating on the spec or when the plan is built, and it's never part of the spec's domain content. An optional label gives the note a stable name you can refer to later. In a system with a [ledger](/ledger), the label is the note's ledger entry (for example `@agent(Q3)`), and the checker requires that entry to exist.

```ts
// @agent(C1): confirm whether a cancelled order needs its own banner before planning.
```
