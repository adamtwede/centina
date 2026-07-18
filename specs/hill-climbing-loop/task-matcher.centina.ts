/**
 * Task Matcher (spec)
 *
 * Describes a software component that matches tasks to previous attempts and corresponding feedback. It defines the types and interfaces necessary for task matching, feedback handling, and decision-making processes. It finds possible matches for the incoming task request based on the following (not comprehensive) criteria:
 * - task name similarity
 * - task description similarity
 * - feedback given to potentially-similar previous recorded tasks
 * - the model tasked with implementing it
 * - a grade given to the implementation
 */

import { Agent, deferred, Skill } from "../../centina"
import { ModelId } from "./shared"

import { taskCorpusStore } from "./task-corpus.centina"
import type {
  TaskCorpusRecord,
  Task,
  Grade,
  TaskRunRecord,
  Attempt,
  TaskCorpusPredicate,
  FeedbackChannelCode,
  Feedback,
} from "./task-corpus.centina"

// @agent: proposed skill that an agent uses to essentially tag pieces of feedback with "channels," either at the time of encoding or upon returning a task match, which are what the agent making the evaluation determines as the best place for the feedback to "live," either permanently (such as in project/agent docs) or during specific implementation runs of future tasks (such as in the task prompt itself) or possibly both (a specific model's system prompt, temporarily or persistently, depending on various constraints). the second input (TaskRunRecord[]?) represents precedents that may inform routing decisions. this input is required, but sending an empty array signals no precedents were found, so the skill would need to generate routing data from scratch.
const feedbackRoutingSkill: Skill<
  [Attempt, TaskRunRecord[]],
  FeedbackChannelCode
> = {
  name: "centina-feedback-routing",
}

// @agent: proposed skill that an agent uses to query the existing task corpus for potential matched tasks given a candidate task. the skill uses name similarity and various heuristics to perform the match. In addition to actually finding a best-fit match for the candidate task, the skill should also examine the feedback channel value that was attached to the task record when it was persisted. That value represents a list of "locations" where the agent using the centina-feedback-routing skill determined the incoming feedback should be "embedded" for future tasks that might utilize it, but this is just a "best guess" or "baseline" assessment and not meant to be definitive, and may represent simply a set of mutually-exclusive options to choose from. The agent using this centina-task-match skill can either return this information unmodified, or it can use its own judgment (perhaps re-utilizing the centina-feedback-routing skill itself) to modify the outgoing task matched contexts' feedback channel values based on the current context of the candidate task and the agent's knowledge of the system. The skill should return a uuid that identifies matched task. It should be a uuid that exists in the corpus, not one that is generated as part of the skill.
const taskMatchSkill: Skill<[TaskCorpusRecord[]], string | undefined> = {
  name: "centina-task-match",
}

const queryDraftSkill: Skill<[Task, ModelId?], TaskCorpusPredicate[]> = {
  name: "centina-query-draft",
}

export class TaskMatcherEngine {
  agent: Agent
  constructor(agent?: Agent) {
    if (agent) {
      this.agent = agent
    } else {
      this.agent = new Agent(ModelId.CLAUDE_OPUS)
    }
  }
  // @agent: structural signal determiner: how many attempts did this take? with which model? what was the grade/score given? this information (and any other relevant) can be used to narrow the set of appropriate embeddings for the incoming feedback. this function should return a set of predicates that can be used to query the task corpus for precedent attempts that bear structural similarities to the incoming task implementation record.
  private derivePrecedentPredicate =
    deferred<
      (taskRunRecord: TaskRunRecord, attempt: Attempt) => TaskCorpusPredicate[]
    >()

  matchTask(task: Task, modelId?: ModelId): TaskRunRecord | undefined {
    const predicates = this.agent.invokeSkill(queryDraftSkill, task, modelId)
    const records =
      predicates.length > 0
        ? taskCorpusStore.queryFlattenedRecords(predicates)
        : taskCorpusStore.queryFlattenedRecords()
    const matchId = this.agent.invokeSkill(taskMatchSkill, records)
    return matchId ? taskCorpusStore.getRecordById(matchId) : undefined
  }
  encodeTask(taskRunRecord: TaskRunRecord) {
    // for (const run of taskRunRecord) {
    for (const attempt of taskRunRecord.attemptRecord) {
      if (!attempt.feedback) continue

      const structuralPredicate = this.derivePrecedentPredicate(
        taskRunRecord,
        attempt,
      )
      const precedents = taskCorpusStore.queryFullRecords(structuralPredicate)

      attempt.feedback.channels = this.agent.invokeSkill(
        feedbackRoutingSkill,
        attempt,
        precedents,
      )
    }
    // }
    taskCorpusStore.persist(taskRunRecord)
  }
}

export namespace TaskMatcherEngine {
  export enum FeedbackChannel {
    // @agent: this is never actually used directly in this spec, because the expectation is that it would be used by the agent implementing the centina-feedback-routing skill, which is not yet specified. The agent would use the channels as sketched out here (though not necessarily verbatim, nor is it obvious they would directly reference this code at all) to determine where to "embed" feedback for future tasks, either in the task prompt, project docs, agent docs, model system prompt, or other locations. the question is... how?
    TASK_PROMPT = 1,
    PROJECT_DOCS = 2,
    AGENTS_DOC = 4,
    MODEL_SYSTEM_PROMPT = 8,
    SKILL = 16,
    HARNESS_CONFIG = 32,
    TASK_TYPE_MAP = 64,
  }
}

export const taskMatcherEngine = new TaskMatcherEngine()
