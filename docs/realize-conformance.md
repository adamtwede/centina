# Conformance for `centina-realize` fills

The detail behind "Conformance" and the step-close checks in
`skills/centina-realize/SKILL.md`, moved out of the skill because a skill's
text is re-injected after every compaction cut at 20,000 characters, and
what is cut is the end of the file. The skill keeps the rule; this file keeps
the reasons, the failure modes and the recipes. Read it before writing the
first conformance assertion of a session, and again when a fill is a
free-function hole, when a contract is added, split, renamed or removed, and
when a step closes.

## Why `implements` is not enough, and what to write

`implements` does not hold a fill to its contract. TypeScript's function
assignability lets a fill satisfy a spec interface while diverging from it
four ways, none of which produces a diagnostic:

1. dropping a trailing parameter;
2. making a required parameter optional;
3. returning a value where the contract declares `void`;
4. widening a parameter type.

A free-function `deferred` hole is worse: its fill has no `implements`
relation at all, so nothing checks it even in principle.

The consequence, observed rather than theorized: a change request that adds
a required parameter to a door can produce **no build signal whatsoever** —
not a weaker one. The fill keeps compiling because fewer parameters are
assignable, and the call sites keep compiling because they are typed against
the fill class (`new BodyRegistryImpl()`), never against the contract.

So pair each contract with its fill, in the fill's own file, next to the
fill. The pairing is **type-only, in both imports** — `conformance.ts`
emits nothing, and neither does a spec file:

```ts
import type { Assert, Conforms } from "<conformance.ts, path in the run frame>"
import type { BodyRegistry } from "<contracts module>"

export class BodyRegistryImpl implements BodyRegistry { ... }

export type BodyRegistryConforms =
  Assert<Conforms<BodyRegistry, BodyRegistryImpl>>
```

A divergence fails the ordinary typecheck and names the member:

```
error TS2344: Type '"diverges: registerBody"' does not satisfy the constraint 'true'.
```

Notes on using it:

- **`Assert` is the assertion; `Conforms` only computes a verdict.** Three
  ways to write a line that reads like a check and checks nothing:

  ```ts
  type X = Conforms<C, I>              // equals the label. No error.
  type X = Assert<true & Conforms<C, I>>
                                       // `true & "diverges: m"` collapses
                                       // to `never`, which satisfies
                                       // `true`. Silent against a stale fill.
  const x = conforms<C, I>()           // there is no such function; see below.
  ```

  Write `Assert<Conforms<...>>` and nothing else.
- **Nothing in `conformance.ts` is callable, deliberately.** An earlier
  version exported `declare function conforms()`. It type-checked and then
  threw `SyntaxError: Export named 'conforms' not found` the moment a test
  imported a fill, because an ambient declaration emits no binding. The
  type-only form cannot reach runtime at all. If a callable turns up in
  that module again, that is the bug returning.
- **Importing `conformance.ts` directly is not a breach of rule 1.** It
  exports no spec types, only the comparison. Spec types still come through
  the contracts module.
- **A free-function hole is its own contract, reached type-only.**
  `deferred<Kind, F>()` returns `F`, so an exported hole is already a
  nameable type. But reach it through a **type-only namespace import** — a
  spec file has no runtime exports, because `deferred` itself is
  `declare`d, so a value import of the hole resolves to `undefined` and the
  module throws on load. In the contracts module:

  ```ts
  import type * as Ops from "<spec file>"
  export type DelayAndSum = typeof Ops.delayAndSum
  ```

  `export { delayAndSum } from "<spec file>"` and
  `export type DelayAndSum = typeof delayAndSum` both look right and both
  break the build at runtime. Pair the fill the same way as a class fill.
  No spec change is needed.

- **Write the assertion in the same edit as the fill.** Nothing detects a
  missing one (see "Coverage" below).
- **Exactness is the point; do not soften it.** An impl that widens a
  parameter is describing a door the spec does not have. Either narrow the
  impl or raise a change request — deliberate divergence belongs in a
  `@proposal` override, which is already tracked and already goes stale on
  its own. Do not add an escape hatch.
- **It checks shape, never behavior.** A fill that accepts a parameter and
  ignores it conforms. A closing test per step still carries the rest.

## The conformance consequence, for part (c)

Most changes need no edit to a conformance assertion. The assertion names
two types, not their members, and walks the contract at check time — so a
change to a door's parameters makes an existing, untouched assertion start
failing and name the member. Write that in part (c) as the expected signal.

The changes that do touch an assertion are changes to a contract's
_identity_:

- **rename, remove, merge** — the contract's name stops resolving, the
  contracts module breaks, and the assertion breaks with it. Loud.
- **add a contract, or split one in two** — silent. A new contract with no
  assertion is unchecked, and a split leaves the old assertion passing
  against a smaller interface while the members that moved go unwatched.
  Part (c) must name the assertions to add.

List open overrides and catch stale ones with:

```
${CLAUDE_PLUGIN_ROOT}/bin/centina-check ledger <artifactsRoot>/specs/<system> --contracts <contracts module>
```

An override whose change request is `done`, `withdrawn` or `superseded` is an
error until removed. Run this at every step close.

## Coverage

Once an assertion exists, everything it checks is the compiler's work — no
judgment, no heuristic. The one thing that depends on the agent is whether
the line got written at all, and a missing one fails silently: the build
passes.

No generator fixes this. Deriving pairings by scanning for `implements`
inherits the same blind spot, and a free-function fill has no `implements`
to scan for — naming the pairing is the work, not a by-product of it.

So it is a step-close check, alongside the `--contracts` run: **every fill
written or touched in this step has a conformance assertion.** List them in
the step's close.

If a step ever closes with a fill whose assertion is missing, say so and
raise it for Centina itself — that is the event that promotes this from a
process step to a checker rule, and if it never happens the rule was never
needed.

## Positive controls

A check whose failure mode is a **pass** tells you nothing when it is quiet.
A clean run proves the check ran and found nothing only if you have seen it
fail on purpose. This applies to the citation checks and to the conformance
assertions alike: both report by staying silent.

So before you lean on one at a gate, falsify it once. Break a single
citation — retarget an owner to a `done` `W`, or point a guard at a retired
`R` — confirm the error appears, and revert. It costs a minute and it is the
only evidence that "clean" means anything.
