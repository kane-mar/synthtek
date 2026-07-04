import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readBoardState } from "../src/board-state.js";

const TEST_DIR = join("/tmp", "kanban-test-" + process.pid);
const KANBAN_DIR = join(TEST_DIR, ".kanban");

function write(path, content) {
  const fullPath = join(KANBAN_DIR, path);
  writeFileSync(fullPath, content, "utf-8");
}

function setupBoard(files) {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(KANBAN_DIR, { recursive: true });
  mkdirSync(join(KANBAN_DIR, "CARDS"), { recursive: true });
  mkdirSync(join(KANBAN_DIR, "ARCHIVED"), { recursive: true });
  for (const [filePath, content] of Object.entries(files)) {
    const fullDir = join(KANBAN_DIR, filePath.split("/").slice(0, -1).join("/"));
    if (fullDir !== KANBAN_DIR) mkdirSync(fullDir, { recursive: true });
    writeFileSync(join(KANBAN_DIR, filePath), content, "utf-8");
  }
}

describe("readBoardState", () => {
  after(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("reads columns from CONFIG.md", () => {
    setupBoard({
      "CONFIG.md": "- Backlog: -1\n- Ready: 3\n- In Progress: 3\n- Review: 2\n- Done: -1\n",
    });

    const state = readBoardState(TEST_DIR);

    assert.equal(state.columns.length, 5);
    assert.equal(state.columns[0].name, "Backlog");
    assert.equal(state.columns[0].wipLimit, -1);
    assert.equal(state.columns[1].name, "Ready");
    assert.equal(state.columns[1].wipLimit, 3);
  });

  it("returns default columns when CONFIG.md is missing", () => {
    setupBoard({});

    const state = readBoardState(TEST_DIR);

    assert.equal(state.columns.length, 5);
    assert.equal(state.columns[0].name, "Backlog");
    assert.equal(state.columns[3].name, "Review");
    assert.equal(state.columns[3].wipLimit, 2);
  });

  it("reads cards from CARDS directory with their column from BOARD.md", () => {
    setupBoard({
      "CARDS/CARD-001--user-auth.md": `---
id: CARD-001
title: "User Authentication"
type: feature
priority: high
status: in-progress
created: 2026-05-28T10:00:00
started: 2026-05-29T09:00:00
completed: —
---

## Description
OAuth2 login with Google and GitHub.
`,
      "CARDS/CARD-002--security-audit.md": `---
id: CARD-002
title: "Security Audit"
type: chore
priority: high
status: done
created: 2026-05-15T10:00:00
started: 2026-05-16T09:00:00
completed: 2026-05-20T18:00:00
---
`,
      "BOARD.md": `# Board State

## In Progress
- **CARD-001** User Authentication

## Done
- **CARD-002** Security Audit
`,
    });

    const state = readBoardState(TEST_DIR);

    assert.equal(state.cards.length, 2);

    const card1 = state.cards.find((c) => c.id === "CARD-001");
    assert.ok(card1);
    assert.equal(card1.title, "User Authentication");
    assert.equal(card1.type, "feature");
    assert.equal(card1.priority, "high");
    assert.equal(card1.status, "in-progress");
    assert.equal(card1.column, "In Progress");
    assert.equal(card1.created, "2026-05-28T10:00:00");
    assert.equal(card1.started, "2026-05-29T09:00:00");
    assert.equal(card1.completed, "—");
    assert.equal(card1.description, "OAuth2 login with Google and GitHub.");

    const card2 = state.cards.find((c) => c.id === "CARD-002");
    assert.ok(card2);
    assert.equal(card2.title, "Security Audit");
    assert.equal(card2.column, "Done");
    assert.equal(card2.completed, "2026-05-20T18:00:00");
  });

  it("places cards in Backlog when BOARD.md is missing", () => {
    setupBoard({
      "CARDS/CARD-001--user-auth.md": `---
title: "User Auth"
type: feature
priority: high
---
`,
    });

    const state = readBoardState(TEST_DIR);
    assert.equal(state.cards.length, 1);
    assert.equal(state.cards[0].column, "Backlog");
  });

  it("reads blockers from BLOCKED.md", () => {
    setupBoard({
      "BLOCKED.md": `## CARD-001
**Status:** split
**Reason:** Dependency issue

## CARD-002
**Status:** help-requested
**Reason:** Needs review
`,
    });

    const state = readBoardState(TEST_DIR);
    assert.deepEqual(state.blockers, ["CARD-001", "CARD-002"]);
  });

  it("returns empty blockers when BLOCKED.md is missing", () => {
    setupBoard({});
    const state = readBoardState(TEST_DIR);
    assert.deepEqual(state.blockers, []);
  });

  it("reads cycle times and lead times from METRICS.md", () => {
    setupBoard({
      "METRICS.md": `## Cycle Time Log
| Card | Title | Started | Completed | Cycle Time |
|------|-------|---------|-----------|------------|
| CARD-001 | Security Audit | 2026-05-16 | 2026-05-20 | 4d 0h |

## Lead Time Log
| Card | Title | Created | Completed | Lead Time |
|------|-------|---------|-----------|-----------|
| CARD-001 | Security Audit | 2026-05-15 | 2026-05-20 | 5d 0h |
`,
    });

    const state = readBoardState(TEST_DIR);

    assert.equal(state.cycleTimes.length, 1);
    assert.equal(state.cycleTimes[0].id, "CARD-001");
    assert.equal(state.cycleTimes[0].duration, "4d 0h");

    assert.equal(state.leadTimes.length, 1);
    assert.equal(state.leadTimes[0].id, "CARD-001");
    assert.equal(state.leadTimes[0].duration, "5d 0h");
  });

  it("returns empty metrics when METRICS.md is missing", () => {
    setupBoard({});
    const state = readBoardState(TEST_DIR);
    assert.deepEqual(state.cycleTimes, []);
    assert.deepEqual(state.leadTimes, []);
  });

  it("computes throughput from archived cards", () => {
    setupBoard({
      "ARCHIVED/card-001.md": `---
completed: 2026-06-01T10:00:00
---`,
      "ARCHIVED/card-002.md": `---
completed: 2026-05-25T10:00:00
---`,
      "ARCHIVED/card-003.md": `---
completed: 2026-04-15T10:00:00
---`,
    });

    const state = readBoardState(TEST_DIR);

    // CARD-001 is today (within 7 days), CARD-002 is within 30 days
    // CARD-003 is more than 30 days ago
    assert.equal(state.throughput7d, 1);
    assert.equal(state.throughput30d, 2);
  });

  it("handles cards with missing frontmatter gracefully", () => {
    setupBoard({
      "CARDS/CARD-001--bare.md": "Just some markdown content\n## Description\nNothing special.\n",
    });

    const state = readBoardState(TEST_DIR);

    assert.equal(state.cards.length, 1);
    assert.equal(state.cards[0].id, "CARD-001");
    assert.equal(state.cards[0].title, "CARD-001--bare"); // falls back to filename
    assert.equal(state.cards[0].type, "feature");
    assert.equal(state.cards[0].priority, "medium");
  });
});
