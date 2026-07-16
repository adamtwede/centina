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
 * An opaque domain noun, an unshaped type: a named thing the spec talks about without committing
 * to its shape. The brand makes it nominal — a `Unshaped<"Step">` cannot be
 * confused with a `Unshaped<"Feedback">`, and no ordinary object accidentally
 * satisfies either. Where a value of a Unshaped type enters the spec, it must come
 * from a declared source (a door, an external, an Agent cast) — that entry
 * point is the provenance record.
 */
declare const shape: unique symbol
export type Unshaped<Name extends string> = { readonly [shape]: Name }

declare const contract: unique symbol
/**
 * A named, invocable capability the spec's `Agent` can call — a "skill" in the
 * tool/skill sense, distinct from a raw `prompt`. Its two type parameters are
 * its *contract*, declared once here and enforced at every call site:
 *
 *   - `In` — a tuple of the skill's input types (e.g. `[Formula, FormulaType, ...]`).
 *   - `Out` — the type the skill produces.
 *
 * "Type-parameters-as-contract": `In`/`Out` don't describe runtime enforcement
 * (the agent running the skill can always ignore them — see the callback form
 * on `invokeSkill`). They're a spec-plane declaration of what this skill
 * consumes and produces, so that `invokeSkill` can *bind* to them. Pass a
 * `Skill<In, Out>` as `invokeSkill`'s first argument and both parameters are
 * inferred from it: the remaining inputs are checked against `In`, and the
 * result is typed `Out`, with no explicit type arguments and no per-call cast.
 *
 * This is where the bookkeeping lives. A raw `prompt` returns `unknown` and the
 * author records the shape assumption with an `as` at each call (see `Agent`).
 * A skill's shape assumption is recorded *once*, at this declaration, and every
 * `invokeSkill` call reuses it — the declaration is the single provenance
 * record, so two call sites of the same skill cannot silently disagree about
 * its shape.
 *
 * `name` identifies the skill; `uri` locates it (absent = local project scope).
 * `In`/`Out` are phantom — carried by the `[contract]` field purely so they
 * have a structural footprint to infer from — so a plain `{ name }` literal,
 * annotated with the contract, is a complete `Skill`.
 */
export type Skill<In extends unknown[] = [unknown], Out = unknown> = {
  name: string
  uri?: string
  readonly [contract]?: (inputs: In) => Out // phantom: never assigned; exists only so In/Out have a structural footprint and can be inferred from a Skill value at the invokeSkill call site.
}
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
 * `invokeSkill` follows a different convention: it receives a variable number of inputs as
 * `In[]` and returns output `Out`, the actual types of which are inferred
 * automatically from the type parameters of the `Skill` passed as the first argument, effectively aligning
 * `invokeSkill` to the shape of the given Skill's input-output contract, allowing
 * a spec to describe the intentions and expectations of an agent skill through the pairing. For example:
 * ```
    enum FormulaType { MATHEMATICAL, CHEMICAL, UNKNOWN }

    const formulaExplanationSkill: Skill<[Formula, FormulaType], string> = {
                      // skill input types   ^   and   ^            ^ output (return) type
      name: "formula-explanation-skill",
    }

    const someFormula = agent.prompt("Generate a random formula.") as Formula
    const explanation = agent.invokeSkill(formulaExplanationSkill, someFormula, FormulaType.UNKNOWN)
 * ```
 * In binding this invocation of `invokeSkill` to `formulaExplanationSkill`, the type of the second argument 
 * (`someFormula`, the first 'input'), is expected to be `Formula`, and the third argument (`FormulaType.UNKNOWN`, the second 'input'),
 * is expected to be `FormulaType`. By the same mechanism, it is expected to return a `string`. 
 * This is all inferred directly from `formulaExplanationSkill`'s definition when it becomes the first argument 
 * to `invokeSkill`. 
 * 
 * `invokeSkill` comes in two forms: the bare form, and the callback form. 
 * In the bare form, the method simply returns `Out` as shown above, but in 
 * the callback form, `Out` is instead passed to a callback function of type 
 * `(output: Out) => void` (which is the second argument to `invokeSkill` in 
 * this form) instead of returned from `invokeSkill` itself, which returns 
 * `void` in this form. 
 * 
 * The callback form is useful for when a spec wants to describe a scenario in which the agent running 
 * the skill may choose to skip rendering an opinion on the output of the skill, and thus not invoke 
 * the callback at all. It is therefore important to only use the callback form if you understand that 
 * it implies that sort of discretion on the part of the agent running the skill.
 * 
 * The `Model` parameter carries provenance of the agent's identity: an
 * `Agent<ModelId>` constructed with a `ModelId` yields that same `ModelId`
 * back from `.modelId` with no cast needed.
 */
export declare class Agent<Model = string> {
  constructor(model: Model)
  readonly modelId: Model
  /** The model's own capability/spec sheet, usable in prompt construction. */
  readonly specification: string
  prompt(text: string): unknown
  review(subject: unknown, criteria: string): unknown
  invokeSkill<In extends unknown[], Out>(
    skill: Skill<In, Out>,
    ...inputs: In
  ): Out
  invokeSkill<In extends unknown[], Out>(
    skill: Skill<In, Out>,
    callback: (output: Out) => void,
    ...inputs: In
  ): void
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
