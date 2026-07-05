import type { BoundaryRole, Program, TypeRef } from "./ast.js";

export interface TypeEntry {
  source: "local" | "external";
  externalPath?: string;
  /** Ad-hoc dot-accessed properties found in the document, sorted. */
  properties: string[];
}

export interface EnumEntry {
  source: "local" | "external";
  externalPath?: string;
  members: string[];
}

export interface ParamEntry {
  name: string;
  type: string;
}

export interface FunctionEntry {
  source: "local" | "external";
  externalPath?: string;
  params: ParamEntry[];
  returnType: string | null;
}

export interface GlobalEntry {
  source: "local" | "external";
  externalPath?: string;
  type: string;
  narrowedRole?: "datasource" | "datasink";
}

export interface DoorEntry {
  params: ParamEntry[];
  returnType: string | null;
}

export interface BoundaryEntry {
  role: BoundaryRole;
  constructorParams: ParamEntry[];
  doors: Record<string, DoorEntry>;
}

export interface BuiltinMethodEntry {
  name: string;
  params: ParamEntry[];
  returnType: string;
  documentation?: string;
}

export interface BuiltinEntry {
  documentation?: string;
  constructor?: { params: ParamEntry[] };
  methods: BuiltinMethodEntry[];
  /** Non-method properties accessed on values of this type (usage-derived + hand-seeded). */
  properties: string[];
}

export interface SymbolTable {
  /** Absolute path of the .aisl file this was derived from. */
  source: string;
  generatedAt: string;
  types: Record<string, TypeEntry>;
  enums: Record<string, EnumEntry>;
  functions: Record<string, FunctionEntry>;
  globals: Record<string, GlobalEntry>;
  builtins: Record<string, BuiltinEntry>;
  boundaries: Record<string, BoundaryEntry>;
}

export function typeRefToString(ref: TypeRef): string {
  if (ref.kind === "array") return `${typeRefToString(ref.element)}[]`;
  return ref.name;
}

/**
 * Hand-seeded entries for built-in privileged types. These types never appear
 * in propertyUsage (the checker special-cases them), so their known
 * constructor/method shapes would otherwise be absent from the table.
 * Usage-derived non-method properties (e.g. `agent.specification`) are merged
 * in from propertyUsage at build time.
 */
const BUILTIN_SYMBOLS: Record<string, BuiltinEntry> = {
  Agent: {
    documentation:
      "Privileged built-in type representing a model endpoint. Values may only " +
      "originate from an `Agent(modelId)` constructor call or a typed parameter. " +
      "Calling `.prompt()` or `.review()` on an `Agent` is the only way to " +
      "introduce new unverified data into a document; those results require an " +
      "explicit `as TypeName` cast before flowing into a concrete typed binding.",
    constructor: { params: [{ name: "modelId", type: "ModelId" }] },
    methods: [
      {
        name: "prompt",
        params: [{ name: "input", type: "String" }],
        returnType: "Unspecified",
        documentation:
          "Sends `input` to the agent and returns an `Unspecified` result. " +
          "This is a **privileged source** — the result can be cast to a concrete " +
          "type via `as TypeName`, but may not be stored or returned as a named " +
          "type without that cast. Without a cast it may be passed around or used " +
          "descriptively (e.g. in template strings or as an argument).",
      },
      {
        name: "review",
        params: [{ name: "content", type: "String" }],
        returnType: "Unspecified",
        documentation:
          "Asks the agent to evaluate or assess `content` and returns an " +
          "`Unspecified` result. Like `.prompt()`, requires an explicit `as TypeName` " +
          "cast before the result flows into a typed binding. Conventionally used " +
          "to produce verdicts, ratings, or structured assessments.",
      },
    ],
    properties: [],
  },
};

/**
 * Builds a SymbolTable from a resolved Program and the checker's propertyUsage map.
 * `program` must be the post-resolveLocalExternals program: .aisl-sourced externals
 * are already injected as native decls, and program.externals contains only
 * real-code / library targets.
 */
export function buildSymbolTable(
  program: Program,
  propertyUsage: Map<string, Map<string, number[]>>,
  sourcePath: string,
): SymbolTable {
  const types: Record<string, TypeEntry> = {};
  const enums: Record<string, EnumEntry> = {};
  const functions: Record<string, FunctionEntry> = {};
  const globals: Record<string, GlobalEntry> = {};

  for (const t of program.types) {
    const props = propertyUsage.get(t.name);
    types[t.name] = {
      source: "local",
      properties: props ? [...props.keys()].sort() : [],
    };
  }

  for (const e of program.enums) {
    enums[e.name] = { source: "local", members: e.members };
  }

  for (const f of program.functions) {
    functions[f.name] = {
      source: "local",
      params: f.params.map((p) => ({
        name: p.name,
        type: p.typeAnnotation ? typeRefToString(p.typeAnnotation) : "Unspecified",
      })),
      returnType: f.returnType ? typeRefToString(f.returnType) : null,
    };
  }

  for (const g of program.globals) {
    globals[g.name] = {
      source: "local",
      type: g.typeAnnotation ? typeRefToString(g.typeAnnotation) : "Unspecified",
      ...(g.role ? { narrowedRole: g.role } : {}),
    };
  }

  // Real-code/library externals still in program.externals after resolveLocalExternals.
  // .aisl-sourced externals are already injected as native decls above.
  for (const ext of program.externals) {
    const props = propertyUsage.get(ext.name);
    if (ext.symbolKind === "type") {
      types[ext.name] = {
        source: "external",
        externalPath: ext.path,
        properties: props ? [...props.keys()].sort() : [],
      };
    } else if (ext.symbolKind === "function") {
      functions[ext.name] = {
        source: "external",
        externalPath: ext.path,
        params: [],
        returnType: "Unknown",
      };
    } else {
      globals[ext.name] = {
        source: "external",
        externalPath: ext.path,
        type: "Unknown",
      };
    }
  }

  const builtins: Record<string, BuiltinEntry> = {};
  for (const [name, seed] of Object.entries(BUILTIN_SYMBOLS)) {
    const usageProps = propertyUsage.get(name);
    const knownNames = new Set([
      ...seed.methods.map((m) => m.name),
      ...seed.properties,
    ]);
    const extraProps = usageProps
      ? [...usageProps.keys()].filter((p) => !knownNames.has(p)).sort()
      : [];
    builtins[name] = {
      ...seed,
      properties: [...seed.properties, ...extraProps],
    };
  }

  const boundaries: Record<string, BoundaryEntry> = {};
  for (const b of program.boundaries) {
    const doors: Record<string, DoorEntry> = {};
    for (const door of b.doors) {
      doors[door.name] = {
        params: door.params.map((p) => ({
          name: p.name,
          type: p.typeAnnotation ? typeRefToString(p.typeAnnotation) : "Unspecified",
        })),
        returnType: door.returnType ? typeRefToString(door.returnType) : null,
      };
    }
    boundaries[b.name] = {
      role: b.role,
      constructorParams: b.constructorParams.map((p) => ({
        name: p.name,
        type: p.typeAnnotation ? typeRefToString(p.typeAnnotation) : "Unspecified",
      })),
      doors,
    };
  }

  return {
    source: sourcePath,
    generatedAt: new Date().toISOString(),
    types,
    enums,
    functions,
    globals,
    builtins,
    boundaries,
  };
}
