#!/usr/bin/env sh
# Thin wrapper: the installer is install.mjs, plain Node, so it behaves the same
# on Windows, macOS and Linux. Usage: ./install.sh [--yes] [destination]
exec node "$(dirname "$0")/install.mjs" "$@"
