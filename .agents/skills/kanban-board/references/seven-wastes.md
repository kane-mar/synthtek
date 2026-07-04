# The Seven Wastes (Muda) — Taiichi Ohno

> Taiichi Ohno was a Japanese industrial engineer and businessman and the father of the Toyota Production System, which inspired Lean Manufacturing in the US, Europe and elsewhere.

He famously identified **7 forms of waste** to be eliminated, in order to increase productivity, speed and quality in making goods. According to him, these are the most wasteful activities that drain time, resources, and profitability, while adding no value to the customer:

| # | Waste | Description | Kanban / Flow Parallel |
|---|-------|-------------|------------------------|
| 1 | **Transportation** | Moving materials, products, or information further than necessary. | Frequent context-switching between tools or repos. Excess handoffs between columns. |
| 2 | **Inventory** | Holding excess raw materials, work-in-progress, or finished goods that tie up capital. | Too many cards in WIP. Stale backlog items nobody pulls. Piling up "almost done" work. |
| 3 | **Motion** | Unnecessary physical movement or strain by employees (e.g., reaching, bending, walking). | Pointless scrolling, searching for card status, redundant status-update meetings, re-reading the same files. |
| 4 | **Waiting** | Idle time caused by bottlenecks, slow systems, or delayed supplies. | A column at WIP limit while upstream work is ready. Waiting for reviews, approvals, or CI. |
| 5 | **Overproduction** | Producing more, faster, or earlier than customer demand requires — considered the most serious waste. | Building features nobody asked for. Refining backlog items too far ahead. Generating reports nobody reads. |
| 6 | **Over-processing** | Using more time, equipment, or steps than the customer actually requires. | Gold-plating. Excessive documentation. Unnecessary ceremony around card moves. Over-engineering. |
| 7 | **Defects** | Producing products or information that do not meet specifications, requiring scrap, rework, or correction. | Cards that fail DoD. Bugs found late. Incorrect or missing task descriptions that force rework. |

---

## Why This Matters for Kanban

The Kanban method and the Toyota Production System share deep roots. Every core Kanban practice directly attacks one or more of the seven wastes:

| Kanban Practice | Wastes It Eliminates |
|-----------------|----------------------|
| **Visualize the workflow** | Motion (#3) — no more searching for status. Defects (#7) — policies are visible. |
| **Limit WIP** | Inventory (#2) — caps work-in-process. Waiting (#4) — exposes bottlenecks. Overproduction (#5) — pulls only what's needed. |
| **Manage flow** | Waiting (#4) — smooths delivery. Transportation (#1) — reduces handoffs. |
| **Make policies explicit** | Defects (#7) — clear entry/exit criteria. Over-processing (#6) — no unnecessary steps. |
| **Implement feedback loops** | Defects (#7) — catch issues early. Overproduction (#5) — validate demand. |
| **Improve collaboratively** | All seven — continuous elimination of waste. |

> **Mental model for agents:** Before adding a step, a card, or a policy, ask: *"Does this create customer value, or is it waste?"* If the answer is waste, eliminate it.
