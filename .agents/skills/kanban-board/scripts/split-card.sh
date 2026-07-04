#!/usr/bin/env bash
# split-card.sh
# Split a stuck card instead of blocking it. Log the split and help requests.
# Usage: ./scripts/split-card.sh CARD-003 "Dependency on email service — split into mock + integration"

set -euo pipefail

CARD="${1:?"Usage: $0 <card-id> <reason>"}"
REASON="${2:?"Usage: $0 <card-id> <reason>"}"
DATE=$(date -Iseconds)

# Check if this is a help request or a split
if echo "$REASON" | grep -qi "asking.*for help\|help request\|need help\|stuck"; then
 STATUS="help-requested"
 echo "Help requested for: $CARD"
else
 STATUS="split"
 echo " Split: $CARD"
fi

{
 echo ""
 echo "## $CARD — $DATE"
 echo ""
 echo "**Reason:** $REASON"
 echo "**Status:** $STATUS"
} >> .kanban/BLOCKED.md

echo " Reason: $REASON"
echo " Logged in .kanban/BLOCKED.md"
echo ""
echo "Next: The split creates a smaller card that can move forward."
if [ "$STATUS" = "split" ]; then
 echo "   If still stuck, split again or ask for help with:"
 echo "   ./scripts/split-card.sh $CARD \"Still stuck — asking for help\""
fi
