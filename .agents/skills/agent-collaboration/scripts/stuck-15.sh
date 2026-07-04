#!/usr/bin/env bash
# stuck-15.sh
# Log a 15-minute rule attempt (stuck on a problem, asking for help).
# Usage: ./scripts/stuck-15.sh "Problem description" "What I tried" "Who I'm asking for help"

set -euo pipefail

PROBLEM="${1:?"Usage: $0 <problem> <tried> <asking>"}"
TRIED="${2:?"Usage: $0 <problem> <tried> <asking>"}"
ASKING="${3:?"Usage: $0 <problem> <tried> <asking>"}"
DATE=$(date -Iseconds)

{
 echo ""
 echo "## 15-min attempt — $DATE"
 echo ""
 echo "**Problem:** $PROBLEM"
 echo "**Tried:**"
 echo " - $TRIED" | sed 's/; /\n - /g'
 echo "**Still stuck after 15min → asking $ASKING for help**"
} >> .collaboration/DAILY_LOG.md

echo "15-min attempt logged. Asking $ASKING for help with: $PROBLEM"
echo ""
echo "Remember: Getting stuck is normal. Asking for help is Courage + Openness in action."
