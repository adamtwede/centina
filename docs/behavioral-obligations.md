# Behavioral obligations: design

**Status:** agreed in a design session on 2026-10-24. Not built. The
signature was prototyped against tsc 6.0.3 (below); nothing else exists yet.
Sequenced against the head-to-head experiment in "Sequencing".

Origin: an outside architecture review of Centina (2026-10-23) observed that a
contract can type-check while leaving its most important behavior unanswered:

```ts
interface PaymentProcessor {
  charge(account: Account, amount: Money): Receipt
}
```

Idempotency, retries, partial failure, duplicate charges: none of it is in the
signature, and nothing in Centina asks.

## Purpose

A behavioral obligation is **a hole for behavior**: a property a door or hole
owes that its signature can't express. It is declared at the seam it belongs
to, named, and routed, and the checker holds the route to account and notices
when it goes stale. That is the move Centina already makes for every other
gap: make it visible, name it, route it, keep the books.

**The checker never verifies the property.** Verification is the job of
tests, and tests belong to `centina-realize`. The spec layer's job is to make
sure the question was asked, answered or deliberately handed off, and that
whatever claims to verify it is still pointed at something real.

Out of scope, deliberately: a language of preconditions, postconditions and
invariants. It would make Centina a weaker Dafny, and it would cost G1
(legibility) on every door that carries one.

## Where behavior lives today

| Where | What it carries | Checked? |
| --- | --- | --- |
| Shape: `Result` unions, nominal `Unshaped`, a required key parameter | Behavior forced into structure | Yes, by tsc |
| Filled bodies | Flow | Names and types only; logic errors pass (the hill-climbing loop's double-run, `head-to-head.md`) |
| Comments, `@agent:` notes | Anything | No |
| `R` entries, `Enforced-by` | Rules for the whole system | `Enforced-by` is free text; the checker never resolves it |
| Guard citations from build code | A guard enforcing an `R` | For staleness only |
| Realize closing tests | One test per step | Linked to no property |
| Conformance assertions | Shape of a fill against its contract | Shape only; a missing assertion goes unnoticed |

The gap is narrow. Nothing names a behavioral question at the door it belongs
to, nothing enumerates such questions, and nothing links a test to the
property it verifies.

## Shape first

If a type can carry it, a type should, and then no obligation is needed: the
type is the record. But a type carries a *decision* far more often than a
*guarantee*. A required `IdempotencyKey` makes idempotency possible and forces
every caller to supply a key; whether the implementation deduplicates is still
behavior. A `RecentOrder | NoOrders` return forces the empty-case decision;
whether the code returns `NoOrders` at the right moment is still behavior.
That is why there is no `"shape"` route (see "Routes").

## The primitive

Declared in `centina.ts`, alongside `deferred`. Two forms, one for a door on a
boundary class and one for a free-function hole:

```ts
obligation(Door, "member", statement, route?)
obligation(hole, statement, route?)
```

```ts
/** @boundary @external "stripe" The payment provider. */
export declare class PaymentProcessor {
  charge(key: IdempotencyKey, account: Account, amount: Money): ChargeResult
}

const chargeOnce = obligation(PaymentProcessor, "charge",
  "a retry with the same key returns the first Receipt and debits once", "test")
const providerDedupes = obligation(PaymentProcessor, "charge",
  "the provider rejects a reused key with a different amount", "assumed")
const chargeSerial = obligation(PaymentProcessor, "charge",
  "concurrent charges on one account are serialized") // unrouted: warning

const runStep = deferred<"spec", (step: Step) => Outcome>()
const neverRepeats = obligation(runStep,
  "a step marked complete is never re-attempted", "test")
```

**The door is a typed reference, so tsc resolves it.** Rename or remove
`charge` and the obligation stops compiling, the same bookkeeping that keeps an
`@external` declaration honest. The member argument is limited to methods by
a mapped type, so a field can't be passed as a door.

**The route goes last and is optional.** With the route first and optional,
`obligation(P, "charge", "test")` would type-check both as "route `test`,
statement forgotten" and as "the statement is the word *test*". With the route
last, three arguments always means unrouted and four always means routed
(two and three for the hole form). This differs from `deferred`, whose kind
comes first; the ambiguity is why.

**Prototype.** Against tsc 6.0.3, the sketch below accepted the valid calls
above and rejected a misspelled member (`"chrage"`), a misspelled route
(`"tset"`) and a field passed as a door:

```ts
export type ObligationRoute = "spec" | "open" | "test" | "assumed"
declare const obligationBrand: unique symbol
export type Obligation = { readonly [obligationBrand]: true }

type Door = abstract new (...args: never[]) => unknown
type Hole = (...args: never[]) => unknown
type DoorKey<I> = { [P in keyof I]: I[P] extends Hole ? P : never }[keyof I] & string

export declare function obligation<C extends Door, K extends DoorKey<InstanceType<C>>>(
  door: C, member: K, statement: string, route?: ObligationRoute): Obligation
export declare function obligation(
  hole: Hole, statement: string, route?: ObligationRoute): Obligation
```

## Routes

| Route | Meaning | Checker |
| --- | --- | --- |
| *(none)* | The behavioral question is named; nobody has decided where its answer comes from | warning, like a bare `deferred` |
| `"spec"` | Answered in another spec | info |
| `"open"` | The implementer's call; the spec owes nothing | info |
| `"test"` | Decided; the statement is the answer, and realize owes a test that cites it | see "Verification citations" |
| `"assumed"` | Decided; it holds because something outside the system guarantees it | listed with the assumption bookkeeping; error unless the door is `@external` |

For `"test"` and `"assumed"` the statement is an answer. For an unrouted,
`"spec"` or `"open"` obligation it may still be a question. The checker can't
tell the two apart; the skills keep them straight.

**Why no `"shape"` route.** A `"shape"` obligation would be one of two things.
Redundant, when the type fully carries the property: delete the obligation and
let the type be the record. Or falsely reassuring, when the type carries only
part of it and the rest needs a test. Recording why a parameter exists belongs
in the statement of a `"test"` obligation.

**Why `"assumed"`.** "The provider deduplicates on the key" is a real and
common answer that isn't the system's to test, and often can't be without a
sandbox. It is an assumption about the outside world, the same kind of record
as an `as` cast or an `@external` declaration, so it is reported with them.

**`"assumed"` is allowed only on `@external` doors.** On a door the system
fills itself, `"assumed"` would be a way to skip the test, so it is an error
there. `@external` is the existing marker for "we don't own this", and nothing
in the checker can tell a terminal boundary from an internal one. A provider
boundary that should carry assumed properties is tagged `@external` as well:
`boundaryDirection` and `boundaryDependency` filter tags by name, so the extra
tag doesn't disturb them. The check must read the tag from the door's own
declaration, not with the file-wide regex `holeEnumeration` uses to find
externals.

## Verification citations

A test cites the obligation it verifies with a comment tag, anywhere under
the system's `buildRoots`:

```ts
// @verifies payments#chargeOnce
test("a retried charge with the same key debits once", () => { ... })
```

Severity, for a `"test"` obligation:

- **info** while the door has no fill, or its member is still unbuilt (its
  final `throw` names an owner, per `ledger.md`, "Citations from build code");
- **warning** once the member is built and no `@verifies` cites the
  obligation, and listed at realize's step close;
- **error** for a `@verifies` whose label doesn't resolve, or names an
  obligation not routed `"test"`.

This copies the ownership-citation pattern: a missing owner is a warning, a
wrong label is an error.

Class fills are found as they are now, through `implements` and the contracts
module. Free-function fills are found through their conformance assertion.
A free-function fill with no assertion reports nothing: the same gap
`realize-conformance.md` admits under "Coverage", and closed when that one is.

**The checker can't judge a test.** A `"test"` obligation backed by a weak test
reads as covered. Realize's destructive-test rule (a test that fails if the
code cheats) applies to every obligation test, and the skill says so. And the
coverage check reports by staying quiet, so before relying on it, falsify it
once, as `realize-conformance.md`'s "Positive controls" asks.

## Labels

`<spec basename>#<const name>`, for example `payments#chargeOnce`.

- `#` follows JSDoc's `Class#member` naming convention, and never matches the
  ledger's `scope:Label` pattern (`checker/ledger/parse.ts`), so no ledger
  tool or lint mistakes one for the other.
- An obligation must be bound to a `const`, whose name is its label. An unbound
  `obligation(...)` call is an error.
- A door may carry any number of obligations.

## Door questions

Elicitation, in `centina-session-zero` (the seam phase) and `centina-iterate`.
The skills prompt by door direction:

- **write door:** what a repeat call does, what partial failure looks like,
  whether order matters;
- **read door:** the empty case, and how stale the answer may be.

Asked once per door, and only where the answer would change the contract. A
question left unanswered is recorded as an **unrouted obligation**, so it is a
visible hole the checker warns about until it is routed, not an item lost in
the conversation. `"open"` is the one-word way to hand it off.

No checker rule requires a door to carry obligations. A checklist turns
elicitation into a form, and a form gets rubber-stamped, which is the failure
Centina exists to prevent.

These questions are elicitation, not machinery: whatever is derived from the
skills' conversation rules (the head-to-head's ablation arm, for one) would
inherit them.

## Ledger

No new letter. The spec holds the current state; the ledger holds where it came
from, the same split as contracts.

- A decided obligation (`"test"` or `"assumed"`) gets a ratified `P`, and the
  obligation's comment cites it, as spec comments already cite ledger labels.
  A skill rule, not a checker rule, since some specs have no ledger.
- An `"assumed"` obligation resembles an `A` (its authority comes from outside
  the project), but an `A` is a quantitative value with a sourced range. They
  stay separate.
- A property that holds across the whole system stays an `R`.

## Traces

Deferred until the hill-climbing probe (`head-to-head.md`) has run. A trace
for one door (input, then expected output) is easy to type. A trace for a flow
needs mocked collaborators, call sequences and recursion, which is a test
framework inside the spec layer: a large design, and a G1 cost. The most
valuable use, `centina-iterate` walking a body against traces, works on prose
traces.

So the probe's traces are written free-form, and these are decided from what
they needed:

- whether traces get a typed form at all;
- whether they attach to obligations, or to doors and holes directly, with
  obligations citing them. A flow trace describes a hole as a whole, which
  argues for the second.

## Sequencing

The head-to-head runs against Centina frozen at a git tag (`head-to-head.md`,
"Arms"), so building obligations can't contaminate its treatment. Hence:

- the obligation core (the primitive, routes, `@verifies`, the checks, the door
  questions) doesn't depend on the probe and can be built whenever;
- traces wait for the probe;
- the head-to-head's next round adds a C-with-obligations arm, which tests
  obligations as an ablation of their own;
- building the core early also lets Underworld use it for real.

## Build list

1. `centina.ts`: `obligation`, `ObligationRoute`, `Obligation`, with the header
   comment documenting the routes.
2. A checker rule (`obligation-routing`): enumerate obligations, apply each
   route's severity, enforce `"assumed"`'s `@external` restriction, error on an
   unbound call. The TS plugin picks it up with the other spec-plane rules.
3. Verification citations: collect `@verifies` under `buildRoots`, resolve
   labels, compute coverage against fills. Wherever build-code citations are
   already read.
4. Skills: door questions in `centina-session-zero` and `centina-iterate`;
   in `centina-realize`, a `"test"` obligation gets a destructive test with
   `@verifies`, and step close lists coverage.
5. Docs: `vocabulary.md`, the hole table in `core-mechanism.md`, and
   `ledger.md`'s "Citations from build code".
6. Tests, including a positive control for the coverage check.

## Risks

- **Pile-up.** A door carrying five obligations makes the spec a compliance
  form. Defenses: shape first, and door questions that ask without demanding.
- **False confidence.** A `"test"` route with a weak test reads as covered.
  Defense: the destructive-test rule, which the checker can't enforce.
- **Building ahead of evidence.** The head-to-head hasn't run, and obligations
  are a new means under test. The C-with-obligations round is where they pay
  their way or don't.
