// The I/O contract for the hill-climbing loop. Draft 2, 2026-10-25.
//
// Implement the loop in one file, `loop.ts`, that exports `run` with the
// signature below. TypeScript, run with tsx on Node 22. Import nothing but
// this file's types: every effect the loop has on the world goes through the
// calls on `Env`, and the loop has no other I/O.
//
// Where your source and this contract differ in shape (names, types, how a
// call is split), this contract wins. Where your source says what the loop
// does, your source wins: the contract says only what can happen at the
// loop's edge, never when, how often or in what order.

export type ModelId = string

export interface Step {
  id: string
  description: string
}

/** One earlier attempt at the step being decided on. */
export interface AttemptSummary {
  model: ModelId
  score: number
  feedback?: string
}

export type Decision =
  | { kind: "feedback"; feedback: string }
  | { kind: "breakdown" }
  | { kind: "escalate" }
  | { kind: "complete" }

/** Feedback given on an attempt, tagged with the model(s) it concerns. */
export interface TaggedFeedback {
  text: string
  models: ModelId[]
}

/** What the task matcher holds: whatever was written to it, as written. */
export type MemoryRecord =
  | { kind: "feedback"; step: Step; feedback: TaggedFeedback[]; models: ModelId[] }
  | { kind: "escalation"; step: Step; context: string; models: ModelId[] }

export interface Env {
  /** Target models, least to most capable. */
  targets: ModelId[]
  /** The supervisor: more capable than every target. */
  supervisorModel: ModelId
  autonomous: boolean

  engine: {
    /** Prompt a model to carry out a step. Any model, the supervisor included. */
    attempt(model: ModelId, step: Step, context: string): Promise<string>
  }

  supervisor: {
    /** Score a model's output for a step, from 0 (worst) to 1 (best). */
    review(step: Step, output: string): Promise<number>
    /** Decide what to do next, given the score and any earlier attempts at the step. */
    decide(
      step: Step,
      output: string,
      score: number,
      history: AttemptSummary[],
    ): Promise<Decision>
    /** Break a step into sub-steps. */
    breakdown(step: Step): Promise<Step[]>
  }

  memory: {
    /** Records relevant to a step. */
    lookup(step: Step): Promise<MemoryRecord[]>
    /** Record a step that was escalated, its context, and the models that attempted it. */
    recordEscalation(step: Step, context: string, models: ModelId[]): Promise<void>
    /** Store a step's feedback durably, with the models that attempted it. */
    storeFeedback(
      step: Step,
      feedback: TaggedFeedback[],
      models: ModelId[],
    ): Promise<void>
  }

  human: {
    /** Alert the human about a step. Resolves when the human responds. */
    alert(step: Step, note: string): Promise<void>
  }
}

/** Run the loop over a plan's steps. What it returns is up to you. */
export type Run = (plan: Step[], env: Env) => Promise<unknown>
