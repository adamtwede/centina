# Install: other harnesses

## Using Centina without Claude Code

Claude Code is what makes setup turnkey. Without it, you have to do by hand what it does for you: loading the plugin, installing the checker's dependencies at session start, and setting the `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` variables. None of that is hard, though. The checker is a plain TypeScript CLI and the skills are plain markdown, so any capable agent can use them.

Where to go from here depends on your setup:

- **If your harness runs sessions in a sandbox** (OpenCode, for example), follow [Installing Centina for OpenCode](/opencode-install). A sandbox usually can't read files outside the directory a session starts in, so the install has to live somewhere it *can* read, and that page walks through it.
- **For any other agent,** see [Running it without a session](/centina-check-setup#running-it-without-a-session) on the setup command page. It covers the environment variables and the setup command.
