#!/usr/bin/env bash
# refine.sh
# Log a backlog refinement session.
# Usage: ./scripts/refine.sh "Refined top 10 items, split ITEM-005 into 3 stories"

set -euo pipefail

NOTES="${1:?"Usage: $0 <refinement-notes>"}"
DATE=$(date -Iseconds)

{
 echo ""
 echo "## Refinement — $DATE"
 echo ""
 echo "$NOTES"
} >> .backlog/REFINEMENT_LOG.md

echo "Refinement logged: $NOTES"
