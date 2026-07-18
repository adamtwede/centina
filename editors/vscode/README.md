# Centina Highlighting (local dev extension)

Not published — a pure-declaration VS Code extension (grammar injections only,
no extension code, no build step) that tints Centina's vocabulary on top of
VS Code's built-in TypeScript grammar. `.centina.ts` files are never assigned
a new language id; they stay `typescript` so every other tool (ESLint,
Prettier, IntelliSense) keeps working exactly as it does today.

Tints, via two injection grammars:

- `// @agent:` — the marker itself (comments injection)
- `/** @boundary */` / `/** @datasource */` / `/** @datasink */` — boundary
  role tags (comments injection)
- `/** @external */` — external reference tag (comments injection)
- `deferred<F>()` / `deferred()` — the typed-hole marker call (code injection)

## Install locally

No marketplace listing, no `vsce package` step needed. Either:

- **Command Palette** → `Developer: Install Extension from Location...` →
  select this `editors/vscode` directory, or
- Symlink this directory into your extensions folder:
  ```
  ln -s "$(pwd)/editors/vscode" ~/.vscode/extensions/centina-injection
  ```

Then reload the window. Reload again after editing either `.injection.json`
file or `package.json` — VS Code only reads grammar contributions at startup.
