# Boundaries (design proposal)

> **Post-pivot status (2026-07-04):** this document survives the AISL→Centina
> pivot. Its design content — affordances-not-transports, the three roles,
> direction-from-returns, the boundary-drawing guidelines, and "when not to
> reach for a boundary" — carries into Centina unchanged. Only the concrete
> syntax below is AISL v0 (preserved at tag `aisl-v0-standalone-language`).
> The Centina spelling is a JSDoc-tagged `declare class`
> (`/** @datasource | @datasink | @boundary */`) — see `centina.ts` and the
> worked use in `prototype.centina.ts`. Checker enforcement is roadmapped.

**Status:** Designed, not yet implemented. This is a language-design document — the
first concrete fragment of the eventual `SPEC.md` referenced in `ROADMAP.md`. It
captures the decisions and reasoning from the boundaries design discussion so they
stop living only in a chat thread. No checker/parser support exists yet.

## Why boundaries exist

AISL's operating principle is *AISL never manufactures data*: every concrete value
in a document has to trace back to a small set of privileged sources — a function
parameter, `Agent.prompt()`/`.review()`, or an `external` reference (see
`ROADMAP.md`). That set maps perfectly onto the original worked domain
(`prototype.aisl`, an agent-supervisor app), where nearly all data genuinely comes
from `Agent.prompt()`.

It maps badly onto most other domains. A todo web app's real data sources are *user
input events*, a *render target*, and *persistent storage*; a CLI's are *argv /
stdin / stdout / files*; a web server's are *the request*, *the response*, and
*downstream services*. None of these had a first-class representation, so
`specs/todo/todo.aisl` had to fake them — hand-rolling an input boundary out of an
`external` listener, forcing the renderer into a stateless `string -> string`
round-trip, and "cheating" with casts like `return payload as Todo` precisely at the
points where data was supposed to enter the system.

**A boundary is a first-class, user-declared privileged source/sink** — the
generalization of `Agent` to data seams the author defines themselves. It is the
fourth privileged source under "never manufactures data": a value read from a
boundary is legitimately *produced* in the same sense an `Agent.prompt()` result is.

The reframing that makes this domain-neutral: what varies across domains is not
syntax, it's the *boundary profile* — the set of seams where data enters and leaves.
"Web app" is just a common bundle of seams ({events, render, storage, network});
"CLI" is another ({argv, stdin, stdout, fs}). So we do not tag a spec with a domain
and switch on it; the author declares the boundaries, and *the set of boundary
declarations is the domain*. An optional `domain:`/`intent:` hint may still exist as
documentation for the interpreting model, but it carries no checker semantics.

## What a boundary models: affordances, not transports

The single most important modeling rule. A boundary is drawn around an **affordance**
— *what data you get or put, and in what shape* — never around the **technology or
structure** that carries it.

Worked example. Google and Reddit are both "webpages," but a spec that searches
Google and reads Reddit's front page is using two *different affordances*
(`search(term) -> SearchResult[]` vs `front_page_posts() -> RedditPost[]`) that
merely share a transport (HTTP + a rendered DOM). The transport is exactly the
"technical minutiae" AISL exists to spare the author. So they are **two boundaries,
not two instances of one** — lumping them onto a shared `Webpage` kind would assert a
sameness that is true only at the layer the spec is trying not to think about, and
would collapse `SearchResult[]`/`RedditPost[]` down to an uninformative
`HtmlElement[]`.

This is itself an instance of boundary conflation caught in our own design — the kind
of error the language is meant to surface.

This is not new ground. The affordance/transport split is the same distinction Alistair
Cockburn's [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture)
("Ports and Adapters") draws between a **port** — a declared interface where the
application meets the outside world — and an **adapter** — the technology that fulfils
it. A boundary is a port; a door is a method on that port; the transport AISL refuses to
model is the adapter. AISL's contribution on top of that prior art is the provenance
layer: a door read is a privileged data source under "never manufactures data," and the
`datasource`/`datasink`/`boundary` roles make direction checkable.

## The three roles

A boundary carries a direction, declared as the kind keyword:

- `datasource` — read-only. Every door returns data into the system.
- `datasink` — write-only. Every door consumes data out of the system, returning nothing.
- `boundary` — both. Data crosses in both directions over the same resource.

These are **roles in this spec's dataflow, not intrinsic categories**. A `File` is a
`datasink` in a scraper that only dumps results, and a `boundary` in an editor that
does read-modify-write. The keyword is the author *committing to a direction*, which
is what lets the checker catch a contradiction (writing through something declared a
`datasource`).

A "door" is a declared method on the boundary — the privileged entry/exit point.

## Syntax

A boundary is a **kind** (declared once: constructor signature + interface of doors)
that is **constructed** into instances (which supply config and inherit the kind's
role). Everything is indentation-based, consistent with the rest of AISL — the
interface block uses `:` + indentation, not braces, and each door reads like a
function header without a body.

```
datasource GoogleSearch(url: String):
    search(term: String) -> SearchResult[]

boundary EditableDoc(path: String):
    read() -> Markdown
    write(content: Markdown)

datasink LogFile(path: String):
    write(line: String)
```

Instances construct with config and inherit the kind's role:

```
google = GoogleSearch("https://google.com")
errlog = LogFile("errors.log")
```

Usage — declared doors only, direction enforced:

```
results = google.search("aisl language")    # -> SearchResult[], nominal, no cast
errlog.write("disk full")                    # ok: write door on a datasink
google.write("...")                          # ERROR: GoogleSearch is a datasource (read-only)
google.fetch_all()                           # ERROR: 'fetch_all' is not a declared door of GoogleSearch
```

Construction arguments obey "never manufactures data": a literal, or a value that is
itself privileged-sourced.

`Agent` is, in effect, the one boundary the language ships pre-built — `prompt()` and
`review()` are its doors. The new primitives let an author declare their own.

## Type rules

Boundaries slot into the existing `Unspecified`/`Unknown`/`Unprivileged` lattice:

- **A door with an annotated return type yields that type nominally** — no cast
  required, because the author committed to the shape. Being forced to write
  `-> SearchResult[]` is AISL doing its job: making the author name the boundary's
  data shape instead of skipping that thinking.
- **A door with no return annotation yields `Unspecified`** (castable), the usual
  gradual-typing escape hatch.
- **Types referenced in door signatures are implicitly treated as `Unknown`** — the
  boundary declaration is itself the seam to external code, so any type name in a
  door param or return type that isn't already declared is auto-implied as an assumed
  external type. You do not need a separate `assumed external type SearchResult` just
  because `SearchResult` appears in a door signature. If a type *is* already declared
  (via `type`, `enum`, or `external`), the declared version is used instead.
- **An undeclared method call on a boundary instance is an ERROR**, not
  `Unspecified`. This is the one place a boundary is *stricter* than a plain `type`
  (whose ad-hoc method calls yield `Unprivileged`). Declaring a boundary is a
  commitment to a *closed* interface; allowing ad-hoc calls through a side door would
  hand back the extemporized looseness the commitment is meant to buy you out of. The
  same closed-ness is what gives the "not a declared door" diagnostic its teeth.
- **A boundary read result is a privileged source** under "never manufactures data" —
  the fourth alongside params, `Agent`, and `external`.

### Direction enforcement (structural, not lexical)

Direction is inferred from each door's **signature**, never from its name (no
`get_`/`set_` prefix rules — those are brittle, English-bound, and gameable):

- a door that **returns data** (non-void) is a *read*;
- a door that **returns nothing** (void) is a *write*.

Then:

- on a `datasource`, every door must return data; a void door warns/errors ("this
  looks like a write; did you mean `boundary`?");
- on a `datasink`, every door must be void; a data-returning door warns ("you're
  getting data back; did you mean `boundary`?");
- on a `boundary`, any mix is allowed.

Classification is by **return only, never by arguments** — so a selector argument
like `search(term: String) -> SearchResult[]` does not false-trip as "writing to the
source." Passing a selector is not exporting your domain data; returning nothing while
accepting a payload is.

This constrains *direction* (a provenance concern, on-principle) rather than *shape*
(a schema concern — the thing deliberately kept out of `type` declarations).

## Guidelines: drawing accurate boundaries

The hard part for a human writing something that feels like code is leaning *away*
from technological/structural abstractions and *into* semantic ones. The litmus:
**if you sketch a boundary and before long you're mixing in things that don't belong,
you drew the line in the wrong place.**

Questions to ask, and what the answer tells you:

1. **Strip the technology away — what *data* crosses here, and in what shape?** If you
   can't name it without naming the tech ("it's a webpage", "it's a SQL table"), you
   haven't found the boundary yet — you've found the wire.
2. **Do my proposed instances share affordances — the same doors and the same data
   shapes — differing only in configuration?** Yes -> one kind, many instances. No ->
   different boundaries.
3. **Am I about to add a method that only makes sense for *some* instances?** If yes,
   you've found a second boundary hiding inside the first. Split it out.
4. **Could I swap one instance's config for another's and have every door still mean
   the same thing?** If putting Reddit's URL into a `GoogleSearch` makes `search()`
   nonsense, they were never one kind.
5. **Is what these things share something my spec actually *uses*, or just something
   that's *true* about them?** Shared substrate the spec never touches (HTTP, "both
   are webpages") is not a reason to share a kind.
6. **Direction:** does this seam only *give* data, only *take* it, or both? ->
   `datasource` / `datasink` / `boundary`.

The governing invariant (question 2, stated sharply):

> An instance may not add or change doors. Instances differ only in construction
> config. If two things need different doors, they are different boundaries.

Smells that you've drawn the line wrong:

- You're reaching for a per-instance method override. (-> separate boundary; this is
  the invariant firing.)
- Door names are drifting vague (`get_contents`, `get_data`) to span instances that
  really do different things. (-> split into specific affordances.)
- Your kind names are technology nouns (`Webpage`, `HttpClient`, `SqlTable`) instead
  of affordance nouns (`GoogleSearch`, `ProductCatalog`, `UserStore`). Not always
  wrong — sometimes the affordance genuinely *is* "a page I read and write wholesale"
  — but it's a yellow flag worth question 5.
- One instance only ever touches half the doors. Maybe fine; maybe it's telling you
  it's a different boundary.

## Decisions and rejected alternatives

- **Presentation/layout syntax (element composition, ordering, data bindings) —
  rejected.** It's the churny sub-language every framework fights over (against the
  "arrange the idea, don't wrestle the pieces" aim), it's schema-shaped (the same
  reason per-type property lists were rejected), and it isn't where AISL has leverage.
  The ambiguity-reducing questions in a UI are about dataflow and provenance (where
  does state live, what mutates it, what's persisted) — already AISL's wheelhouse —
  not about layout, which a coding model handles and a comment can pin down.
- **Domain as a checker-significant tag — rejected** in favor of boundary
  declarations, which subsume it (`datasource ...` + `datasink ...` *is* the I/O
  profile). An optional doc-only `domain:`/`intent:` hint may exist, with no
  semantics.
- **Generic built-in doors (`get_data(field) -> Unspecified`) instead of
  author-declared doors — rejected.** That refuses the one thing that makes a boundary
  worth declaring; the language can't know your seam's doors the way it owns `Agent`'s.
- **`get_`/`set_` method-name prefixes to mark direction — rejected** for structural
  return-based inference (see above).
- **Transport-level kinds (`Webpage`) with per-instance interfaces — rejected** for
  affordance-level kinds with shared interfaces (see "affordances, not transports").
  Per-instance interface overrides are disallowed by design, and the desire for one is
  the diagnostic signal that two affordances have been conflated.
- **Ad-hoc (undeclared) method calls on boundaries — rejected** (error, not
  `Unspecified`); a boundary is a closed interface (see "Type rules").
- **Role on the instance vs. on the kind — moved to the kind.** An earlier step (when
  the kind was a transport like `Webpage`) put the role on the instance. Once the kind
  became the *affordance*, the affordance carries a definite direction, so the role's
  natural home is the kind, with instances inheriting it.

## When *not* to reach for a boundary

Boundaries are the right primitive for **I/O-shaped** features and a poor fit for
**compute/transform-shaped** ones. Forcing a boundary frame onto pure computation
reliably produces "implementation tasks dressed as doors" — the
`create_primitive()`/`get_data()` smell — which is the signal that you've modeled the
*act of building the feature* instead of data crossing a runtime seam.

The quick diagnostic is to **count the boundary-ends** of the slice you're specifying —
how many ends face a *real external actor at runtime* (a user, a file, a socket, a
model, a downstream service — not the developer, and not another function in the same
program):

- **2 ends** (ingress + egress are both boundaries) — I/O-shaped. The ideal fit
  (web handler, ETL). Boundaries carry the spec.
- **1 end** (usually egress) — a *reporting/effect* shape: internal logic that surfaces
  outward (a checker, a logger, a metrics emitter), with a privileged *parameter* (not a
  boundary) on the ingress side because the producer is internal. Fit, but lighter — one
  real sink.
- **0 ends** — pure compute (token-stream → AST, a sort). No external seam, so little
  spec-worthy provenance; default to skepticism.

The sharpest single test for any candidate boundary: **what is on the other side of this
door, at runtime?** "The developer building this" means it's build-time work, not a data
seam; "another function in the same program" means it's internal compute, not a boundary.

This is one face of the deeper invariant: **"never manufactures data" is not only a
typing rule, it is AISL's domain boundary.** It auto-recuses AISL from anything whose
essence is manufacturing — *algorithm* (how a result is computed), *dynamics* (how
behavior unfolds over time), *aesthetics* (how something is perceived) — and points
healthy iteration *inward*, deeper into provenance / flow / contract, rather than
*outward* toward general-purpose programming. The `centina-fit` skill
(`.claude/skills/centina-fit/SKILL.md`) operationalizes this as a structured "is this
even a Centina task?" determination run before a spec is written.

## Provisional boundaries (Centina-era)

A boundary standing in for a system that doesn't have its own spec yet (marked,
typically, by an `@agent:` note like "this is probably a separate spec") is
fine to declare inline in whatever spec first needed it — but it's a candidate
for extraction into its own file (e.g. `task-matcher.centina.ts`), not gated on
that note being present. Any inline boundary carries the same risk: a later
spec that needs the same seam, unaware it already exists, reinvents it
slightly differently.

Two checks worth applying to any `@datasource`/`@datasink`/`@boundary`,
whether or not it's flagged for extraction yet:

- **Dependency direction.** A boundary's door signatures must not resolve to a
  type declared in the *consuming* spec — that's the boundary depending on its
  caller, backwards from how a real external system would typecheck. This
  generalizes the affordance/transport split above: a boundary that imports its
  caller's own record shapes has quietly become coupled to one specific
  caller's internal representation, the same kind of conflation "affordances,
  not transports" already rules out, just discovered at the type level instead
  of the design level. Primitives, `unknown`, opaque `Noun<...>` brands, and
  closed enums carry no such dependency and are fine at a door; a real
  structured payload should be `unknown` at the door rather than an imported
  local interface.
- **Extraction readiness.** Once a boundary looks stable — a real seam other
  specs would plausibly also want, not still being shaped — move it to its own
  file. That file gets a clear "provisional boundary declarator" header and
  contains only declarations (`declare class`/`type`/`interface`, plus one
  instantiation if the boundary is naturally a shared singleton) — no function
  bodies, no spec logic — so it stays trivially discoverable ahead of a future
  `centina-fit` precedent search, and has a natural place to grow into once
  someone actually specs out the real system behind it.

## Deferred / open

- **Instance-level role narrowing** — restricting a both-capable `boundary` kind to a
  read-only or write-only use at a specific instance (the old "Webpage snapshot"
  case). Held back to see whether kind-level roles are enough on their own; its syntax
  is to be designed only if the need materializes.
- Where boundaries sit relative to existing constructs in a full spec body (how a
  reducer/handler references them, the todo app re-expressed cleanly) — next.
