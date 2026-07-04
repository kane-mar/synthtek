#!/usr/bin/env bash
# init-dod.sh
# Initialize the Definition of Done structure.
# Usage: ./scripts/init-dod.sh

set -euo pipefail

DATE=$(date -Iseconds)

echo "Initializing Definition of Done..."

mkdir -p .dod

# DEFINITION_OF_DONE.md
if [ ! -f DEFINITION_OF_DONE.md ]; then
 cat > DEFINITION_OF_DONE.md << 'DOD_EOF'
# Definition of Done

> Every item must meet ALL of these criteria before it can be marked as Done.
> See `.dod/CHECKLIST.md` for the machine-readable checklist.
>
> **This is an example for a software team.** Adapt it to your own context.
> Physical products, marketing, regulatory, and other domains will need
> completely different criteria.

## Code Quality
- [ ] No known defects
- [ ] Code has been refactored to reduce technical debt
- [ ] Static Analysis: Code passes all local linting, syntax verification, and static security analysis tool baselines
- [ ] Peer Review: The pull request (PR) has been reviewed and approved by at least one other engineer, ensuring adherence to structural and architectural patterns
- [ ] Mainline Integration: Code branch is cleanly merged into the integration line with all build flags passing

## Testing
- [ ] Unit Testing: Automated unit tests execute successfully with no failures
- [ ] Integration Verification: API contracts, database migrations, and cross-service dependencies validate successfully in an automated staging sweep
- [ ] End-to-end functionality tested with no failures
- [ ] Acceptance Criteria: The implemented logic satisfies all business-defined acceptance criteria mapped out in the parent backlog item

## Observability
- [ ] Telemetry & Logging: Structured application logs and performance markers are exposed for system monitoring tools

## Documentation
- [ ] Documentation Update: System design changes, new API schemas, or configuration flag alterations are accurately cataloged in the team's shared knowledge base, FAQs, Support Guides
- [ ] Compliance documentation completed (for regulated industries)

## Deployment
- [ ] Docker instance has been rebuilt and deployed

---
_Last reviewed: —_
DOD_EOF
 echo "Created DEFINITION_OF_DONE.md"
fi

# .dod/CONFIG.md
cat > .dod/CONFIG.md << 'CONFIG_EOF'
# DoD Configuration

## Scope
# Does the DoD apply to all items, or are there exceptions?
scope: all

## Exceptions
# List item types that may have a different DoD (e.g., "spike", "chore")
# If none, leave empty.
exceptions:

## Review Cadence
# How often is the DoD reviewed?
review_cadence: quarterly

## Override Policy
# Can DoD items be overridden? If so, who decides?
override_policy: "Team decision — logged in VERIFICATION_LOG.md"
CONFIG_EOF
echo "Created .dod/CONFIG.md"

# .dod/CHECKLIST.md
cat > .dod/CHECKLIST.md << 'CHECK_EOF'
# DoD Checklist

# Format: [enabled|disabled] category: criterion
# Disabled items are skipped during verification.

## Code Quality
enabled: No known defects
enabled: Technical debt addressed
enabled: Static analysis passed
enabled: Peer review completed
enabled: Mainline integration

## Testing
enabled: Unit tests pass
enabled: Integration verification passed
enabled: End-to-end tests pass
enabled: Acceptance criteria satisfied

## Observability
enabled: Telemetry and logging added

## Documentation
enabled: Documentation updated
enabled: Compliance documentation completed

## Deployment
enabled: Docker instance rebuilt and deployed
CHECK_EOF
echo "Created .dod/CHECKLIST.md"

# .dod/VERIFICATION_LOG.md
echo "# Verification Log" > .dod/VERIFICATION_LOG.md
echo "" >> .dod/VERIFICATION_LOG.md
echo "- $DATE: DoD initialized" >> .dod/VERIFICATION_LOG.md
echo "Created .dod/VERIFICATION_LOG.md"

# .dod/REVIEW_LOG.md
echo "# DoD Review Log" > .dod/REVIEW_LOG.md
echo "" >> .dod/REVIEW_LOG.md
echo "- $DATE: Initial DoD created" >> .dod/REVIEW_LOG.md
echo "Created .dod/REVIEW_LOG.md"

echo ""
echo "Definition of Done initialized!"
echo ""
echo "Next steps:"
echo " 1. Review DEFINITION_OF_DONE.md and customize the criteria"
echo " 2. Enable/disable checklist items in .dod/CHECKLIST.md"
echo " 3. Before marking work as Done, run ./scripts/verify-dod.sh <item-id>"
