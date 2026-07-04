#!/usr/bin/env bash
# init-board.sh
# Initialize the Kanban board structure.
# Usage: ./scripts/init-board.sh

set -euo pipefail

DATE=$(date -Iseconds)

echo "Initializing Kanban board..."

mkdir -p .kanban/CARDS .kanban/ARCHIVED

# KANBAN.md
if [ ! -f KANBAN.md ]; then
 cat > KANBAN.md << 'EOF'
# Kanban Board

Active work items and their current status on the Kanban board.
See `.kanban/BOARD.md` for the full board state.

## Quick Summary

| Column | Count | WIP Limit |
|--------|-------|-----------|
| Backlog | — | ∞ |
| Ready | — | 3 |
| In Progress | — | 3 |
| Review | — | 2 |
| Done | — | ∞ |

_Last updated:_
EOF
 echo "Created KANBAN.md"
fi

# .kanban/CONFIG.md
cat > .kanban/CONFIG.md << 'CONFIG_EOF'
# Board Configuration
# Format: - Column Name: wip_limit
# Use -1 for no limit (e.g., Backlog and Done)
- Backlog: -1
- Ready: 3
- In Progress: 3
- Review: 2
- Done: -1

## Card Types
# feature, bug, tech-debt, improvement, chore, spike
CONFIG_EOF
echo "Created .kanban/CONFIG.md"

# .kanban/BOARD.md
if [ ! -f .kanban/BOARD.md ]; then
 cat > .kanban/BOARD.md << 'BOARD_EOF'
# Board State

## Backlog
| Card | Title | Priority |
|------|-------|----------|
| (add cards here) | | |

## Ready
| Card | Title | Priority |
|------|-------|----------|
| (add cards here) | | |

## In Progress
| Card | Title | Owner |
|------|-------|-------|
| (add cards here) | | |

## Review
| Card | Title | Reviewer |
|------|-------|----------|
| (add cards here) | | |

## Done
| Card | Title | Completed |
|------|-------|-----------|
| (add cards here) | | |
BOARD_EOF
 echo "Created .kanban/BOARD.md"
fi

# .kanban/POLICIES.md
cat > .kanban/POLICIES.md << 'POLICIES_EOF'
# Column Policies

## Backlog
- Cards can be added at any time
- No WIP limit

## Ready
- Card must have clear acceptance criteria before entering Ready
- No WIP limit

## In Progress
- Only one card per agent at a time unless pairing
- Card must be assigned to an owner

## Review
- Requires sign-off from a different agent than the owner
- All acceptance criteria must be verified

## Done
- All acceptance criteria met
- Reviewed and signed off
- Documentation updated (if applicable)

## Stuck Work
- Cards should never be blocked — split them instead
- If a card cannot proceed, split off the achievable part into a smaller card
- If still stuck after splitting, ask another agent or the end user for help
- Log the split or help request in BLOCKED.md
POLICIES_EOF
echo "Created .kanban/POLICIES.md"

# .kanban/METRICS.md
cat > .kanban/METRICS.md << METRICS_EOF
# Flow Metrics

## Cycle Time Log
Time from work started to work completed.

| Card | Title | Started | Completed | Cycle Time |
|------|-------|---------|-----------|------------|
| (logged by archive-card.sh) | | | | |

## Lead Time Log
Time from backlog entry to work completed.

| Card | Title | Created | Completed | Lead Time |
|------|-------|---------|-----------|-----------|
| (logged by archive-card.sh) | | | | |

## Throughput
Cards completed per period.

| Period | Count |
|--------|-------|
| (computed by report-metrics.sh) | | |

---
_Initialized: $DATE_
METRICS_EOF
echo "Created .kanban/METRICS.md"

# .kanban/BLOCKED.md
echo "# Stuck Work Log" > .kanban/BLOCKED.md
echo "" >> .kanban/BLOCKED.md
echo "- $DATE: Board initialized — no stuck work" >> .kanban/BLOCKED.md
echo "Created .kanban/BLOCKED.md"

echo ""
echo "Kanban board initialized!"
echo ""
echo "Next steps:"
echo " 1. Edit .kanban/CONFIG.md — customize columns and WIP limits"
echo " 2. Add cards to the backlog with ./scripts/add-card.sh"
echo " 3. Check WIP status with ./scripts/check-wip.sh"
echo " 4. Move cards through columns with ./scripts/move-card.sh"
