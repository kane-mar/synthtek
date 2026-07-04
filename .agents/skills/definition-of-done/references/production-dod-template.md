# Example DoD: Software Development Team

> **This is an example, not a universal template.** A software team deploying services has different quality criteria than a team building physical products, marketing campaigns, or regulatory filings. Use this as inspiration to define your own DoD.

A production-ready Definition of Done for a software team, balancing source-level quality, runtime validation, and organizational compliance.

## Code Quality
- [ ] **No known defects** — all identified bugs are fixed or explicitly deferred
- [ ] **Technical debt addressed** — code has been refactored to reduce technical debt
- [ ] **Static analysis passed** — code passes all local linting, syntax verification, and static security analysis tool baselines
- [ ] **Peer review completed** — the pull request has been reviewed and approved by at least one other engineer, ensuring adherence to structural and architectural patterns
- [ ] **Mainline integration** — code branch is cleanly merged into the integration line with all build flags passing

## Testing
- [ ] **Unit tests pass** — automated unit tests execute successfully with no failures
- [ ] **Integration verification passed** — API contracts, database migrations, and cross-service dependencies validate successfully in an automated staging sweep
- [ ] **End-to-end functionality tested** — full E2E tests pass with no failures
- [ ] **Acceptance criteria satisfied** — the implemented logic satisfies all business-defined acceptance criteria mapped out in the parent backlog item

## Observability
- [ ] **Telemetry and logging added** — structured application logs and performance markers are exposed for system monitoring tools

## Documentation
- [ ] **Documentation updated** — system design changes, new API schemas, or configuration flag alterations are accurately cataloged in the team's shared knowledge base, FAQs, support guides
- [ ] **Compliance documentation completed** (for regulated industries)

## Deployment
- [ ] **Docker instance rebuilt and deployed** — the Docker image has been rebuilt and deployed to the target environment
