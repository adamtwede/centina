// centina.ts — the Centina spec vocabulary.
//
// A Centina spec is a valid TypeScript file (suffix `.centina.ts`) that imports
// this module. Nothing here is new grammar: every primitive is ordinary typed
// TypeScript, so any editor parses, highlights, and completes a spec with no
// extension installed. The Centina checker (not yet built — see ROADMAP.md)
// layers spec-plane rules on top; tsc, run permissively, contributes name
// resolution, arity, and shape checking.
//
// Boundary roles are declared with JSDoc tags on `declare class` declarations
// in the spec itself (no import needed):
//
//   /** @datasource */  — read-only: every door returns data
//   /** @datasink */    — write-only: every door returns void
//   /** @boundary */    — both directions over the same resource
//
// Direction is inferred from each door's return type (void = write, non-void =
// read), never from its name. See docs/boundaries.md for the design rationale
// (affordances, not transports), which carries over from AISL v0 unchanged.
//
// External references (the "lives in existing code / an API / a system"
// routing of a hole) are plain `declare` statements tagged with
// `/** @external "<source>" */`. The declaration site is where the assumption
// about the outside world is recorded — call sites then use the declared type
// with no cast.

/**
 * An opaque domain noun: a named thing the spec talks about without committing
 * to its shape. The brand makes it nominal — a `Noun<"Step">` cannot be
 * confused with a `Noun<"Feedback">`, and no ordinary object accidentally
 * satisfies either. Where a value of a Noun type enters the spec, it must come
 * from a declared source (a door, an external, an Agent cast) — that entry
 * point is the provenance record.
 */
declare const shape: unique symbol
export type Noun<Name extends string> = { readonly [shape]: Name }

/**
 * A typed hole's resolution state, given as the first type argument:
 *
 *   - `"unimplemented"` — must have a real function body before planning can
 *     begin; the checker treats this as an error, a hard stop.
 *   - `"spec"` — routed to a separate `.centina.ts` spec that doesn't exist
 *     yet (part of a larger Centina-driven planning workflow).
 *   - `"open"` — left to the implementing agent's discretion when the plan is
 *     written; not a gap the human needs to close.
 *
 * Leaving the kind off entirely (`deferred<F>()`) means routing itself is
 * still undecided — the checker flags that as a warning, distinct from the
 * three resolved kinds above (which it reports as info/error, not "please
 * resolve this").
 */
export type DeferredKind = "unimplemented" | "spec" | "open"

/**
 * A "typed hole" with variable *routing* resolution: the author knows this
 * operation's signature but has not yet decided whether it belongs in this
 * spec, in a separate spec, or should be left to a coding agent's runtime
 * judgment (e.g. a direct agent prompt). The routing decision is made during
 * the iterate loop, not at authoring time.
 *
 * Usage:
 *
 * ```
 *   const score = deferred<(step: Step, output: string) => Score>() // unresolved, emits a warning
 *   const rank = deferred<"spec", (c: Candidate[]) => Candidate>() // warrants a separate, unwritten spec
 *   const decide = deferred<"open", (node: Node) => Decision>() // left to the discretion of the planning agent
 *   const lookup = deferred<"unimplemented", (n: Name, t: Table) => Row>() // emits an error until function has a body
 * ```
 *
 * The signature is real and participates fully in type checking — callers are
 * held to it even though nothing exists behind it. The checker enumerates all
 * `deferred` holes; a "clean" spec is one with no *unmarked* gaps, not one
 * with no gaps.
 */
export declare function deferred<F extends (...args: never[]) => unknown>(
  note?: string,
): F
export declare function deferred<
  Kind extends DeferredKind,
  F extends (...args: never[]) => unknown,
>(note?: string): F

/**
 * The one boundary Centina ships pre-built: a model the spec converses with.
 * `prompt`/`review` return `unknown` — the author must cast the result to give
 * it a shape, and every such `as` is a recorded assumption (bookkeeping, not
 * prohibition).
 *
 * The `Model` parameter carries provenance of the agent's identity: an
 * `Agent<ModelId>` constructed with a `ModelId` yields that same `ModelId`
 * back from `.model_id` with no cast needed.
 */
export declare class Agent<Model = string> {
  constructor(model: Model)
  readonly modelId: Model
  /** The model's own capability/spec sheet, usable in prompt construction. */
  readonly specification: string
  prompt(text: string): unknown
  review(subject: unknown, criteria: string): unknown
}

// `Agent<Model>` / `.prompt()` / `.review()` are domain content: they describe
// the *real system the spec is about* prompting or judging an LLM agent at
// runtime, once the spec becomes an implementation. This is unrelated to the
// `@agent:`-tagged comments documented at the top of this file and in
// centina-iterate's SKILL.md, which are spec-authoring-time metadata — a
// direct channel between the human writing the spec and whichever coding
// agent is helping them write it. Never conflate the two: an `Agent` value in
// a spec's pseudocode is never the coding agent reading the spec, and an
// `@agent:` note is never describing the runtime system's behavior.
