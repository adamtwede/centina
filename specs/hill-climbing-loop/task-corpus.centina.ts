// PROVISIONAL BOUNDARY DECLARATOR — declarations only, no implementation.
// Data types live in shared.centina.ts; this file holds only the boundary.

import type {
  TaskCorpusPredicate,
  TaskCorpusRecord,
  TaskRunRecord,
} from "./shared.centina"

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
