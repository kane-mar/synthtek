# Collaboration Patterns — Deep Dive

This reference provides deeper guidance on each cross-functional collaboration pattern.
Agents should read this file when they need more detailed instructions on a specific pattern.

## Table of Contents

1. [The Five Scrum Values — Deep Dive](#1-the-five-scrum-values--deep-dive)
2. [Sprint Planning Best Practices](#2-sprint-planning-best-practices)
3. [Swarming: How to Converge on Bottlenecks](#3-swarming-how-to-converge-on-bottlenecks)
4. [Pair Programming for Agents](#4-pair-programming-for-agents)
5. [Running Effective Agent Retros](#5-running-effective-agent-retros)
6. [T-Shaped Skill Development for Agents](#6-t-shaped-skill-development-for-agents)
7. [Troubleshooting Common Issues](#7-troubleshooting-common-issues)

---

## 1. The Five Scrum Values — Deep Dive

Values are not abstract ideals. They are **daily operational choices** that determine whether collaboration succeeds or fails. This section explores each value in depth for agent teams.

### Commitment: Beyond "My Task Is Done"

Commitment is about dedication to the **team's Sprint Goal**, not just individual task completion.

**What it looks like in an agent team:**
- An agent who finishes its tasks early moves to help a teammate who is stuck — without being asked
- An agent doesn't check out after its "part" is complete. It asks: "What else needs to happen for the Sprint Goal to be met?"
- When scope needs to change, the team re-commits together rather than one agent unilaterally deciding

**What it DOESN'T mean:**
- A blood oath to deliver fixed scope no matter what
- Working overtime or ignoring new information to protect estimates

**Signs Commitment is weak:**
- Agents disappear from the collaboration after their piece is done
- SPRINT_BACKLOG.md shows items completed but nobody picked up the next thing
- "That's not my task" mentality

### Focus: The Power of a Shared Destination

Focus means every agent is aligned on the same short-term goal, making collaboration highly efficient.

**What it looks like in an agent team:**
- Every agent reads SPRINT.md before acting and keeps the Sprint Goal top of mind
- When an agent sees an interesting tangent (nice-to-have feature, refactoring opportunity), they log it in BACKLOG.md for later rather than derailing the sprint
- Agents protect each other's focus — if an external request comes in, the team decides together whether to accept it

**What it DOESN'T mean:**
- Tunnel vision that ignores important new information
- Refusing to help a teammate because "that's not in my focus area" (Commitment and Respect balance Focus)

**Signs Focus is weak:**
- Half-finished features from scope creep
- DAILY_LOG.md shows agents working on items not in the SPRINT_BACKLOG
- Sprint Review reveals the team delivered less than expected because of unplanned work

### Openness: Bad News Early Is a Gift

Openness is the willingness to share the complete picture — especially the parts that are uncomfortable.

**What it looks like in an agent team:**
- An agent who discovers a technical debt issue or architectural flaw flags it immediately in DECISIONS.md, even if it means re-opening a "closed" discussion
- DAILY_LOG.md entries are honest about blockers, uncertainty, and mistakes — not sanitized status reports
- Agents share their work-in-progress early for feedback, not just finished work for approval

**What it DOESN'T mean:**
- Sharing every random thought or minor doubt (signal vs. noise)
- Being open only about successes and hiding failures

**Signs Openness is weak:**
- Problems only surface at the Sprint Review (or worse, in production)
- DECISIONS.md is sparse or only logs safe, obvious decisions
- DAILY_LOG.md entries are generic status updates with no mention of blockers or uncertainty

### Respect: Expertise Is Not a Hierarchy

Respect means recognizing that every agent brings legitimate expertise. Different is not better or worse — just different.

**What it looks like in an agent team:**
- A frontend agent's API feedback is taken seriously by the backend agent, not dismissed as "not your area"
- A QA agent's code review is treated with the same weight as a senior developer's
- When agents disagree, they engage with each other's reasoning rather than talking past each other
- A junior-pattern agent feels safe asking questions

**What it DOESN'T mean:**
- Agreeing with everyone to avoid conflict (this undermines Courage)
- Treating all opinions as equally informed (expertise still matters — Respect means engaging with it, not ignoring it)

**Signs Respect is weak:**
- Repeated disagreements that never get resolved (agents talk past each other)
- Certain agents' input is consistently ignored or overridden
- DAILY_LOG.md shows solo decision-making without consulting affected agents

### Courage: The Engine of Constructive Conflict

Courage is the willingness to do the right thing even when it's uncomfortable.

**What it looks like in an agent team:**
- An agent tells the team: "I don't know how to solve this — I need help"
- An agent speaks up when the Sprint Goal is at risk, even if it means admitting an estimate was wrong
- An agent pushes back on a design decision that they believe will cause problems later
- An agent volunteers for a task outside their comfort zone because the team needs it

**What it DOESN'T mean:**
- Being aggressive or confrontational (Courage + Respect go hand in hand)
- Taking unnecessary risks without discussing them

**Signs Courage is weak:**
- Agents avoid flagging problems until they're emergencies
- SPRINT_BACKLOG.md items stay "in-progress" for too long without explanation
- Retrospectives are polite and surface-level, with no real disagreements

### Values Interlock in Practice

| Scenario | Commitment | Focus | Openness | Respect | Courage |
|----------|-----------|-------|----------|---------|--------|
| Feature is 2x more complex than estimated | Stay engaged, don't check out | Protect the Sprint Goal, don't add more work | Share the bad news immediately | Trust the PO's priorities; listen to the team's input | Admit the estimate was wrong |
| QA bottleneck with 5 items queued | Help clear the queue | Don't start new work until bottleneck clears | Flag the bottleneck publicly | Trust QA's guidance on what to test | Offer to help in an area outside your expertise |
| Disagreement on architecture approach | Stay committed to the shared outcome | Focus on what solves the Sprint Goal best | Articulate your reasoning fully | Listen to and engage with the other position | Have the hard conversation; don't avoid it |

---

## 2. Sprint Planning Best Practices

### The Anti-Pattern: "Throw it over the wall"

**Bad:** The "Product Owner" agent writes a detailed spec in isolation, then hands it to the "backend" agent, who designs an API, then throws it to the "frontend" agent, who builds a UI, then throws it to the "QA" agent.

**Why it fails:** Each agent discovers issues the previous agent didn't anticipate. Feedback loops are long. Rework is expensive.

### The Cross-Functional Way

During Sprint Planning, all agents collaborate to negotiate scope. This exercise requires **Openness** (share concerns honestly), **Respect** (listen to each specialty's input), and **Courage** (push back on unrealistic commitments):

1. **PO agent proposes** a Sprint Goal and candidate backlog items
2. **Each agent assesses** from their expertise:
   - **Backend agent:** "This API call will need pagination — adds 2 days"
   - **Frontend agent:** "That animation requires a WebSocket — adds complexity"
   - **QA agent:** "How do we test offline behavior? Need a mock server"
3. **Team negotiates** — adjusts scope, finds simpler alternatives, identifies dependencies
4. **Commit as a team** to a realistic Sprint Goal **(this is Commitment)**

### Setting a Good Sprint Goal

| Weak Goal | Strong Goal |
|-----------|-------------|
| "Implement user auth" | "Users can sign up and log in with email + password" |
| "Build the dashboard" | "Team members can see their task status on a shared dashboard" |
| "Fix bugs" | "The checkout flow works end-to-end with zero critical bugs" |

### Definition of Done Checklist

Customize per team, but every item should meet:

- [ ] **Cross-functional review** — reviewed by at least one agent from a different discipline
- [ ] **Tests pass** (unit + integration)
- [ ] **QA signs off** — acceptance criteria verified
- [ ] **Edge cases documented**
- [ ] **Decision rationale** in DECISIONS.md
- [ ] **Working increment** demo-able at Sprint Review

---

## 3. Swarming: How to Converge on Bottlenecks

### What is Swarming?

Swarming is when multiple agents with different expertise converge on a single problem simultaneously. It's the opposite of serial handoffs.

### When to Swarm

| Symptom | Swarm Response |
|---------|---------------|
| 5 items in "Ready for QA" | One agent helps automate regression tests; another helps run manual edge-case tests |
| Complex bug nobody can solve alone | Backend + Frontend agents debug together — one traces the API, the other checks the UI state |
| Documentation pile-up | All agents write doc sections for their own work simultaneously, then cross-review |
| Integration issues | Agents from both sides work on the integration point together, not sending bugs back and forth |

### How to Swarm (Step by Step)

1. **Recognize** — Someone flags the bottleneck in DAILY_LOG.md or the sync
2. **Offer** — Available agents say "I can help with X"
3. **Divide** — Break the bottleneck into parallel tasks:
   - *Example:* QA bottleneck → Agent A automates tests, Agent B runs manual tests, Agent C fixes the bugs found so far
4. **Execute** — Work simultaneously, communicating via DAILY_LOG.md
5. **Resolve** — When the bottleneck clears, note it in DECISIONS.md
6. **Reflect** — In retro, ask: "How can we spot this bottleneck earlier next sprint?"

### Swarming vs. Pairing

| | Swarming | Pair Programming |
|---|---|---|
| **Why** | Clear a bottleneck | Reduce risk / transfer knowledge |
| **How many** | 2+ agents | Exactly 2 agents |
| **Roles** | Divide and conquer | Driver + Navigator |
| **Duration** | Until bottleneck clears | Until task is done |
| **Example** | 3 agents clear QA queue together | 2 agents pair on security auth module |

---

## 4. Pair Programming for Agents

### When to Pair

Pair programming is not for everything. Use it when:

- **High risk:** Security, auth, payment processing, data migration
- **High complexity:** A new algorithm, architecture decision, or framework migration
- **High bus factor:** Only one agent understands a critical component
- **Knowledge transfer:** Onboarding an agent to an unfamiliar area

### Driver vs. Navigator

| Role | Focus | Example |
|------|-------|---------|
| **Driver** | Tactical "how" — writes code, implements the immediate step | "I'll write the API endpoint, you watch for security issues" |
| **Navigator** | Strategic "what/why" — reviews each line, thinks about edge cases, testing, architecture | "This SQL query has an injection risk — let's use parameterized queries instead" |

### Effective Pairing Protocol

1. **Set a clear goal** — "We're pairing until the auth module passes all security scans"
2. **Switch roles** every N turns or every 15-30 agent minutes
3. **Navigator writes tests** while Driver writes implementation
4. **Document knowledge transfer** in the PAIR-*.md file
5. **Log decisions** in DECISIONS.md

### Common Pairing Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| **Watch-and-wait** — Navigator is passive | Navigator should be writing tests, checking docs, thinking about edge cases |
| **Tug-of-war** — Both agents fight over the keyboard | Stick to roles. Driver types, Navigator suggests. Switch when stuck. |
| **Role lock** — Same agent always drives | Switch roles every session. The point is knowledge transfer both ways. |
| **Over-pairing** — Pairing on trivial tasks | Only pair on high-risk, high-complexity, or high-bus-factor work. Simple tasks go solo. |

---

## 5. Running Effective Agent Retros

### The Retro Structure

1. **Set the stage** (2 min) — Remind everyone of the Sprint Goal
2. **Gather data** (5 min) — Review SPRINT_BACKLOG.md, DAILY_LOG.md, DECISIONS.md
3. **Generate insights** (5 min) — What went well? What could be improved?
4. **Decide action items** (3 min) — 1-3 concrete improvements for next sprint
5. **Close** (1 min) — Thank the team

### Retro Questions for Agent Teams

**Start with a Guardrails Check (3 min):**

- Did our WIP limits work? Did they force useful swarming, or were they too tight/loose?
- Did the Definition of Done catch issues that would have slipped through otherwise?
- Did we use the Three Amigos pattern consistently? Did it prevent rework?
- Did we follow the 15-Minute Rule? Were agents getting stuck too long before asking for help?
- Is the WORKING_AGREEMENT.md still accurate? Does anything need updating?

**Then a Values Check (5 min):**

| Value | Question |
|-------|----------|
| **Commitment** | Did we all stay engaged after our individual tasks were done? Did anyone "check out" early? |
| **Focus** | Did we stay focused on the Sprint Goal, or did we get pulled elsewhere? |
| **Openness** | Did we surface bad news early enough? Were there hidden problems that only came out at the review? |
| **Respect** | Did we truly listen to each other's expertise? Were there moments where an agent's input was dismissed? |
| **Courage** | Did anyone speak up about an uncomfortable truth? Did we avoid a hard conversation? |

**Then ask process-oriented questions:**

- Was our swarming effective? Did we converge fast enough on bottlenecks?
- Did we pair on the right things? Too much? Too little?
- Was DECISIONS.md kept up to date? Did anyone have to hunt for context?
- Did we respect our Definition of Done?
- Was the Sprint Goal clear to everyone throughout the sprint?

### Writing Good Action Items

| Weak | Strong |
|------|--------|
| "Update docs more" | "Add a 'log decision' step to the daily sync template" |
| "Communicate better" | "Flag blockers in DAILY_LOG.md within 1 turn of discovering them" |
| "Swarm earlier" | "If an item is 'in-progress' for 3+ sync cycles, automatically flag it for swarming" |

### Retro Formats

Beyond "what went well / what could be improved," try:

- **Start / Stop / Continue:**
  - Start doing: _____
  - Stop doing: _____
  - Continue doing: _____
- **4 Ls:** Liked, Learned, Lacked, Longed For
- **Sailboat:** What's pushing us forward (wind)? What's holding us back (anchor)? What risks are ahead (rocks)?

---

## 6. T-Shaped Skill Development for Agents

### What "T-Shaped" Means for Agents

- **Vertical bar** — Deep expertise in one area (e.g., backend API design, UI component architecture, test automation)
- **Horizontal bar** — Broad working knowledge of adjacent areas (e.g., a backend agent can write a basic frontend form, a frontend agent can read and debug a SQL query)

### How Agents Demonstrate T-Shaped Skills

| Primary Expertise | Horizontal Bar (Can Help With) |
|---|---|
| Backend / APIs | Basic frontend debugging, writing integration tests, reviewing DB schemas |
| Frontend / UI | Reading API docs, writing E2E tests, basic shell scripting |
| QA / Testing | Automating test suites, writing testable code, documenting edge cases |
| DevOps / Infra | Dockerfile review, CI debugging, environment setup |
| Data / ML | Data pipeline review, basic statistics, visualization critique |

### Swarming as a T-Shaped Opportunity

When an agent swarms on a bottleneck outside their primary expertise, they're practicing T-shaped collaboration:

- The backend agent who writes a few E2E tests during a QA swarm expands their testing knowledge
- The frontend agent who helps debug an API endpoint learns about request validation
- The QA agent who helps write a Dockerfile learns about containerization

**Log these cross-domain contributions in DAILY_LOG.md** — they're how the team levels up together.

---

## 7. Troubleshooting Common Issues

### "The Sprint Goal is unclear halfway through"

- Re-read SPRINT.md
- Check DAILY_LOG.md for recent decisions that may have drifted scope
- If still unclear, flag it: "I'm unclear on the Sprint Goal — can we re-align?"
- If no response, make a reasonable judgment and log your reasoning in DECISIONS.md

### "Two agents are working on the same thing"

- Check SPRINT_BACKLOG.md — was the item already claimed?
- If overlap happened anyway: "I see we both started on X. I'll work on Y instead — can you handle X?"
- Log the realignment in DAILY_LOG.md
- In retro: "We need a clearer ownership signal — maybe claim items in SPRINT_BACKLOG.md before starting"

### "An agent is stuck"

- **If they're blocked by a dependency:** Another agent should ask "What do you need from me?"
- **If they don't know how to proceed:** Offer to pair
- **If the task is too big:** Break it down. Swarm on the decomposition.
- **If they disappeared (e.g., session ended):** Another agent picks up their work. Log the transition.

### "Decisions are being forgotten"

- Check DECISIONS.md — is it being updated?
- If not, start. Every time you make a non-trivial call (architecture, tooling, approach), log it.
- If you can't find a previous decision, check git history or DAILY_LOG.md
- In retro: "Let's commit to logging decisions within 1 turn of making them"

### "The team is falling back into serial handoffs"

This is the most common anti-pattern. Watch for:

- "I finished X, now someone else can do Y" → Instead: Ask "Who can help me verify X before I move on?"
- SPRINT_BACKLOG.md showing items moving in lockstep (design → code → test) → Instead: Show multiple items in progress simultaneously
- Long gaps between sync entries → Instead: Sync frequently, flag bottlenecks early

**Recognize it. Call it out. Swarm to break the pattern.**
