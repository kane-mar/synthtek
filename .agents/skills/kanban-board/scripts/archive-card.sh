#!/usr/bin/env bash
# archive-card.sh
# Archive a completed card (cleanup only — metrics were already logged by move-card.sh).
# Usage: ./scripts/archive-card.sh CARD-003

set -euo pipefail

CARD="${1:?"Usage: $0 <card-id>"}"

CARD_FILE=$(find .kanban/CARDS/ -name "${CARD}--*.md" 2>/dev/null | head -1)

if [ -z "$CARD_FILE" ]; then
 echo "Error: Card $CARD not found in .kanban/CARDS/"
 exit 1
fi

TITLE=$(grep "^title:" "$CARD_FILE" | sed 's/.*: "//' | sed 's/"$//')

# Move card to ARCHIVED
mkdir -p .kanban/ARCHIVED
mv "$CARD_FILE" ".kanban/ARCHIVED/"

echo "Archived: $CARD — $TITLE"
echo " Card moved to .kanban/ARCHIVED/"
echo " (Metrics were already logged by move-card.sh when this PBI moved to Done)"
