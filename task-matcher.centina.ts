// task-matcher.centina.ts — PROVISIONAL BOUNDARY DECLARATOR. Extracted from
// prototype.centina.ts (the first spec that needed it) so any future spec
// needing task-matching imports this instead of reinventing it. No real
// implementation or spec of its own yet — the @agent: note below is still
// the author's honest state on that. Declarations only: no function bodies,
// no spec logic. Promote to a full spec (with its own deferred holes, if
// any) when the task matcher is actually designed.

import { Agent, Noun } from "./centina"

/** @external "task-matcher" — in AISL v0 this was auto-implied by the boundary door signature; TS wants it declared */
export type TaskMatchedContext = Noun<"TaskMatchedContext">

/**
 * @boundary
 * @agent: the task matcher database is probably a separate spec. for now we
 * just treat it as a solved problem.
 */
export declare class TaskMatcherEngine {
  encodeTask(
    task: unknown,
    taskRunLog: unknown[],
    destinationMap: unknown[],
  ): void
  matchTask(
    task: unknown,
    model: Agent<string>,
  ): TaskMatchedContext | undefined
}

export const taskMatcherEngine = new TaskMatcherEngine()
