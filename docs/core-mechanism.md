# Core mechanism

## The typed hole

Centina's central idea is the **typed hole**: a gap in the design that you know about, with a declared type and a route for how it will get filled. A spec isn't finished when it has no gaps. It's finished when every gap is deliberate, typed, and routed, meaning each one has been sent somewhere: deferred to the person writing the spec, delegated to an agent, pointed at external code, or quarantined behind a boundary.

Aside: it's worth being aware that "finished" is a relative term. Software design is (potentially) infinitely recursive. Centina's goal is to help you find the balance point between reinventing the wheel (and the laws of physics themselves) and stopping somewhere you can safely leave your design alone (at least for now) without coming to regret it later.

Here are the holes:

| Hole | How you write it | Where it goes |
|---|---|---|
| Deferred, unrouted | `const f = deferred<(a: A) => B>()` | Nowhere yet. You haven't decided how it gets resolved, so the checker warns you that a decision is still owed. |
| Deferred to another spec | `deferred<"spec", F>()` | It belongs in its own `.centina.ts`, as part of a larger workflow. |
| Deferred to the implementer | `deferred<"open", F>()` | It's the planning agent's call. This isn't a gap the human has to close. |
| Deferred for a human-written body | `deferred<"unimplemented", F>()` | A real body is owed before planning can start. The checker errors until it's filled in. |
| Agent note | `// @agent: ...` or `// @agent(C1): ...` | The coding agent resolves it while iterating on the spec or building the plan. The optional label gives the note a stable name you can refer back to. |
| External | `/** @external "src" */ declare ...` | It already exists, in existing code, an API, or some outside system. |
| Boundary | `/** @datasource\|@datasink\|@boundary */ declare class ...` | A declared, black-box seam for data. Its doors are the declared ways in and out. |

The type signature on a hole is real, and it takes full part in type checking. Anything that calls it is held to that signature, even though nothing exists behind it yet. That's what lets you specify a consumer against a seam that hasn't been built, and build the two in parallel.

## Two founding principles

Two principles sit underneath all of this.

**Boundaries model affordances, not transports.** A boundary describes what you can do with something, not how the data gets there. It's a set of *doors*, and whether a door reads or writes is inferred from its return type (`void` means write, anything else means read), never from its name. [Boundaries](/boundaries) covers this in depth.

**Provenance is bookkeeping, not prohibition.** You should always be able to see where a value came from. Names have to resolve, and every `as` cast is recorded as an assumption. But you're free to assemble records and sketch structure without fighting a privilege system to do it. (Centina's predecessor had one, and real use showed it got in the way more than it helped. The story is in [Fit validation](/fit-validation#provenance-is-a-hypothesis-not-an-axiom).)
