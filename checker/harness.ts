import path from "node:path"
import { fileURLToPath } from "node:url"
import { Project, SourceFile } from "ts-morph"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tsConfigFilePath = path.resolve(__dirname, "..", "tsconfig.json")

export function loadProject(): Project {
  return new Project({ tsConfigFilePath })
}

/** Every `*.centina.ts` spec file in the project — excludes centina.ts itself and checker/** (neither matches the suffix). */
export function getSpecSourceFiles(project: Project): SourceFile[] {
  return project
    .getSourceFiles()
    .filter((sourceFile) => sourceFile.getFilePath().endsWith(".centina.ts"))
}
