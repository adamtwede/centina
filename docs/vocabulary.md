# Vocabulary

### The vocabulary, primitive by primitive

The typed hole is the centerpiece, but a spec is written in a handful of other primitives too. They fall on the two sides of the responsibility split: some are **domain content** (they describe the real system the spec is about), and some are **authoring markers** (metadata addressed to the checker and the coding agent, never part of what the spec models). Each is ordinary TypeScript.

To view the whole vocabulary in code, see: [centina.ts](centina.ts).

#### Domain content — describing the system

**`Unshaped<Name>` — an opaque domain noun.** A named thing the spec talks about without committing to its shape. The brand makes it a pure named, or *nominal*, type: an `Unshaped<"Formula">` can never be confused with an `Unshaped<"Feedback">`, and no ordinary object accidentally satisfies either. A value of an `Unshaped` type can only enter the spec from a declared source (a door, an `@external`, an `Agent` cast) — and that entry point *is* its provenance record.

```ts
type Formula = Unshaped<"Formula">
// A Formula can't be conjured from a literal; it must arrive from a declared
// source — here, the agent below, where the `as` records the shape assumption.
```

**`Agent<Model>` — the model a spec converses with.** The one boundary Centina ships pre-built. `prompt`/`review` return `unknown`, so the author *records the shape assumption* with an `as` at each call. This is bookkeeping, accounting, not prohibition. The `Model` parameter carries the agent's identity with no cast: an `Agent<ModelId>` hands the same `ModelId` back from `.modelId`.

```ts
const supervisor = new Agent(ModelId.CLAUDE_OPUS)
const someFormula = agent.prompt("Generate a random formula.") as Formula
//                                                             ^ recorded assumption
```

> [!IMPORTANT]
> `Agent` (a value in the spec's pseudocode) is the *runtime* model the finished
> system will converse with — **never** the coding agent helping you write the
> spec. That second, spec-authoring channel is the `@agent:` comment below.
> Same word, unrelated concepts.

**`Skill<In, Out>` — a delegated capability with a declared contract.** A named, invocable capability the spec's `Agent` can call — distinct from a raw `prompt`. Its type parameters *are* its contract, declared once and enforced at every call site: pass the `Skill` as `invokeSkill`'s first argument and the remaining inputs are checked against `In` while the result is typed `Out`, with no cast. Unlike a raw `prompt` (whose `as` is recorded per call), a skill's shape assumption is recorded *once*, at the declaration — so two call sites can't silently disagree about its shape.

```ts
const explain: Skill<[Formula, FormulaType], string> = { name: "formula-explanation" }
//                  ^ input types            ^ output
const text = agent.invokeSkill(explain, someFormula, FormulaType.UNKNOWN) // : string
```

#### Authoring markers: metadata for the checker and the agent

**`deferred<…>()` — the typed hole.** The signature is real and type-checks its callers; the *routing* is what varies. Bare means routing is still owed (a warning); the three kinds resolve it (see the table above).

```ts
const score  = deferred<(step: Step, output: string) => Score>()   // routing owed → warning
const rank   = deferred<"spec", (c: Candidate[]) => Candidate>()   // its own spec, unwritten
const decide = deferred<"open", (node: Node) => Decision>()        // implementer's discretion
const lookup = deferred<"unimplemented", (n: Name) => Row>()       // hard stop until a body exists
```

**`@external "src"` — a reference into existing code.** A plain `declare` tagged with its source. The declaration site is where the assumption about the outside world is recorded; call sites then use the declared type with no cast.

```ts
/** @external "node:crypto" */
declare function randomUUID(): string
```

**Boundaries — `@datasource` / `@datasink` / `@boundary`.** A declared, black-box data seam, spelled as a JSDoc tag on a `declare class`. Direction is inferred from each door's return type — `void` = write, non-`void` = read — never from its name (`@datasource` = read-only, `@datasink` = write-only, `@boundary` = both). See [docs/boundaries.md](boundaries.md).

```ts
/** @datasource The store of placed orders. */
export declare class OrderStore {
  readMostRecent(customer: string): RecentOrder // non-void ⇒ a read door
}
```

**`@agent:` / `@agent(label):` — a note to the coding agent.** The spec-authoring channel between you and whichever agent is running a session
with you, to be resolved at spec-iteration or plan-build time, never part of the spec's domain content. An optional label gives a note a stable name to reference later. In a system with a ledger ([docs/ledger.md](ledger.md)), the label is the note's ledger entry, e.g. `@agent(Q3)`, and the checker requires that entry to exist.

```ts
// @agent(C1): confirm whether a cancelled order needs its own banner before planning.
```
