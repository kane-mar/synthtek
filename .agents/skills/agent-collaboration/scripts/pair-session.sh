#!/usr/bin/env bash
# pair-session.sh
# Initialize a pair programming session log.
# Usage: ./scripts/pair-session.sh "driver-agent" "navigator-agent" "task description"

set -euo pipefail

DRIVER="${1:?"Usage: $0 <driver> <navigator> <task>"}"
NAVIGATOR="${2:?"Usage: $0 <driver> <navigator> <task>"}"
TASK="${3:?"Usage: $0 <driver> <navigator> <task>"}"

DATE=$(date -Iseconds)
SAFE_DATE=$(date +%Y-%m-%d)
NEXT_NUM=$(find .collaboration/PAIRS/ -name 'PAIR-*.md' 2>/dev/null | wc -l | tr -d ' ')
NEXT_NUM=$((NEXT_NUM + 1))
PAIR_ID=$(printf "PAIR-%03d" "$NEXT_NUM")
FILENAME=".collaboration/PAIRS/${PAIR_ID}--${DRIVER}--${NAVIGATOR}.md"

cat > "$FILENAME" << PAIR_EOF
---
id: $PAIR_ID
date: $DATE
driver: $DRIVER
navigator: $NAVIGATOR
task: "$TASK"
status: in-progress
---

## Session Log

### Goals
(What do we want to accomplish in this session?)

### Notes
(Key decisions, insights, and discoveries during pairing)

### Knowledge Transfer
(What the navigator learned — document this for bus factor reduction)

### Outcome
(What was accomplished)
PAIR_EOF

echo "Pair session created: $FILENAME"
echo " Driver: $DRIVER | Navigator: $NAVIGATOR"
echo " Task: $TASK"
echo ""
echo "Remember to update status when the session ends."
