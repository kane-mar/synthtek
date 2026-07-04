#!/usr/bin/env bash
# verify-dod.sh
# Check an item against every active DoD criterion.
# Usage: ./scripts/verify-dod.sh CARD-003 [--override "reason"]

set -euo pipefail

ITEM="${1:?"Usage: $0 <item-id> [--override <reason>]"}"
OVERRIDE=""
OVERRIDE_REASON=""

if [ "${2:-}" = "--override" ] && [ -n "${3:-}" ]; then
 OVERRIDE="true"
 OVERRIDE_REASON="$3"
fi

DATE=$(date -Iseconds)

if [ ! -f .dod/CHECKLIST.md ]; then
 echo "Error: .dod/CHECKLIST.md not found. Run init-dod.sh first."
 exit 1
fi

echo ""
echo "Verifying $ITEM against Definition of Done..."
echo ""

TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0
CATEGORY=""

while IFS= read -r line; do
 # Track categories
 if echo "$line" | grep -q "^## "; then
  CATEGORY=$(echo "$line" | sed 's/^## //')
  continue
 fi

 # Parse checklist items
 if echo "$line" | grep -q "^enabled:"; then
  CRITERION=$(echo "$line" | sed 's/^enabled: //')
  TOTAL=$((TOTAL + 1))

  # Prompt for each criterion
  echo ""
  echo " [$CATEGORY] $CRITERION"
  echo -n " Met? (y/n/skip): "
  read -r ANSWER </dev/tty

  case "$ANSWER" in
   y|Y)
    echo "  $CRITERION"
    PASSED=$((PASSED + 1))
    ;;
   n|N)
    if [ -n "$OVERRIDE" ]; then
     echo "   OVERRIDE: $OVERRIDE_REASON"
     PASSED=$((PASSED + 1))
    else
     echo "  $CRITERION ← NOT MET"
     FAILED=$((FAILED + 1))
    fi
    ;;
   skip|s)
    echo "   Skipped"
    SKIPPED=$((SKIPPED + 1))
    ;;
  esac
 fi
done < .dod/CHECKLIST.md

echo ""
echo ""

if [ "$FAILED" -eq 0 ]; then
 echo "Result: DONE — all $TOTAL criteria met"
 STATUS="passed"
else
 echo "Result: NOT DONE — $FAILED of $TOTAL criteria not met"
 STATUS="failed"
fi

if [ "$SKIPPED" -gt 0 ]; then
 echo " ($SKIPPED criteria were skipped)"
fi

# Log verification result
{
 echo ""
 echo "- $DATE: $ITEM — $STATUS ($PASSED/$TOTAL passed, $FAILED failed, $SKIPPED skipped)"
 if [ -n "$OVERRIDE" ]; then
  echo " Override: $OVERRIDE_REASON"
 fi
} >> .dod/VERIFICATION_LOG.md

echo " Logged in .dod/VERIFICATION_LOG.md"
echo ""
