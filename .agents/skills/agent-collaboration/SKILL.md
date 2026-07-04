---
name: agent-collaboration
description: "Scrum-based collaboration for multi-agent teams. Use when multiple agents share a project, need to avoid serial handoffs, swarm bottlenecks, or pair on high-risk tasks. Grounded in the five Scrum values: Commitment, Focus, Openness, Respect, Courage."
compatibility: "Works with any coding agent harness that supports reading/writing files and running shell commands. No special tools required."
metadata:
  version: "2.1.0"
  inspired-by: "Scrum values (Commitment, Focus, Openness, Respect, Courage) + Cross-functional teams — shared ownership, T-shaped skills, continuous feedback"
  patterns: "scrum-values, cross-functional, swarming, pair-programming, continuous-feedback"
---

# Agent Collaboration — Cross-Functional Scrum Team

This skill enables multiple AI agents to work together as a **cross-functional Scrum team**. Instead of passing work like a hot potato from agent to agent (serial handoffs), agents with different expertise collaborate **simultaneously or in tight iterative loops** on a shared Sprint Goal.

> **Core shift:** "That's not my job" → "How do we get this over the finish line together?"

> **For AI agents:** Traditional Sprint Events — Sprint Planning, Sprint Review, Daily Scrum — are designed for human teams that need scheduled synchronization. AI agents work continuously and can coordinate instantly, making these events redundant. The 2-week sprint cadence does not apply. Instead, use the continuous flow model: pull work from the backlog whenever capacity allows, sync via shared artifacts (DAILY_LOG.md, DECISIONS.md), and swarm on bottlenecks immediately. The Scrum values and collaboration patterns (swarming, pairing, guardrails) remain valuable — only the calendar-based events are unnecessary.

## Quick Start

If you're an agent entering a project that already has collaboration set up:

```bash
# 1. Read the context
cat SPRINT.md
cat .collaboration/WORKING_AGREEMENT.md
cat .collaboration/DAILY_LOG.md
cat .collaboration/DECISIONS.md
cat .collaboration/SPRINT_BACKLOG.md

# 2. Log your presence
echo "- $(date -Iseconds): [your-name] entered the project" >> .collaboration/DAILY_LOG.md

# 3. Check what needs doing
# - Items 'in-progress' that need help → offer to swarm
# - Items 'todo' matching your expertise → claim one
# - Items 'blocked' you can unblock
```

If `.collaboration/` does **not** exist, initialize it. Run from the project root:

```bash
# Scripts are located at <SKILL_DIR>/scripts/init-sprint.sh
# Replace <SKILL_DIR> with the path to this skill directory.
<SKILL_DIR>/scripts/init-sprint.sh 1 "Initial sprint"
```

Then read the rest of this skill to understand the values, guardrails, and protocols.

---

>  **Two modes of operation:** This skill works for both real-time multi-agent teams (agents running simultaneously) and sequential sessions (one agent at a time, handing off via artifacts). Protocols are the same — real-time teams use syncs and swarming more aggressively; sequential sessions rely more on DECISIONS.md and DAILY_LOG.md for handoffs.

## Core Concepts

The processes in this skill (planning, daily syncs, swarming, pairing, retros) are tools. They work **only when the five Scrum values are genuinely adopted** by every agent. Without these values, the practices become empty, robotic rituals. With them, the team creates **psychological safety** — the exact environment required for true cross-functional collaboration to happen naturally.

### Commitment — to the Sprint Goal, each other, and quality
### Focus — on the Sprint, not distractions
### Openness — full transparency about work, progress, and challenges
### Respect — every agent is a capable professional with unique strengths
### Courage — speak up, tackle hard problems, admit uncertainty

### The Values in Action

These values interlock. When a developer realizes a feature is twice as complex as estimated:

```
  [COURAGE]           [OPENNESS]            [RESPECT]             [COMMITMENT]
  Developer admits →  Team openly        →  PO Agent listens   →  Team collaborates
  they are stuck      discusses the         without blame;        to adjust scope
  and the Sprint      bottleneck and        values the            and swarm the
  Goal is at risk.    technical debt.       engineer's input.     goal together.
```

> Without these values, the developer stays silent, the PO is blindsided, and the team fails in isolation. With them, the obstacle becomes a shared challenge solved through immediate collaboration.

**For detailed exploration of each value** (what it looks like, what it doesn't mean, signs of weakness) see [references/patterns-deep-dive.md](references/patterns-deep-dive.md#1-the-five-scrum-values--deep-dive).

## Operating Rules

Values shape *intentions*. These operating rules shape *behavior* — they make collaboration the path of least resistance rather than an afterthought. High-performing teams formalize these into a **Team Working Agreement** (see `.collaboration/WORKING_AGREEMENT.md`).

### Rule 1 — WIP Limits (Swarming Enforcer)

**The rule:** Set a hard Work-in-Progress (WIP) limit on SPRINT_BACKLOG.md. For a team of 3-5 agents, limit active stories to 2-3 total.

**How it forces collaboration:** If the WIP limit is reached, an agent cannot pull a new item from "To Do". They *must* look at "In Progress" or "Blocked" columns and ask teammates: *"How can I help you get this story to Done?"* This shifts the metric from *resource utilization* (keeping everyone busy) to *throughput* (getting value out of the pipeline).

```bash
# In SPRINT_BACKLOG.md, add: WIP Limit: 3 active items
# Before pulling new work, count in-progress items. If at limit, swarm instead.
```

> **See also:** [Workflow 4 — Swarming](#4-swarming-bottleneck-protocol) for detailed swarming mechanics.

### Rule 2 — Shared Definition of Done (Cross-Functional Binding)

**The rule:** An item is not "Done" until *all* criteria are met — no agent can declare victory unilaterally. Include cross-functional gates:
- *"Requires peer review from another discipline"* (backend reviews frontend, QA signs off on backend, etc.)
- *"Acceptance criteria verified by PO before marking 'Done'"*

**Define your DoD in WORKING_AGREEMENT.md and reference it in SPRINT.md.**

### Rule 3 — Three Amigos (Design Before Code)

**The rule:** Before coding a story, hold a mini-kickoff with three perspectives:
- **Business** (PO agent) — explains the *what*
- **Technical** (Developer agent) — explains the *how*
- **Testing** (QA agent) — raises the *what ifs*

**Log to DAILY_LOG.md:**
```markdown
## Three Amigos — Story: Password Reset
**PO:** "Users locked out must receive a reset link within 30 seconds"
**Developer:** "Email service has 10 req/min rate limit — we need a queue"
**QA:** "How do we test rate limiting? What if email service is down?"
**Resolution:** Added client cooldown + server queue + error UI. AC updated.
```

### Rule 4 — The 15-Minute Rule (Normalizing Help-Seeking)

**The rule:** If stuck on a problem, spend **15 minutes** trying to solve it (documenting attempts). If still stuck, **must** ask a teammate for help.

**Log to DAILY_LOG.md:**
```markdown
## 15-min attempt — 2026-05-23T10:00:00
**Problem:** WebSocket drops after 60s idle
**Tried:** checked heartbeat (30s), bypassed proxy, added reconnect (state lost)
**Still stuck → asking agent-beta for help**
```

> **See also:** [Workflow 5 — Pair Programming](#5-pair-programming) for when a teammate responds and you pair on the solution.

### Rule 5 — Guilds (Cross-Team Alignment)

**The rule:** Establish cross-cutting groups from different sub-teams who share a discipline (e.g., Frontend Guild, Security Guild) to align on global standards.

**Log to DECISIONS.md:**
```markdown
## Guild: Frontend Architecture
**Members:** agent-beta (Team A), agent-delta (Team B)
**Decision:** All new components use shared design system. No component-specific CSS outside `src/shared/`.
```

### Rule 6 — Team Working Agreement

Formalize all guardrails into **`.collaboration/WORKING_AGREEMENT.md`**:

| Focus Area | Example Agreement |
|------------|-------------------|
| **WIP Limits** | Max 3 active stories. At limit, swarm before pulling new work. |
| **Code Reviews** | Review within 4h. Sign-off from a different discipline required. |
| **Definition of Done** | Code reviewed + tests pass + PO verified + decision logged. |
| **Three Amigos** | Every story needs Three Amigos before moving to "In Progress". |
| **15-Minute Rule** | Stuck for 15+ min? Ask for help. No exceptions. |
| **Communication** | Design → shared docs. Decisions → DECISIONS.md. Status → SPRINT_BACKLOG.md. |

---

## When to Activate This Skill

| Trigger | Action |
|---------|--------|
| Multiple agents share a project | Initialize collaboration structure + define a Sprint Goal |
| Work is being passed serially (A → B → C) | Break the chain — use swarming + Three Amigos instead |
| A bottleneck is forming | Check WIP limits → swarm (see [Workflow 4](#4-swarming-bottleneck-protocol)) |
| High-risk or security-sensitive task | Pair program (see [Workflow 5](#5-pair-programming)) |
| An agent is stuck for 15+ minutes | Invoke the 15-minute rule → ask for help → micro-pair |
| Sprint needs structure | Run planning, daily syncs, review, retro (see workflows below) |
| Teams need technical alignment | Form a Guild (see [Rule 5](#rule-5--guilds-cross-team-alignment)) |

## Shared Structure

```
project-root/
 SPRINT.md                     # ← READ THIS FIRST. Sprint Goal, DoD, team roles
 .collaboration/
    WORKING_AGREEMENT.md      # WIP limits, DoD, Three Amigos, 15-min rule, etc.
    BACKLOG.md                # Refined backlog items
    SPRINT_BACKLOG.md         # Sprint items + WIP limit header
    DAILY_LOG.md              # Syncs, Three Amigos, 15-min attempts
    DECISIONS.md              # Key decisions + Guild alignment log
    PAIRS/                    # Pair session notes
    RETROS/                   # Sprint retrospectives
```

## Collaboration Workflows

### 0. Ground Rules (Every Agent Must Follow)

These ground rules are direct expressions of the five Scrum values. Follow them to create psychological safety.

**Read SPRINT.md first.** Know the Sprint Goal before doing anything.
**Update shared artifacts after every action.** Log decisions, blockers, and uncertainty — especially bad news.
**Swarm before you wait.** Finished early? Go help a teammate. See a bottleneck? Converge on it.
**Be explicit, not implicit.** Document rationale and trade-offs in DECISIONS.md. Don't assume.

### 1. Sprint Setup

Run `./scripts/init-sprint.sh` to initialize the collaboration structure. This creates:
- `.collaboration/BACKLOG.md` — Product Backlog
- `.collaboration/SPRINT_BACKLOG.md` — Sprint Backlog with WIP limit header
- `.collaboration/WORKING_AGREEMENT.md` — Team Working Agreement with defaults
- `.collaboration/DAILY_LOG.md` — Daily sync log
- `.collaboration/DECISIONS.md` — Key decisions log
- `.collaboration/PAIRS/` — Pair session notes directory
- `.collaboration/RETROS/` — Retrospective artifacts directory
- `SPRINT.md` — Sprint Goal, team roles, and Definition of Done

```bash
./scripts/init-sprint.sh 3 "Users can reset their password via email"
```

Then customize the defaults:
- Edit `SPRINT.md` — add team roles and sprint scope
- Edit `WORKING_AGREEMENT.md` — tune WIP limits, DoD, Three Amigos rules

### 2. Sprint Planning

The team collaboratively defines the Sprint Goal and commits to backlog items.

**Steps:**

1. **Review the Product Backlog** — Read `.collaboration/BACKLOG.md`
2. **Negotiate scope** — Agents with deep expertise advise on complexity, technical debt, and risks. The goal is a realistic commitment, not overcommitment.
3. **Define the Sprint Goal** — A single sentence describing the value the team will deliver.
4. **Commit to items** — Move items from BACKLOG.md to SPRINT_BACKLOG.md with owners.
5. **Update SPRINT.md** with the goal, committed items, and team roles.

**What cross-functional collaboration looks like here:**
- The "backend" agent warns that a certain feature requires heavy API polling that could crash the server → the team adjusts scope together
- The "QA" agent asks how edge cases will be tested → acceptance criteria get refined
- The "frontend" agent suggests a UI pattern that simplifies the API contract → everyone wins

### 3. Daily Sync

Every day (or every N agent turns), the team syncs.

```bash
# Read the current state
cat SPRINT.md
cat .collaboration/SPRINT_BACKLOG.md
cat .collaboration/DAILY_LOG.md
cat .collaboration/DECISIONS.md
```

**Sync format — append to DAILY_LOG.md:**

```markdown
## 2026-05-23

**agent-alpha:** Finished the API endpoint for user auth. Now helping agent-beta with the login form validation (swarming — testing bottleneck).
  - Blockers: None
  - Next: Pair with agent-gamma on edge-case tests

**agent-beta:** Login page UI is done. Hit a snag with form validation — agent-alpha is helping me debug.
  - Blockers: Cleared (agent-alpha swarmed in)
  - Next: Integration test with the API

**agent-gamma:** Running regression suite. Found 3 failing tests after agent-alpha's changes.
  - Blockers: Need agent-alpha to review the test failures
  - Next: Automate the new edge cases with agent-beta
```

**Key rule:** This is not a status report. It's a planning conversation for the next 24 hours. Agents coordinate dependencies, call out blockers, and offer help.

### 4. Swarming (Bottleneck Protocol)

When a bottleneck appears — a task piling up, a tester overwhelmed, a complex problem blocking progress — the team **swarms** it instead of waiting.

**Trigger conditions:**
- An item in SPRINT_BACKLOG.md has been `in-progress` for too long
- One agent is blocked waiting for another
- Test failures are piling up faster than they're being fixed
- A complex issue needs multiple perspectives

**Protocol:**

1. **Recognize the bottleneck** — Flag it in DAILY_LOG.md
2. **Offer help** — Agents with available capacity ask "How can I help?" or "Let me take X off your plate"
3. **Converge** — Multiple agents work on the same problem simultaneously:
   - One agent handles test automation while another runs manual edge-case tests
   - One agent debugs the core issue while another writes the fix
   - One agent researches alternatives while another prototypes
4. **Resolve** — Clear the bottleneck together
5. **Log it** — Document what happened and how it was resolved in DECISIONS.md

**Example scenario:** Five user stories are coded but sitting in "Ready for QA." The QA agent is overwhelmed.

```
Instead of: QA agent works through them one-by-one while other agents move on to new coding tasks.

Do this: Two developers "swarm" the QA column. One helps automate tedious regression tests.
The other handles manual edge-case testing under the QA agent's guidance. The team clears
the bottleneck together and saves the Sprint Goal.
```

### 5. Pair Programming

When a high-risk, complex, or knowledge-critical task appears, two agents pair up.

**When to pair:**
- A critical framework upgrade that only one agent understands (bus factor)
- A security-sensitive component
- A complex algorithm that benefits from real-time review
- Onboarding an agent to an unfamiliar area of the codebase

**Protocol:**

1. **Announce the pair session** — Create a pair note:
   ```
   .collaboration/PAIRS/PAIR-001--backend-alpha--frontend-beta.md
   ```
2. **Define roles**:
   - **Driver** — Writes the code, focuses on the tactical "how"
   - **Navigator** — Reviews each line as it's written, thinks about strategy, edge cases, and testing
3. **Switch roles** periodically (every 15-30 min of agent turns)
4. **Document output** — Log the outcome, key decisions, and knowledge transferred

**Example:** A senior backend agent pairs with a frontend agent on a security architecture upgrade.
The senior drives the architectural logic; the frontend agent provides immediate code review,
asks clarifying questions, and writes unit tests. The task is completed with higher quality,
and the frontend agent now understands the backend security setup — spreading capability.

### 6. Sprint Review

At the end of the sprint, the team demonstrates the working increment.

**Steps:**

1. **Review SPRINT_BACKLOG.md** — What was completed? What wasn't? Why?
2. **Demonstrate value** — Each agent summarizes what they built and how it contributes to the Sprint Goal
3. **Gather feedback** — If a human stakeholder is present, they review the increment
4. **Update BACKLOG.md** — Add any new items discovered during the sprint
5. **Log outcomes** in DECISIONS.md

**What cross-functional collaboration looks like here:**
- The "backend" agent explains API decisions
- The "frontend" agent shows the UI
- The "QA" agent reports on test coverage and quality metrics
- Together they tell the story of what the team accomplished

### 7. Sprint Retrospective

After the review, the team reflects on their working relationships, processes, and — crucially — **how well they lived the five Scrum values**.

**Retro format — use the template from `scripts/retro.sh` or `references/templates.md`:**

Structure: Guardrails Check → Values Check → What went well → What could be improved → Action Items.

See [references/templates.md](references/templates.md#sprint-retrospective-with-values-check) for the full template.

**Key retrospective topics for agent teams:**
- **Values health** — Which value was weakest this sprint? What one thing can we do to strengthen it?
- **Handoff friction** — Are updates to shared artifacts timely?
- **Bottleneck patterns** — Where do we keep getting stuck?
- **Knowledge gaps** — What expertise is the team missing?
- **Communication quality** — Are agents being explicit enough in logs and decisions?

## Complete Sprint Example

The following example shows how all the above workflows work together in practice:

```
Sprint 3 Goal: "Users can reset their password via email"

## Sprint Planning
Team reviews backlog, negotiates scope:
- agent-alpha (backend): "The email service has a rate limit — we can only send 10 emails/min"
- agent-beta (frontend): "I can add a 'resend email' button with a 60s cooldown to handle that UX"
- agent-gamma (QA): "I'll write the E2E tests that verify rate limiting behavior"
Result: Realistic commitment, shared understanding.

## During the Sprint
- agent-alpha builds the password reset API endpoint
- agent-beta builds the "Forgot Password" and "Reset Password" UI
- agent-beta hits a snag with form validation — agent-alpha swarms in to help
- agent-gamma writes E2E tests, finds 2 API edge cases → agent-alpha fixes immediately
- agent-alpha and agent-gamma pair on the email service integration (high-risk, security-sensitive)

## Daily Sync (Day 3)
- alpha: API done, now helping beta with validation. Blockers: none.
- beta: UI done, validation fixed with alpha's help. Next: integration testing with gamma.
- gamma: E2E tests written, 2 edge cases found and fixed. Next: performance test the email queue.

## Sprint Review
Team demoes end-to-end password reset. PO agent confirms acceptance criteria met.
2 new backlog items discovered: "password reset analytics" and "email template customization."

## Sprint Retrospective
- **Guardrails:** WIP limit forced us to swarm early. Three Amigos caught the email rate limit before coding started.
- **Values:** Openness was strong — agent-alpha immediately flagged the rate limit issue. Courage needs work — agent-beta knew the form validation was fragile but didn't mention it until swarming.
- Went well: Swarming on validation saved 1 day; pairing on email service caught security issue
- Improve: Should have identified email rate limiting earlier (in refinement, not planning)
```

## Quick Reference Cards

### Before Any Action
- [ ] **Values check:** Am I acting with Commitment, Focus, Openness, Respect, Courage?
- [ ] **Guardrails check:** Is WIP at the limit? (If yes → swarm, don't pull new work)
- [ ] **Guardrails check:** Is this story Three Amigos-ready? (If not → flag it before coding)
- [ ] Read SPRINT.md (Sprint Goal, DoD, team roles)
- [ ] Read WORKING_AGREEMENT.md (team's explicit rules)
- [ ] Read DAILY_LOG.md (recent activity, blockers, Three Amigos sessions)
- [ ] Check SPRINT_BACKLOG.md (what's my next priority? WIP limit enforced here)
- [ ] Check DECISIONS.md (any decisions that affect my work?)

### After Any Action
- [ ] **Values check:** Did I live the values? (Commitment → helped others? Openness → shared bad news? Courage → spoke up about problems?)
- [ ] **Guardrails check:** Did I respect the WIP limit? Did I follow the DoD? If I was stuck, did I ask for help within 15 min?
- [ ] Update SPRINT_BACKLOG.md item status
- [ ] Log blockers, Three Amigos sessions, and 15-min attempts in DAILY_LOG.md
- [ ] Log key decisions and Guild alignment in DECISIONS.md
- [ ] Note pair sessions or swarming events in DAILY_LOG.md

### WIP Limit Reached?
→ **Swarm.** Don't pull new work. Ask "How can I help finish what's already started?" This enforces **Commitment** and **Focus**.

### Starting a New Story?
→ **Three Amigos first.** PO + Developer + QA perspectives before a line of code. Log it. This enforces **Openness** and **Respect**.

### Stuck for 15 Minutes?
→ **Ask for help.** Log what you tried. This enforces **Courage** and **Openness**.

### Spot a High-Risk Task?
→ **Pair.** Two agents, one task. Driver + Navigator roles, switch regularly. This is **Respect** (sharing knowledge) and **Commitment** (quality).

### End of Sprint
- [ ] Run Sprint Review (demo value, gather feedback)
- [ ] Run Sprint Retrospective — **include a Values Check** + **Guardrails Check** (did WIP limits work? Did the DoD catch issues? Were Three Amigos used consistently?)
- [ ] Update BACKLOG.md with new items
- [ ] Review and update WORKING_AGREEMENT.md (it's a living document — improve it based on what you learned)
- [ ] Prepare for next Sprint Planning

## References

- [Patterns Deep Dive](references/patterns-deep-dive.md) — Detailed exploration of the five Scrum values, sprint planning best practices, swarming, pair programming, running retros, and T-shaped skill development.
- [Templates](references/templates.md) — Ready-to-use templates for all collaboration artifacts: Working Agreement, Three Amigos, 15-minute rule, SPRINT.md, sprint backlog, daily sync, swarm events, pair programming, decision log, and sprint retros.
- [backlog-management](../backlog-management/SKILL.md) — Managing the product backlog: user stories, acceptance criteria, prioritization, estimation, refinement.
- [definition-of-done](../definition-of-done/SKILL.md) — Defining and enforcing the Definition of Done: the quality gate everything must pass.
- [kanban-board](../kanban-board/SKILL.md) — Visualizing workflow with a Kanban board: WIP limits, flow metrics, card lifecycle.

---

## Helper Scripts

| Script | Purpose |
|--------|---------|
| `init-sprint.sh` | Initialize the collaboration structure for a sprint |
| `daily-sync.sh` | Log a daily sync entry with optional Scrum values reflection |
| `three-amigos.sh` | Log a Three Amigos session (PO + Developer + QA) |
| `stuck-15.sh` | Log a 15-minute rule attempt (stuck on a problem, asking for help) |
| `swarm.sh` | Log a swarming event — multiple agents converging on a bottleneck |
| `pair-session.sh` | Initialize a pair programming session log |
| `decision.sh` | Log a key decision to DECISIONS.md |
| `retro.sh` | Initialize a sprint retrospective document with Scrum values check |

See [scripts/](scripts/) for implementation.
