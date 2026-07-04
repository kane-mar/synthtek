---
name: kanban-board
description: "Visualize and manage work using a Kanban board: columns with WIP limits, card lifecycle (add, move, split, archive), explicit policies, flow metrics (cycle time, lead time, throughput), and WIP monitoring. Use when tracking work in progress, limiting multitasking, or improving flow through the workflow."
compatibility: "Works with any coding agent harness that supports reading/writing files and running shell commands."
metadata:
  version: "1.0.0"
  inspired-by: "Kanban Method (David J. Anderson) — Visualize, Limit WIP, Manage Flow, Make Policies Explicit, Improve Collaboratively"
  patterns: "kanban, wip-limits, flow-management, bottleneck-detection, cycle-time"
---

# Kanban Board

This skill provides a lightweight Kanban board for AI agents to visualize and manage workflow. It is grounded in the six core Kanban practices: **visualize the workflow, limit work in progress, manage flow, make policies explicit, implement feedback loops, and improve collaboratively**.

> **Relationship to backlog-management:** The [backlog-management](../backlog-management/SKILL.md) skill manages the *product backlog* — what to build and in what priority order. This skill manages the *Kanban board* — visualizing and flowing work through the system. Together they form a complete pull-based workflow: backlog-management decides *what* to work on next; kanban-board controls *how much* is in progress and tracks flow.

> **Gate to Done:** The [definition-of-done](../definition-of-done/SKILL.md) skill defines the quality checklist that every item must pass before it can leave the Kanban board. On this board, the DoD is the gate between **In Progress / Review** and **Done** — nothing moves to Done without passing the DoD checklist.

---

## Quick Start

If you're entering a project that already has a Kanban board set up:

```bash
# Read the board state and policies
cat KANBAN.md
cat .kanban/CONFIG.md
cat .kanban/BOARD.md
```

If no board exists, initialize one:

```bash
# Scripts are located at <SKILL_DIR>/scripts/
# Replace <SKILL_DIR> with the path to this skill directory.
<SKILL_DIR>/scripts/init-board.sh
```

---

## Core Concepts

### The Six Kanban Practices

| # | Practice | What It Means for Agents |
|---|----------|--------------------------|
| 1 | **Visualize the workflow** | Make work and its status visible on the board. Hidden work cannot be managed. |
| 2 | **Limit WIP** | Cap the number of items in each column. This forces completion before starting new work. |
| 3 | **Manage flow** | Monitor how work moves through the board. Bottlenecks show up as items piling up in a column. |
| 4 | **Make policies explicit** | Define clear rules for each column (e.g., "code review required before moving to Done"). |
| 5 | **Implement feedback loops** | Review the board regularly to identify improvements. |
| 6 | **Improve collaboratively** | Use metrics and experiments to evolve the process. |

### Pull-Based System

Kanban is a **pull** system — work is pulled into the next column only when there is capacity, not pushed when someone finishes. This is the opposite of a push-based system where work is assigned and forced through.

> **Core mechanism:** An item moves from `Column A` to `Column B` only when `Column B` has room under its WIP limit. If `Column B` is full, work stays in `Column A` — even if someone has capacity. This exposes bottlenecks immediately.

### WIP Limits

Every column has a Work-in-Progress (WIP) limit — a cap on how many items can be in that column at once. WIP limits are the heart of Kanban:

- **Too high** → no pressure to finish work; items pile up
- **Too low** → team starves; not enough work flowing
- **Just right** → smooth flow, fast cycle times, early bottleneck detection

```bash
# Check current WIP state
<SKILL_DIR>/scripts/check-wip.sh
```

### Cycle Time vs Lead Time

| Metric | Definition | Starts | Ends |
|--------|------------|--------|------|
| **Cycle Time** | Time to complete an item once work starts | First column | Done column |
| **Lead Time** | Total time from request to delivery | Backlog entry | Done column |

> **Goal:** Reduce cycle time by limiting WIP and eliminating bottlenecks.

---

## Shared Structure

```
project-root/
 KANBAN.md                   # ← READ THIS FIRST. Board overview and active cards.
 .kanban/
    CONFIG.md               # Column definitions, WIP limits, policies
    BOARD.md                # Current board state (card positions)
    CARDS/                  # Individual card files
       CARD-001--user-auth.md
       CARD-002--password-reset.md
       ...
    POLICIES.md             # Explicit column policies
    METRICS.md              # Cycle time, lead time, throughput tracking
    BLOCKED.md              # Stuck work log — records when cards were split and if help was requested
 pi-ext/                     # pi TUI extension (see TUI Extension section)
    package.json
    index.ts
 tui/                        # Standalone TUI — runs in its own terminal, no pi dependency
    package.json
    index.js
    README.md
```

---

## Operating Rules

### Rule 1 — Respect WIP Limits

Never exceed a column's WIP limit. Before moving a card into a column, count how many cards are already there. If at the limit, the card stays where it is.

### Rule 2 — Pull, Don't Push

Work is pulled by the next column when it has capacity. Do not push work into a column that is full. If the next column is at WIP capacity, focus on finishing work in the current column to create space.

### Rule 3 — Split Before Stalling

Never mark a card as blocked. If work is stuck, split the card into smaller pieces. If a smaller piece is still stuck after splitting, **ask another agent or the end user for help**. Log the split and help request in BLOCKED.md. Do not let work sit idle.

### Rule 4 — Finish Before Starting

When WIP limits are reached, do not start new work. Help finish what's already in progress first. This is the same principle as [Rule 3 in backlog-management](../backlog-management/SKILL.md#rule-3--help-others-before-pulling-new-work).

### Rule 5 — Measure and Improve

Cycle time and lead time are logged automatically when a PBI moves to Done. Review metrics regularly with `report-metrics.sh` to identify improvement opportunities.

---

## Kanban Workflows

### 0. Drawing the Board

When asked to show the current board state, generate a text-based visualization using the format described in [references/board-visualization.md](references/board-visualization.md).

```
+------------------------------------+------------------------------------------+------------------------------------+------------------------------------+
| Product Backlog Item (PBI)         | Work Not Started                         | Work in Progress (WIP)             | Done                               |
+------------------------------------+------------------------------------------+------------------------------------+------------------------------------+
| Secure Customer Portal Access      | - Draft identity verification reqs       | - Establish secure login protocol  | - System baseline security review  |
|                                    | - Map password recovery journey          |                                    |                                    |
...
+------------------------------------+------------------------------------------+------------------------------------+------------------------------------+
```

Each row is one PBI. Columns go in this order: PBI name → Work Not Started → Work in Progress → Done.

**PBI lifecycle on the board:**
1. When a PBI is broken down into individual tasks, those tasks appear in the **Work Not Started** column
2. As a task is started, it moves into the **Work in Progress (WIP)** column
3. As a task is completed, it moves into the **Done** column
4. The PBI itself only moves to **Done** when **all** of its tasks are completed — not before

> **Rule:** A PBI stays in its current column until every task under it is finished. Partially done PBIs remain visible so the team can see what's still outstanding.

---

### 1. Initializing the Board

```bash
<SKILL_DIR>/scripts/init-board.sh
```

This creates the default board with standard columns:
- **Backlog** (no WIP limit) — work waiting to be started
- **Ready** (WIP: 3) — work that's ready to pull
- **In Progress** (WIP: 3) — actively being worked on
- **Review** (WIP: 2) — awaiting review
- **Done** (no WIP limit) — completed work

Customize columns and WIP limits in `.kanban/CONFIG.md`.

> **Visualization vs tracking:** The text board (Workflow 0) uses four columns — *PBI, Work Not Started, WIP, Done* — to show tasks within each PBI. The internal board above uses five columns — *Backlog, Ready, In Progress, Review, Done* — to track where each PBI card is in the workflow. They are different views of the same system: the visualization shows task-level detail within each PBI; the tracking board shows the PBI's overall stage.

### 2. Adding a Card

```bash
<SKILL_DIR>/scripts/add-card.sh "Implement password reset" "feature" "high"
```

Cards should be small enough to complete quickly. If a card is too large, it should be split.

**Card template:**

```markdown
---
id: CARD-003
title: "Implement password reset"
type: feature
priority: high
status: backlog
created: 2026-05-23T10:00:00
---

## Description
Users can reset their password via email.

## Acceptance Criteria
- [ ] Reset link sent within 30s
- [ ] Link expires after 15 minutes
- [ ] Invalid link shows error message

## Notes
(Add notes)

## Cycle Time
started: —
completed: —
```

### 3. Moving a Card

Cards move through columns by being **pulled** by the next stage, not pushed.

```bash
# Move a card to the next column (only if WIP allows)
<SKILL_DIR>/scripts/move-card.sh CARD-003 "In Progress"

# Move a card to a specific column
<SKILL_DIR>/scripts/move-card.sh CARD-003 "Done"

# Split a stuck card (instead of blocking it)
<SKILL_DIR>/scripts/split-card.sh CARD-003 "Waiting for email service API key"
```

**Rule:** Before moving, the script checks whether the target column has capacity under its WIP limit. If the column is full, the card stays where it is and the bottleneck is reported.

> **Moving to Done requires DoD verification.** Before calling `move-card.sh CARD-003 "Done"`, run the [definition-of-done](../definition-of-done/SKILL.md) verification first:
> ```bash
> <SKILL_DIR_PARENT>/definition-of-done/scripts/verify-dod.sh CARD-003
> ```
> (Replace `<SKILL_DIR_PARENT>` with the parent of the skill directories, e.g., `~/skills`.)
> If any DoD criterion is not met, the item cannot move to Done.

### 4. Checking WIP Status

```bash
<SKILL_DIR>/scripts/check-wip.sh
```

Output example:
```
 WIP Status

Backlog      —  12 cards  (limit: ∞)
Ready        —   3 cards  (limit:  3)  AT LIMIT
In Progress  —   2 cards  (limit:  3) 
Review       —   2 cards  (limit:  2)  AT LIMIT
Done         —   8 cards  (limit: ∞)

 Bottleneck detected: Review column is at WIP limit.
   → 1 card waiting in In Progress to enter Review.
```

### 5. Splitting Stuck Work

Cards should never be blocked. When work cannot proceed, do not leave it sitting — split it.

```bash
<SKILL_DIR>/scripts/split-card.sh CARD-003 "Dependency on email service API key — split into frontend mock + backend integration"
```

**The split approach:**
1. Identify what part of the card IS achievable right now
2. Split that achievable work into a new, smaller card
3. Log the split reason and the remaining impediment in BLOCKED.md
4. The smaller card moves forward; the remaining part stays visible

**If still stuck after splitting:**

If the smaller piece is also stuck, the agent should **ask for help** from another agent or the end user. Log the help request in BLOCKED.md.

```bash
<SKILL_DIR>/scripts/split-card.sh CARD-003 "Still stuck after split — asking for help with email service integration"
```

> **Rule:** Do not let work sit idle. Split first. Ask for help second. Never mark a card as "blocked" and walk away.

### 6. Archiving Completed Cards

Archiving is a cleanup step — it removes the card from the active board once the PBI is fully done. Metrics (cycle time, lead time) were already logged automatically by `move-card.sh` when the PBI moved to Done.

```bash
<SKILL_DIR>/scripts/archive-card.sh CARD-003
```

Archiving moves the card file from `.kanban/CARDS/` to `.kanban/ARCHIVED/`.

### 7. Reporting Metrics

Generate a comprehensive metrics report at any time to understand flow health:

```bash
<SKILL_DIR>/scripts/report-metrics.sh
```

The report draws from archived card files and the board state to compute five metrics:

| # | Metric | What It Tells You |
|---|--------|-------------------|
| 1 | **WIP Count** | Active PBIs per column compared to WIP limits — shows bottlenecks immediately |
| 2 | **Cycle Time** | Time from PBI started → PBI completed — are you delivering fast? |
| 3 | **Lead Time** | Time from PBI created → PBI completed — how long do requests take end-to-end? |
| 4 | **Throughput** | PBIs completed in last 7 and 30 days — is the team stable? |
| 5 | **Stuck Work** | Cards that were split or where help was requested — what's preventing progress? |

**Metrics are measured at the PBI level, not at the task level.** A card file (`CARD-001`) represents one PBI. Individual tasks are bullet points on the board — their movements are visual updates only. When the PBI itself moves to **Done** (all tasks completed), `move-card.sh` computes and logs cycle time and lead time in `.kanban/METRICS.md` immediately.

```markdown
## Cycle Time Log
| Card | Title | Started | Completed | Cycle Time |
|------|-------|---------|-----------|------------|
| CARD-003 | Password Reset | 2026-05-20 | 2026-05-23 | 3d 0h |

## Lead Time Log
| Card | Title | Created | Completed | Lead Time |
|------|-------|---------|-----------|-----------|
| CARD-003 | Password Reset | 2026-05-15 | 2026-05-23 | 8d 0h |
```

### 8. Work in Strict Priority Order

All work must be pulled in strict priority order, with no exceptions. The highest-priority card in the backlog is always the next card to be worked on. Do not create separate tracks, swimlanes, or categories of work that bypass the priority order — this undermines the entire Kanban system.

> **Rule:** Priority is a single ranked list. There is no "high priority lane" and "low priority lane." There is only the next most important item.

---

## Quick Reference Cards

### Before Any Action
- [ ] **Read the board** — read KANBAN.md, BOARD.md, and CONFIG.md to understand current state and policies
- [ ] **Check WIP limits** — run `check-wip.sh` to see where there is capacity

### When Adding a Card
- [ ] Give it a unique ID (CARD-NNN)
- [ ] Add to the Backlog column initially
- [ ] Record type, priority, and description
- [ ] If unclear → add minimal info; refine later

### When Moving a Card
- [ ] Verify target column is under its WIP limit
- [ ] Record the move in BOARD.md
- [ ] If moving to Done → first verify against the [Definition of Done](../definition-of-done/SKILL.md) with `verify-dod.sh`
- [ ] If moving to Done → metrics (cycle time, lead time) are logged automatically in METRICS.md

### When Completing a Task
- [ ] Move the task to the **Done** column
- [ ] Check if **all tasks** for the parent PBI are now done
- [ ] If all tasks are done → move the PBI itself to **Done** alongside its tasks

### When Completing a PBI
- [ ] Verify every task under the PBI is in **Done**
- [ ] Verify against the [Definition of Done](../definition-of-done/SKILL.md) with `verify-dod.sh` — all criteria must be met
- [ ] Move the PBI to **Done** with `move-card.sh` — metrics are logged automatically
- [ ] Archive the completed card with `archive-card.sh` to clean up the active board

### When Work Is Stuck
- [ ] **Do not block the card** — split it instead
- [ ] Identify what part of the work CAN be done right now
- [ ] Split that work into a new smaller card
- [ ] Log the split reason in BLOCKED.md
- [ ] If the smaller piece is also stuck → **ask another agent or the end user for help**
- [ ] Log the help request in BLOCKED.md

### When Reviewing Flow
- [ ] Run `report-metrics.sh` to get the full picture
- [ ] Check which columns are at WIP limit — where is the bottleneck?
- [ ] Review cycle times — are they trending up or down?
- [ ] Review lead times — are requests taking too long end-to-end?
- [ ] Check throughput — is delivery stable week over week?
- [ ] Check BLOCKED.md for stuck work — are cards being split promptly?
- [ ] Make one process change based on the data

---

## References

- [Kanban Board Visualization](references/board-visualization.md) — Text-based board format. When asked to draw the current board, generate output matching this template.
- [Kanban Method Overview](references/kanban-overview.md) — The six core Kanban practices explained for AI agents.
- [The Seven Wastes (Muda) — Taiichi Ohno](references/seven-wastes.md) — Lean manufacturing's seven forms of waste and how Kanban practices eliminate them. Use as a mental model to identify and remove waste from the workflow.

---

## TUI Options

Two terminal UI options are available — a **pi extension** for use inside pi, and a **standalone TUI** that runs in its own terminal tab with no pi dependency.

---

### Option 1: Standalone TUI (no pi dependency)

A real-time, keyboard-navigable Kanban board that runs in its **own terminal tab** — completely independent of pi. It watches `.kanban/` files with `chokidar` and updates automatically as cards move.

#### Install & Run

```bash
# 1. Install dependencies (one-time)
cd skills/kanban-board/tui
npm install

# 2. Open a new terminal tab and run from your project
cd /path/to/your-project
node /path/to/skills/kanban-board/tui/index.js

# Or specify the project path as an argument
node /path/to/skills/kanban-board/tui/index.js /path/to/your-project
```

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `b` | Board view |
| `m` | Metrics view |
| `s` | Stuck work view |
| `↑`/`k` | Navigate up (board view) |
| `↓`/`j` | Navigate down (board view) |
| `Enter` | Open card detail |
| `Esc` | Back from detail view |
| `p` | Toggle sort by priority / ID |
| `r` | Refresh board state |
| `q` or `Ctrl+C` | Quit |

#### Views

- **Board** — Columns with WIP counts, color-coded WIP bars, cards with priority colors, sticky work indicators
- **Metrics** — Throughput (7d/30d), WIP counts with bars, cycle times (last 10), lead times (last 10), card distribution
- **Blockers** — Stuck work list with card details and descriptions
- **Card Detail** — Full card info on Enter

> **Tip:** Run the standalone TUI in a second terminal tab while you work in the first. Cards update live as they move.

#### Features

- **Real-time file watching** — uses `chokidar` to detect changes in `.kanban/`
- **WIP limit indicators** — color-coded bars (green < 75%, yellow < 100%, red = full)
- **Priority sorting** — toggle between priority order and card ID order with `p`
- **Card detail view** — press Enter on any card to see full description and metadata
- **Terminal resize** — handles window resizing gracefully

---

### Option 2: pi TUI Extension

A live-updating, keyboard-navigable Kanban board terminal UI available as a pi extension. It renders the board, metrics, and stuck work with color-coded columns and WIP bars.

#### Install

```bash
# Link the extension into pi's global extensions:
mkdir -p ~/.pi/agent/extensions
ln -sf /path/to/kanban-board/pi-ext ~/.pi/agent/extensions/kanban-board

# Then restart pi or run /reload
```

> **Tip:** Replace `/path/to/kanban-board` with the actual path to this skill directory. If you cloned the skills repo to `~/skills`, use:
> `ln -sf ~/skills/kanban-board/pi-ext ~/.pi/agent/extensions/kanban-board`
> 
> Or from inside the `kanban-board` directory:
> `ln -sf $(pwd)/pi-ext ~/.pi/agent/extensions/kanban-board`

#### Verify

1. Restart pi or run `/reload`
2. Type `/kanban` and press enter
3. The TUI board should render with your current board state
4. Press `m` to see metrics, `s` for stuck work, `b` to return to board view
5. Press `q` or `esc` to close

If `/kanban` is not recognized, check that the symlink points to the correct directory and that `pi-ext/index.ts` exists.

#### Usage

| Command | Action |
|---------|--------|
| `/kanban` | Open interactive TUI board |
| `m` (in TUI) | Switch to metrics view |
| `b` (in TUI) | Switch back to board view |
| `s` (in TUI) | Switch to stuck work view |
| `q` or `esc` | Close TUI |

The extension also:
- Shows a **summary widget** above the input editor with column counts and WIP status
- Registers a **`kanban_board` tool** for the LLM to read board state inline

### Install

```bash
# Link the extension into pi's global extensions:
mkdir -p ~/.pi/agent/extensions
ln -sf /path/to/kanban-board/pi-ext ~/.pi/agent/extensions/kanban-board

# Then restart pi or run /reload
```

> **Tip:** Replace `/path/to/kanban-board` with the actual path to this skill directory. If you cloned the skills repo to `~/skills`, use:
> `ln -sf ~/skills/kanban-board/pi-ext ~/.pi/agent/extensions/kanban-board`
> 
> Or from inside the `kanban-board` directory:
> `ln -sf $(pwd)/pi-ext ~/.pi/agent/extensions/kanban-board`

### Verify

1. Restart pi or run `/reload`
2. Type `/kanban` and press enter
3. The TUI board should render with your current board state
4. Press `m` to see metrics, `s` for stuck work, `b` to return to board view
5. Press `q` or `esc` to close

If `/kanban` is not recognized, check that the symlink points to the correct directory and that `pi-ext/index.ts` exists.

### Usage

| Command | Action |
|---------|--------|
| `/kanban` | Open interactive TUI board |
| `m` (in TUI) | Switch to metrics view |
| `b` (in TUI) | Switch back to board view |
| `s` (in TUI) | Switch to stuck work view |
| `q` or `esc` | Close TUI |

The extension also:
- Shows a **summary widget** above the input editor with column counts and WIP status
- Registers a **`kanban_board` tool** for the LLM to read board state inline

---

## Helper Scripts

| Script | Purpose |
|--------|---------|
| `init-board.sh` | Initialize the Kanban board structure |
| `add-card.sh` | Add a new card to the backlog |
| `move-card.sh` | Move a card between columns (respects WIP) |
| `split-card.sh` | Split a stuck card instead of blocking it — logs the reason and help requests |
| `check-wip.sh` | Display WIP status across all columns |
| `report-metrics.sh` | Comprehensive metrics report: WIP, cycle time, lead time, throughput, stuck work |
| `archive-card.sh` | Archive a completed card (cleanup — metrics were already logged by move-card.sh) |
| `pi-ext/` | pi TUI extension — interactive `/kanban` board with live updates |
| `tui/` | Standalone TUI — runs in its own terminal tab; no pi dependency; real-time file watching |

See [scripts/](scripts/) for implementation.
