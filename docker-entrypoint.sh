#!/bin/sh
set -e

# Ensure the workspace directory exists
if [ -n "$SYNTHTEK_WORKSPACE" ]; then
  mkdir -p "$SYNTHTEK_WORKSPACE" 2>/dev/null || true
fi

exec "$@"
