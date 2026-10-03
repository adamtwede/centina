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

/** The ELI5 pane's content: one entry's explanation, asked for, arrived, or failed. */
export type Eli5 = { cite: string; status: 'asking' | 'answered' | 'failed'; text: string }

declare module 'claude-code' {
  interface PluginState {
    centina: { cited: Row[]; isHidden: boolean; eli5: Eli5 | null }
  }
}
