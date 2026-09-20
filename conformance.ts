/**
 * Build-plane conformance assertions.
 *
 * This module is NOT spec vocabulary — nothing here appears in a
 * `.centina.ts` file. It sits beside `centina.ts` because it ships and
 * installs the same way, and it is imported by implementation code in a
 * `centina-realize` build tree.
 *
 * WHY IT EXISTS. `implements` does not hold a fill to its spec contract.
 * TypeScript's function assignability lets a fill satisfy a contract while
 * diverging from it in four ways, all silent:
 *
 *   1. dropping a trailing parameter;
 *   2. making a required parameter optional;
 *   3. returning a value where the contract declares `void`;
 *   4. widening a parameter type.
 *
 * And a free-function `deferred` hole has no `implements` relation at all,
 * so nothing checks its fill even in principle.
 *
 * `Conforms` closes all four by comparing parameter tuples and return types
 * in BOTH directions, which is exact: tuples of different length, or of
 * different element types, are not mutually assignable.
 *
 * IT IS PURELY TYPE-LEVEL, DELIBERATELY. Nothing here emits, so a build
 * tree that carries assertions pulls no runtime dependency on this file:
 * `bun build` on a fill that asserts contains no reference to this module
 * at all. An earlier version exported `declare function conforms()`, which
 * type-checked and then threw `SyntaxError: Export named 'conforms' not
 * found` the moment any test imported a fill — an ambient declaration emits
 * no binding. Do not reintroduce a callable here.
 *
 * HOW TO USE IT. One assertion per contract/fill pairing, in the fill's own
 * file, next to the fill, reached by a TYPE-ONLY import:
 *
 *   import type { Assert, Conforms } from "<path to this file>"
 *
 *   export type BodyRegistryConforms =
 *     Assert<Conforms<BodyRegistry, BodyRegistryImpl>>
 *
 * It is written once and survives every later change to that contract's
 * members — the comparison walks `keyof C` at check time, so a spec gaining
 * a parameter makes an unedited assertion start failing, naming the member:
 *
 *   error TS2344: Type '"diverges: registerBody"' does not satisfy the constraint 'true'.
 *
 * `Assert` IS THE ASSERTION; `Conforms` only computes a verdict. Two ways
 * to write a line that reads like a check and checks nothing:
 *
 *   type X = Conforms<C, I>          // equals the label. No error.
 *   type X = Assert<true & Conforms<C, I>>
 *                                    // `true & "diverges: m"` collapses to
 *                                    // `never`, which satisfies `true`.
 *                                    // Passes silently against a stale fill.
 *
 * The same pairing checks a free-function hole's fill, where the contract
 * is the hole's own type (`typeof delayAndSum` — `deferred<Kind, F>()`
 * returns `F`, so an exported hole is already a nameable type; no spec
 * change is needed to reach it). Reach the hole type-only as well: a spec
 * file has no runtime exports either.
 *
 * KNOWN LIMITS. It checks shape, never behavior: a fill that accepts a
 * parameter and ignores it conforms. That is a test's job. It also compares
 * only the last signature of an overloaded member, and it says nothing
 * about members the fill has and the contract does not.
 */

/** Mutual assignability. Exact where a one-way `extends` is not. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type AnyFunction = (...args: never[]) => unknown

/**
 * Functions compare by parameter tuple and return type; everything else
 * compares directly.
 */
type SameMember<I, C> = C extends AnyFunction
  ? I extends AnyFunction
    ? Exact<Parameters<I>, Parameters<C>> extends true
      ? Exact<ReturnType<I>, ReturnType<C>>
      : false
    : false
  : Exact<I, C>

/**
 * The contract members `I` fails to match, as a union of labels. `never`
 * when the fill conforms. A function contract has no keys to walk, so it is
 * compared whole.
 */
type Divergent<C, I extends C> = C extends AnyFunction
  ? SameMember<I, C> extends true
    ? never
    : "diverges: signature"
  : {
      [K in keyof C]-?: SameMember<I[K], C[K]> extends true
        ? never
        : `diverges: ${K & string}`
    }[keyof C]

/**
 * `true` when `I` matches `C` exactly, otherwise a label naming each
 * divergent member. This is a verdict, not an assertion — wrap it in
 * `Assert` to turn a divergence into a compiler error.
 *
 * `I extends C` keeps an outright non-assignable fill reporting as an
 * ordinary constraint violation rather than as a divergence label.
 */
export type Conforms<C, I extends C> = [Divergent<C, I>] extends [never]
  ? true
  : Divergent<C, I>

/**
 * The assertion. A divergence label does not satisfy `true`, so the error
 * lands on the type alias that names the pairing, and carries the member.
 */
export type Assert<T extends true> = T
