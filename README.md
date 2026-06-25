# Agent-Interpreted Specification Language

This project lays out a formal description/specification for the creation of a domain specific language (DSL) for use with agentic (LLM-assisted) coding, specifically for high-level planning and architecture. As a DSL, it is concerned more with the *what* rather than the *how*.

In the fewest words, it's **type-checked  pseudocode**.

## Enabling syntax highlighting (development phase)

1. In VS Code: File > Open Folder... (or Cmd+O)
2. Navigate to and select ./editors/vscode — open it as its own window (it'll ask "open in new window," say yes if prompted, or just let it replace if you don't mind closing the current one).
3. In that new window, press F5. It should now find the Run AISL Extension config and launch a separate "Extension Development Host" window — that's a sandboxed VS Code instance with your unpublished extension active.
4. In that Extension Development Host window, open any .aisl file (e.g. File > Open Folder... and pick the current project, then open a .aisl file) — it should now show syntax highlighting.

If F5 still shows a config picker instead of going straight to "Run AISL Extension," that just means VS Code found multiple/no matching configs — pick "Run AISL Extension" from the dropdown, or check the Run and Debug panel (Cmd+Shift+D) to confirm launch.json was picked up under that window.

# Documentation

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

---

**The key takeaway**

Parentheses mean "I am describing a computation whose *result* is opaque (unverifiable)"; no parentheses mean "I am describing a data attribute *assumed* to be on hand that I'm willing to name a type for." Both forms are valid AISL — they just express different things about the relationship between the object and the semantic meaning of the descriptive value in question.