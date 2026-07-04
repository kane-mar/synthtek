#!/usr/bin/env bash
# retro.sh
# Initialize a sprint retrospective document with Scrum values check.
# Usage: ./scripts/retro.sh [sprint-number]

set -euo pipefail

SPRINT_NUM="${1:-$(date +%Y-%m-%d)}"
NEXT_NUM=$(find .collaboration/RETROS/ -name 'RETRO-*.md' 2>/dev/null | wc -l | tr -d ' ')
NEXT_NUM=$((NEXT_NUM + 1))
RETRO_ID=$(printf "RETRO-%03d" "$NEXT_NUM")
DATE=$(date -Iseconds)
FILENAME=".collaboration/RETROS/${RETRO_ID}-sprint-${SPRINT_NUM}.md"

cat > "$FILENAME" << RETRO_EOF
# Sprint Retrospective — Sprint $SPRINT_NUM

**Date:** $DATE

## Values Check

### Commitment
- Did we all stay engaged after our individual tasks were done?
- Did anyone "check out" early?

### Focus
- Did we stay focused on the Sprint Goal, or did we get pulled elsewhere?
- Any external distractions we should shield against next sprint?

### Openness
- Did we surface bad news early enough?
- Were there hidden problems that only came out at the review?

### Respect
- Did we truly listen to each other's expertise?
- Were there moments where an agent's input was dismissed?

### Courage
- Did anyone speak up about an uncomfortable truth?
- Did we avoid a hard conversation that we should have had?

## What went well
- 

## What could be improved
- 

## Action Items
_(1-3 concrete improvements for next sprint)_

- [ ] 
- [ ] 

## Quiet Reflection (write before discussion)
_Each team member writes their thoughts before discussing:_

- agent-alpha:
- agent-beta:
- agent-gamma:

## Discussion Notes
_Key points from the retrospective conversation._

## Action Item Owners
| Action Item | Owner | Due |
|-------------|-------|-----|
| | | |
RETRO_EOF

echo "Retrospective created: $FILENAME"
echo ""
echo "Fill in the Values Check first (5 min), then discuss what went well and what to improve."
echo "Commit to 1-3 concrete action items for the next sprint."
