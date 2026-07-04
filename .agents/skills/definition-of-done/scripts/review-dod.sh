#!/usr/bin/env bash
# review-dod.sh
# Log a DoD review or update.
# Usage: ./scripts/review-dod.sh "Added security review criterion. Removed outdated browser test."

set -euo pipefail

NOTES="${1:?"Usage: $0 <review-notes>"}"
DATE=$(date -Iseconds)

{
 echo ""
 echo "## Review — $DATE"
 echo ""
 echo "$NOTES"
} >> .dod/REVIEW_LOG.md

# Update the last reviewed date in DEFINITION_OF_DONE.md
if [ -f DEFINITION_OF_DONE.md ]; then
 sed -i '' "s/^_Last reviewed:.*/_Last reviewed: ${DATE:0:10}_/" DEFINITION_OF_DONE.md 2>/dev/null || true
fi

echo "DoD review logged: $NOTES"
echo " Logged in .dod/REVIEW_LOG.md"
