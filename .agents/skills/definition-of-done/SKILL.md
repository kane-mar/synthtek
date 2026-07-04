---
name: definition-of-done
description: "Define, enforce, and evolve the Definition of Done (DoD): a shared checklist of quality criteria that all work must meet before it can be considered complete. Covers DoD vs Acceptance Criteria, standard criteria templates, verification workflows, DoD review, and integration with backlog-management and kanban-board skills."
compatibility: "Works with any coding agent harness that supports reading/writing files and running shell commands."
metadata:
  version: "1.0.0"
  patterns: "definition-of-done, quality-gates, acceptance-criteria, done-checklist"
---

# Definition of Done

The **Definition of Done (DoD)** is a shared, explicit checklist of quality criteria that every piece of work must meet before it can be considered complete. It protects quality by ensuring nothing is called "done" prematurely.

> **DoD is not negotiable per item.** Acceptance Criteria vary per story. The DoD applies to *everything* the team delivers. If an item doesn't meet the DoD, it's not done — regardless of whether its Acceptance Criteria are satisfied.

> **Relationship to other skills:** The [backlog-management](../backlog-management/SKILL.md) skill covers writing Acceptance Criteria for individual items. The [kanban-board](../kanban-board/SKILL.md) skill controls *when* an item moves to Done. This skill defines *what "Done" actually means* — the gate that must be passed before that move happens.

---

## Quick Start

If you're entering a project that already has a DoD:

```bash
# Read the current Definition of Done
cat DEFINITION_OF_DONE.md
```

If no DoD exists, initialize one:

```bash
# Scripts are located at <SKILL_DIR>/scripts/
# Replace <SKILL_DIR> with the path to this skill directory.
<SKILL_DIR>/scripts/init-dod.sh
```

---

## Core Concepts

### What is a Definition of Done?

The Definition of Done is a **shared quality checklist** that the entire team agrees to. Every backlog item — every PBI, every story, every task — must pass every item on this checklist before it can be marked as "Done."

| Aspect | DoD | Acceptance Criteria |
|--------|-----|---------------------|
| **Scope** | Applies to ALL work | Specific to ONE item |
| **Content** | Quality standards, process gates | Functional behavior, edge cases |
| **Who defines** | The whole team | The Product Owner |
| **When set** | Once, reviewed periodically | Per item, during refinement |
| **Negotiable?** | No — team agreement | Yes — can be adjusted per item |

> **Example:** A story's Acceptance Criteria say "User receives a reset link within 30 seconds." The DoD says "All unit tests pass, code reviewed, integration tests pass, documentation updated." Both must be satisfied for the item to be done.

> **Guardrail:** The DoD applies **uniformly** to every item that crosses the finish line, regardless of its unique scope. If a validation step applies only to a specific task — a particular performance benchmark, a niche security requirement, a one-time data migration check — it belongs in that task's **Acceptance Criteria**, not the global DoD. Adding item-specific rules to the DoD breaks the universal contract and forces every item to meet criteria that don't apply to it.

### Why a DoD Matters

- **Prevents technical debt** — no cutting corners on quality to meet a deadline
- **Shared understanding** — everyone agrees on what "done" means, avoiding arguments at the Sprint Review
- **Consistent quality** — every item meets the same bar, regardless of who built it
- **Transparency** — stakeholders know what "done" actually means

### DoD vs "Ready"

| Concept | Definition |
|---------|-----------|
| **Definition of Done** | Criteria that must be met for work to be considered complete |
| **Definition of Ready** | Criteria that must be met for work to be pulled into a sprint |

The DoD is about the exit door. "Ready" is about the entry door. They are complementary but different.

---

## Shared Structure

```
project-root/
 DEFINITION_OF_DONE.md        # ← READ THIS FIRST. The team's DoD.
 .dod/
    CONFIG.md                # DoD scope, exceptions, review cadence
    CHECKLIST.md             # The full DoD checklist (machine-readable)
    VERIFICATION_LOG.md      # Records of items verified against the DoD
    REVIEW_LOG.md            # DoD review/evolution history
```

---

## Example DoD Criteria (Software Team)

> **DoD varies by context.** The example below works for a software development team building and deploying services. A team building a physical product, a marketing campaign, or a regulatory filing will have a completely different DoD. **Define your own DoD** — use this as inspiration, not as a mandate.

The criteria that matter depend on what you're building:

| Team Context | Example DoD Criteria |
|-------------|---------------------|
| **Software** | Tests pass, code reviewed, deployed, logged |
| **Physical product** | Prototype tested, materials sourced, safety certified, assembly documented |
| **Marketing** | Copy reviewed, assets approved, campaign scheduled, analytics tagged |
| **Regulatory** | Filing reviewed, evidence compiled, signatures obtained, submitted |

**The principle is the same regardless of context:** the DoD is a shared, universal quality checklist that applies to every item. What goes on that checklist depends entirely on what "quality" means for your team.

Below is an example for a software team building and deploying production services:

### Code Quality
- [ ] **No known defects** — all identified bugs are fixed or explicitly deferred
- [ ] **Technical debt addressed** — code has been refactored to reduce technical debt
- [ ] **Static analysis passed** — code passes all local linting, syntax verification, and static security analysis tool baselines
- [ ] **Peer review completed** — the pull request has been reviewed and approved by at least one other engineer, ensuring adherence to structural and architectural patterns
- [ ] **Mainline integration** — code branch is cleanly merged into the integration line with all build flags passing

### Testing
- [ ] **Unit tests pass** — automated unit tests execute successfully with no failures
- [ ] **Integration verification passed** — API contracts, database migrations, and cross-service dependencies validate successfully in an automated staging sweep
- [ ] **End-to-end functionality tested** — full E2E tests pass with no failures
- [ ] **Acceptance criteria satisfied** — the implemented logic satisfies all business-defined acceptance criteria mapped out in the parent backlog item

### Observability
- [ ] **Telemetry and logging added** — structured application logs and performance markers are exposed for system monitoring tools

### Documentation
- [ ] **Documentation updated** — system design changes, new API schemas, or configuration flag alterations are accurately cataloged in the team's shared knowledge base, FAQs, support guides
- [ ] **Compliance documentation completed** (for regulated industries)

### Deployment
- [ ] **Docker instance rebuilt and deployed** — the Docker image has been rebuilt and deployed to the target environment

> **Not all criteria apply to all teams.** Customize the checklist in `.dod/CHECKLIST.md` to match your team's context. A small team building a prototype may have a lightweight DoD. A regulated industry team may have an extensive one.

---

## DoD Workflows

### 1. Initializing the DoD

```bash
<SKILL_DIR>/scripts/init-dod.sh
```

This creates `DEFINITION_OF_DONE.md` with a starter DoD and `.dod/CHECKLIST.md` with the full machine-readable checklist.

Customize the checklist by editing `.dod/CHECKLIST.md` — enable or disable items based on your team's needs.

### 2. Checking an Item Against the DoD

Before marking any work as Done, verify it against every active criterion in the DoD:

```bash
<SKILL_DIR>/scripts/verify-dod.sh CARD-003
```

The script reads the checklist from `.dod/CHECKLIST.md` and walks through each criterion:

```
 Verifying CARD-003 against Definition of Done...

 Code reviewed
 Unit tests pass
 New unit tests added
 Integration tests pass  ← NOT MET
 Edge cases tested
 Code documented
 No regressions

Result:  NOT DONE — 1 criterion not met
```

If any criterion is not met, the item cannot be moved to Done. Log the verification result in `.dod/VERIFICATION_LOG.md`.

### 3. Overriding a DoD Item (Rare)

In exceptional cases, the team may agree to waive a specific DoD criterion for a specific item. This must be:

1. **Explicit** — logged in VERIFICATION_LOG.md with the reason
2. **Rare** — frequent overrides mean the DoD needs updating
3. **Team decision** — not a single agent's choice

```bash
<SKILL_DIR>/scripts/verify-dod.sh CARD-003 --override "Integration tests waived — test environment down, will add in next sprint"
```

### 4. Reviewing the DoD

The DoD should be reviewed periodically (e.g., every quarter or after a major retrospective). Update it based on what the team has learned.

```bash
<SKILL_DIR>/scripts/review-dod.sh "Added security review criterion. Removed outdated browser test requirement."
```

Review history is logged in `.dod/REVIEW_LOG.md`.

---

## Quick Reference Cards

### Before Marking an Item as Done
- [ ] Run `verify-dod.sh <item-id>` to check every DoD criterion
- [ ] Every criterion must be met — no exceptions without a logged override
- [ ] Acceptance Criteria are NOT a substitute for the DoD — both must be satisfied
- [ ] Log the verification result in VERIFICATION_LOG.md

### When Defining the DoD
- [ ] Involve the whole team — DoD is a team agreement, not a mandate
- [ ] Start simple — a 5-item DoD that's enforced is better than a 20-item DoD that's ignored
- [ ] Include criteria from: Code Quality, Testing, Documentation, Operations, Collaboration
- [ ] Write each criterion as a clear yes/no check — no ambiguity

### During DoD Review
- [ ] Review the DoD every quarter or after major retros
- [ ] Ask: "Did we skip any DoD items this sprint?" — that's a signal the DoD is wrong
- [ ] Ask: "Are there new quality concerns not covered?" — add them
- [ ] Ask: "Are any criteria obsolete?" — remove them
- [ ] Log changes in REVIEW_LOG.md

### DoD vs Acceptance Criteria Quick Check

| Question | DoD | AC |
|----------|-----|----|
| Does this apply to every item? |  Yes |  Per item |
| Can an agent decide to skip it? |  No |  With PO |
| Is it about quality or behavior? | Quality | Behavior |
| Who defines it? | Team | Product Owner |

---

## References

- [DoD vs Acceptance Criteria Deep Dive](references/dod-vs-ac.md) — Detailed explanation with examples of when each applies.
- [Example DoD: Software Team](references/production-dod-template.md) — A production-ready DoD example for a software team (adapt to your own context).

---

## Helper Scripts

| Script | Purpose |
|--------|---------|
| `init-dod.sh` | Initialize the Definition of Done structure |
| `verify-dod.sh` | Check an item against every DoD criterion |
| `review-dod.sh` | Log a DoD review or update |

See [scripts/](scripts/) for implementation.
