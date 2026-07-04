/**
 * Kanban Board TUI Extension
 *
 * A live-updating, keyboard-navigable Kanban board for pi.
 * Reads board state from .kanban/ files and renders a TUI.
 *
 * Commands:
 *   /kanban        — Open the Kanban board TUI (interactive)
 *
 * Widget:
 *   Shows WIP summary above the editor when board is active
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, Key, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

interface ColumnConfig {
  name: string;
  wipLimit: number; // -1 for unlimited
}

interface CardData {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  created: string;
  started: string;
  completed: string;
  column: string;
}

interface BoardState {
  columns: ColumnConfig[];
  cards: CardData[];
  blockers: string[];
  metrics: {
    cycleTimes: string[];
    leadTimes: string[];
    throughput7d: number;
    throughput30d: number;
  };
}

interface KanbanDetails {
  board: BoardState;
}

// ── Board State Reader ──────────────────────────────────────────────────────

function readBoardState(cwd: string): BoardState {
  const kanbanDir = join(cwd, ".kanban");
  const columns: ColumnConfig[] = [];
  const cards: CardData[] = [];
  const blockers: string[] = [];
  const cycleTimes: string[] = [];
  const leadTimes: string[] = [];

  // Read CONFIG.md for columns
  const configPath = join(kanbanDir, "CONFIG.md");
  if (existsSync(configPath)) {
    const config = readFileSync(configPath, "utf-8");
    const inColumns = false;
    for (const line of config.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") && trimmed.includes(":")) {
        const rest = trimmed.slice(2);
        const colonIdx = rest.lastIndexOf(":");
        if (colonIdx > 0) {
          const name = rest.slice(0, colonIdx).trim();
          const limit = parseInt(rest.slice(colonIdx + 1).trim(), 10);
          if (!isNaN(limit)) {
            columns.push({ name, wipLimit: limit });
          }
        }
      }
    }
  }

  // Default columns if CONFIG not found or empty
  if (columns.length === 0) {
    columns.push(
      { name: "Backlog", wipLimit: -1 },
      { name: "Ready", wipLimit: 3 },
      { name: "In Progress", wipLimit: 3 },
      { name: "Review", wipLimit: 2 },
      { name: "Done", wipLimit: -1 }
    );
  }

  // Read card files
  const cardsDir = join(kanbanDir, "CARDS");
  if (existsSync(cardsDir)) {
    const cardFiles = readdirSync(cardsDir).filter((f) => f.endsWith(".md"));
    for (const file of cardFiles) {
      const content = readFileSync(join(cardsDir, file), "utf-8");
      const id = file.replace(/--.*/, "");
      const title =
        content.match(/^title:\s*"([^"]*)"/m)?.[1] ||
        content.match(/^title:\s*(.+)$/m)?.[1] ||
        file.replace(/\.md$/, "");
      const type = content.match(/^type:\s*(.+)$/m)?.[1]?.trim() || "feature";
      const priority = content.match(/^priority:\s*(.+)$/m)?.[1]?.trim() || "medium";
      const status = content.match(/^status:\s*(.+)$/m)?.[1]?.trim() || "backlog";
      const created = content.match(/^created:\s*(.+)$/m)?.[1]?.trim() || "—";
      const started = content.match(/^started:\s*(.+)$/m)?.[1]?.trim() || "—";
      const completed = content.match(/^completed:\s*(.+)$/m)?.[1]?.trim() || "—";

      // Determine column from BOARD.md
      let column = "Backlog";
      const boardPath = join(kanbanDir, "BOARD.md");
      if (existsSync(boardPath)) {
        const boardContent = readFileSync(boardPath, "utf-8");
        let currentSection = "";
        for (const line of boardContent.split("\n")) {
          if (line.startsWith("## ")) {
            currentSection = line.slice(3).trim();
          }
          if (line.includes(`**${id}**`) || line.includes(`| ${id} `)) {
            column = currentSection || "Backlog";
            break;
          }
        }
      }

      cards.push({ id, title, type, priority, status, created, started, completed, column });
    }
  }

  // Read archived cards for metrics
  const archivedDir = join(kanbanDir, "ARCHIVED");
  let archivedCount = 0;
  let archived7d = 0;
  let archived30d = 0;
  if (existsSync(archivedDir)) {
    const archivedFiles = readdirSync(archivedDir).filter((f) => f.endsWith(".md"));
    archivedCount = archivedFiles.length;
    const now = Date.now();
    for (const file of archivedFiles) {
      const content = readFileSync(join(archivedDir, file), "utf-8");
      const completed = content.match(/^completed:\s*(.+)$/m)?.[1]?.trim();
      if (completed && completed !== "—") {
        try {
          const ts = new Date(completed).getTime();
          const daysAgo = (now - ts) / (1000 * 60 * 60 * 24);
          if (daysAgo <= 7) archived7d++;
          if (daysAgo <= 30) archived30d++;
        } catch { /* ignore parse errors */ }
      }
    }
  }

  // Read METRICS.md for cycle/lead times
  const metricsPath = join(kanbanDir, "METRICS.md");
  if (existsSync(metricsPath)) {
    const metricsContent = readFileSync(metricsPath, "utf-8");
    for (const line of metricsContent.split("\n")) {
      if (line.startsWith("|") && line.includes("CARD-")) {
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length >= 5) {
          const time = parts[4];
          if (time && time !== "Cycle Time" && time !== "—") {
            cycleTimes.push(time);
          }
        }
        if (parts.length >= 6) {
          const leadTime = parts[5];
          if (leadTime && leadTime !== "Lead Time" && leadTime !== "—") {
            leadTimes.push(leadTime);
          }
        }
      }
    }
  }

  // Read BLOCKED.md
  const blockersPath = join(kanbanDir, "BLOCKED.md");
  if (existsSync(blockersPath)) {
    const blockersContent = readFileSync(blockersPath, "utf-8");
    let inBlocked = false;
    for (const line of blockersContent.split("\n")) {
      if (line.includes("**Status:** split") || line.includes("**Status:** help-requested")) {
        inBlocked = true;
      }
      if (inBlocked && line.startsWith("## ")) {
        const id = line.slice(3).trim().split(" — ")[0];
        if (id) blockers.push(id);
        inBlocked = false;
      }
    }
  }

  return {
    columns,
    cards,
    blockers,
    metrics: {
      cycleTimes,
      leadTimes,
      throughput7d: archived7d,
      throughput30d: archived30d,
    },
  };
}

// ── ANSI helpers ────────────────────────────────────────────────────────────

function bar(value: number, max: number, width: number = 10): string {
  const fill = Math.min(Math.round((value / max) * width), width);
  const empty = width - fill;
  return "█".repeat(fill) + "░".repeat(empty);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function formatTime(s: string): string {
  if (!s || s === "—") return "—";
  return s.slice(0, 10);
}

// ── TUI Components ──────────────────────────────────────────────────────────

class KanbanBoardComponent {
  private state: BoardState;
  private theme: Theme;
  private onClose: () => void;
  private cachedWidth?: number;
  private cachedLines?: string[];
  private view: "board" | "metrics" | "blockers" = "board";

  constructor(state: BoardState, theme: Theme, onClose: () => void) {
    this.state = state;
    this.theme = theme;
    this.onClose = onClose;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onClose();
    } else if (matchesKey(data, "q")) {
      this.onClose();
    } else if (matchesKey(data, "m")) {
      this.view = "metrics";
      this.invalidate();
    } else if (matchesKey(data, "b")) {
      this.view = "board";
      this.invalidate();
    } else if (matchesKey(data, "k")) {
      this.view = "blockers";
      this.invalidate();
    }
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const th = this.theme;
    const sw = Math.min(width, 120); // Cap at 120 to keep readable

    // Re-read state for live updates
    this.state = readBoardState(process.cwd());

    lines.push("");
    // Title bar
    const title = th.fg("accent", th.bold(" KANBAN BOARD "));
    const mode = this.view === "board"
      ? th.fg("success", " [Board]")
      : this.view === "metrics"
        ? th.fg("accent", " [Metrics]")
        : th.fg("warning", " [Blockers]");
    lines.push(truncateToWidth(
      title + mode + th.fg("dim", "  m:metrics b:board k:blockers q:quit"),
      sw
    ));
    lines.push(truncateToWidth(
      th.fg("borderMuted", "─".repeat(sw)),
      sw
    ));

    if (this.view === "board") {
      this.renderBoardView(lines, sw, th);
    } else if (this.view === "metrics") {
      this.renderMetricsView(lines, sw, th);
    } else {
      this.renderBlockersView(lines, sw, th);
    }

    lines.push(truncateToWidth(
      th.fg("borderMuted", "─".repeat(sw)),
      sw
    ));
    lines.push(truncateToWidth(
      th.fg("dim", " [q/esc] quit  [m] metrics  [b] board  [k] blockers"),
      sw
    ));
    lines.push("");

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  private renderBoardView(lines: string[], sw: number, th: Theme): void {
    const { columns, cards, blockers } = this.state;

    // Count cards per column
    const counts: Record<string, number> = {};
    for (const col of columns) {
      counts[col.name] = 0;
    }
    for (const card of cards) {
      counts[card.column] = (counts[card.column] || 0) + 1;
    }

    // Column headers
    lines.push("");
    const colWidth = Math.floor((sw - 4) / columns.length);
    let header = "  ";
    for (const col of columns) {
      const count = counts[col.name] || 0;
      const limitStr = col.wipLimit === -1 ? "∞" : String(col.wipLimit);
      const atLimit = col.wipLimit !== -1 && count >= col.wipLimit;
      const label = truncate(`${col.name} (${count}/${limitStr})`, colWidth);
      if (atLimit) {
        header += th.fg("warning", label.padEnd(colWidth));
      } else {
        header += th.fg("text", label.padEnd(colWidth));
      }
    }
    lines.push(truncateToWidth(header, sw));

    // WIP limit bars
    lines.push("");
    let barLine = "  ";
    for (const col of columns) {
      const count = counts[col.name] || 0;
      if (col.wipLimit === -1) {
        barLine += th.fg("dim", truncate("(no limit)", colWidth).padEnd(colWidth));
      } else {
        const pct = Math.min(Math.round((count / col.wipLimit) * 100), 100);
        const barStr = bar(count, col.wipLimit, Math.min(colWidth - 5, 10));
        const color = pct >= 100 ? th.fg("warning", barStr) :
                      pct >= 75 ? th.fg("accent", barStr) :
                      th.fg("success", barStr);
        barLine += truncate(`${color} ${pct}%`, colWidth).padEnd(colWidth);
      }
    }
    lines.push(truncateToWidth(barLine, sw));

    // Cards listed under their columns
    lines.push("");
    const maxCardsPerCol = Math.min(
      ...columns.map((c) => counts[c.name] || 0).filter((c) => c > 0),
      5
    );

    for (let i = 0; i < Math.max(maxCardsPerCol, 3); i++) {
      let row = "  ";
      for (const col of columns) {
        const colCards = cards
          .filter((c) => c.column === col.name)
          .sort((a, b) => {
            const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
            return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
          });

        const card = colCards[i];
        if (card) {
          const isBlocked = this.state.blockers.includes(card.id);
          const prefix = isBlocked ? th.fg("warning", "⏸ ") : th.fg("accent", "▪ ");
          const display = truncate(`${prefix}${card.title}`, colWidth - 3);
          row += display.padEnd(colWidth);
        } else if (i === 0 && colCards.length === 0 && counts[col.name] === 0) {
          row += th.fg("dim", truncate("(empty)", colWidth).padEnd(colWidth));
        } else {
          row += " ".repeat(colWidth);
        }
      }
      lines.push(truncateToWidth(row, sw));
    }

    // Summary
    lines.push("");
    const totalCards = cards.length;
    const doneCards = cards.filter((c) => c.column === "Done").length;
    const stuckCount = this.state.blockers.length;
    const wipCards = cards.filter((c) => c.column !== "Backlog" && c.column !== "Done").length;
    const summary = th.fg(
      "muted",
      `  ${totalCards} total  ·  ${wipCards} in progress  ·  ${doneCards} done  ·  ${stuckCount > 0 ? th.fg("warning", `${stuckCount} split or help-requested`) : "0 stuck"}`
    );
    lines.push(truncateToWidth(summary, sw));
  }

  private renderMetricsView(lines: string[], sw: number, th: Theme): void {
    const { metrics } = this.state;
    const { cycleTimes, leadTimes, throughput7d, throughput30d } = metrics;

    lines.push("");
    lines.push(truncateToWidth(`  ${th.fg("accent", th.bold("Cycle Times"))}`, sw));

    if (cycleTimes.length === 0) {
      lines.push(truncateToWidth(`  ${th.fg("dim", "No completed cards yet.")}`, sw));
    } else {
      const display = cycleTimes.slice(-5);
      for (const ct of display) {
        lines.push(truncateToWidth(`  ${th.fg("success", "●")} ${th.fg("muted", ct)}`, sw));
      }
      if (cycleTimes.length > 5) {
        lines.push(truncateToWidth(`  ${th.fg("dim", `... ${cycleTimes.length - 5} more`)}`, sw));
      }
    }

    lines.push("");
    lines.push(truncateToWidth(`  ${th.fg("accent", th.bold("Throughput"))}`, sw));
    lines.push(truncateToWidth(`  ${th.fg("muted", `Last 7 days:  ${throughput7d} PBIs completed`)}`, sw));
    lines.push(truncateToWidth(`  ${th.fg("muted", `Last 30 days: ${throughput30d} PBIs completed`)}`, sw));

    lines.push("");
    lines.push(truncateToWidth(`  ${th.fg("accent", th.bold("WIP Count"))}`, sw));
    const activeCols = this.state.columns.filter((c) => c.name !== "Backlog" && c.name !== "Done");
    for (const col of activeCols) {
      const count = this.state.cards.filter((c) => c.column === col.name).length;
      const limitStr = col.wipLimit === -1 ? "∞" : String(col.wipLimit);
      const color = col.wipLimit !== -1 && count >= col.wipLimit ? "warning" : "muted";
      lines.push(truncateToWidth(
        `  ${th.fg(color as "warning" | "muted", `● ${col.name}: ${count}/${limitStr}`)}`,
        sw
      ));
    }
  }

  private renderStuckView(lines: string[], sw: number, th: Theme): void {
    const { blockers, cards } = this.state;

    lines.push("");
    if (blockers.length === 0) {
      lines.push(truncateToWidth(`  ${th.fg("success", "✓ No stuck work")}`, sw));
    } else {
      for (const blockerId of blockers) {
        const card = cards.find((c) => c.id === blockerId);
        const title = card ? card.title : "Unknown";
        lines.push(truncateToWidth(
          `  ${th.fg("warning", "✂")} ${th.fg("accent", blockerId)} ${th.fg("text", truncate(title, sw - 20))}`,
          sw
        ));
      }
    }

    lines.push("");
    lines.push(truncateToWidth(
      `  ${th.fg("dim", "Cards should never be blocked — split first, ask for help second.")}`,
      sw
    ));
  }
}

// ── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // /kanban command — opens interactive TUI board
  pi.registerCommand("kanban", {
    description: "Open the Kanban board TUI — shows cards, WIP limits, metrics, and blockers",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/kanban requires interactive mode", "info");
        return;
      }

      const state = readBoardState(ctx.cwd);

      await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
        return new KanbanBoardComponent(state, theme, () => done());
      });

      // Refresh state after closing
      const newState = readBoardState(ctx.cwd);
      const stuck = newState.blockers.length;
      const doneCards = newState.cards.filter((c) => c.column === "Done").length;
      ctx.ui.notify(
        `Board: ${newState.cards.length} cards, ${newState.cards.filter((c) => c.column !== "Backlog" && c.column !== "Done").length} in progress, ${doneCards} done${stuck > 0 ? `, ${stuck} split or help-requested` : ""}`,
        "info"
      );
    },
  });

  // Tool for the LLM to render board state inline
  pi.registerTool({
    name: "kanban_board",
    label: "Kanban Board",
    description: "Show the current Kanban board state. Use to check WIP status, view cards, and monitor flow.",
    parameters: Type.Object({
      view: Type.Optional(Type.String({ description: "View type: board (default), metrics, or stuck" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = readBoardState(ctx.cwd);
      return {
        content: [{ type: "text", text: formatBoardText(state) }],
        details: { board: state } as unknown as KanbanDetails,
      };

      function formatBoardText(s: BoardState): string {
        let out = "## Kanban Board\n\n";
        for (const col of s.columns) {
          const colCards = s.cards.filter((c) => c.column === col.name);
          const limitStr = col.wipLimit === -1 ? "∞" : String(col.wipLimit);
          out += `### ${col.name} (${colCards.length}/${limitStr})\n`;
          if (colCards.length === 0) {
            out += "_(empty)_\n";
          } else {
            for (const card of colCards) {
              const stuck = s.blockers.includes(card.id) ? " ✂" : "";
              out += `- ${card.title} [${card.priority}]${stuck}\n`;
            }
          }
          out += "\n";
        }

        const wip = s.cards.filter((c) => c.column !== "Backlog" && c.column !== "Done").length;
        const done = s.cards.filter((c) => c.column === "Done").length;
        out += `---\n**${s.cards.length} total · ${wip} in progress · ${done} done · ${s.blockers.length} split or help-requested**\n`;
        return out;
      },
    },

    renderCall(args, theme, _context) {
      const view = args.view || "board";
      return new Text(
        theme.fg("toolTitle", theme.bold("kanban ")) +
        theme.fg("muted", `[${view}]`),
        0, 0
      );
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as KanbanDetails | undefined;
      if (!details?.board) return new Text(theme.fg("dim", "Board state unavailable"), 0, 0);

      const { board } = details;
      const lines: string[] = [];

      for (const col of board.columns) {
        const colCards = board.cards.filter((c) => c.column === col.name);
        const limitStr = col.wipLimit === -1 ? "∞" : String(col.wipLimit);
        const atLimit = col.wipLimit !== -1 && colCards.length >= col.wipLimit;
        const header = atLimit
          ? theme.fg("warning", `${col.name} (${colCards.length}/${limitStr})`)
          : theme.fg("accent", `${col.name} (${colCards.length}/${limitStr})`);
        lines.push(header);

        for (const card of colCards.slice(0, 3)) {
          const stuck = board.blockers.includes(card.id);
          const prefix = stuck ? theme.fg("warning", "✂ ") : theme.fg("muted", "▪ ");
          lines.push(`  ${prefix}${card.title}`);
        }
        if (colCards.length > 3) {
          lines.push(`  ${theme.fg("dim", `... ${colCards.length - 3} more`)}`);
        }
      }

      const wip = board.cards.filter((c) => c.column !== "Backlog" && c.column !== "Done").length;
      const done = board.cards.filter((c) => c.column === "Done").length;
      lines.push(theme.fg("muted", `${board.cards.length} cards · ${wip} WIP · ${done} done · ${board.blockers.length} split or help-requested`));

      return new Text(lines.join("\n"), 0, 0);
    },
  });

  // Widget showing summary above the editor
  pi.on("session_start", (_event, ctx) => {
    updateWidget(ctx);
  });

  function updateWidget(ctx: ExtensionContext): void {
    const state = readBoardState(ctx.cwd);
    if (state.cards.length === 0) {
      ctx.ui.setWidget("kanban-summary", undefined);
      return;
    }

    const th = ctx.ui.theme;
    const wip = state.cards.filter((c) => c.column !== "Backlog" && c.column !== "Done").length;
    const done = state.cards.filter((c) => c.column === "Done").length;
    const blocked = state.blockers.length;

    // Column summary line
    const colParts = state.columns
      .filter((c) => c.name !== "Backlog" && c.name !== "Done")
      .map((c) => {
        const count = state.cards.filter((card) => card.column === c.name).length;
        const atLimit = c.wipLimit !== -1 && count >= c.wipLimit;
        const color = atLimit ? "warning" : "muted";
        return th.fg(color as "warning" | "muted", `${c.name}:${count}`);
      });

    const blockedStr = blocked > 0
      ? `  ${th.fg("warning", `⏸ ${blocked} blocked`)}`
      : "";

    const summaryLine = `${th.fg("accent", th.bold("📋 Kanban"))}  ${colParts.join(" · ")}  ·  ${th.fg("muted", `done:${done}`)}${blockedStr}`;

    ctx.ui.setWidget("kanban-summary", [summaryLine]);
  }
}
