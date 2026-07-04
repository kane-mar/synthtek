# CSM Course Notes — The Product Backlog

> **Instructor:** Kane Mar  
> **Source:** Certified Scrum Master (CSM) training  
> **Topic:** The product backlog — definition, structure, and refinement

---

## The Product Goal

The product backlog starts with the **product goal**. Product owners describe the future state of the product — a formal description of what they're trying to achieve. Once a product goal is established, the product owner lists everything needed to achieve it, puts that work into a **single ranked order**, and that list is called the **product backlog**.

---

## Definition of the Product Backlog

The formal definition: the product backlog is a **dynamic, single-ranked, ordered list**.

### Dynamic

The backlog changes — and this is a *good thing* from a Scrum point of view. It's how we ensure we deliver something that meets customer needs.

- Product owners talk to stakeholders, senior management, end users, and subject matter experts regularly, returning with new ideas, features, and needs
- They add that work to the backlog and reorder it
- Early on, it's common for the backlog to change every couple of days
- The product owner often says *"That's not what I want. It's what I asked for, but it's not what I want."* Most people can't fully conceptualize what they're trying to achieve — it's easier to see something and then make decisions. That's fine. If it's not what they want, the team adjusts.

> **For AI agents:** The backlog can change at **any time**. If new information arrives, capture it and reorder the backlog immediately. Do not wait for a scheduled event.

### Single Ranked Order

There is only **one item at the top**, one item underneath that, one item underneath that — a strict single-ranked order throughout.

**Why this matters:** This prevents product owners from saying *"These top 50 things are my highest priority."* If you have 50 things to start with, where exactly do you start? Item #1? Item #50? Somewhere in between? That's not useful.

Instead, the product owner chooses **one thing** to solve first, then one thing after that, then one thing after that.

### Ordered List (Granularity)

The backlog is structured with **small, fine-grained bodies of work at the top** and **larger, chunkier bodies of work at the bottom**.

#### Why not break everything down?

The fundamental reason is **waste**:

- Large bodies of work at the bottom of the backlog are **low value**
- Why spend time breaking down low-value work that you may never reach?
- The product owner may only have funding for items above a certain point — anything below that red line may never be built
- If you'd broken down those low-priority items, that work would be thrown away

**Instead:** Focus on high-value work. Break high-value work into the smallest chunks. Don't worry about low-value work until it rises in priority.

#### When does work get broken down?

As the team takes work off the top each sprint, the remaining work **shuffles up** in priority order. When a large item reaches the **top of the backlog**, it must be broken down into smaller, fine-grained items before the team can work on it. Items that stay low priority never need to be broken down.

> **Rule of thumb:** If the top item on the backlog is too large to complete in a single sprint, it's not yet ready. Break it down first.

---

## Product Backlog Items (PBIs)

PBI stands for **Product Backlog Item**. PBIs are anything on the product backlog:

- User stories
- Items of risk
- Defects from production
- Any other work needed to deliver the product

The product backlog is really **nothing more than a to-do list** of everything needed to deliver the product. This is why Scrum works in so many domains beyond software — as soon as you can take a to-do list and put it in a single rank order, you can start doing Scrum.

### User Stories

Many teams create each PBI as a user story. The most common template:

> **As a** [user role]  
> **I want** [feature/functionality]  
> **So that** [business value/justification]

**Important:** Always write acceptance criteria for every single user story.

### Epics and Features — Avoid Them

From a pure Scrum perspective, there is no such thing as an epic or a feature. Scrum only requires a product backlog ordered in a single rank order. There are two reasons to avoid introducing these terms:

#### 1. No Formal Definition

There is no universally agreed definition of "epic" or "feature." Different teams interpret the same words in different ways, which leads to confusion and misalignment. One team's "epic" is another team's "feature." This ambiguity undermines the clarity that the backlog is meant to provide.

#### 2. Both Terms Introduce Waste

**Premature breakdown:** Epics and features pressure teams to break down large bodies of work *before they rise in priority*. This violates the principle of progressive granularity — you end up decomposing low-value work you may never reach. That effort is waste.

**False completion pressure:** Teams feel compelled to get an epic to 100% completion, even if the remaining items are low value. This pulls focus away from higher-value work that's waiting in the backlog. The team optimizes for closing the epic rather than maximizing delivered value.

#### The Alternative

Keep it simple. The only structure you need in your product backlog is:
- Small, fine-grained work at the top
- Larger, chunkier work at the bottom

Don't overload the backlog with unnecessary hierarchy. Items get broken down naturally as they rise in priority.

---

## Common Pitfall: The Requirements Document Analogy

Many people assume the product backlog is just a requirements document. **This is a bad analogy.** There are two fundamental differences:

### 1. Dynamic vs. Static

| Product Backlog | Requirements Document |
|----------------|----------------------|
| Always changing | Held static through reviews and sign-offs |
| Change is encouraged | Change is restricted |

We want the backlog to be freely changeable. Requirements documents do everything to resist change.

### 2. Granularity

| Product Backlog | Requirements Document |
|----------------|----------------------|
| Small work at top, large work at bottom | Everything broken down to roughly the same size |
| Break down work as it rises in priority | All work broken down upfront |
| Avoids waste on low-priority items | Wastes effort on items that may never be built |

---

## Backlog Refinement

Refinement is the ongoing activity of keeping the backlog healthy. It happens continuously as items rise in priority and new information arrives — it is not constrained to a scheduled meeting.

### What Refinement Involves

- Breaking down large bodies of work into smaller ones
- Writing new user stories
- Breaking down high-priority work into smaller chunks so the team better understands it
- Re-estimating items where context has changed

---

## Summary

| Concept | Key Takeaway |
|---------|-------------|
| **Product Goal** | The starting point — a description of the future state of the product |
| **Product Backlog** | A dynamic, single-ranked, ordered list of everything needed to achieve the product goal |
| **Dynamic** | Changes constantly — at minimum once per sprint, often every few days |
| **Single Ranked** | One item at the top, one underneath — no ties, no "top 50" |
| **Granularity** | Small/fine at top, large/chunky at bottom — break down only as items rise in priority |
| **Waste avoidance** | Don't break down low-value work you may never reach |
| **Refinement** | Not a formal Scrum event, but essential — regular weekly sessions prevent chaotic Sprint Planning |
