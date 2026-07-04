#!/usr/bin/env bash
# capture-item.sh
# Quick-capture a new backlog item.
# Usage: ./scripts/capture-item.sh "Title" "Type" "Priority" [notes]

set -euo pipefail

TITLE="${1:?"Usage: $0 <title> <type> <priority> [notes]"}"
TYPE="${2:?"Usage: $0 <title> <type> <priority> [notes]"}"
PRIORITY="${3:?"Usage: $0 <title> <type> <priority> [notes]"}"
NOTES="${4:-}"

DATE=$(date -Iseconds)
NEXT_NUM=$(find .backlog/ITEMS/ -name 'ITEM-*.md' 2>/dev/null | wc -l | tr -d ' ')
NEXT_NUM=$((NEXT_NUM + 1))
ITEM_ID=$(printf "ITEM-%03d" "$NEXT_NUM")
FILENAME=".backlog/ITEMS/${ITEM_ID}--${TITLE// /-}.md"

cat > "$FILENAME" << ITEM_EOF
---
id: $ITEM_ID
title: "$TITLE"
type: $TYPE
priority: $PRIORITY
status: captured
created: $DATE
---

# $ITEM_ID: $TITLE

## Description
(Add description)

## Acceptance Criteria
- [ ] (add criteria)

## Technical Notes
(Add notes)
ITEM_EOF

# Also append to BACKLOG.md
{
 echo "| $ITEM_ID | $TITLE | $TYPE | $PRIORITY | — | captured |"
} >> BACKLOG.md

echo "Captured: $ITEM_ID — $TITLE"
echo " File: $FILENAME"
echo " Type: $TYPE | Priority: $PRIORITY"
echo ""
echo "Next: Refine with story and AC when ready for sprint planning."
