#!/usr/bin/env bash
# select-for-sprint.sh
# Pull top N items from backlog into sprint scope.
# Usage: ./scripts/select-for-sprint.sh 3 "Items for Sprint 4"

set -euo pipefail

COUNT="${1:?"Usage: $0 <count> <context>"}"
CONTEXT="${2:-}"
DATE=$(date -Iseconds)

echo "Selected top $COUNT items for sprint preparation."
echo ""
echo "Review BACKLOG.md and move the top $COUNT items to SPRINT_BACKLOG.md"
echo ""

{
 echo ""
 echo "## Sprint Selection — $DATE"
 echo ""
 echo "Selected top $COUNT items for sprint."
 if [ -n "$CONTEXT" ]; then
  echo "Context: $CONTEXT"
 fi
} >> .backlog/REFINEMENT_LOG.md

echo "Logged to .backlog/REFINEMENT_LOG.md"
echo ""
echo "Tip: Pair with agent-collaboration's init-sprint.sh to set up the sprint."
