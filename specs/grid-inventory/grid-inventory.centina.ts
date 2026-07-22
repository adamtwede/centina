// grid-inventory.centina.ts — the Inventory core node.
//
// Session-zero skeleton (grid-inventory case, 2026-07-21). Inventory is the one
// core node of this system: it owns the grid state and exposes the common client
// door-set every partner (paper doll, character sheet, crafting, world) consumes.
// It is FULLY ISOLATABLE — no outbound edges — which was the human's top
// isolatability goal: persistence is snapshot / restore doors (not a terminal),
// and item identity is client-minted (not generated here), so Inventory meets no
// existing technology directly. Partners depend on this frozen door-set
// interface; the single-cell (Minecraft) vs multi-cell (Diablo) placement regime
// lives BELOW the seam as held implementation, so it never reaches them.
//
// Interfaces present and concrete; implementations absent and held. The fit /
// packing algorithm — the one genuinely realization-heavy interior — is a
// deferred<"unimplemented"> hole the human fills at iterate.

import { deferred } from "../../centina"
import {
  AffectedItem,
  CellView,
  Coord,
  InventoryMetadata,
  ItemType,
  PeekResult,
  PolicyContext,
  PolicyDecision,
  PolicyOperation,
  Snapshot,
  SortCriteria,
  Stack,
  StoreResult,
} from "./shared"

// The frozen client door-set. Coordinate-addressed throughout: reads resolve to
// the placement COVERING the given coord, writes place rooted at it. This is the
// contract partners are insulated by — it does not vary by placement regime.
export interface Inventory {
  // --- store (write-with-receipt) ---
  // Two doors. Input is a homogeneous stack (one ItemType). All-or-nothing on
  // both layers.
  // @agent: input homogeneity is a runtime invariant, not structurally typed.
  // @agent: empty-input (`[]`) convention is an OPEN minor hole.
  storeInAny(items: Stack): StoreResult
  storeInSpecific(root: Coord, items: Stack): StoreResult

  // --- retrieve (mutating read) ---
  // Takes & returns the WHOLE covering placement's contents. No partial: the
  // client retrieves all and stores back any remainder (symmetric with store).
  // Empty covering cell => [].
  // @agent: out-of-bounds behavior on retrieve is an open convention hole (mirror
  // peek's error family, or reject — the human's call at fill).
  retrieveByCell(coord: Coord): Stack

  // --- non-mutating reads ---
  // On-demand type query -> peek-shaped views. Absent type => [].
  queryByType(type: ItemType): CellView[]
  peek(coord: Coord): PeekResult
  // Occupied-by-root cell views, ROW-MAJOR (coord-derived, snapshot-stable;
  // deliberately not insertion order).
  peekAll(): CellView[]
  readMetadata(): InventoryMetadata

  // --- sort (mutating repack) ---
  // Rearranges placements per criteria. In multi-cell this is NOT pure
  // presentation — it repacks, sharing the held fit interior below. Orientation /
  // rotation (parked) lives in that same interior.
  sort(criteria: SortCriteria): void

  // --- persistence (round-trip doors; no outbound terminal) ---
  snapshot(): Snapshot
  restore(snapshot: Snapshot): void
}

// The stacking-policy seam. INTERNAL to Inventory (one evaluate door). Multi-
// locus does not change the door: item-only decisions are authored per-ItemType,
// inventory-state decisions per-Inventory — only WHERE definitions live differs.
// @agent: scope currently stacking-only; broadening (capacity-as-policy, …) is an
// open hole. `context` is PARKED. Standing principle — "Inventory is mechanism,
// not negotiator": it says yes/no to the payload as presented and never infers
// client intent.
export interface Policy {
  evaluate(
    operation: PolicyOperation,
    affected: AffectedItem[],
    context?: PolicyContext,
  ): PolicyDecision
}

// HELD realization interior — the fit / packing algorithm. store-in-any's
// placement AND sort()'s repack share this one interior (same problem: fit
// homogeneous stacks into the grid honoring footprints). This is where the
// single-cell-vs-multi-cell implementation difference lives — one branching impl
// or two impls, decided at fill, partners insulated either way. Multi-cell
// footprints and parked orientation both live here. deferred<"unimplemented">
// => the checker reports it as work-remaining until the human fills it.
export const fitPlacement = deferred<
  "unimplemented",
  (items: Stack, root?: Coord) => StoreResult
>()
