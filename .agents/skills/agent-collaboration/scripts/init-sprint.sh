#!/usr/bin/env bash
# init-sprint.sh
# Initialize the cross-functional collaboration structure for a sprint.
# Usage: ./scripts/init-sprint.sh [sprint-number] [sprint-goal]

set -euo pipefail

SPRINT_NUM="${1:-1}"
SPRINT_GOAL="${2:-"Deliver value to the user this sprint"}"
DATE=$(date -Iseconds)

echo "Initializing Sprint $SPRINT_NUM collaboration structure..."

mkdir -p .collaboration/PAIRS .collaboration/RETROS

# BACKLOG.md
if [ ! -f .collaboration/BACKLOG.md ]; then
 cat > .collaboration/BACKLOG.md << 'EOF'
# Product Backlog

| Item | Description | Acceptance Criteria | Complexity |
|------|-------------|-------------------|------------|
| (add items here) | | | |

_Refined during Backlog Refinement sessions. Items should be small enough to complete in one sprint._
EOF
 echo "Created BACKLOG.md"
fi

# WORKING_AGREEMENT.md
if [ ! -f .collaboration/WORKING_AGREEMENT.md ]; then
 cat > .collaboration/WORKING_AGREEMENT.md << 'WA_EOF'
# Team Working Agreement

> A living document that formalizes the structural guardrails for agent collaboration.
> Review and update every sprint retrospective.

## WIP Limits
- Maximum active items on SPRINT_BACKLOG at any time: 3
- If at limit, swarm before pulling new work.

## Definition of Done
An item is "Done" only when ALL of these are met:
- [ ] Cross-functional review (agent from a different discipline signs off)
- [ ] Tests pass (unit + integration)
- [ ] QA signs off — acceptance criteria verified
- [ ] Documentation updated
- [ ] Decision rationale logged in DECISIONS.md

## Three Amigos
- Every story requires a Three Amigos review before moving to "In Progress"
- Log the session in DAILY_LOG.md

## 15-Minute Rule
- If stuck for 15+ minutes on a problem, ask a teammate for help
- Log what you tried

## Communication
- Design feedback: in shared documents / comments
- Architectural decisions: in DECISIONS.md
- Status: in SPRINT_BACKLOG.md
- Blockers & sync: in DAILY_LOG.md
WA_EOF
 echo "Created WORKING_AGREEMENT.md"
fi

# SPRINT_BACKLOG.md
cat > .collaboration/SPRINT_BACKLOG.md << 'SPRINT_BACKLOG_EOF'
# Sprint Backlog

| Item | Owner | Status | Notes |
|------|-------|--------|-------|
| (item) | (agent) | todo | (add notes) |
SPRINT_BACKLOG_EOF
echo "Created SPRINT_BACKLOG.md"

# DAILY_LOG.md
echo "# Daily Log" > .collaboration/DAILY_LOG.md
echo "" >> .collaboration/DAILY_LOG.md
echo "- $DATE: Sprint $SPRINT_NUM initialized" >> .collaboration/DAILY_LOG.md

# DECISIONS.md
echo "# Key Decisions" > .collaboration/DECISIONS.md
echo "" >> .collaboration/DECISIONS.md
echo "- $DATE: Sprint $SPRINT_NUM started — Goal: $SPRINT_GOAL" >> .collaboration/DECISIONS.md
echo "Created DAILY_LOG.md and DECISIONS.md"

# SPRINT.md (only if not exists or forced)
if [ ! -f SPRINT.md ] || [ "${FORCE:-}" = "1" ]; then
 cat > SPRINT.md << SPRINT_EOF
# Sprint $SPRINT_NUM

## Sprint Goal
$SPRINT_GOAL

## Team
| Agent | Primary Expertise | Can Help With |
|-------|------------------|---------------|
| (name) | (expertise) | (adjacent skills) |

## Sprint Scope
_Items committed from the backlog._

## Definition of Done
- [ ] **Cross-functional review** — reviewed by at least one agent from a different discipline
- [ ] **Tests pass** (unit + integration)
- [ ] **QA signs off** — acceptance criteria verified
- [ ] **Documentation updated**
- [ ] **Decision logged** in DECISIONS.md with rationale
SPRINT_EOF
 echo "Created SPRINT.md"
fi

echo ""
echo "Sprint $SPRINT_NUM initialized!"
echo ""
echo "Next steps:"
echo " 1. Review WORKING_AGREEMENT.md — customize WIP limits, DoD, and guardrails"
echo " 2. Edit SPRINT.md — add team roles and sprint scope"
echo " 3. Run Sprint Planning — Three Amigos every story before coding"
echo " 4. Start collaborating — remember: swarm before you wait, pair on high-risk work"
