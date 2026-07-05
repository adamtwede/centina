# Fit-case: visual / layout / perceptual

**Descriptor:** A task whose substance is perceptual judgment — UI layout,
visual design, animation feel, copy tone, spacing and hierarchy.

**Shape:** Boundary-ends vary but are not the point. Center of gravity is
realization on the **aesthetics** axis. The deciding content is "what looks /
reads / feels right," which is not a data relationship.

**Verdict:** `no-fit` for the aesthetic layer (recuse). Keep only the dataflow
layer if one exists.

**Deciding factor:** Resolves at **Level 0**. The ambiguity-reducing questions in
a UI that Centina *can* serve are about dataflow and provenance — where does
state live, what mutates it, what is persisted, what binds where. The layout
itself — arrangement, ordering, visual weight — is realization a coding model
handles and a comment can pin down. This is why Centina rejects
presentation/layout syntax.

**Discriminators:**
- The hard part is "what looks / feels / reads right" → realization/aesthetics,
  out of scope.
- If, underneath the layout, there is a real dataflow question (state
  provenance, what binds to what), *that* slice may be a fit — re-slice to the
  dataflow layer and drop the aesthetics.
- A spec trying to encode arrangement, ordering, or visual hierarchy is reaching
  into the rejected presentation-syntax territory → recuse.

**Source:** Boundaries design discussion (AISL v0 era; shape carries over
unchanged), the rejected-presentation-syntax decision and the recuse
criterion.
