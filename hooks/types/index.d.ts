/** One line of the ledger-citation band: a cited label as the ledger knows it, or why it didn't resolve. */
export type Row = {
  /** The citation as written, `sz:P12` or `sz:P12(a)`. */
  cite: string
  /** The entry's label without the system or part, `sz:P12`. Set when it resolved. */
  key?: string
  /** The part cited, `a` of `sz:P12(a)`. */
  part?: string
  /** The system directory holding the entry's LEDGER.json. */
  dir?: string
  /** Set only when the cite resolves in more than one system. */
  system?: string
  title?: string
  status?: string
  parkedUntil?: string
  obsoletedBy?: string[]
  /** Absolute path and line of the entry's heading, for opening it. */
  path?: string
  line?: number
  /** Set when the cite didn't resolve: no such label, or no such part on it. */
  problem?: 'no-label' | 'no-part'
}

/**
 * The explanation pane's content, asked for, arrived, or failed: one entry's ELI5
 * (`cite` is its citation), or the TLDR of the latest reply, the phase's
 * progress or a second opinion on the reply (`cite` is a heading). `isSendable`
 * is set on an answer the pane offers to send on to the main session.
 */
export type Eli5 = { cite: string; status: 'asking' | 'answered' | 'failed'; text: string; isSendable?: boolean }

/** How long-running an item is, against the closed items of its kind in the same system. */
export type Drift = {
  key: string
  /** Characters of the item's own text, which only grows: the ledger is append-only. */
  size: number
  /** Entries that name the item in `Premises`. */
  findings: number
  /** Days since the item's `Date`, when it has one and a clock reading is given. */
  days?: number
  /** The closed items of the same kind it is compared with. Absent when there are too few to compare. */
  typical?: { count: number; median: number; largest: number; findingsMedian: number }
  /**
   * `high`: longer than any closed item of its kind; `warn`: more than WARN_RATIO
   * times the median one; `ok`: neither; `unknown`: no baseline or no size.
   */
  level: "ok" | "warn" | "high" | "unknown"
}

declare module 'claude-code' {
  interface PluginState {
    /**
     * `reply` is the text of the latest main-agent reply, for TLDR THIS and Second
     * opinion; `request` is the reader's last typed prompt, for Second opinion.
     * `hasPhase` is whether a ledger has an active phase, which is what Phase
     * progress needs; `hasItem` is whether a work item is active, which is what
     * Item progress needs; `drift` is how long-running the current work item is;
     * `trailDir` is the system directory whose TRAIL.jsonl the Tracker button opens.
     */
    centina: { cited: Row[]; isHidden: boolean; eli5: Eli5 | null; reply: string; request: string; hasPhase: boolean; hasItem: boolean; drift: Drift | null; trailDir: string | null }
  }
}
