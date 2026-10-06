import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { TrackerModel } from "./model"

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), "tracker.html")

/** The tracker page for `model`: one self-contained HTML file. */
export function renderTracker(model: TrackerModel): string {
  const data = JSON.stringify(model).replace(/</g, "\\u003c")
  return readFileSync(TEMPLATE, "utf8").replace("__DATA__", () => data)
}
