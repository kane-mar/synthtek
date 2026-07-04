import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Parse a YAML frontmatter key from a markdown file.
 * Matches lines like `key: value` or `key: "quoted value"`.
 */
export function parseFrontmatter(content, key) {
  const pattern = `^${key}:\\s*(.+)$`;
  const match = content.match(new RegExp(pattern, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^"(.*)"$/, "$1");
}

/**
 * Read columns from CONFIG.md.
 * Falls back to defaults if the file is missing or empty.
 */
export function readColumns(kanbanDir) {
  const configPath = join(kanbanDir, "CONFIG.md");
  if (!existsSync(configPath)) {
    return defaultColumns();
  }

  const config = readFileSync(configPath, "utf-8");
  const columns = [];

  for (const line of config.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ") || !trimmed.includes(":")) continue;

    const rest = trimmed.slice(2);
    const colonIdx = rest.lastIndexOf(":");
    if (colonIdx <= 0) continue;

    const name = rest.slice(0, colonIdx).trim();
    const limit = parseInt(rest.slice(colonIdx + 1).trim(), 10);
    if (!isNaN(limit)) {
      columns.push({ name, wipLimit: limit });
    }
  }

  return columns.length > 0 ? columns : defaultColumns();
}

function defaultColumns() {
  return [
    { name: "Backlog", wipLimit: -1 },
    { name: "Ready", wipLimit: 3 },
    { name: "In Progress", wipLimit: 3 },
    { name: "Review", wipLimit: 2 },
    { name: "Done", wipLimit: -1 },
  ];
}

/**
 * Determine a card's column from BOARD.md by finding the section
 * heading that contains the card ID.
 */
export function determineCardColumn(kanbanDir, cardId) {
  const boardPath = join(kanbanDir, "BOARD.md");
  if (!existsSync(boardPath)) return "Backlog";

  const content = readFileSync(boardPath, "utf-8");
  let currentSection = "";

  for (const line of content.split("\n")) {
    if (line.startsWith("## ")) {
      currentSection = line.slice(3).trim();
    }
    // Match bold references like **CARD-001** or table rows like | CARD-001 |
    if (line.includes(`**${cardId}**`) || line.includes(`| ${cardId} `)) {
      return currentSection || "Backlog";
    }
  }

  return "Backlog";
}

/**
 * Read an individual card from its markdown file.
 */
export function readCard(filePath, kanbanDir) {
  const content = readFileSync(filePath, "utf-8");
  const fileName = filePath.split("/").pop() || "";

  const id = fileName.replace(/--.*/, "");
  const title = parseFrontmatter(content, "title") || fileName.replace(/\.md$/, "");

  const descMatch = content.match(/## Description\n(.+?)(?:\n##|\n---|$)/s);
  const description = descMatch ? descMatch[1].trim() : "";

  return {
    id,
    title,
    type: parseFrontmatter(content, "type") || "feature",
    priority: parseFrontmatter(content, "priority") || "medium",
    status: parseFrontmatter(content, "status") || "backlog",
    created: parseFrontmatter(content, "created") || "—",
    started: parseFrontmatter(content, "started") || "—",
    completed: parseFrontmatter(content, "completed") || "—",
    column: determineCardColumn(kanbanDir, id),
    description,
  };
}

/**
 * Read all cards from the CARDS directory.
 */
export function readCards(kanbanDir) {
  const cardsDir = join(kanbanDir, "CARDS");
  if (!existsSync(cardsDir)) return [];

  return readdirSync(cardsDir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => readCard(join(cardsDir, file), kanbanDir));
}

/**
 * Read blockers from BLOCKED.md.
 * Each `## CARD-NNN` heading is a blocker.
 */
export function readBlockers(kanbanDir) {
  const blockersPath = join(kanbanDir, "BLOCKED.md");
  if (!existsSync(blockersPath)) return [];

  const content = readFileSync(blockersPath, "utf-8");
  const blockers = [];

  for (const line of content.split("\n")) {
    const match = line.match(/^##\s+(CARD-\d+)/);
    if (match) blockers.push(match[1]);
  }

  return blockers;
}

/**
 * Read cycle time log entries from METRICS.md.
 */
export function readCycleTimes(kanbanDir) {
  const metricsPath = join(kanbanDir, "METRICS.md");
  if (!existsSync(metricsPath)) return [];

  const content = readFileSync(metricsPath, "utf-8");
  const entries = [];
  let inSection = false;

  for (const line of content.split("\n")) {
    if (line.includes("## Cycle Time Log")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) break;
    if (!inSection || !line.startsWith("|") || !line.includes("CARD-")) continue;

    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 6 && parts[5] !== "Cycle Time" && parts[5] !== "—") {
      entries.push({
        id: parts[1],
        title: parts[2],
        started: parts[3],
        completed: parts[4],
        duration: parts[5],
      });
    }
  }

  return entries;
}

/**
 * Read lead time log entries from METRICS.md.
 */
export function readLeadTimes(kanbanDir) {
  const metricsPath = join(kanbanDir, "METRICS.md");
  if (!existsSync(metricsPath)) return [];

  const content = readFileSync(metricsPath, "utf-8");
  const entries = [];
  let inSection = false;

  for (const line of content.split("\n")) {
    if (line.includes("## Lead Time Log")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) break;
    if (!inSection || !line.startsWith("|") || !line.includes("CARD-")) continue;

    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 6 && parts[5] !== "Lead Time" && parts[5] !== "—") {
      entries.push({
        id: parts[1],
        title: parts[2],
        created: parts[3],
        completed: parts[4],
        duration: parts[5],
      });
    }
  }

  return entries;
}

/**
 * Compute throughput counts from archived cards.
 */
export function readThroughput(kanbanDir) {
  const archivedDir = join(kanbanDir, "ARCHIVED");
  if (!existsSync(archivedDir)) return { throughput7d: 0, throughput30d: 0 };

  const now = Date.now();
  let archived7d = 0;
  let archived30d = 0;

  for (const file of readdirSync(archivedDir).filter((f) => f.endsWith(".md"))) {
    const content = readFileSync(join(archivedDir, file), "utf-8");
    const completed = parseFrontmatter(content, "completed");
    if (!completed || completed === "—") continue;

    try {
      const ts = new Date(completed).getTime();
      const daysAgo = (now - ts) / (1000 * 60 * 60 * 24);
      if (daysAgo <= 7) archived7d++;
      if (daysAgo <= 30) archived30d++;
    } catch {
      // Skip unparseable dates
    }
  }

  return { throughput7d: archived7d, throughput30d: archived30d };
}

/**
 * Read the complete board state from a project's .kanban directory.
 *
 * @param {string} cwd - Path to the project root (containing .kanban/)
 * @returns {object} Board state with columns, cards, blockers, metrics
 */
export function readBoardState(cwd) {
  const kanbanDir = join(cwd, ".kanban");

  const columns = readColumns(kanbanDir);
  const cards = readCards(kanbanDir);
  const blockers = readBlockers(kanbanDir);
  const cycleTimes = readCycleTimes(kanbanDir);
  const leadTimes = readLeadTimes(kanbanDir);
  const { throughput7d, throughput30d } = readThroughput(kanbanDir);

  return {
    columns,
    cards,
    blockers,
    cycleTimes,
    leadTimes,
    throughput7d,
    throughput30d,
  };
}

/**
 * Parse a duration string like "3d 0h", "2d 5h", "1d" into total hours.
 */
export function parseDuration(str) {
  if (!str || str === "—") return null;
  let hours = 0;
  const dMatch = str.match(/(\d+)d/);
  if (dMatch) hours += parseInt(dMatch[1], 10) * 24;
  const hMatch = str.match(/(\d+)h/);
  if (hMatch) hours += parseInt(hMatch[1], 10);
  const mMatch = str.match(/(\d+)m/);
  if (mMatch) hours += Math.round(parseInt(mMatch[1], 10) / 60);
  return hours;
}

/**
 * Format hours back to a human-readable duration string.
 */
export function formatDurationHours(hours) {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (d > 0 && h > 0) return `${d}d ${h}h`;
  if (d > 0) return `${d}d`;
  return `${h}h`;
}

/**
 * Truncate a string to max length, adding "…" at the end if truncated.
 */
export function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str || "";
  return str.slice(0, maxLength - 1) + "…";
}
