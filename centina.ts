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
 * A typed hole with deliberately unresolved *routing*: the author knows this
 * operation's signature but has not yet decided whether it belongs in this
 * spec, in a separate spec, or should be left to a coding agent's runtime
 * judgment (e.g. a direct agent prompt). The routing decision is made during
 * the iterate loop, not at authoring time.
 *
 * Usage:
 *   const score_attempt = deferred<(step: Step, output: string) => Score>()
 *
 * The signature is real and participates fully in type checking — callers are
 * held to it even though nothing exists behind it. The checker enumerates all
 * `deferred` holes; a "clean" spec is one with no *unmarked* gaps, not one
 * with no gaps.
 */
export declare function deferred<F extends (...args: never[]) => unknown>(
	note?: string,
): F

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
export declare class Agent<Model = unknown> {
	constructor(model: Model)
	readonly model_id: Model
	/** The model's own capability/spec sheet, usable in prompt construction. */
	readonly specification: string
	prompt(text: string): unknown
	review(subject: unknown): unknown
}
