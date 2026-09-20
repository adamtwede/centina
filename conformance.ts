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
 * `conforms` closes all four by comparing parameter tuples and return types
 * in BOTH directions, which is exact: tuples of different length, or of
 * different element types, are not mutually assignable.
 *
 * HOW TO USE IT. One assertion per contract/fill pairing, in the fill's own
 * file, next to the fill:
 *
 *   export const bodyRegistryConforms: true =
 *     conforms<BodyRegistry, BodyRegistryImpl>()
 *
 * It is written once and survives every later change to that contract's
 * members — the comparison walks `keyof C` at check time, so a spec gaining
 * a parameter makes an unedited assertion start failing, naming the member:
 *
 *   error TS2322: Type '"diverges: registerBody"' is not assignable to type 'true'.
 *
 * The same call checks a free-function hole's fill, where the contract is
 * the hole's own type (`typeof delayAndSum` — `deferred<Kind, F>()` returns
 * `F`, so an exported hole is already a nameable type; no spec change is
 * needed to reach it).
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
 * Returns `true` when `I` matches `C` exactly, and otherwise a label naming
 * each divergent member — which fails to assign to the `true` annotation on
 * the assertion, putting the member's name in the compiler error.
 *
 * `I extends C` keeps an outright non-assignable fill reporting as an
 * ordinary assignability error rather than as a divergence label.
 */
export declare function conforms<C, I extends C>(): [Divergent<C, I>] extends [
  never,
]
  ? true
  : Divergent<C, I>
