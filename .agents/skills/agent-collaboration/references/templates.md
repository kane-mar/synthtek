# Collaboration Templates — Cross-Functional Scrum Team

Ready-to-use templates for cross-functional collaboration artifacts. Copy and fill as needed.

## Team Working Agreement (WORKING_AGREEMENT.md)

```markdown
# Team Working Agreement

> A living document. Review and update every sprint retrospective.

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

## Code Reviews
- All pull requests must be reviewed within 4 hours of submission
- Reviews require sign-off from a different discipline
```

## Three Amigos Session Log (for DAILY_LOG.md)

```markdown
## Three Amigos — Story: [story name] (2026-05-23)

**PO:** "[what the user needs]"
**Developer:** "[technical constraints / approach]"
**QA:** "[edge cases / testability concerns]"
**Resolution:** [what changed — scope, design, or acceptance criteria]
```

## 15-Minute Attempt Log (for DAILY_LOG.md)

```markdown
## 15-min attempt — 2026-05-23T10:00:00

**Problem:** [what's stuck]
**Tried:**
  - [what you attempted]
  - [what you attempted]
**Still stuck after 15min → asking [agent-name] for help**
```

## SPRINT.md

```markdown
# Sprint [N]

## Sprint Goal
_(A single sentence describing the value the team commits to deliver)_

## Team
| Agent | Primary Expertise | Can Help With |
|-------|------------------|---------------|
| (name) | (expertise) | (adjacent skills) |

## Sprint Scope
_(Backlog items committed for this sprint — reference SPRINT_BACKLOG.md)_

## Definition of Done
- [ ] **Cross-functional review** — reviewed by at least one agent from a different discipline
- [ ] **Tests pass** (unit + integration)
- [ ] **QA signs off** — acceptance criteria verified
- [ ] **Documentation updated**
- [ ] **Decision logged** in DECISIONS.md with rationale
```

## Sprint Backlog Entry

```markdown
| Item | Owner | Status | Notes |
|------|-------|--------|-------|
| User password reset | agent-alpha | in-progress | Waiting on email service config |
```

## Daily Sync Entry

```markdown
## 2026-05-23

**agent-name:** What I did, any swarming/pairing activity.
  - Blockers: What's blocking me (or "none")
  - Next: What I'll do next
```

## Swarm Event Log

```markdown
## Swarm Event — 2026-05-23T10:00:00

**Bottleneck:** Description of the bottleneck
**Agents involved:** agent-alpha, agent-beta
**Plan:** How we'll break it down and resolve it
```

## Pair Programming Session

```markdown
---
id: PAIR-001
date: 2026-05-23T10:00:00
driver: agent-alpha
navigator: agent-beta
task: "Implement password reset security module"
status: in-progress
---

### Goals
- Implement rate-limited password reset endpoint
- Add email verification step
- Pass all security scans

### Notes
- Discovered email service has a 10 req/min rate limit
- Decided to add client-side cooldown UX (delegated to beta's next solo task)

### Knowledge Transfer
- agent-beta now understands the email service integration
- agent-alpha learned the frontend cooldown pattern for future reference

### Outcome
- Security module implemented and passing scans
- Rate limiting handled correctly
```

## Decision Log Entry

```markdown
## 2026-05-23: Email service rate limiting

- **Decision:** Use client-side cooldown + server-side rate limiting for password reset emails
- **Rationale:** Email provider limits to 10 req/min. Client cooldown prevents most exceeded limits; server-side catch handles edge cases.
- **Alternatives considered:** Switch email provider (too slow for this sprint), queue-based sending (overengineering for current volume)
- **Values reflected:** Openness (agent-alpha surfaced the limit early), Courage (agent-beta admitted the UI cooldown adds complexity)
- **Logged by:** agent-alpha
```

## Sprint Review

```markdown
# Sprint Review — Sprint [N]

**Date:** 2026-05-23

## Sprint Goal
_(Restate the goal)_

## Completed
- Item 1 — what was built, how it contributes to the goal
- Item 2 — what was built, how it contributes to the goal

## Not Completed
- Item 3 — why? What was learned?

## Feedback
_(From stakeholders or other agents)_

## New Backlog Items
- Item discovered during sprint
- Improvement idea from review
```

## Sprint Retrospective (with Values Check)

```markdown
# Sprint Retrospective — Sprint [N]

**Date:** 2026-05-23

## Values Check (5 min — start here)

| Value | Reflection |
|-------|------------|
| **Commitment** | Did we all stay engaged after our individual tasks were done? |
| **Focus** | Did we stay focused on the Sprint Goal, or get pulled elsewhere? |
| **Openness** | Did we surface bad news early enough? |
| **Respect** | Did we truly listen to each other's expertise? |
| **Courage** | Did anyone speak up about an uncomfortable truth? |

_Which value was weakest this sprint? What one thing can we do to strengthen it?_

## What went well
- 

## What could be improved
- 

## Action Items
_(1-3 concrete improvements)
- [ ] 
- [ ] 

## Discussion Notes
_(Key points from the retro conversation)_
```

## Swarming Invitation (for DAILY_LOG.md)

```markdown
**Swarm needed:** [description of bottleneck]
  - Who can help? [agent names]
  - What's needed: [specific help request]
```

## Pairing Invitation (for DAILY_LOG.md)

```markdown
**Pairing request:** [task description]
  - Why: [high-risk / knowledge transfer / complex]
  - Looking for: [driver / navigator / specific expertise]
```
