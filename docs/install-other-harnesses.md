# Install: other harnesses

### Using Centina without Claude Code

Claude Code is what makes setup turnkey. Without it, the plugin loader, the `SessionStart` dependency install, and the `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` variables all have to be done by hand. The checker is a plain TypeScript CLI and the skills are plain markdown, so any capable agent can use them.

- **Other harnesses, or sandboxed setups:** see [OpenCode install](opencode-install.md).
- **Any other agent:** see [Plugin setup procedure, "Running it without a session"](plugin-setup-procedure.md#running-it-without-a-session) for the environment variables and the setup command.
