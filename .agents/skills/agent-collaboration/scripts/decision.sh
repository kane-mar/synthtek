#!/usr/bin/env bash
# decision.sh
# Log a key decision to DECISIONS.md.
# Usage: ./scripts/decision.sh "Context" "Decision" "Rationale" "Alternatives considered"

set -euo pipefail

CONTEXT="${1:?"Usage: $0 <context> <decision> <rationale> [alternatives]"}"
DECISION="${2:?"Usage: $0 <context> <decision> <rationale> [alternatives]"}"
RATIONALE="${3:?"Usage: $0 <context> <decision> <rationale> [alternatives]"}"
ALTERNATIVES="${4:-N/A}"
DATE=$(date -Iseconds)

{
 echo ""
 echo "## $(date +%Y-%m-%d): $CONTEXT"
 echo ""
 echo "- **Decision:** $DECISION"
 echo "- **Rationale:** $RATIONALE"
 echo "- **Alternatives considered:** $ALTERNATIVES"
 echo "- **Logged by:** (agent)"
} >> .collaboration/DECISIONS.md

echo "Decision logged: $DECISION"
