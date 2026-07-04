#!/usr/bin/env bash
# add-card.sh
# Add a new card to the Kanban board backlog.
# Usage: ./scripts/add-card.sh "Title" "Type" "Priority"

set -euo pipefail

TITLE="${1:?"Usage: $0 <title> <type> <priority>"}"
TYPE="${2:?"Usage: $0 <title> <type> <priority>"}"
PRIORITY="${3:?"Usage: $0 <title> <type> <priority>"}"

DATE=$(date -Iseconds)
NEXT_NUM=$(find .kanban/CARDS/ -name 'CARD-*.md' 2>/dev/null | wc -l | tr -d ' ')
NEXT_NUM=$((NEXT_NUM + 1))
CARD_ID=$(printf "CARD-%03d" "$NEXT_NUM")
FILENAME=".kanban/CARDS/${CARD_ID}--${TITLE// /-}.md"

cat > "$FILENAME" << CARD_EOF
---
id: $CARD_ID
title: "$TITLE"
type: $TYPE
priority: $PRIORITY
status: backlog
created: $DATE
---

## Description
(Add description)

## Acceptance Criteria
- [ ] (add criteria)

## Notes
(Add notes)

## Cycle Time
started: —
completed: —
CARD_EOF

# Update BOARD.md — add to Backlog section
BOARD="${KANBAN_DIR:-.}/BOARD.md"
if [ ! -f "$BOARD" ]; then
 BOARD=".kanban/BOARD.md"
fi

CARD_LINE="- **${CARD_ID}** ${TITLE}"

if [ -f "$BOARD" ]; then
 # Add card line after the ## Backlog section heading
 if grep -q "^## Backlog" "$BOARD"; then
  awk '
   /^## Backlog/ { print; backlog=1; next }
   backlog && /^## / { print card_line; print; backlog=0; next }
   { print }
   END { if (backlog) print card_line }
  ' card_line="$CARD_LINE" "$BOARD" > "${BOARD}.tmp" && mv "${BOARD}.tmp" "$BOARD"
 else
  echo -e "\n## Backlog\n$CARD_LINE" >> "$BOARD"
 fi
fi

echo "Card created: $CARD_ID — $TITLE"
echo " File: $FILENAME"
echo " Type: $TYPE | Priority: $PRIORITY"
echo " Status: backlog"
