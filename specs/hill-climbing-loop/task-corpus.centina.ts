// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.

import { ModelId } from "./shared"

export const corpusFields = [
  "uuid",
  "name",
  "context",
  "grade",
  "modelId",
  "modelSpecification",
  "timestamp",
]
export type TaskCorpusField = (typeof corpusFields)[number]

export type TaskCorpusRecord = {
  uuid: string
  matchedField: TaskCorpusField
  content: string
}

export type TaskCorpusPredicate = {
  // @agent: used to narrow the number of results for both the flattened result set (queryRecords) or the full "row" (queryRuns). For example, if you only want to see records with a Grade of SUCCEEDED.
  field: TaskCorpusField | "any"
  value: string
}

export type Task = {
  name: string
  description?: string
}

// @agent: given to a single implementation attempt, used to inform a full task run's Grade (see below).
export enum Score {
  FAIL, // little or no usable output
  PARTIAL_SUCCESS_LOW, // some output conforms to expectations
  PARTIAL_SUCCESS_HIGH, // majority of output conforms to expectations
  SUCCESS, // output sufficiently conforms to expectations
  MAX_ESCALATED, // supervisor model attempted the step itself; not scored against another model's output — a signal to the task matcher, not a quality grade
}

// @agent: given to an entire task run attempt, not a single iteration of an attempt loop.
export enum Grade {
  SUCCEEDED = 1, // 1
  INCONCLUSIVE = 0, // 0
  FAILED = -1, // -1
  // NEEDS_REVIEW,
}

export type FeedbackChannelCode = number

export type Feedback = {
  originalTaskName: string
  content: string // @agent: this is the actual text content of the feedback
  channels: FeedbackChannelCode // @agent: bitmask, just a concise way to represent any permutation of FeedbackChannel values.
}

export type Attempt = {
  model: ModelId
  timestamp: number
  score: Score
  feedback?: Feedback
}

export type TaskRunRecord = {
  uuid: string
  task: Task
  grade: Grade
  attemptRecord: Attempt[] // individual results of hill climbing loop attempts, in order of execution.
}

/**
 * @boundary
 * Persistence for the task corpus.
 *
 * Write doors: `persist`, which records task runs.
 *
 * Read doors: `queryFlattenedRecords`, a queryable flattened projection set
 * of task run records, `queryFullRecords`, a queryable set of
 * full task run records, and `getRecordById`, which returns a single
 * record by its UUID.
 */
export declare class TaskCorpusStore {
  persist(taskRunRecord: TaskRunRecord): void
  queryFlattenedRecords(predicate?: TaskCorpusPredicate[]): TaskCorpusRecord[]
  queryFullRecords(predicate?: TaskCorpusPredicate[]): TaskRunRecord[]
  getRecordById(uuid: string): TaskRunRecord
}

export const taskCorpusStore = new TaskCorpusStore()
