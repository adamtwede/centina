// prototype.centina.ts — the Centina port of prototype.aisl (AISL v0), the
// founding fixture. Ported 1:1 from the author's rewrite, including its open
// questions and known gaps. The tsc errors this file produces are PRESERVED
// FINDINGS awaiting the author's decisions (see CLAUDE.md) — do not "fix" them
// without the author.
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

/** @external "system-util" */
type Timestamp = Noun<"Timestamp">
/** @external "system-util" */
declare function timestamp(): Timestamp
/** @external "system-util" */
declare function autonomous_mode(): boolean
/** @external "system-util" */
declare function pause_loop_and_alert_human(): void
/** @external "system-util" */
declare function human_intervened(): boolean

/** @external "task-matcher" — in AISL v0 this was auto-implied by the boundary door signature; TS wants it declared */
type TaskMatchedContext = Noun<"TaskMatchedContext">

enum ModelId {
	CLAUDE_OPUS,
	QWEN_LOCAL,
	MINIMAX_OPENROUTER,
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

const cloud_model = new Agent(ModelId.CLAUDE_OPUS)
const local_model = new Agent(ModelId.QWEN_LOCAL)
const escalation_model = new Agent(ModelId.MINIMAX_OPENROUTER)

interface ImplementationAttempt {
	timestamp: Timestamp
	score: Score
	feedback?: Feedback // port note: optional — MARK_COMPLETE pushes attempts that never received feedback
}

// @agent: would this be a better way to represent a step implementation loop?
// map LoopRunMap:
// 	key: Step + ModelId # composite key
// 	value: ImplementationAttempt[]

interface LoopRun {
	step: Step
	model: ModelId
	attempts: ImplementationAttempt[]
}

// seems like this might be unnecessary:
interface ImplementationRun {
	iterations: LoopRun[]
}
const implementation_run: ImplementationRun = { iterations: [] }

interface LoopFeedbackDestination {
	key: Feedback
	value: FeedbackDestination
}

/**
 * @boundary
 * @agent: the task matcher database is probably a separate spec. for now we
 * just treat it as a solved problem.
 */
declare class TaskMatcherEngine {
	encode_run_into_task_matcher(
		loop_run: LoopRun,
		destination_map: LoopFeedbackDestination[],
	): void
	match_task(step: Step, model: Agent<ModelId>): TaskMatchedContext | null // port note: `| null` inferred from the AISL `if task_matched_feedback:` truthiness check — ratify
}
const task_matcher_engine = new TaskMatcherEngine()

function main(): void {
	const supervisor_model = cloud_model
	const human_input = "Draft an implementation plan to ..."
	const implementation_plan = supervisor_model.prompt(human_input) as Step[]
	start_implementation(implementation_plan, supervisor_model, local_model)
}

function start_implementation(
	implementation_plan: Step[],
	supervisor_model: Agent<ModelId>,
	target_model: Agent<ModelId>,
): void {
	for (const implementation_step of implementation_plan) {
		const run = implementation_loop(
			implementation_step,
			supervisor_model,
			target_model,
		)
		implementation_run.iterations.push(run)
	}
}

function implementation_loop(
	implementation_step: Step,
	supervisor_model: Agent<ModelId>,
	target_model: Agent<ModelId>,
	loop_run_feedback?: Feedback,
): LoopRun {
	let implementation_step_complete = false
	const loop_run = {} as LoopRun // assumption: fields committed immediately below
	loop_run.step = implementation_step
	loop_run.model = target_model.model_id
	loop_run.attempts = []

	do {
		let decision: Decision
		if (supervisor_model === target_model) {
			supervisor_model.prompt(
				`Please implement the following: ${implementation_step}`,
			) // max escalation policy.
			decision = Decision.MAX_ESCALATION
		} else {
			const attempt = {} as ImplementationAttempt // assumption: fields committed over the iteration
			attempt.timestamp = timestamp()

			let step_prompt_text = `Generate a prompt for ${target_model.specification} to implement: ${implementation_step}`

			// @agent: loop run feedback takes precedence over task matched feedback, if present. if we started out with task matched feedback, we can expect that to remain present in session context, onto which we "layer" more recent/salient loop run feedback:
			if (loop_run_feedback) {
				step_prompt_text = `${step_prompt_text}, and incorporate this feedback into the prompt: ${loop_run_feedback}`
			} else {
				const task_matched_feedback = task_matcher(
					implementation_step,
					target_model,
				)
				if (task_matched_feedback) {
					step_prompt_text = `${step_prompt_text}, and incorporate this feedback into the prompt: ${task_matched_feedback}`
				}
			}

			const step_prompt_output = supervisor_model.prompt(step_prompt_text)

			attempt.score = score_attempt(
				implementation_step,
				target_model_output,
				target_model,
			)

			decision = make_decision(
				implementation_step,
				step_prompt_output,
				attempt.score,
				loop_run,
				supervisor_model,
				target_model,
			)
		}

		switch (decision) {
			case Decision.FEEDBACK_REQUIRED: {
				const feedback = propose_feedback(
					implementation_step,
					target_model_output,
					supervisor_model,
					target_model,
				)
				attempt.feedback = feedback
				// @agent: does it make sense to do this as opposed to tracking a local feedback variable?
				loop_run.attempts.push(
					...implementation_loop(
						implementation_step,
						supervisor_model,
						target_model,
						feedback,
					).attempts,
				) // @agent: which one? this?
				// return implementation_loop(implementation_step, supervisor_model, target_model, feedback) // @agent: or this? ideally, each loop_run represents a 1:1 relationship between a particular model's attempt to complete a particular implementation step, and so contains all the attempts for a given step for a given model. but some steps get broken down, others escalated, etc., so it's not clear how best to represent this.
				break
			}
			case Decision.DECOMPOSE_STEP: {
				const sub_steps = decompose_step(implementation_step, supervisor_model)
				for (const sub_step of sub_steps) {
					// loop_run.attempts.push(...implementation_loop(sub_step, supervisor_model, target_model).attempts) // @agent: which one? this?
					return implementation_loop(sub_step, supervisor_model, target_model) // @agent: or this? see above.
				}
				break
			}
			case Decision.ESCALATE:
				escalate(
					implementation_step,
					step_prompt_output,
					supervisor_model,
					target_model,
				)
				break
			case Decision.MARK_COMPLETE:
				loop_run.attempts.push(attempt)
				encode_loop_run_into_task_matcher(loop_run)
				implementation_step_complete = true
				break
			case Decision.MAX_ESCALATION:
				// @agent: we would want this particular task to be escalated right away in the future, assuming the same models/agents are involved. that is why this case is separated out, despite looking identical to MARK_COMPLETE. it may not need to be treated differently at all in reality, depending on how the task matcher engine works.
				loop_run.attempts.push(attempt)
				encode_loop_run_into_task_matcher(loop_run)
				implementation_step_complete = true
				break
		}
	} while (!implementation_step_complete && !human_intervened())

	return loop_run
}

function escalate(
	implementation_step: Step,
	step_prompt_output: string,
	supervisor_model: Agent<ModelId>,
	target_model: Agent<ModelId>,
): void {
	const autonomous = autonomous_mode()
	if (target_model === escalation_model && autonomous) {
		implementation_loop(implementation_step, supervisor_model, supervisor_model) // if escalation model can't handle it, have supervisor do it.
	} else if (target_model === escalation_model && !autonomous) {
		pause_loop_and_alert_human()
	} else {
		implementation_loop(implementation_step, supervisor_model, escalation_model)
	}
}

function decompose_step(
	high_level_step: Step,
	supervisor_model: Agent<ModelId>,
): Step[] {
	// @agent: what do to if the step cannot be meaningfully broken down further without resorting to step-by-step instructions?
	return supervisor_model.prompt(
		`Break this down into simpler steps but not to the point of explicit step-by-step instructions: ${high_level_step}`,
	) as Step[]
}

function propose_feedback(
	implementation_step: Step,
	target_model_output: unknown,
	supervisor_model: Agent<ModelId>,
	target_model: Agent<ModelId>,
): Feedback {
	return supervisor_model.prompt(
		`Review this output for ${implementation_step} and provide structured feedback that identifies the specific areas of failure and suggests improvements *without* providing step-by-step instructions: ${target_model_output}`,
	) as Feedback
}

// @agent: `deferred` means the human spec writer is not sure if whatever operation this function is intended to describe should be part of this spec, part of a separate spec, or if a coding agent should be given the autonomy to decide at runtime with a direct agent.prompt. the direction should be determined as part of the iterate process.

// @agent: supervisor agent examines the attempts for the given task to decide if the feedback is relevant to the task as a whole, or if it is only relevant to a specific model's attempt at the task. if it is relevant to the task as a whole, it should be encoded into project docs, agent docs, and the task matcher for future similar tasks. if it is only relevant to a specific model's attempt, it should be encoded into that model's system prompt or a skill for future attempts at similar tasks:
const organize_feedback_from_task_loop =
	deferred<(loopRun: LoopRun) => LoopFeedbackDestination[]>()

// @agent: supervisor model looks at whether or not the target model is improving or not over the course of X attempts at implementing the given step, in part by comparing ImplementationAttempt.score across multiple consecutive attempts, analyzing the trend, and making a determination about how to proceed:
const make_decision = deferred<
	(
		implementation_step: Step,
		step_prompt_output: unknown,
		attempt_score: Score,
		loop_run: LoopRun,
		supervisor_model: Agent<ModelId>,
		target_model: Agent<ModelId>,
	) => Decision
>()

// @agent: supervisor model incorporates feedback into the task matcher examining the destination code, which indicates where the feedback should be stored, e.g., PLAN.md (or equivalent), AGENTS.md (or equivalent), target model system prompt, skill, harness config, or a map keyed by "task type," etc.
function encode_loop_run_into_task_matcher(loop_run: LoopRun): void {
	const destination_map = organize_feedback_from_task_loop(loop_run)
	task_matcher_engine.encode_run_into_task_matcher(loop_run, destination_map)
}

// @agent: the question for the supervisor model is: for this task/step, for this model (but also for any model), have we done something similar in the past that can be found in our project docs or task matcher database that can be used to improve the prompt for this task/step? if so, return it:
function task_matcher(
	implementation_step: Step,
	target_model: Agent<ModelId>,
): TaskMatchedContext | null {
	return task_matcher_engine.match_task(implementation_step, target_model)
}

// @agent: the supervisor model scores the implementation against the task's basic requirements in isolation:
const score_attempt =
	deferred<
		(
			implementation_step: Step,
			target_model_output: string,
			target_model: Agent<ModelId>,
		) => Score
	>()
