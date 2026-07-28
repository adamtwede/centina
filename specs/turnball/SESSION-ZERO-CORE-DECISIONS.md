# Turnball — Core / Non-Switchable Decisions (Session-Zero Details)

Ruleset-incompatible-if-changed; nothing downstream may assume otherwise. Index file (`SESSION-ZERO-STATE.md`) carries only a pointer.

## Core / non-switchable decisions (Match)

- **Court:** square tiles + **declared, tweakable movement cost** (diagonal metric authored, not intrinsic). Hex parked as revisitable.
- **Ball actions are physics/vectors, NOT tile-stepped** — pass = straight-line vector → distance-ordered collision set (intercept/glance) → per-collision resolution → reception resolution; failure leaves ball in a player's hands or on a tile. Ball-physics/collision routes as a REALIZATION door, separate from the tile-movement grid.
- **One Player moves per turn** (not multiple).
- **Alternating turns, no planning phase** (not simultaneous execution).
- **No out-of-bounds / in-bound plays.** All play is in-bounds; on-court == has a tile, unconditionally. Throw-in-shaped possession changes need another spelling.

---

**Pointer:** Index at `SESSION-ZERO-STATE.md`. Match at `SESSION-ZERO-MATCH.md`. Career at `SESSION-ZERO-CAREER.md`. Simulation engine at `SESSION-ZERO-SIMENGINE.md`. Findings at `SESSION-ZERO-FINDINGS.md`.
