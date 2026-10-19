# Core mechanism

### The core mechanism: the typed hole with routing

Centina's central primitive is the **"typed hole,"** a known gap in the design with a route for resolution. A spec is finished not when it has no gaps, but when every gap is *deliberate, typed, and routed*, i.e., deferred to the designer writing the spec, delegated to an agent, referenced from external code, or quarantined behind a boundary. 

Aside: It's worth being aware that "finished" is a relative term. Software design is (potentially) infinitely recursive, and Centina's goal is to help guide you to the balance point between reinventing the wheel (and the laws of physics themselves), and where you can safely stop iterating on your design (at least for now) without coming to regret it later.

The typed holes, enumerated:

| Hole | Spelling | Routing |
|---|---|---|
| deferred decision | `const f = deferred<(a: A) => B>()` | routing itself undecided — the checker flags it (a decision still owed) |
| → routed to this/another spec | `deferred<"spec", F>()` | belongs in a separate `.centina.ts`, part of a larger workflow |
| → left to the implementer | `deferred<"open", F>()` | the planning agent's discretion; not a gap the human must close |
| → held for a human-authored body | `deferred<"unimplemented", F>()` | a real body is owed before planning; a hard stop until filled |
| agent-directed note | `// @agent: ...` / `// @agent(C1): ...` | the coding agent resolves it at spec-iteration or plan-build time; optional label gives it a stable name to reference |
| external | `/** @external "src" */ declare ...` | lives in existing code / an API / an external system |
| boundary | `/** @datasource\|@datasink\|@boundary */ declare class ...` | a declared, black-box data seam; doors are the privileged entry/exit points |

The signature behind a hole is real and participates fully in type checking. Callers are held to it even though nothing exists behind it yet. That is what lets a *consumer* be specified against a seam that has not been built, and built in parallel with it.

Two operating principles that form the foundation:

- **Boundaries model affordances, not transports** — a boundary is a set of
  *doors* (what you can "do" with respect to an interface or boundary), 
  and direction is inferred from each door's return type (`void` = write, 
  non-`void` = read), never from its name.
  See [docs/boundaries.md](boundaries.md).
- **Provenance is bookkeeping, not prohibition.** Every value's origin should
  be *visible* — names must resolve, and every `as` cast is a recorded
  assumption, but the spec-writer is free to assemble records and sketch
  structure without fighting a privilege system.
