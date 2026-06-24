# Agent-Interpreted Specification Language

This project lays out a formal description/specification for the creation of a domain specific language (DSL) for use with agentic (LLM-assisted) coding, specifically for high-level planning and architecture. As a DSL, it is concerned more with the *what* rather than the *how*.

In the fewest words, it's **type-checked  pseudocode**.

## Enabling syntax highlighting (development phase)

1. In VS Code: File > Open Folder... (or Cmd+O)
2. Navigate to and select ./editors/vscode — open it as its own window (it'll ask "open in new window," say yes if prompted, or just let it replace if you don't mind closing the current one).
3. In that new window, press F5. It should now find the Run AISL Extension config and launch a separate "Extension Development Host" window — that's a sandboxed VS Code instance with your unpublished extension active.
4. In that Extension Development Host window, open any .aisl file (e.g. File > Open Folder... and pick the current project, then open a .aisl file) — it should now show syntax highlighting.

If F5 still shows a config picker instead of going straight to "Run AISL Extension," that just means VS Code found multiple/no matching configs — pick "Run AISL Extension" from the dropdown, or check the Run and Debug panel (Cmd+Shift+D) to confirm launch.json was picked up under that window.