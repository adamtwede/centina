# Agent-Interpreted Specification Language

AISL is a domain specific language (DSL) designed specifically for use with agentic (LLM-assisted) coding, specifically for high-level planning and architecture. It is concerned more with the *what* rather than the *how*. 

In the fewest words I can manage, it's **type-checked  pseudocode**. In slightly more words, it's like declarative programming with your coding agent as the runtime.

## It's what now?

Stick with me a minute. I promise it'll make sense. (I can't promise it'll make sense to *you*, but it does to me.)

Have you ever struggled to explain to your coding agent of choice what you want it to do with the masterful clarity you need? Have you shaken your head in dismay as you burn precious tokens going back and forth trying to articulate what you want it to do? Have you ever sent your coding agent off to do something, only to have it produce something that doesn't do what you expected, and you realize you don't even know where to start explaining how to fix it? No? Well, I have. Here is my story.

Recently, I wanted to implement a moderately complex process that included escalation paths, loops, recursion, etc. I started typing out my initial prompt and within a few minutes became frustrated that I couldn't explain clearly what I wanted without laborious, tedious back-references, ambiguous terms, and constant parentheticals. I couldn't even explain it to *myself*, let alone an agent. After a handful of false starts, I thought to myself, "There has to be a better way!" So, I went looking for one. 

I'm a latecomer to the agentic coding world. A holdout. A rebel turncoat. As such, I figured surely someone smarter than me (many people qualify) had already solved this problem. Naturally, I first asked the usual suspects: various popular chat agents. They all gave me the same few unsatisfying answers ("Goodness! What a brilliant idea! Nobody has ever thought of this! You're probably a genius!" shut up, baby, I know it). So I deigned to try an actual search engine, looking for a way to approach my agent's "planning mode" with something more structured, something less haphazardly free-form than \*ugh\* *organic conversation* (I already get enough of this with my kids, you know?) but, to my surprise, found nothing I liked. There were some diagramming tools, some hot tips and tricks, and a whole bunch of agent skills that promised to take my confusing, meandering, resignedly self-conscious prose and turn it into an implementation plan good enough to make Linus Torvalds weep with joy. (Spoiler: There's no crying in coding.)

I gave up the search and decided that the best way forward was to simply try and sketch the idea out for myself without involving the agent at all, as though I were back in the old days where we still wrote code by hand like common people. I thought if I could get a better handle on exactly *what* I was planning to ask for, maybe I could write a usable prompt to get things started on *how*. Almost without thinking, I started writing psuedocode. I know people are always bullying poor psuedocode, but it's actually pretty great. You can use familiar, structured programming conventions without being hobbled by the requirements of actually producing executable code (totally unreasonable in 2026). However, as I wrote and my pseudocode became more complex, making sure I was maintaining consistency in spelling, local conventions, proposed control flow, etc., started becoming really tedious, threatening to undermine the entire reason I was doing it.

I thought to myself, "There has to be a better way!" So, I went looking for one. Just kidding. I already did that. I decided to just make one. The result of that is AISL.

## Example

As is tradition, we start with a todo app. Here is a truncated example of an AISL spec for such a thing, leaning on React as the context:

```python
# "assumed" means "doesn't have to actually exist." Like a mocked assertion.
assumed external type TodoEvent from "./external_ui_library.ts"

# AISL can make use of three distinct "boundary" types, which describe where 
# you expect data to flow in and out. 'datasource' is the read-only boundary type.

# if our datasource is the TodoReactComponent, what are we? we appear to be the 
# "logic" of the todo functionality. if we were the TodoReactComponent itself, 
# our boundary might be the React renderer, or the component lifecycle.
datasource TodoReactComponent():
    # we aren't concerned with the details of how todos are made, we let the component handle that, 
    # so we just ascribe the type info (in this case, Todo) directly onto it.
    get_todos() -> Todo[] # functions on boundary types are called 'door methods' or simply 'doors'.

todo_component = TodoComponent() # boundaries must be "instantiated," it'll be clear why later.

# the other two boundary types are 'datasink' (write only) and 'boundary' (read/write).
# these conventions are enforced by the AISL checker with a simple structural heuristic:
# datasource doors must *always* describe a return type, datasink doors *can't* describe a return type.

function on_todo_event(todo_event: TodoEvent) -> Todo[]:
    # we can directly address the agent/model reading the spec like this:
    # @agent: this is a handler registered with the TodoReactComponent that gets called when there is a relevant event.
    # ^ this is an escape hatch, so try to minimize its use.

    todo = convert_payload_to_todo(todo_event.payload)
    todos = todo_component.get_todos()

    match todo_event.event_type:
        case "new":
            handle_new_todo(todo, todos)
        # other cases would follow here.

    return todos

function convert_payload_to_todo(payload: Unknown) -> Todo:
    # this function converts the payload from the event into a Todo object.
    # this is pseudocode so we can "cheat" where it makes sense to let the 
    # coding agent have some discretion where we're not concerned with the 
    # details and we've left little ambiguity.
    return payload as Todo

function handle_new_todo(todo: Todo, todos: Todo[]):
    todos.push(todo)
  
# other case handlers would follow here.
```
## Prior Art

If you're at all familiar with Alistair Cockburn's [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture) aka "Ports and Adapters," some of this might feel familiar. It's basically those ideas dropped into a lexer via primitives with a Python-like syntax, a few semantic revisions, and several constructions designed for both humans and AI coding models to easily understand.

## PLAN.md

The intended result of an AISL spec is a PLAN.md with more detail, less ambiguity, and an easier path toward revision. [Here is the PLAN.md](https://github.com/adamtwede/aisl/blob/main/specs/refactor_external/PLAN.md) that resulted from [this AISL spec](https://github.com/adamtwede/aisl/blob/main/specs/refactor_external/refactor_external.aisl). (This is an example of [dogfooding](https://en.wikipedia.org/wiki/Eating_your_own_dog_food).)

## Artifacts

- command line checker that enforces AISL syntax and rules and warns of potential problems in the spec.
- /aisl-iterate agent skill. Provides guidance to a coding agent for working through an AISL spec with a human (you, probably) until it is ready for an implementation plan doc.

## Philosophical Goals and Operating Principles

### Mental model

The most challenging aspect of adapting your ideas to AISL is the fact that, superficial similarities notwithstanding, AISL is *not a programming language*. It is *structured psuedocode* that enforces syntax and conventions that encourage activities meant to *expose and ameliorate unknowns, ambiguities, edge cases, and dubious assumptions*. When you are writing AISL pseudocode, you aren't writing imperative instructions for mechanistic execution, you are *describing expectations and intentions* that are meant to be interpreted by machine intelligence. More to the point, you are writing expectations and intentions regarding three crucial aspects of how your idea fits into the rest of the world you anticipate it will inhabit:

1. Where does data enter, and what does it look like when it arrives?
2. How does data change and move as it flows through the functionality the spec describes?
3. Where does data exit, and what does it look like when it leaves?

These are more than just inputs and ouputs. They are your boundaries and your data provenance.

AISL ships with three core 'boundary' types:

- `boundary` -- fully "encloses" the functionality described by the spec, asserting a "read/write" interface.
- `datasource` -- sits "over" the functionality described by the spec, asserting a "read-only" interface.
- `datasink` -- sits "under" the functionality described by the spec, asserting a "write-only" interface.
  
These conventions are enforced by the AISL checker with a simple structural heuristic: datasource doors must *always* describe a return type, datasink doors *can't* describe a return type. boundary doors have no restrictions, so should be used with care so as not to become an escape hatch.

Boundaries must be instantiated to be used. This is so you can describe two boundaries that differ in configuration as opposed to structure. For example:

```python
  datasink File(file_path: String):
    write(file_contents: String)
  
  log_file = File("log_file.log")
  telemetry_file = File("telemetry.log")

  log_file.write("log file contents")
  # ...
```

However, when you find yourself writing a configurable boundary, it's always worth questioning whether your abstraction might be too general, or at the wrong level. What if you don't want or need to be concerned with filenames? Maybe you want different semantics between the two boundary types, or to describe a different abstraction altogether:

```python
  datasink LogEngine():
    write_log_entry(log_entry: LogEntry)
  
  datasink TelemetryEngine():
    write_metrics(metric: Metric)
  
  log_engine = LogEngine()
  telemetry_engine = TelemetryEngine()

  log_engine.write_log_entry("log entry" as LogEntry)
  # ...
```

More on this in the next section.

### Drawing boundaries

**Principle**: Draw boundaries around *affordances* — what data you get or put, and in what shape — not around technologies or structures that carry them. Lean away from "what is this thing" and toward "what does it give me? / what do I do with it?" This is the hard part for humans writing something that feels like code, and it's the main thing AISL is here to push you toward.

**Principle**: Model your proposed boundaries as one of the two restricted types first. Only use 'boundary' when it's unambiguous that you need it.

**Principle**: Identify and use datasources over ad hoc types to describe where your data comes from. Boundary types allow you to succinctly describe an interface with the outside world. Use this to your advantage, because more than anything else, boundaries will limit scope, identify roles, inform separation of concerns, etc.

**Principle**: Identify and use datasink "write-through" doors over return statements, especially in "entry point" functions (functions which aren't referenced by name in the spec outside of their definitions).

**Questions to ask, and what the answer tells you**

1. Strip the technology away — what data crosses here, and in what shape? If you can't name it without naming the tech ("it's a webpage", "it's a SQL table"), you haven't found the boundary yet — you've found the wire.
2. Do my proposed instances share affordances — the same doors and the same data shapes — differing only in configuration?
  - Yes → one kind, many instances.
  - No → different boundaries. This is the invariant: "An instance may not add or change doors. Instances differ only in construction config. If two things need different doors, they are different boundaries."
3. Am I about to add a method that only makes sense for some instances? If yes, you've found a second boundary hiding inside the first. Split it out.
4. Could I swap one instance's config for another's and have every door still mean the same thing? If putting Reddit's URL into a GoogleSearch makes search() nonsense, they were never one kind.
5. Is what these things share something my spec actually uses, or just something that's true about them? Shared substrate the spec never touches (HTTP, "both are webpages") is not a reason to share a *kind* of boundary.
6. Direction: does this seam only give data, only take it, or both? → datasource / datasink / boundary.

**Smells you've drawn the line wrong**

- You have more than one `boundary` declared in a single spec (*not* of the other types, specifically the `boundary` boundary type). That's often an indication your spec is modeling the wrong thing, and your boundaries are porous.
- You're reaching for a per-instance method override. (→ separate boundary — this is the invariant in #2 above firing)
- Door names are drifting vague (get_contents, get_data) to span instances that really do different things. (→ split into specific affordances)
- Your kind names are technology nouns (Webpage, HttpClient, SqlTable) instead of affordance nouns (GoogleSearch, ProductCatalog, UserStore). Not always wrong — sometimes the affordance genuinely is "a page I read and write wholesale" — but it's a yellow flag worth asking question #5 above.
- One instance only ever touches half the doors. Maybe fine (see narrowing below); maybe it's telling you it's a different boundary.

### Invariants, rules, and things to know

1. Never ask a coding agent to write an AISL spec for you. It defeats the entire purpose. Collaborate. Don't outsource your thinking or you might as well go back to whatever you were doing before.
2. AISL pseudocode doesn't "manufacture" objects. This is by design. Other than primitives, data in an AISL spec must come from a small selection of "privileged" sources, all semantically *external* to the feature or process being specified.
3. Writing a spec can be a frustrating process. That's why many people don't do it. They wind up regretting it, though, when the consequences of not having thought things through well enough catch up to them. I can't promise writing an AISL spec won't be frustrating, at least initially, but that's more a result of learning a new way of thinking than anything else. You're exercising disused muscles.
4. Your goal in writing an AISL spec isn't to just clearly communicate an idea or process, it's to find the gaps in your thinking and force you make implicit assumptions explicit, and to ensure as much of your idea as possible makes it into code the first time through.
5. Specs aren't just good for getting something implemented, they also keep you involved, and provide a structured record of the conceptual components of your application that you can reference later. As AI models become more and more capable, it can become very tempting to talk through an idea, get excited, and send it toddling off to execute, only a week or so later to find you don't know enough about "your" own codebase to troubleshoot a major bug. 
6. It's an artifact you can reuse for structured revision. Something didn't turn out the way you expected? Talk it through, figure out where the gap was in the spec. It's easy to miss or gloss over stuff in conversation, but it's harder to accidentally skip steps with a formal spec.

# Documentation

> **Forward design:** boundaries (`datasource`/`datasink`/`boundary`) — first-class
> data sources/sinks meant to make AISL a robust medium beyond the agent-supervisor
> domain — are designed but **not yet implemented**. See
> [`docs/boundaries.md`](docs/boundaries.md) for the proposal, syntax, and the
> affordances-not-transports modeling guidelines. The sections below document
> currently implemented behavior.

## Property Access vs. Method Calls in AISL

AISL distinguishes between two ways of navigating an object with dot notation: bare property access (`obj.prop`) and method calls (`obj.method()`). Both are "ad hoc" — AISL doesn't require you to declare properties or methods on custom types ahead of using them — but they carry different type-level meaning, which the checker uses to guide you toward clear pseudocode.

**The distinction**

`obj.prop` — describes *reading* a data attribute.

When you write `obj.prop`, you're describing the act of reading a value that exists on the object — a field, a discriminant, an attribute whose type you haven't pinned down yet. The checker types it as `Unspecified`, the designed gradual-typing escape hatch: you can cast it to a concrete type (with a warning if the object is from an external source) and use it in match exhaustiveness checking.

```
type Statement

enum Kind = EXPR | DECL | RETURN

function classify(s: Statement) -> Kind:
    match s.kind as Kind:   # bare prop → Unspecified → castable → exhaustiveness works
        case EXPR:  return EXPR
        case DECL:  return DECL
        case RETURN: return RETURN
```

`obj.method()` — describes the execution of a computation (with an *unverifiable* result).

When you write `obj.method()`, you're describing a computation that produces a "new" value. The checker rigidly types the result as `Unprivileged` — a special mode of `Unspecified` that blocks casting and assignment into concrete slots. This exists to enforce AISL's core invariant: *AISL cannot be used to express the internal manufacturing of data, since it is not a real programming language; AISL is descriptive only.* Only function parameters, `Agent.prompt()`/`Agent.review()`, and external references may produce a concrete value. An undeclared method call with parentheses is explicitly not one of them.

`Unprivileged` values are still useful descriptively: you can chain off them, compare them for equality, use them as if conditions, and pass them where an unspecified value is expected. What you can't do is cast the result into a concrete type and treat it as real data your AISL spec document has "produced":

```
type Statement

function analyze(s: Statement):
    if s.is_valid():           # implied-bool: fine, describing a condition
        if s.kind() == s.other_kind():  # equality: fine, describing a comparison
            s.do_something()   # chained call: fine, descriptive
    # s.kind() as Kind        # ← error: can't manufacture a concrete Kind from an ad hoc call
```

**When to use which form**

Use bare property access (`obj.prop`) when you're describing a value that simply is there on the object — a type tag, a discriminant, a field whose content you want to refer to or match against. This is the right form when you want to cast the result to an enum and drive a match statement.

Use a method call (`obj.method()`) when you're describing an operation the object performs — a validation, a transformation, a predicate. These are useful for if conditions and equality checks, but their results should stay opaque (you aren't claiming to know what type the computation produces).

The quick test: if replacing `obj.method()` with a `Bool` literal (or `Unspecified`) would still capture your intent, it's a method call. If you need to treat the result as a specific type — match it against an `enum`, return it, assign it — reach for the bare property form and make the type relationship explicit via `as`.

**When you'll see helpful errors**

If you write `obj.method() as SomeType`, the checker tells you: "if 'method' describes a data attribute (not a computation), use bare property access — `obj.method` without the `()` — which types as `Unspecified` and is castable." Similarly, matching directly on a method-call result (`match obj.method():`) warns you that the `Unprivileged` result can't drive exhaustiveness checking and suggests match `obj.prop as EnumType:` as the alternative.

**The key takeaway**

Parentheses mean "I am describing a computation whose *result* is opaque (unverifiable)"; no parentheses mean "I am describing a data attribute *assumed* to be on hand that I'm willing to name a type for." Both forms are valid AISL — they just express different things about the relationship between the object and the semantic meaning of the descriptive value in question.