#!/usr/bin/env bash
# One-time installer: copies the plugin bundle (the same subset described in
# docs/plugin-file-layout.md's directory tree) into a durable location Claude
# Code auto-loads every session, so the checkout this script runs from is no
# longer needed afterward — it's a distribution artifact, not the install.
#
# Usage: ./install.sh [destination]   (default: ~/.claude/skills/centina)
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-$HOME/.claude/skills/centina}"

if [ -e "$DEST" ] && [ ! -L "$DEST" ] && [ "$(ls -A "$DEST" 2>/dev/null | head -1)" != "" ]; then
  read -r -p "$DEST already exists and is non-empty. Overwrite? [y/N] " reply
  case "$reply" in
    [yY]*) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

rm -rf "$DEST"
mkdir -p "$DEST"

cp -R "$SRC/.claude-plugin" "$DEST/"
cp -R "$SRC/hooks" "$DEST/"
cp -R "$SRC/skills" "$DEST/"
cp -R "$SRC/bin" "$DEST/"
cp -R "$SRC/scripts" "$DEST/"
cp -R "$SRC/checker" "$DEST/"
cp "$SRC/centina.ts" "$DEST/"
cp "$SRC/tsconfig.template.json" "$DEST/"

mkdir -p "$DEST/docs"
for doc in boundaries.md fit-validation.md plan-organization.md plugin-setup-procedure.md output-management.md; do
  cp "$SRC/docs/$doc" "$DEST/docs/"
done

# checker/node_modules and package-lock.json, if present from local dev use,
# are install-time artifacts the SessionStart hook regenerates in
# CLAUDE_PLUGIN_DATA on first use — don't ship a stale copy.
rm -rf "$DEST/checker/node_modules" "$DEST/checker/package-lock.json"

echo "Centina installed to $DEST"
echo "This checkout ($SRC) is no longer required — Claude Code will load the"
echo "plugin from $DEST every session from now on. Re-run this script after"
echo "pulling updates; nothing here tracks the checkout automatically."
