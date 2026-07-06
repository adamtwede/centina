// prototype.centina.ts — the Centina port of prototype.aisl (AISL v0), the
// founding fixture. Ported 1:1 from the author's rewrite, including its open
// questions and known gaps, then iterated on in centina-iterate sessions.
//
// loop:
// 1. supervisor prompts target with an implementation step.
// 2. we feed step to task matcher to see if there is any relevant feedback from previous attempts at this step or similar steps, and incorporate that into the prompt for the target model.
// 3. supervisor reviews/scores target output.
// 4. supervisor makes a decision about what to do based on score (and, in later iterations, previous atttempts): give feedback, break step down, escalate to a more capable model, or mark step as complete.
// 5a. if feedback is given, the loop repeats with the same step and the feedback from the previous attempt is incorporated into the prompt for the target model, so we go back to step 1.
// 5b. if the step needs to be broken down, the supervisor model does so, then makes a recursive call to restart the loop with the new sub-steps, so we repeat step 1, only this time within a recursive loop with its entry point here.
// 5c. if we need to escalate, we swap in a more capable model and repeat step 1, so we go back to step 1 UNLESS we have escalated to the supervisor model. if so, the supervisor model attempts the task itself (if in autonomous mode), marking it complete, or pauses the loop to alert the human for review. in either case, the step and its context, along with the models that attempted it, are feed to the task matching processor so that future similar tasks can be escalated immediately.
// 5d. if step is marked complete, we gather the accumulated feedback (if any) for the model that completed it and feed it to the task matching processor to be disseminated into "durable" storage. all feedback should be tagged with information about the model(s) that have attempted it.
// 6. move to the next step (see below), if any, or terminate task run.

import { Agent, Noun, deferred } from "./centina"
import { taskMatcherEngine } from "./task-matcher.centina"
import type { TaskMatchedContext } from "./task-matcher.centina"

/** @external "system-util" */
type Timestamp = Noun<"Timestamp">
/** @external "system-util" */
declare function timestamp(): Timestamp
/** @external "system-util" */
declare function anonymousMode(): boolean
/** @external "system-util" */
declare function pauseLoopAndAlertHuman(): void
/** @external "system-util" */
declare function humanIntervened(): boolean

enum ModelId {
  CLAUDE_OPUS = "CLAUDE_OPUS",
  CLAUDE_SONNET = "CLAUDE_SONNET",
  QWEN_LOCAL = "QWEN_LOCAL",
  MINIMAX_OPENROUTER = "MINIMAX_OPENROUTER",
}
enum Decision {
  FEEDBACK_REQUIRED,
  DECOMPOSE_STEP,
  ESCALATE,
  MARK_COMPLETE,
  MAX_ESCALATION,
}
// enum Judgement { SUCCEEDED, FAILED, INCONCLUSIVE, NEEDS_REVIEW }
enum FeedbackDestination {
  PROJECT_DOCS,
  AGENTS_DOC,
  MODEL_SYSTEM_PROMPT,
  SKILL,
  HARNESS_CONFIG,
  TASK_TYPE_MAP,
  OTHER,
}
enum Score {
  FAIL, // little or no usable output
  PARTIAL_SUCCESS_LOW, // some output conforms to expectations
  PARTIAL_SUCCESS_HIGH, // majority of output conforms to expectations
  SUCCESS, // output sufficiently conforms to expectations
}

type Step = Noun<"Step">
type Feedback = Noun<"Feedback">

const escalations = [
  ModelId.QWEN_LOCAL,
  ModelId.MINIMAX_OPENROUTER,
  ModelId.CLAUDE_SONNET,
  ModelId.CLAUDE_OPUS,
]

interface ImplementationAttempt {
  timestamp: Timestamp
  score: Score
  feedback?: Feedback
}

interface TaskRunRecord {
  step: Step
  model: ModelId
  attempt: ImplementationAttempt
}
const taskRunLog: TaskRunRecord[] = []

interface LoopFeedbackDestination {
  key: Feedback
  value: FeedbackDestination
}

function main(): void {
  const supervisorModel = new Agent(escalations[escalations.length - 1]) // the most capable model in the escalation chain
  const targetModel = new Agent(escalations[0])

  const humanInput = "Draft an implementation plan to ..."
  const implementationPlan = supervisorModel.prompt(humanInput) as Step[]
  startImplementation(implementationPlan, supervisorModel, targetModel)
}

function startImplementation(
  implementationPlan: Step[],
  supervisorModel: Agent<ModelId>,
  targetModel: Agent<ModelId>,
): void {
  for (const implementationStep of implementationPlan) {
    implementationLoop(implementationStep, supervisorModel, targetModel)
  }
}

function implementationLoop(
  implementationStep: Step,
  supervisorModel: Agent<ModelId>,
  targetModel: Agent<ModelId>,
  loopRunFeedback?: Feedback,
) {
  let implementationStepComplete = false
  let stepPromptOutput: unknown
  const attempt: ImplementationAttempt = {} as ImplementationAttempt // assumption: fields committed over the iteration

  do {
    let decision: Decision
    if (supervisorModel === targetModel) {
      attempt.timestamp = timestamp()
      supervisorModel.prompt(
        `Please implement the following: ${implementationStep}`,
      ) // max escalation policy.
      decision = Decision.MAX_ESCALATION
      // @agent: attempt.score is deliberately left unset on this path — open
      // design question (not yet resolved) on how to differentiate a
      // max-escalation attempt from a normally-scored one; see the note below
      // on MAX_ESCALATION about matching future tasks.
    } else {
      attempt.timestamp = timestamp()

      let stepPromptText = `Generate a prompt for ${targetModel.specification} to implement: ${implementationStep}`

      // @agent: loop run feedback takes precedence over task matched feedback, if present. if we started out with task matched feedback, we can expect that to remain present in session context, onto which we "layer" more recent/salient loop run feedback:
      if (loopRunFeedback) {
        stepPromptText = `${stepPromptText}, and incorporate this feedback into the prompt: ${loopRunFeedback}`
      } else {
        const taskMatchedFeedback = taskMatcher(implementationStep, targetModel)
        if (taskMatchedFeedback) {
          stepPromptText = `${stepPromptText}, and incorporate this feedback into the prompt: ${taskMatchedFeedback}`
        }
      }

      // supervisor drafts the prompt, then the target model is the one that
      // actually attempts the step — the assumption at the cast below is that
      // the supervisor's draft is usable verbatim as the target's prompt.
      const generatedPrompt = supervisorModel.prompt(stepPromptText)
      stepPromptOutput = targetModel.prompt(generatedPrompt as string)

      attempt.score = scoreAttempt(
        implementationStep,
        stepPromptOutput,
        targetModel,
      )

      decision = makeDecision(
        implementationStep,
        stepPromptOutput,
        attempt.score,
        taskRunLog,
        supervisorModel,
        targetModel,
      )
    }

    switch (decision) {
      case Decision.FEEDBACK_REQUIRED: {
        const feedback = proposeFeedback(
          implementationStep,
          stepPromptOutput,
          supervisorModel,
          targetModel,
        )
        attempt.feedback = feedback
        taskRunLog.push({
          step: implementationStep,
          model: targetModel.modelId,
          attempt,
        })
        implementationLoop(
          implementationStep,
          supervisorModel,
          targetModel,
          feedback,
        )
        break
      }
      case Decision.DECOMPOSE_STEP: {
        const subSteps = decomposeStep(implementationStep, supervisorModel)
        taskRunLog.push({
          step: implementationStep,
          model: targetModel.modelId,
          attempt,
        })
        for (const subStep of subSteps) {
          implementationLoop(subStep, supervisorModel, targetModel)
        }
        break
      }
      case Decision.ESCALATE:
        escalate(implementationStep, supervisorModel, targetModel)
        return
      case Decision.MARK_COMPLETE: {
        taskRunLog.push({
          step: implementationStep,
          model: targetModel.modelId,
          attempt,
        })
        encodeStepImplementationAttemptRunIntoTaskMatcher(
          taskRunLog,
          implementationStep,
        )
        implementationStepComplete = true
        break
      }
      case Decision.MAX_ESCALATION:
        // @agent: no feedback given in this case, the omission of which should be considered a deliberate indicator that future matched tasks should be escalated to the supervisor model immediately, at least assuming the same models/agents are involved (how that works is still TBD, and depends on the task matcher engine's implementation).
        taskRunLog.push({
          step: implementationStep,
          model: targetModel.modelId,
          attempt,
        })
        encodeStepImplementationAttemptRunIntoTaskMatcher(
          taskRunLog,
          implementationStep,
        )
        implementationStepComplete = true
        break
    }
  } while (!implementationStepComplete && !humanIntervened())
}

function escalate(
  implementationStep: Step,
  supervisorModel: Agent<ModelId>,
  targetModel: Agent<ModelId>,
): void {
  const autonomous = anonymousMode()
  const targetModelIndex = escalations.indexOf(targetModel.modelId)

  if (
    targetModelIndex !== -1 &&
    targetModelIndex + 1 !== escalations.length - 1 // our next escalation would NOT be to the supervisor...
  ) {
    const escalationModelId = escalations[targetModelIndex + 1]
    const escalationModel = new Agent(escalationModelId)
    implementationLoop(implementationStep, supervisorModel, escalationModel)
  } else {
    if (autonomous) {
      implementationLoop(implementationStep, supervisorModel, supervisorModel) // if escalation model can't handle it, have supervisor do it.
    } else {
      pauseLoopAndAlertHuman()
    }
  }
}

function decomposeStep(
  highLevelStep: Step,
  supervisorModel: Agent<ModelId>,
): Step[] {
  // @agent: what do to if the step cannot be meaningfully broken down further without resorting to step-by-step instructions?
  return supervisorModel.prompt(
    `Break this down into simpler steps but not to the point of explicit step-by-step instructions: ${highLevelStep}`,
  ) as Step[]
}

function proposeFeedback(
  implementationStep: Step,
  targetModelOutput: unknown,
  supervisorModel: Agent<ModelId>,
  targetModel: Agent<ModelId>,
): Feedback {
  return supervisorModel.prompt(
    `Review this output for ${implementationStep} and provide structured feedback for ${targetModel} that identifies the specific areas of failure and suggests improvements *without* providing step-by-step instructions: ${targetModelOutput}`,
  ) as Feedback
}

// @agent: supervisor agent examines the attempts for the given task to decide if the feedback is relevant to the task as a whole, or if it is only relevant to a specific model's attempt at the task. if it is relevant to the task as a whole, it should be encoded into project docs, agent docs, and the task matcher for future similar tasks. if it is only relevant to a specific model's attempt, it should be encoded into that model's system prompt or a skill for future attempts at similar tasks:
const organizeFeedback =
  deferred<
    (
      implementationStep: Step,
      taskRunLog: TaskRunRecord[],
    ) => LoopFeedbackDestination[]
  >()

// @agent: supervisor model looks at whether or not the target model is improving or not over the course of X attempts at implementing the given step, in part by comparing ImplementationAttempt.score across multiple consecutive attempts, analyzing the trend, and making a determination about how to proceed:
const makeDecision =
  deferred<
    (
      implementationStep: Step,
      stepPromptOutput: unknown,
      attemptScore: Score,
      taskRunLog: TaskRunRecord[],
      supervisorModel: Agent<ModelId>,
      targetModel: Agent<ModelId>,
    ) => Decision
  >()

// @agent: supervisor model incorporates feedback into the task matcher examining the destination code, which indicates where the feedback should be stored, e.g., PLAN.md (or equivalent), AGENTS.md (or equivalent), target model system prompt, skill, harness config, or a map keyed by "task type," etc.
function encodeStepImplementationAttemptRunIntoTaskMatcher(
  taskRunLog: TaskRunRecord[],
  implementationStep: Step,
): void {
  const destinationMap = organizeFeedback(implementationStep, taskRunLog)
  taskMatcherEngine.encodeTask(implementationStep, taskRunLog, destinationMap)
}

// @agent: the question for the supervisor model is: for this task/step, for this model (but also for any model), have we done something similar in the past that can be found in our project docs or task matcher database that can be used to improve the prompt for this task/step? if so, return it:
function taskMatcher(
  implementationStep: Step,
  targetModel: Agent<ModelId>,
): TaskMatchedContext | undefined {
  return taskMatcherEngine.matchTask(implementationStep, targetModel)
}

// @agent: the supervisor model scores the implementation against the task's basic requirements in isolation:
const scoreAttempt =
  deferred<
    (
      implementationStep: Step,
      targetModelOutput: unknown,
      targetModel: Agent<ModelId>,
    ) => Score
  >()
