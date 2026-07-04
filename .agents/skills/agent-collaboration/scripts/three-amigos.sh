#!/usr/bin/env bash
# three-amigos.sh
# Log a Three Amigos session (PO + Developer + QA perspectives before coding).
# Usage: ./scripts/three-amigos.sh "Story Name" "PO perspective" "Developer perspective" "QA perspective" "Resolution"

set -euo pipefail

STORY="${1:?"Usage: $0 <story-name> <po-view> <dev-view> <qa-view> <resolution>"}"
PO="${2:?"Usage: $0 <story-name> <po-view> <dev-view> <qa-view> <resolution>"}"
DEV="${3:?"Usage: $0 <story-name> <po-view> <dev-view> <qa-view> <resolution>"}"
QA="${4:?"Usage: $0 <story-name> <po-view> <dev-view> <qa-view> <resolution>"}"
RESOLUTION="${5:?"Usage: $0 <story-name> <po-view> <dev-view> <qa-view> <resolution>"}"
DATE=$(date -Iseconds)

{
 echo ""
 echo "## Three Amigos — Story: $STORY ($DATE)"
 echo ""
 echo "**PO:** \"$PO\""
 echo "**Developer:** \"$DEV\""
 echo "**QA:** \"$QA\""
 echo "**Resolution:** $RESOLUTION"
} >> .collaboration/DAILY_LOG.md

echo "Three Amigos session logged for: $STORY"
echo " Resolution: $RESOLUTION"
