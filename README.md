# Agent-Interpreted Specification Language

This project lays out a formal description/specification for the creation of a domain specific language (DSL) for use with agentic (LLM-assisted) coding, specifically for high-level planning and architecture. As a DSL, it is concerned more with the *what* rather than the *how*.

Here is the initial prompt:

I'm not satisfied with the conversation-first human-agent implementation planning process for implementing software projects and features. I want to try a new approach. I'd like to look into writing pseudocode that can be transcribed by a coding model into an implementation plan. The idea is that the human would write the pseudocode document, which I'm calling an AISL (Agent-Interpreted Specification Language) document, then I'd refer a coding model (for example, you) to it, we would iterate over it to ensure common understanding and, once it reaches a satisfactory state, it would be turned into an implementation plan.

However, before all of that, we need the pseudocode to have some structure enforced and conventions observed to ensure naming consistency, reduce ambiguities, provide clear guidance and guardrails for the coding model, and encourage the human to think things through rather than depending on the coding model to do most of the thinking. This would mean a basic type-checker or linter would need to be implemented first.

## Enabling syntax highlighting (development phase)

1. In VS Code: File > Open Folder... (or Cmd+O)
2. Navigate to and select ./editors/vscode — open it as its own window (it'll ask "open in new window," say yes if prompted, or just let it replace if you don't mind closing the current one).
3. In that new window, press F5. It should now find the Run AISL Extension config and launch a separate "Extension Development Host" window — that's a sandboxed VS Code instance with your unpublished extension active.
4. In that Extension Development Host window, open any .aisl file (e.g. File > Open Folder... and pick the current project, then open a .aisl file) — it should now show syntax highlighting.

If F5 still shows a config picker instead of going straight to "Run AISL Extension," that just means VS Code found multiple/no matching configs — pick "Run AISL Extension" from the dropdown, or check the Run and Debug panel (Cmd+Shift+D) to confirm launch.json was picked up under that window.