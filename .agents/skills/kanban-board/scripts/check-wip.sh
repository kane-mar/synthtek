#!/usr/bin/env bash
# check-wip.sh
# Display WIP status across all columns.
# Usage: ./scripts/check-wip.sh

set -euo pipefail

if [ ! -f .kanban/CONFIG.md ]; then
 echo "Error: .kanban/CONFIG.md not found. Run init-board.sh first."
 exit 1
fi

echo ""
echo "WIP Status"
echo ""

BOTTLENECKS=""
HAS_BOTTLENECK=false

# Parse columns from CONFIG and count cards in BOARD.md
while IFS= read -r line; do
 # Match lines like "- Column Name: limit"
 case "$line" in
  -*:*)
   # Strip leading "- " to get the rest
   rest="${line#*- }"
   # Extract column name (everything before last ": ")
   COLUMN="${rest%:*}"
   COLUMN="${COLUMN%"${COLUMN##*[! ]}"}" # trim trailing spaces
   # Extract limit (everything after last ": ")
   LIMIT="${rest##*: }"
   LIMIT="${LIMIT%"${LIMIT##*[! ]}"}" # trim trailing spaces
   ;;
  *)
   continue
   ;;
 esac

 if [ -z "$COLUMN" ] || [ -z "$LIMIT" ]; then
  continue
 fi

 # Count cards in this column from BOARD.md
 COUNT=0
 if [ -f .kanban/BOARD.md ]; then
  IN_SECTION=false
  while IFS= read -r board_line; do
   if [[ "$board_line" == "## $COLUMN" ]]; then
    IN_SECTION=true
    continue
   fi
   if $IN_SECTION; then
    if [[ "$board_line" == "## "* ]]; then
     break
    fi
    # Match lines like "- **CARD-001** Title"
    if [[ "$board_line" == *"**CARD-"* ]]; then
     COUNT=$((COUNT + 1))
    fi
   fi
  done < .kanban/BOARD.md
 fi

 if [ "$LIMIT" = "-1" ]; then
  LIMIT_DISPLAY="∞"
  STATUS=""
 elif [ "$COUNT" -ge "$LIMIT" ]; then
  LIMIT_DISPLAY="$LIMIT"
  STATUS="AT LIMIT"
  BOTTLENECKS="$BOTTLENECKS\n → $COLUMN is at WIP limit ($COUNT/$LIMIT)"
  HAS_BOTTLENECK=true
 else
  LIMIT_DISPLAY="$LIMIT"
  STATUS=""
 fi

 printf "%-15s %3s cards (limit: %3s) %s\n" "$COLUMN" "$COUNT" "$LIMIT_DISPLAY" "$STATUS"
done < .kanban/CONFIG.md

echo ""

if $HAS_BOTTLENECK; then
 echo -e " Bottleneck detected:$BOTTLENECKS"
fi

echo ""
