# Kanban Method Overview

> The six core Kanban practices explained for AI agents.

---

## 1. Visualize the Workflow

Make work and its status visible. Hidden work cannot be managed, measured, or improved.

**For AI agents:** The board files in `.kanban/` are your visualization. Read `BOARD.md` before starting anything. If a card exists but isn't on the board, it doesn't exist for the team.

## 2. Limit WIP (Work in Progress)

Cap the number of items in each workflow stage. WIP limits are the engine of Kanban — they force completion before starting new work.

**Why it works:** When a column hits its WIP limit, no new work can enter. The only way to create space is to finish something. This exposes where the system is constrained.

**For AI agents:** Use `check-wip.sh` before pulling new work. If a column is at its limit, do not start new work — help finish what's already there.

## 3. Manage Flow

Monitor how work moves through the board. The goal is smooth, predictable flow.

**Signs of healthy flow:**
- Cards move steadily through columns
- No column is consistently at its WIP limit
- Cycle time is stable or decreasing

**Signs of poor flow:**
- Items pile up in one column (bottleneck)
- Cycle time is increasing
- Work sits idle between columns

## 4. Make Policies Explicit

Every column should have clear, written policies about what it means to be in that column and what's required to leave it.

**Examples:**
- *"A card can only enter Review if all acceptance criteria are checked"*
- *"A card leaves In Progress only when all tests pass"*
- *"An agent can only have one card in In Progress at a time"*

**For AI agents:** Read `.kanban/POLICIES.md` before moving cards. If a policy is unclear, clarify it before proceeding.

## 5. Implement Feedback Loops

Review the board and metrics regularly to identify what to improve.

**For AI agents:**
- After moving a PBI to Done, check if cycle time is improving
- After hitting a WIP limit, ask: *"Is this limit right, or is there a bottleneck?"*
- Log observations in METRICS.md

## 6. Improve Collaboratively

Use the data from the board to make small, incremental process improvements.

**For AI agents:**
- If Review is always at WIP limit → increase Review capacity, or reduce how much work enters In Progress
- If items sit in Backlog for weeks → the backlog may need refinement
- If cycle time is increasing → WIP limits may be too high

---


