import { Symbol as MorphSymbol } from "ts-morph"

/** Resolves through an import alias (e.g. `import { Noun } from "./centina"`) to the symbol's real declaring site. */
export function resolveAliasedSymbol(
  symbol: MorphSymbol | undefined,
): MorphSymbol | undefined {
  return symbol?.getAliasedSymbol() ?? symbol
}

/** Is this symbol — after resolving any import alias — declared in centina.ts, the vocabulary module? */
export function isFromVocabulary(symbol: MorphSymbol | undefined): boolean {
  const target = resolveAliasedSymbol(symbol)
  return (target?.getDeclarations() ?? []).some((declaration) =>
    declaration.getSourceFile().getFilePath().endsWith("/centina.ts"),
  )
}
