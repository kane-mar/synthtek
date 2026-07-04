#!/usr/bin/env bash
# init-backlog.sh
# Initialize the backlog management structure.
# Usage: ./scripts/init-backlog.sh

set -euo pipefail

DATE=$(date -Iseconds)

echo "Initializing backlog management structure..."

mkdir -p .backlog/ITEMS

# BACKLOG.md
if [ ! -f BACKLOG.md ]; then
 cat > BACKLOG.md << 'EOF'
# Product Backlog

Prioritized list of work items. Top items are ready to be pulled into the sprint backlog.
See `.backlog/CONFIG.md` for workflow states and item types.

| ID | Title | Type | Priority | Status |
|----|-------|------|----------|----------|--------|
| (add items here) | | | | | |

_Last updated:_
EOF
 echo "Created BACKLOG.md"
fi

# .backlog/CONFIG.md
cat > .backlog/CONFIG.md << 'CONFIG_EOF'
# Backlog Configuration

## Workflow States
# captured → backlog → refined → ready → in-progress → done

## Item Types
# feature, bug, tech-debt, improvement, chore, spike
CONFIG_EOF
echo "Created .backlog/CONFIG.md"

# .backlog/EPICS.md
if [ ! -f .backlog/EPICS.md ]; then
 cat > .backlog/EPICS.md << 'EPICS_EOF'
# Epics

Large initiatives broken into multiple backlog items.

| ID | Title | Items | Status |
|----|-------|-------|--------|
| (add epics here) | | | |

_An epic is complete when all its child items are done._
EPICS_EOF
 echo "Created .backlog/EPICS.md"
fi

# .backlog/REFINEMENT_LOG.md
echo "# Refinement Log" > .backlog/REFINEMENT_LOG.md
echo "" >> .backlog/REFINEMENT_LOG.md
echo "- $DATE: Backlog initialized" >> .backlog/REFINEMENT_LOG.md
echo "Created .backlog/REFINEMENT_LOG.md"



echo ""
echo "Backlog structure initialized!"
echo ""
echo "Next steps:"
echo " 1. Edit .backlog/CONFIG.md — customize workflow states and item types"
echo " 2. Start capturing items in BACKLOG.md or use ./scripts/capture-item.sh"
echo " 3. Refine top items with stories and AC before sprint planning"
