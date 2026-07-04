import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderBoardView,
  renderMetricsView,
  renderBlockersView,
  renderDetailView,
  renderStatusBar,
  renderHelpBar,
} from "../src/renderers.js";

function sampleState(overrides = {}) {
  return {
    columns: [
      { name: "Backlog", wipLimit: -1 },
      { name: "Ready", wipLimit: 3 },
      { name: "In Progress", wipLimit: 3 },
      { name: "Review", wipLimit: 2 },
      { name: "Done", wipLimit: -1 },
    ],
    cards: [
      {
        id: "CARD-001",
        title: "Password Reset UI",
        type: "feature",
        priority: "high",
        status: "backlog",
        created: "2026-06-01",
        started: "—",
        completed: "—",
        column: "Backlog",
        description: "",
      },
      {
        id: "CARD-002",
        title: "Session Management",
        type: "feature",
        priority: "high",
        status: "ready",
        created: "2026-05-30",
        started: "2026-06-01",
        completed: "—",
        column: "Ready",
        description: "JWT session handling",
      },
      {
        id: "CARD-003",
        title: "User Authentication",
        type: "feature",
        priority: "high",
        status: "in-progress",
        created: "2026-05-28",
        started: "2026-05-29",
        completed: "—",
        column: "In Progress",
        description: "OAuth2 login",
      },
      {
        id: "CARD-004",
        title: "Dashboard Layout",
        type: "feature",
        priority: "medium",
        status: "in-progress",
        created: "2026-05-25",
        started: "2026-05-26",
        completed: "—",
        column: "In Progress",
        description: "",
      },
      {
        id: "CARD-005",
        title: "Security Audit",
        type: "chore",
        priority: "high",
        status: "done",
        created: "2026-05-15",
        started: "2026-05-16",
        completed: "2026-05-20",
        column: "Done",
        description: "OWASP compliance",
      },
    ],
    blockers: ["CARD-004"],
    cycleTimes: [
      {
        id: "CARD-005",
        title: "Security Audit",
        started: "2026-05-16",
        completed: "2026-05-20",
        duration: "4d 0h",
      },
    ],
    leadTimes: [
      {
        id: "CARD-005",
        title: "Security Audit",
        created: "2026-05-15",
        completed: "2026-05-20",
        duration: "5d 0h",
      },
    ],
    throughput7d: 2,
    throughput30d: 5,
    ...overrides,
  };
}

describe("renderStatusBar", () => {
  it("includes total card count", () => {
    const result = renderStatusBar(sampleState());
    assert.ok(result.includes("Total: 5"));
  });

  it("includes WIP count (Ready + In Progress + Review)", () => {
    const result = renderStatusBar(sampleState());
    assert.ok(result.includes("WIP: 3")); // Ready(1) + In Progress(2) = 3
  });

  it("includes Done count", () => {
    const result = renderStatusBar(sampleState());
    assert.ok(result.includes("Done: 1")); // Only CARD-005
  });

  it("shows blocker count when there are blockers", () => {
    const result = renderStatusBar(sampleState());
    assert.ok(result.includes("⏸1"));
  });

  it("does not show blocker count when there are none", () => {
    const result = renderStatusBar(sampleState({ blockers: [] }));
    assert.ok(!result.includes("⏸"));
  });
});

describe("renderHelpBar", () => {
  it("shows board navigation hints for board view", () => {
    const result = renderHelpBar("board");
    assert.ok(result.includes("[b]oard"));
    assert.ok(result.includes("[m]etrics"));
    assert.ok(result.includes("[q]uit"));
  });

  it("shows metrics hints for metrics view", () => {
    const result = renderHelpBar("metrics");
    assert.ok(result.includes("[m]etrics"));
  });

  it("shows back hint for detail view", () => {
    const result = renderHelpBar("detail");
    assert.ok(result.includes("[esc] back"));
  });
});

describe("renderBoardView", () => {
  it("renders all column headers", () => {
    const lines = renderBoardView(sampleState(), 120, null, true);
    const text = lines.join("\n");
    assert.ok(text.includes("Backlog"));
    assert.ok(text.includes("Ready"));
    assert.ok(text.includes("In Progress"));
    assert.ok(text.includes("Review"));
    assert.ok(text.includes("Done"));
  });

  it("shows WIP counts in column headers", () => {
    const lines = renderBoardView(sampleState(), 120, null, true);
    const text = lines.join("\n");
    assert.ok(text.includes("(1/"));
    assert.ok(text.includes("(2/"));
  });

  it("shows all card IDs", () => {
    const lines = renderBoardView(sampleState(), 120, null, true);
    const text = lines.join("\n");
    assert.ok(text.includes("CARD-001"));
    assert.ok(text.includes("CARD-002"));
    assert.ok(text.includes("CARD-003"));
    assert.ok(text.includes("CARD-004"));
    assert.ok(text.includes("CARD-005"));
  });

  it("includes card title fragments", () => {
    const lines = renderBoardView(sampleState(), 120, null, true);
    const text = lines.join("\n");
    assert.ok(text.includes("Password"));
    assert.ok(text.includes("Session"));
  });

  it("marks blocked cards with ⏸", () => {
    const lines = renderBoardView(sampleState(), 120, null, true);
    const text = lines.join("\n");
    assert.ok(text.includes("⏸"));
  });

  it("highlights selected card when provided", () => {
    const lines = renderBoardView(sampleState(), 120, "CARD-003", true);
    const text = lines.join("\n");
    assert.ok(text.includes("Selected:"));
    assert.ok(text.includes("CARD-003"));
    assert.ok(text.includes("User Authentication"));
  });

  it("includes total and WIP summary in footer", () => {
    const lines = renderBoardView(sampleState(), 120, null, true);
    const text = lines.join("\n");
    assert.ok(text.includes("total"));
    assert.ok(text.includes("in progress"));
    assert.ok(text.includes("done"));
    assert.ok(text.includes("5")); // 5 cards total
  });

  it("shows sort label in footer", () => {
    const lines = renderBoardView(sampleState(), 120, null, true);
    const text = lines.join("\n");
    assert.ok(text.includes("sorted by priority"));
  });

  it("shows 'sorted by ID' when sortByPriority is false", () => {
    const lines = renderBoardView(sampleState(), 120, null, false);
    const text = lines.join("\n");
    assert.ok(text.includes("sorted by ID"));
  });
});

describe("renderMetricsView", () => {
  it("shows a metrics header", () => {
    const lines = renderMetricsView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("Metrics"));
  });

  it("shows throughput counts", () => {
    const lines = renderMetricsView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("7 days"));
    assert.ok(text.includes("30 days"));
    assert.ok(text.includes("2"));
    assert.ok(text.includes("5"));
  });

  it("shows WIP counts per active column", () => {
    const lines = renderMetricsView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("In Progress"));
    assert.ok(text.includes("2/3"));
  });

  it("shows cycle times", () => {
    const lines = renderMetricsView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("CARD-005"));
    assert.ok(text.includes("4d 0h"));
  });

  it("shows lead times", () => {
    const lines = renderMetricsView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("5d 0h"));
  });

  it("shows card distribution across columns", () => {
    const lines = renderMetricsView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("Distribution"));
  });

  it("handles empty state gracefully", () => {
    const empty = sampleState({ cards: [], cycleTimes: [], leadTimes: [] });
    const lines = renderMetricsView(empty, 120);
    const text = lines.join("\n");
    assert.ok(text.includes("No completed cards yet"));
  });
});

describe("renderBlockersView", () => {
  it("shows success message when no blockers", () => {
    const lines = renderBlockersView(sampleState({ blockers: [] }), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("No stuck work"));
  });

  it("lists blocker card IDs", () => {
    const lines = renderBlockersView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("CARD-004"));
  });

  it("shows blocker card title", () => {
    const lines = renderBlockersView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(text.includes("Dashboard Layout"));
  });

  it("shows card description when available", () => {
    const state = sampleState();
    const lines = renderBlockersView(state, 120);
    // CARD-004 has no description in our sample
  });

  it("does not include non-blocked cards", () => {
    const lines = renderBlockersView(sampleState(), 120);
    const text = lines.join("\n");
    assert.ok(!text.includes("Security Audit")); // CARD-005 is not blocked
  });
});

describe("renderDetailView", () => {
  it("shows card ID and title", () => {
    const state = sampleState();
    const lines = renderDetailView(state, "CARD-003", 120);
    const text = lines.join("\n");
    assert.ok(text.includes("CARD-003"));
    assert.ok(text.includes("User Authentication"));
  });

  it("shows card priority with color tag", () => {
    const state = sampleState();
    const lines = renderDetailView(state, "CARD-003", 120);
    const text = lines.join("\n");
    assert.ok(text.includes("high"));
  });

  it("shows blocked status for stuck cards", () => {
    const state = sampleState();
    const lines = renderDetailView(state, "CARD-004", 120);
    const text = lines.join("\n");
    assert.ok(text.includes("Stuck"));
    assert.ok(text.includes("split or help-requested"));
  });

  it("does not show stuck for non-blocked cards", () => {
    const state = sampleState();
    const lines = renderDetailView(state, "CARD-003", 120);
    const text = lines.join("\n");
    assert.ok(!text.includes("Stuck"));
  });

  it("shows card description when available", () => {
    const state = sampleState();
    const lines = renderDetailView(state, "CARD-002", 120);
    const text = lines.join("\n");
    assert.ok(text.includes("JWT session handling"));
  });

  it("shows back navigation hint", () => {
    const state = sampleState();
    const lines = renderDetailView(state, "CARD-003", 120);
    const text = lines.join("\n");
    assert.ok(text.includes("[esc] Back"));
  });
});
