// hill-climbing-loop.centina.ts — the Centina port of prototype.aisl (AISL v0),
// the founding fixture. Ported 1:1 from the author's rewrite, including its
// open questions and known gaps, then iterated on in centina-iterate sessions.
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

import { Agent, Skill, deferred } from "../../centina"
import { taskMatcherEngine } from "./task-matcher.centina"
import { ModelId } from "./shared"
import {
  Attempt,
  Task,
  Grade,
  Score,
  TaskRunRecord,
  Feedback,
} from "./task-corpus.centina"

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

function main(): void {
  const supervisorModel = new Agent(escalations[escalations.length - 1]) // the most capable model in the escalation chain
  const targetModel = new Agent(escalations[0])

  const humanInput = "Draft an implementation plan to ..."
  const implementationPlan = supervisorModel.prompt(humanInput) as Task[]
  startImplementation(implementationPlan, supervisorModel, targetModel)
}

function startImplementation(
  implementationPlan: Task[],
  supervisorModel: Agent<ModelId>,
  targetModel: Agent<ModelId>,
): void {
  for (const implementationStep of implementationPlan) {
    implementationLoop(implementationStep, supervisorModel, targetModel)
  }
}

function implementationLoop(
  implementationStep: Task,
  supervisorModel: Agent<ModelId>,
  targetModel: Agent<ModelId>,
  loopRunFeedback?: Feedback,
) {
  const taskRunRecord: TaskRunRecord = {
    uuid: randomUUID(),
    task: implementationStep,
    grade: Grade.INCONCLUSIVE,
    attemptRecord: [],
  }
  let implementationStepComplete = false
  let stepPromptOutput: unknown

  do {
    const attempt: Attempt = {} as Attempt // assumption: fields committed over the iteration
    let decision: Decision
    if (supervisorModel.modelId === targetModel.modelId) {
      attempt.timestamp = timestamp()
      supervisorModel.prompt(
        `Please implement the following: ${implementationStep}`,
      ) // max escalation policy.
      attempt.score = Score.MAX_ESCALATED
      decision = Decision.MAX_ESCALATION
    } else {
      attempt.timestamp = timestamp()

      let stepPromptText = `Generate a prompt for ${targetModel.specification} to implement: ${implementationStep}`

      // task-matcher lookup always runs, so we know whether a match existed even
      // on attempts where loopRunFeedback took precedence in the prompt. loopRunFeedback
      // still wins the prompt slot when present — this is about not losing the
      // diagnostic signal, not changing which feedback the target model sees.
      const matchedTask = taskMatcher(implementationStep, targetModel)

      // taskRunRecord.attemptRecord = matchedTask ? matchedTask.attemptRecord : []

      if (loopRunFeedback) {
        stepPromptText = `${stepPromptText}, and incorporate this feedback into the prompt: ${loopRunFeedback}`
        attempt.feedback = loopRunFeedback
      } else if (matchedTask) {
        const feedbackSummary = supervisorModel.invokeSkill(
          feedbackSummarySkill,
          matchedTask,
          targetModel.modelId,
        )
        attempt.feedback = feedbackSummary
        stepPromptText = `${stepPromptText}, and incorporate this feedback into the prompt: ${feedbackSummary}`
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
        taskRunRecord,
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
        taskRunRecord.attemptRecord.push(attempt)
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
        if (subSteps) {
          taskRunRecord.attemptRecord.push(attempt)
          for (const subStep of subSteps) {
            implementationLoop(subStep, supervisorModel, targetModel)
          }
        } else {
          // if we can't break it down further, escalate to supervisor:
          escalate(implementationStep, supervisorModel, supervisorModel)
        }
        break
      }
      case Decision.ESCALATE:
        escalate(implementationStep, supervisorModel, targetModel)
        return
      case Decision.MARK_COMPLETE: {
        taskRunRecord.attemptRecord.push(attempt)
        encodeStepImplementationAttemptRunIntoTaskMatcher(taskRunRecord)
        implementationStepComplete = true
        break
      }
      case Decision.MAX_ESCALATION:
        // Score.MAX_ESCALATED on the attempt is the signal that this step went to
        // the supervisor model directly — see task-matcher.centina.ts's note on how
        // matched future tasks should react to it.
        taskRunRecord.attemptRecord.push(attempt)
        encodeStepImplementationAttemptRunIntoTaskMatcher(taskRunRecord)
        implementationStepComplete = true
        break
    }
  } while (!implementationStepComplete && !humanIntervened())
}

function escalate(
  implementationStep: Task,
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
  highLevelStep: Task,
  supervisorModel: Agent<ModelId>,
): Task[] | null {
  const decompositionAttempt = supervisorModel.prompt(
    `Break this down into simpler steps but not to the point of explicit step-by-step instructions: ${highLevelStep}`,
  )
  return supervisorModel.review(
    decompositionAttempt,
    `Does this represent a meaningful decomposition of "${highLevelStep}" into distinct sub-steps, without degenerating into step-by-step instructions? If not — or if it's unchanged/degenerate — respond with null.`,
  ) as Task[] | null
}

function proposeFeedback(
  implementationStep: Task,
  targetModelOutput: unknown,
  supervisorModel: Agent<ModelId>,
  targetModel: Agent<ModelId>,
): Feedback {
  return supervisorModel.prompt(
    `Review this output for ${implementationStep} and provide structured feedback for ${targetModel} that identifies the specific areas of failure and suggests improvements *without* providing step-by-step instructions: ${targetModelOutput}`,
  ) as Feedback
}

// supervisor model looks at whether or not the target model is improving or not over the course of X attempts at implementing the given step, in part by comparing ImplementationAttempt.score across multiple consecutive attempts, analyzing the trend, and making a determination about how to proceed:
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

// supervisor model incorporates feedback into the task matcher examining the destination code, which indicates where the feedback should be stored, e.g., PLAN.md (or equivalent), AGENTS.md (or equivalent), target model system prompt, skill, harness config, or a map keyed by "task type," etc.
function encodeStepImplementationAttemptRunIntoTaskMatcher(
  taskRunLog: TaskRunRecord,
): void {
  // const destinationMap = organizeFeedback(implementationStep, taskRunLog)
  taskMatcherEngine.encodeTask(taskRunLog)
}

// the question for the supervisor model is: for this task/step,
// for this model (but also for any model), have we done something
// similar in the past that can be found in our project docs or task
// matcher database that can be used to improve the prompt for this
// task/step? if so, return it. this function is always called whether
// or not the task ended up needing additional, in-loop feedback, so
// both successes and misses on task-matched feedback can be logged:
function taskMatcher(
  implementationStep: Task,
  targetModel: Agent<ModelId>,
): TaskRunRecord | undefined {
  return taskMatcherEngine.matchTask(implementationStep, targetModel.modelId)
}

// the supervisor model scores the implementation against the task's basic requirements in isolation:
const scoreAttempt = deferred<
  "spec",
  (
    implementationStep: Task,
    targetModelOutput: unknown,
    targetModel: Agent<ModelId>,
  ) => Score
>()
