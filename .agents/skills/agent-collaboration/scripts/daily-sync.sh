#!/usr/bin/env bash
# daily-sync.sh
# Log a daily sync entry for an agent with Scrum values reflection.
# Usage: ./scripts/daily-sync.sh "Agent Name" "What happened" "Blockers" "Next steps"

set -euo pipefail

AGENT="${1:?"Usage: $0 <agent-name> <what-happened> <blockers> <next-steps>"}"
WHAT="${2:?"Usage: $0 <agent-name> <what-happened> <blockers> <next-steps>"}"
BLOCKERS="${3:-none}"
NEXT="${4:-}"
# Optional: values flag (e.g., "Courage: spoke up about estimate" or "none")
VALUES="${5:-}"

DATE=$(date +%Y-%m-%d)

{
 echo ""
 echo "## $DATE"
 echo ""
 echo "**$AGENT:** $WHAT"
 echo " - Blockers: $BLOCKERS"
 if [ -n "$NEXT" ]; then
  echo " - Next: $NEXT"
 fi
 if [ -n "$VALUES" ]; then
  echo " - Values: $VALUES"
 fi
} >> .collaboration/DAILY_LOG.md

echo "Daily sync entry added for $AGENT"
echo ""
echo "Tip: Use the 5th argument to log a Scrum values reflection:"
echo " ./daily-sync.sh \"agent-alpha\" \"Did API work\" \"none\" \"Help beta\" \"Courage: flagged rate limit early\""
