// loop:
// 1. supervisor prompts target with an implementation step.
// 2. we feed step to task matcher to see if there is any relevant feedback from
// previous attempts at this step or similar steps, and incorporate that into the
// prompt for the target model.
// 3. supervisor reviews/scores target output.
// 4. supervisor makes a decision about what to do based on score (and, in later
// iterations, previous atttempts): give feedback, break step down, escalate to
// a more capable model, or mark step as complete.
// 5a. if feedback is given, the loop repeats with the same step and the feedback
// from the previous attempt is incorporated into the prompt for the target model,
// so we go back to step 1.
// 5b. if the step needs to be broken down, the supervisor model does so, then
// makes a recursive call to restart the loop with the new sub-steps, so we repeat
// step 1, only this time within a recursive loop with its entry point here.
// 5c. if we need to escalate, we swap in a more capable model and repeat step 1,
// so we go back to step 1 UNLESS we have escalated to the supervisor model.
// if so, the supervisor model attempts the task itself (if in autonomous mode),
// marking it complete, or pauses the loop to alert the human for review.
// in either case, the step and its context, along with the models that attempted
// it, are fed to the task matching processor so that future similar tasks can be
// escalated immediately.
// 5d. if step is marked complete, we gather the accumulated feedback (if any) for
// the model that completed it and feed it to the task matching processor to be
// disseminated into "durable" storage. all feedback should be tagged with information
// about the model(s) that have attempted it.
// 6. move to the next step (see below), if any, or terminate task run.

import { Agent, Skill, deferred } from "../../centina"
import { taskMatcherEngine } from "./task-matcher.centina"
import {
  ModelId,
  Attempt,
  Task,
  Grade,
  Score,
  TaskRunRecord,
  Feedback,
} from "./shared.centina"

/** @external "node:crypto" */
declare function randomUUID(): string
/** @external "system-util" */
declare function timestamp(): number
/** @external "system-util" */
declare function anonymousMode(): boolean
/** @external "system-util" */
declare function pauseLoopAndAlertHuman(): void
/** @external "system-util" */
declare function humanIntervened(): boolean

const feedbackSummarySkill: Skill<[TaskRunRecord, ModelId?], Feedback> = {
  name: "centina-feedback-summary",
}

enum Decision {
  FEEDBACK_REQUIRED,
  DECOMPOSE_STEP,
  ESCALATE,
  MARK_COMPLETE,
  MAX_ESCALATION,
}

const escalations = [
  ModelId.QWEN_LOCAL,
  ModelId.MINIMAX_OPENROUTER,
  ModelId.CLAUDE_SONNET,
  ModelId.CLAUDE_OPUS,
]


/**
 * Sets up the initial state for a new task run, 
 * including picking the initial model to use for the target model, 
 * the supervisor model, and the initial implementation plan to attempt.
 * This is the entry point for the hill-climbing loop.
 * Calls `startImplementation` to begin the loop with the implementation plan.
 */
const main = deferred<"open", () => void>()

/**
 * Calls `implementationLoop` in a loop, once per step, until implementationPlan's
 * constituent steps are marked complete.
 */
const startImplementation = deferred<
  "open",
  (
    implementationPlan: Task[],
    supervisorModel: Agent<ModelId>,
    targetModel: Agent<ModelId>,
  ) => void
>()

/**
* The main loop of the hill-climbing implementation process. Runs steps 1-5 in the
* header comment, repeating until the implementation step is marked complete. 
* Once the step is marked complete, the loop returns to `startImplementation`
* to move on to the next step in the implementation plan.
*/
const implementationLoop = deferred<
  "open",
  (
    implementationStep: Task,
    supervisorModel: Agent<ModelId>,
    targetModel: Agent<ModelId>,
    loopRunFeedback?: Feedback,
  ) => void
>()

/**
 * Escalates the implementation step to a more capable model.
 * If there are no more capable models available, the supervisor model attempts the step itself.
 * If the supervisor model is in autonomous mode, it attempts the step and marks it complete.
 * If not, it pauses the loop and alerts a human for review.
 */
const escalate = deferred<
  "open",
  (
    implementationStep: Task,
    supervisorModel: Agent<ModelId>,
    targetModel: Agent<ModelId>,
  ) => void
>()

/**
 * Tasks the supervisor model with decomposing the current implementation step into smaller sub-steps.
 * Returns an array of new sub-steps to be implemented, or null if decomposition is not possible.
 */
const decomposeStep = deferred<
  "open",
  (highLevelStep: Task, supervisorModel: Agent<ModelId>) => Task[] | null
>()

/** 
 * Tasks the supervisor model with proposing feedback for the current implementation step,
 * appropriate for the target model's output. Returns the feedback to be incorporated into 
 * the next prompt for the target model.
*/
const proposeFeedback = deferred<
  "open",
  (
    implementationStep: Task,
    targetModelOutput: unknown,
    supervisorModel: Agent<ModelId>,
    targetModel: Agent<ModelId>,
  ) => Feedback
>()

/**
 * supervisor model looks at whether or not the target model is improving or not
 * over the course of X attempts at implementing the given step, in part by comparing 
 * ImplementationAttempt.score across multiple consecutive attempts,
 * analyzing the trend, and making a determination about how to proceed:
 */
const makeDecision = deferred<
  "spec",
  (
    implementationStep: Task,
    stepPromptOutput: unknown,
    attemptScore: Score,
    taskRunLog: TaskRunRecord,
    supervisorModel: Agent<ModelId>,
    targetModel: Agent<ModelId>,
  ) => Decision
>()

/**
*  supervisor model incorporates feedback into the task matcher examining the
*  destination code, which indicates where the feedback should be stored,
*  e.g., PLAN.md (or equivalent), AGENTS.md (or equivalent), target model
*  system prompt, skill, harness config, or a map keyed by "task type," etc.
 */
const encodeStepImplementationAttemptRunIntoTaskMatcher = deferred<
  "open",
  (taskRunLog: TaskRunRecord) => void
>()

/**
*  the question for the supervisor model here is: for this task/step,
*  for this model (but also for any model), have we done something
*  similar in the past that can be found in our project docs or task
*  matcher database that can be used to improve the prompt for this
*  task/step? if so, return it. this function is always called whether
*  or not the task ended up needing additional, in-loop feedback, so
*  both successes and misses on task-matched feedback can be logged.
 */
const taskMatcher = deferred<
  "open",
  (
    implementationStep: Task,
    targetModel: Agent<ModelId>,
  ) => TaskRunRecord | undefined
>()

/** 
 * the supervisor model scores the implementation against the task's basic 
 * requirements in isolation.
 * */
const scoreAttempt = deferred<
  "spec",
  (
    implementationStep: Task,
    targetModelOutput: unknown,
    targetModel: Agent<ModelId>,
  ) => Score
>()
