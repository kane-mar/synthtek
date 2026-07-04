#!/usr/bin/env bash
# swarm.sh
# Log a swarming event — multiple agents converging on a bottleneck.
# Usage: ./scripts/swarm.sh "bottleneck description" "agent1,agent2,agent3" "resolution plan"

set -euo pipefail

BOTTLENECK="${1:?"Usage: $0 <bottleneck> <agents> <plan>"}"
AGENTS="${2:?"Usage: $0 <bottleneck> <agents> <plan>"}"
PLAN="${3:?"Usage: $0 <bottleneck> <agents> <plan>"}"
DATE=$(date -Iseconds)

{
 echo ""
 echo "## Swarm Event — $DATE"
 echo ""
 echo "**Bottleneck:** $BOTTLENECK"
 echo "**Agents involved:** $AGENTS"
 echo "**Plan:** $PLAN"
} >> .collaboration/DAILY_LOG.md

echo "Swarm logged — $AGENTS converging on: $BOTTLENECK"
