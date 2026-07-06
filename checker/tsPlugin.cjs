// tsserver loads plugins via a synchronous CommonJS require and can't transpile
// TS itself, so this is a plain .cjs bootstrap: register tsx's require hook,
// then hand off to the real (TypeScript) implementation.
require("tsx/cjs")
module.exports = require("./tsPluginImpl.ts")
