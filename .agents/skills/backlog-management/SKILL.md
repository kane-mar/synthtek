---
name: backlog-management
description: "Manage product and sprint backlogs: the backlog is a dynamic, single-ranked, ordered list of everything needed to achieve the product goal. Includes writing user stories, acceptance criteria, backlog refinement, and progressive granularity (small work at top, large work at bottom — break down large items at the top of the backlog into smaller items before working on them). Use when maintaining a backlog, preparing for sprint planning, or triaging incoming work."
compatibility: "Works with any coding agent harness that supports reading/writing files and running shell commands."
metadata:
  version: "1.0.0"
  patterns: "backlog-refinement, user-stories, acceptance-criteria"
---

# Backlog Management

This skill provides structured workflows for managing product and sprint backlogs with AI agents. It is grounded in the Certified Scrum Master (CSM) definition: **the product backlog is a dynamic, single-ranked, ordered list** of everything needed to achieve the product goal.

It covers the full lifecycle: defining the product goal, capturing items, writing user stories with acceptance criteria, prioritizing using established frameworks, estimating effort, refining items, and maintaining a healthy backlog.

> **Relationship to agent-collaboration:** This skill focuses on the *backlog artifact itself* — its structure, quality, and prioritization. The [agent-collaboration](../agent-collaboration/SKILL.md) skill focuses on *team collaboration patterns* — the five Scrum values, swarming on bottlenecks, pair programming, and the structural guardrails (WIP limits, Three Amigos, Definition of Done, 15-minute rule). They work well together: use backlog-management to keep your backlog healthy, and agent-collaboration to resolve bottlenecks and coordinate multi-agent work.

> **CSM reference:** See [references/csm-course-notes.md](references/csm-course-notes.md) for the full Certified Scrum Master training on the product backlog by Kane Mar.

---

## Quick Start

If you're entering a project that already has backlog management set up:

```bash
# Read the current state
cat BACKLOG.md
cat .collaboration/BACKLOG.md   # if agent-collaboration is active
```

If no backlog exists, initialize one:

```bash
# Scripts are located at <SKILL_DIR>/scripts/
# Replace <SKILL_DIR> with the path to this skill directory.
<SKILL_DIR>/scripts/init-backlog.sh
```

---

## Core Concepts

### The Product Goal

The backlog does not exist in a vacuum. It starts with the **product goal** — a description of the future state of the product. The product owner defines what they're trying to achieve, then lists everything needed to get there. That list, ordered in a single rank, becomes the product backlog.

> Every backlog item should trace back to the product goal. If an item doesn't serve the goal, question whether it belongs.

### What is a Backlog?

The formal CSM definition: the product backlog is a **dynamic, single-ranked, ordered list** of everything needed to achieve the product goal.

> **A backlog is just a to-do list** — but ordered with discipline. This is why Scrum works across so many domains: as soon as you can take a to-do list and put it in a single rank order, you can start doing Scrum.

#### Dynamic

The backlog changes constantly — and this is **a good thing**. It's how we ensure we deliver something that meets customer needs.

- Product owners talk to stakeholders, senior management, end users, and subject matter experts regularly, returning with new ideas, features, and needs
- They add that work to the backlog and reorder it
- The product owner often says *"That's not what I want. It's what I asked for, but it's not what I want."* Most people can't fully conceptualize what they're trying to achieve — it's easier to see something and then make decisions. That's fine. If it's not what they want, the team adjusts.

> **For AI agents:** The backlog can change at **any time**. If new information arrives — from a stakeholder conversation, a production incident, a new insight, or any other source — capture it and reorder the backlog immediately. Do not wait for a scheduled event.

#### Single Ranked

There is only **one item at the top**, one item underneath that, one item underneath that — a strict single-ranked order throughout. No ties, no "top 50 priorities."

**Why this matters:** If a product owner says "these top 50 things are my highest priority," where do you start? Item #1? Item #50? Somewhere in between? That's not useful. Instead, the product owner chooses **one thing** to solve first, then one thing after that, then one thing after that.

#### Ordered (Progressive Granularity)

The backlog is structured with **small, fine-grained bodies of work at the top** and **larger, chunkier bodies of work at the bottom**.

**Why not break everything down upfront?** The fundamental reason is **waste**:
- Large bodies of work at the bottom are **low value** — why spend time breaking down work you may never reach?
- The product owner may only have funding for items above a certain point. Breaking down items below that line is effort thrown away.

**When does work get broken down?** As the team takes work off the top each sprint, the remaining work **shuffles up** in priority order. When a large item reaches the **top of the backlog**, it must be broken down into smaller, fine-grained items before the team can work on it. Items that stay low priority never need to be broken down.

> **Rule of thumb:** If the top item on the backlog is too large to complete in a single sprint, it's not yet ready. Break it down first.

> **Guardrail:** Do not treat the backlog like a requirements document. Requirements documents are held static through reviews and sign-offs — they resist change. The backlog must be freely changeable. Requirements documents also break everything down to roughly the same size upfront — the backlog keeps small work at top and large work at bottom to avoid waste. These are fundamentally different artifacts.

### Backlog Types

| Type | Purpose |
|------|---------|
| **Product Backlog** | All planned work the team might do — features, improvements, and **production defects** (bugs identified in a live environment that represent new work). |
| **Sprint Backlog** | Active work currently flowing through the [Kanban board](../kanban-board/SKILL.md) — items being worked on, reviewed, or completed this cycle. **Bugs discovered during development** go here: they must be fixed before the item is done, aligned with the Definition of Done (no known defects). |

**Rule of thumb:** If a bug is discovered while building something, fix it now — it goes on the sprint backlog. If a bug is reported from production after release, it goes on the product backlog as new work to be prioritized.

---

## Operating Rules

The following rules govern how agents consume the backlog. These are not optional — they ensure the team always works on the most valuable work and never idles while items remain.

### Rule 1 — Always Work in Priority Order

Agents must always work in priority order without exception. The highest-priority item in the backlog is always the next item to be worked on. Priority is determined by the product owner and the backlog's single-ranked order.

### Rule 2 — Pull Work at Any Time, in Priority Order

Agents can pull work from the backlog at any time — they do not need to wait for a formal sprint start or assignment. However, they **must** respect Rule 1: always pull the highest-priority unstarted item.

### Rule 3 — Help Others Before Pulling New Work

If an agent is not busy, they should first help other agents complete any work that is already in progress before pulling new work from the backlog. This maximizes throughput by finishing started work rather than starting new work. See also the [swarming protocol in agent-collaboration](../agent-collaboration/SKILL.md#4-swarming-bottleneck-protocol).

### Rule 4 — Archive When Done

Once all acceptance criteria have been met and the work meets the Definition of Done, the backlog item must be archived. Archiving means moving the item out of the active backlog (e.g., into an `ARCHIVED/` directory or marking it as `done` in the tracking table) so it no longer appears as pending work.

### Rule 5 — Keep Moving

Agents should continue working while there are items in the backlog. If no items remain in the backlog, the agent should flag this to the team — the backlog needs to be replenished.

---

## Shared Structure

```
project-root/
 BACKLOG.md                   # ← READ THIS FIRST. The product backlog.
 .backlog/
    CONFIG.md                # Workflow states and item types
    ITEMS/                   # Individual backlog items (one file per item)
       ITEM-001--user-auth.md
       ITEM-002--password-reset.md
       ...
    EPICS.md                 # Epics (large initiatives broken into items) — use with caution, see warning below
    REFINEMENT_LOG.md        # Notes from backlog refinement sessions
```

> **Avoid epics and features.** From a pure Scrum perspective, there is no such thing as an epic or a feature — Scrum only requires a single-ranked ordered list. There are two reasons to avoid introducing these terms into your backlog:
>
> 1. **No formal definition.** There is no universally agreed definition of "epic" or "feature." Different teams interpret the same words in different ways, which leads to confusion and misalignment. One team's "epic" is another team's "feature."
>
> 2. **Both terms introduce waste** in two ways:
>    - **Premature breakdown:** Epics and features pressure teams to break down large bodies of work *before they rise in priority*, violating the principle of progressive granularity. You end up decomposing low-value work you may never reach.
>    - **False completion pressure:** Teams feel compelled to get an epic to 100% completion, even if the remaining items are low value. This pulls focus away from higher-value work that's waiting.
>
> **Instead:** Keep it simple. The only structure you need is **small, fine-grained work at the top; larger, chunkier work at the bottom**. Items get broken down naturally as they rise in priority.

---

## Backlog Workflows

### 1. Capturing a New Item

When a new idea, feature request, or bug is identified, capture it as a backlog item with minimal structure first (don't let perfect be the enemy of captured):

```bash
# Quick capture
<SKILL_DIR>/scripts/capture-item.sh "User can reset password via email" "feature" "high"
```

**Minimum viable capture** (log directly to BACKLOG.md):

```markdown
| Item | Type | Priority | Notes |
|------|------|----------|-------|
| User password reset | feature | high | Need email service integration |
```

### 2. Writing a User Story

When an item is refined for sprint planning, write it as a full user story:

```
**As a** [type of user]
**I want** [action or capability]
**So that** [benefit or value]

**Acceptance Criteria:**
1. [Scenario 1 — happy path]
2. [Scenario 2 — edge case]
3. [Scenario 3 — error case]

**Technical Notes:**
- [constraints, dependencies, implementation hints]
```

**Example:**

```markdown
## ITEM-003: Password Reset

**As a** registered user who has forgotten their password
**I want** to reset my password via email
**So that** I can regain access to my account

**Acceptance Criteria:**
1. User enters email on "Forgot Password" page → receives reset link within 30s
2. Reset link expires after 15 minutes
3. Using an expired link shows "Link expired — request a new one"
4. Using an invalid link shows "Invalid reset link"

**Technical Notes:**
- Email service has 10 req/min rate limit → needs client cooldown + server queue
- Reset tokens stored hashed in DB
- Rate limit: max 3 reset requests per email per hour
```

### 3. Backlog Refinement

Refinement is the ongoing activity of keeping the backlog healthy. It is not a scheduled meeting — it happens continuously as new information arrives and as items rise in priority.

**What refinement involves:**
- Breaking down large bodies of work into smaller ones
- Writing new user stories and acceptance criteria
- Breaking down high-priority work into smaller chunks so the team better understands it
- Re-estimating items where context has changed

**Refinement checklist:**

- [ ] **Top items are small enough** — the item at the very top of the backlog should be small enough to complete in a single sprint. If not, it needs further breakdown
- [ ] **Top 20%** of backlog items have user stories and acceptance criteria
- [ ] **No zombies** — items older than 3 months without activity → remove or flag for review
- [ ] **Split into vertical slices** — items should be as independent as possible
- [ ] **Splitting done** — items > 13 points are broken down
- [ ] **Duplicates merged** — search for overlapping items

```bash
# Log a refinement session
<SKILL_DIR>/scripts/refine.sh "Refined top 10 items, split ITEM-005 into 3 stories, re-estimated 4 items"
```

### 4. Sprint Backlog Preparation

When preparing for sprint planning, pull the top N items from the backlog that fit in the sprint:

```bash
# Select items for the sprint (capacity-based)
<SKILL_DIR>/scripts/select-for-sprint.sh 3 "Items for Sprint 4"
```

**Selection rules:**
1. Take items from the top of the prioritized backlog
2. Stop when total estimated effort reaches team capacity
3. Include at least one bug fix if bugs exist in the backlog

### 5. Work in Vertical Slices

Break down work into **vertical slices** — small, independent items that deliver end-to-end value on their own. Each item should be as independent as possible, requiring no other item to be complete before it can be delivered.

If a dependency does arise, the simplest resolution is **backlog order**: the depended-upon item naturally comes first in priority, so it gets pulled and completed before the dependent item. No explicit dependency tracking is needed — the single ranked order handles it.

---

## Quick Reference Cards

### Before Any Action
- [ ] **Read the backlog** — read BACKLOG.md and CONFIG.md to understand the current state
- [ ] **Check the product goal** — ensure the work traces back to the product goal
- [ ] **Work in priority order** — always pull the highest-priority unstarted item (Rule 1); help others before pulling new work (Rule 3)

### After Any Action
- [ ] **Update BACKLOG.md** — reflect the new status of any item that changed
- [ ] **Log decisions** — record refinement notes in REFINEMENT_LOG.md
- [ ] **Archive completed items** — acceptance criteria met + DoD satisfied → archive out of active backlog (Rule 4)
- [ ] **Keep moving** — if items remain, pull the next highest-priority item (Rule 5)

### When Capturing a New Item
- [ ] Give it a unique ID (ITEM-NNN)
- [ ] Record: description, type (feature/bug/tech-debt/improvement), source
- [ ] Assign a rough priority now; refine later
- [ ] If unclear → log as a note and flag for refinement

### When Refining an Item
- [ ] Write a user story (As a... I want... So that...)
- [ ] Define acceptance criteria (happy path + edge cases + error cases)
- [ ] Split into vertical slices — each item should be independent
- [ ] Check for duplicates

### Before Sprint Planning
- [ ] Top items have stories + AC
- [ ] Dependencies are clear (backlog order handles them naturally)
- [ ] Stale items are removed or flagged for review
- [ ] CONFIG.md reflects current workflow states

---

## References

- [CSM Course Notes — The Product Backlog](references/csm-course-notes.md) — Kane Mar's Certified Scrum Master training on the definition, structure, and refinement of the product backlog.

---

## Helper Scripts

| Script | Purpose |
|--------|---------|
| `init-backlog.sh` | Initialize the backlog directory structure |
| `capture-item.sh` | Quick-capture a new backlog item |
| `refine.sh` | Log a refinement session |
| `select-for-sprint.sh` | Pull items from backlog into sprint scope |

See [scripts/](scripts/) for implementation.
