// shared.ts — cross-seam vocabulary for the grid-inventory system.
//
// Session-zero skeleton (grid-inventory case, 2026-07-21). These are the data
// nouns and shapes the Inventory door-set traffics in, decided by the human
// across the ratified phases. Held / undecided shapes are opaque `Unshaped`
// brands or `@agent:`-flagged holes — never plausible fills.

import { Unshaped } from "../../centina"

// --- geometry -------------------------------------------------------------

export type Coord = { x: number; y: number }

// >= 1x1, always present on an ItemType. The single-cell (Minecraft) regime
// treats every footprint as 1x1; the multi-cell (Diablo) regime honors it.
export type Footprint = { width: number; height: number }

// --- items: type (definitional) vs instance (per-copy) --------------------

// @agent: stacking policy is authored PER ItemType — locus = decision-data
// provenance (a stacking decision reads only item data, so it lives with the
// item). Concrete shape is a held hole; scope currently stacking-only.
export type StackingPolicy = Unshaped<"StackingPolicy">

// The definitional, per-kind facts. `id` is the type identity; stacks are
// homogeneous by it.
export type ItemType = {
  id: string
  maxStackSize: number // >= 1; 1 = non-stackable
  footprint: Footprint
  weight: number
  tags: string[]
  stackingPolicy: StackingPolicy
}

// @agent: HELD — the per-instance, stack-busting property set (durability /
// condition / style / …). Exact set is a hole, filled at iterate. Instances
// whose properties differ do not stack.
export type InstanceProperties = Unshaped<"InstanceProperties">

export type ItemInstance = {
  // @agent: client-minted UUID. Inventory OFFERS the field but never populates
  // it — identity is minted upstream at item creation (crafting / world / …),
  // so Inventory carries no id-generation dependency and identity stays stable
  // across retrieve→store round-trips. Optional: clients may use or ignore it.
  id?: string
  type: ItemType
  properties: InstanceProperties
}

// A stack is a collection of instances (not item+count), homogeneous by
// ItemType, bounded by maxStackSize.
// @agent: homogeneity is a runtime invariant TS can't structurally encode —
// enforced in the fill, not in this type (the honest untypeable-constraint case).
export type Stack = ItemInstance[]

// A non-empty stack. INTENT-AS-SPEC encoding (session-zero auto-emit,
// 2026-07-21): the human ratified that sort's client comparator is never handed
// an empty cell's contents. Typing the comparator's inputs as `[ItemInstance,
// ...ItemInstance[]]` makes that guarantee part of the checked contract in both
// directions — Inventory cannot pass `[]`, and the comparator may rely on
// `a[0]` — rather than a prose precondition an implementer could skip.
export type NonEmptyStack = [ItemInstance, ...ItemInstance[]]

// --- cell views (the one result family reads return) ----------------------

// The addressable unit is the PLACEMENT covering a coordinate, derivable from
// root + footprint. Empty cell => contents []. Single-cell regime: rootCoord ==
// the queried coord, footprint 1x1.
export type CellView = {
  rootCoord: Coord
  footprint: Footprint
  contents: Stack
}

// --- store result ---------------------------------------------------------

export enum StoreStatus {
  STORED,
  REJECTED,
}

export enum RejectionCode {
  POLICY_VIOLATION,
  INVENTORY_LIMITATION,
}

// All-or-nothing on both layers. Success => post-store state (client sees
// prior+added, so free room is reported for free). Rejection => current
// unchanged state + code + reason (a well-defined rejection is a more-
// informative peek).
// @agent: `affected` carries the touched cell(s). store-in-specific => a single
// element. store-in-any that spreads across cells => multiple; the exact multi-
// cell receipt grouping is an OPEN convention hole (that it returns affected
// cells with post-store contents is ratified; the grouping is not).
export type StoreResult =
  | { status: StoreStatus.STORED; affected: CellView[] }
  | {
      status: StoreStatus.REJECTED
      affected: CellView[]
      rejectionCode: RejectionCode
      reason: string
    }

// --- peek result ----------------------------------------------------------

// In-bounds (including empty, contents []) vs out-of-bounds (nil contents +
// error). Same result-family spirit as StoreResult.
export type PeekResult =
  | { inBounds: true; cell: CellView }
  | { inBounds: false; error: string }

// --- sort criteria --------------------------------------------------------

// @agent: built-in orders — exact set is a hole (weight / type / stack-size /
// …). The client comparator is the escape hatch for orders not built in.
export enum SortOrder {
  BY_TYPE,
  BY_WEIGHT,
  BY_STACK_SIZE,
}

// Compares stacks-as-arrays. Coordinate is deliberately withheld (it's a sort
// OUTPUT, not an input). Inputs are NonEmptyStack by construction: sort ranges
// only over occupied placements, so an empty cell never reaches the comparator.
export type StackComparator = (a: NonEmptyStack, b: NonEmptyStack) => number

export type SortCriteria = SortOrder | StackComparator

// --- metadata -------------------------------------------------------------

export type InventoryMetadata = {
  dimensions: Footprint
  weightCapacity?: number // unset => infinite / weight ignored
  totalWeight: number
  usedCells: number
  freeCells: number
}

// --- policy ---------------------------------------------------------------

// @agent: concrete id scheme / code set are holes.
export type PolicyId = Unshaped<"PolicyId">
export type PolicyErrorCode = Unshaped<"PolicyErrorCode">
// @agent: op vocabulary a hole; policy scope stacking-only for now.
export type PolicyOperation = Unshaped<"PolicyOperation">
// @agent: role vocabulary (incoming / resident / …) a hole.
export type ItemRole = Unshaped<"ItemRole">
// @agent: PARKED — revisit when needs are clearer.
export type PolicyContext = Unshaped<"PolicyContext">

export type PolicyDecision =
  | { compliant: true }
  | {
      compliant: false
      reason: string
      violatedPolicy: PolicyId
      errorCode: PolicyErrorCode
    }

export type AffectedItem = {
  instance: ItemInstance
  role: ItemRole
}

// --- persistence ----------------------------------------------------------

// @agent: HELD, opaque. The round-trippable persisted form; Inventory owns both
// ends (snapshot / restore doors). Schema is decided at fill — deliberately NOT
// a projection of CellView (peek-all is a read-view; a snapshot is round-trip
// state). The client owns the storage technology.
export type Snapshot = Unshaped<"Snapshot">
