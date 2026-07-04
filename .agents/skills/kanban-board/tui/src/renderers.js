import { truncate, parseDuration, formatDurationHours } from "./board-state.js";

// ── Style Constants ──

const PRIORITY_COLORS = {
  high: "red",
  medium: "yellow",
  low: "blue",
};

const TYPE_ICONS = {
  feature: "⭐",
  bug: "🐛",
  chore: "⚙️",
  improvement: "📈",
  epic: "📋",
  user_story: "📖",
};

function priorityColor(priority) {
  return PRIORITY_COLORS[priority] || "white";
}

function typeIcon(type) {
  return TYPE_ICONS[type] || "📌";
}

// ── Status Bar ──

export function renderStatusBar(state) {
  const { cards, columns, blockers } = state;
  const totalCards = cards.length;
  const wipCards = cards.filter(
    (c) => c.column !== "Backlog" && c.column !== "Done"
  ).length;
  const doneCards = cards.filter((c) => c.column === "Done").length;
  const stuckCount = blockers.length;

  const colSummary = columns
    .filter((c) => c.name !== "Backlog" && c.name !== "Done")
    .map((c) => {
      const count = cards.filter((card) => card.column === c.name).length;
      const limitStr = c.wipLimit === -1 ? "∞" : String(c.wipLimit);
      const atLimit = c.wipLimit !== -1 && count >= c.wipLimit;
      return `${c.name} ${count}/${limitStr}${atLimit ? "⚠" : "·"}`;
    })
    .join(" │ ");

  const stuckStr = stuckCount > 0 ? ` ⏸${stuckCount}` : "";

  return (
    ` {bold}📋 KANBAN{/bold}  │  ` +
    `Total: ${totalCards}  │  ` +
    `WIP: ${wipCards}  │  ` +
    `Done: ${doneCards}${stuckStr}  │  ` +
    `${colSummary}`
  );
}

// ── Help Bar ──

export function renderHelpBar(view) {
  const helpByView = {
    board:
      " [b]oard  [m]etrics  b[s]tuck  ↑↓/jk navigate  [enter] detail  [r]efresh  [p] sort  [q]uit",
    metrics: " [b]oard  [m]etrics  b[s]tuck  [r]efresh  [q]uit",
    blockers: " [b]oard  [m]etrics  b[s]tuck  [r]efresh  [q]uit",
    detail: " [esc] back  [q]uit",
  };

  const text = helpByView[view] || helpByView.board;
  return ` {bold}${text}{/bold} `;
}

// ── Board View ──

/**
 * Sort cards by priority (high first, then medium, then low),
 * then by ID for stability.
 */
function sortByPriority(cards) {
  const order = { high: 0, urgent: 0, critical: 0, medium: 1, low: 2 };
  return [...cards].sort((a, b) => {
    const pa = order[a.priority] !== undefined ? order[a.priority] : 2;
    const pb = order[b.priority] !== undefined ? order[b.priority] : 2;
    return pa !== pb ? pa - pb : a.id.localeCompare(b.id);
  });
}

function renderColumnHeaders(columns, cards, colW) {
  let line = " ";
  for (const col of columns) {
    const count = cards.filter((c) => c.column === col.name).length;
    const limitStr = col.wipLimit === -1 ? "∞" : String(col.wipLimit);
    const atLimit = col.wipLimit !== -1 && count >= col.wipLimit;
    const contentStr = ` ${col.name} (${count}/${limitStr})`;
    const maxVisible = colW - 2;
    const truncated = truncate(contentStr, maxVisible);

    const label = atLimit
      ? `{bold}{red-fg}⚠${truncated}{/red-fg}{/bold}`
      : ` ${truncated}`;

    line += label.padEnd(colW);
  }
  return line;
}

function renderWipBarRow(columns, cards, colW) {
  let line = " ";
  for (const col of columns) {
    const count = cards.filter((c) => c.column === col.name).length;
    const barWidth = Math.max(3, colW - 4);

    if (col.wipLimit === -1) {
      line += "(no limit)".padEnd(colW);
      continue;
    }

    const pct = Math.round((count / col.wipLimit) * 100);
    const barChars = Math.min(barWidth, Math.round((count / col.wipLimit) * barWidth));
    const fillColor =
      pct >= 100 ? "{red-fg}" : pct >= 75 ? "{yellow-fg}" : "{green-fg}";
    const closeTag = `{/${fillColor.replace("{", "").replace("}", "")}}`;
    const barFull = "█".repeat(barChars) + "░".repeat(barWidth - barChars);
    const pctStr = `${pct}%`.padStart(4);

    line += (fillColor + barFull + closeTag + pctStr).padEnd(colW);
  }
  return line;
}

function renderSeparator(lineW, maxWidth) {
  const count = Math.max(0, Math.min(lineW - 1, maxWidth - 2));
  return " " + "─".repeat(count);
}

function countCardRows(columns, cards) {
  let max = 0;
  for (const col of columns) {
    const colCards = cards.filter((c) => c.column === col.name);
    max = Math.max(max, colCards.length);
  }
  return max;
}

function renderCardRow(rowIndex, columns, cards, blockers, selectedCardId, colW) {
  let row = " ";
  for (const col of columns) {
    const colCards = sortByPriority(cards.filter((c) => c.column === col.name));
    const card = colCards[rowIndex];
    const isEmpty = rowIndex === 0 && colCards.length === 0;

    if (isEmpty) {
      row += "(empty)" + " ".repeat(Math.max(0, colW - 7));
      continue;
    }

    if (!card) {
      row += " ".repeat(colW);
      continue;
    }

    const isSelected = selectedCardId === card.id;
    const isBlocked = blockers.includes(card.id);
    row += buildCardCell(card, isSelected, isBlocked, colW);
  }
  return row;
}

function buildCardCell(card, isSelected, isBlocked, colW) {
  const pColor = priorityColor(card.priority);
  const maxTitleLen = Math.max(3, colW - 10);
  const shortTitle = truncate(card.title, maxTitleLen);
  const marker = isBlocked ? "{red-fg}⏸{/red-fg}" : "{white-fg}▪{/white-fg}";

  let cell = marker + " ";
  if (isSelected) {
    cell += "{white-bg}{black-fg}";
  }
  cell += `{${pColor}-fg}${shortTitle}{/${pColor}-fg}`;
  if (isSelected) {
    cell += "{/white-bg}{/black-fg}";
  }
  cell += ` ${card.id}`;

  const visibleLen = 2 + shortTitle.length + card.id.length + 1;
  const padding = Math.max(0, colW - visibleLen);
  return cell + " ".repeat(padding);
}

function renderBoardFooter(cards, blockers, sortByPriority, selectedCard) {
  const lines = [];
  lines.push("");

  const totalCards = cards.length;
  const wipCards = cards.filter(
    (c) => c.column !== "Backlog" && c.column !== "Done"
  ).length;
  const doneCards = cards.filter((c) => c.column === "Done").length;
  const stuckCount = blockers.length;
  const sortLabel = sortByPriority ? "sorted by priority" : "sorted by ID";

  const stuckText =
    stuckCount > 0
      ? `{red-fg}${stuckCount} split or help-requested{/red-fg}`
      : "{green-fg}0 stuck{/green-fg}";

  lines.push(
    ` {bold}{cyan-fg}${totalCards}{/cyan-fg}{/bold} total · ` +
    `{yellow-fg}${wipCards}{/yellow-fg} in progress · ` +
    `{green-fg}${doneCards}{/green-fg} done · ` +
    `${stuckText} · ${sortLabel}`
  );

  if (selectedCard) {
    const card = cards.find((c) => c.id === selectedCard);
    if (card) {
      const pColor = priorityColor(card.priority);
      lines.push("");
      lines.push(
        ` {bold}Selected:{/bold} ${card.id} — ${card.title}  ` +
        `{${pColor}-fg}[${card.priority}]{/${pColor}-fg}  ` +
        `${card.type}  ·  ${card.column}`
      );
    }
  }

  return lines;
}

export function renderBoardView(state, width, selectedCardId, sortByPriority) {
  const { columns, cards, blockers } = state;
  const colW = Math.max(15, Math.floor((width - 4) / columns.length));
  const lineW = columns.length * colW + 2;

  const lines = [];
  lines.push(renderColumnHeaders(columns, cards, colW));
  lines.push(renderWipBarRow(columns, cards, colW));
  lines.push(renderSeparator(lineW, width));

  const maxRows = countCardRows(columns, cards);
  for (let i = 0; i < maxRows; i++) {
    lines.push(renderCardRow(i, columns, cards, blockers, selectedCardId, colW));
  }

  lines.push(...renderBoardFooter(cards, blockers, sortByPriority, selectedCardId));
  return lines;
}

// ── Metrics View ──

function renderThroughputSection(throughput7d, throughput30d) {
  const lines = [];
  lines.push("");
  lines.push(" {bold}Throughput{/bold}");
  lines.push(
    `   Last 7 days:  {bold}{green-fg}${throughput7d}{/green-fg}{/bold} PBIs completed`
  );
  lines.push(
    `   Last 30 days: {bold}{green-fg}${throughput30d}{/green-fg}{/bold} PBIs completed`
  );
  return lines;
}

function renderWipSection(columns, cards) {
  const lines = [];
  lines.push("");
  lines.push(" {bold}WIP Count{/bold}");

  const activeCols = columns.filter(
    (c) => c.name !== "Backlog" && c.name !== "Done"
  );

  for (const col of activeCols) {
    const count = cards.filter((c) => c.column === col.name).length;
    const limitStr = col.wipLimit === -1 ? "∞" : String(col.wipLimit);
    const atLimit = col.wipLimit !== -1 && count >= col.wipLimit;
    const color = atLimit ? "red" : count > 0 ? "yellow" : "green";

    const barW = 20;
    const fillCount =
      col.wipLimit > 0
        ? Math.min(Math.round((count / col.wipLimit) * barW), barW)
        : 0;
    const barStr =
      fillCount > 0
        ? "{red-fg}" + "█".repeat(fillCount)
        : "";
    const emptyStr = "░".repeat(Math.max(0, barW - fillCount));

    lines.push(
      `   {${color}-fg}●{/${color}-fg} ${col.name.padEnd(16)} ${count}/${limitStr}  ${barStr}${emptyStr}`
    );
  }

  return lines;
}

function renderCycleTimeSection(cycleTimes) {
  const lines = [];
  lines.push("");
  lines.push(" {bold}Cycle Times{/bold}");

  if (cycleTimes.length === 0) {
    lines.push("   No completed cards yet.");
    return lines;
  }

  const recent = cycleTimes.slice(-10);
  lines.push("   Card         │ Duration   │ Completed");
  lines.push("   ────────────┼────────────┼──────────");

  for (const ct of recent) {
    lines.push(
      `   {green-fg}●{/green-fg} ${ct.id.padEnd(12)}│ ${ct.duration.padEnd(10)}│ ${ct.completed || "—"}`
    );
  }

  if (cycleTimes.length > 10) {
    lines.push(`   ... ${cycleTimes.length - 10} more (showing last 10)`);
  }

  const durations = cycleTimes
    .map((c) => parseDuration(c.duration))
    .filter((d) => d !== null);
  if (durations.length > 0) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    lines.push("");
    lines.push(`   Average cycle time: {bold}${formatDurationHours(avg)}{/bold}`);
  }

  return lines;
}

function renderLeadTimeSection(leadTimes) {
  const lines = [];
  lines.push("");
  lines.push(" {bold}Lead Times{/bold}");

  if (leadTimes.length === 0) {
    lines.push("   No completed cards yet.");
    return lines;
  }

  const recent = leadTimes.slice(-10);
  lines.push("   Card         │ Duration   │ Created   ");
  lines.push("   ────────────┼────────────┼───────────");

  for (const lt of recent) {
    lines.push(
      `   {blue-fg}●{/blue-fg} ${lt.id.padEnd(12)}│ ${lt.duration.padEnd(10)}│ ${lt.created || "—"}`
    );
  }

  if (leadTimes.length > 10) {
    lines.push(`   ... ${leadTimes.length - 10} more (showing last 10)`);
  }

  return lines;
}

function renderCardDistribution(columns, cards, width) {
  const lines = [];
  lines.push("");
  lines.push(" {bold}Card Distribution{/bold}");

  const totalCards = cards.length;
  const barW = Math.min(30, Math.floor((width - 30) / 2));

  for (const col of columns) {
    const count = cards.filter((c) => c.column === col.name).length;
    const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
    const fill = Math.min(barW, Math.round((count / Math.max(1, totalCards)) * barW));

    const barStr =
      "{cyan-fg}" +
      "█".repeat(fill) +
      "{/cyan-fg}" +
      "░".repeat(Math.max(0, barW - fill));

    lines.push(
      `   ${col.name.padEnd(16)} ${String(count).padStart(2)} ${barStr} ${pct}%`
    );
  }

  return lines;
}

export function renderMetricsView(state, width) {
  const {
    columns,
    cards,
    cycleTimes,
    leadTimes,
    throughput7d,
    throughput30d,
  } = state;

  const lines = [];
  lines.push("");
  lines.push(" {bold}{cyan-fg}📊 Metrics Dashboard{/cyan-fg}{/bold}");
  lines.push(" " + "─".repeat(Math.min(width - 2, 78)));

  lines.push(...renderThroughputSection(throughput7d, throughput30d));
  lines.push(...renderWipSection(columns, cards));
  lines.push(...renderCycleTimeSection(cycleTimes));
  lines.push(...renderLeadTimeSection(leadTimes));
  lines.push(...renderCardDistribution(columns, cards, width));

  return lines;
}

// ── Blockers View ──

export function renderBlockersView(state, width) {
  const { blockers, cards } = state;
  const lines = [];

  lines.push("");
  lines.push(" {bold}{red-fg}⏸ Stuck Work{/red-fg}{/bold}");
  lines.push(" " + "─".repeat(Math.min(width - 2, 78)));

  if (blockers.length === 0) {
    lines.push("");
    lines.push("   {green-fg}✓ No stuck work{/green-fg}");
    lines.push("");
    lines.push("   Cards should never be blocked — split first, ask for help second.");
    return lines;
  }

  lines.push("");
  for (const blockerId of blockers) {
    const card = cards.find((c) => c.id === blockerId);
    const title = card ? card.title : "Unknown";
    const priority = card ? card.priority : "medium";
    const pColor = priorityColor(priority);

    lines.push("");
    lines.push(
      `   {red-fg}✂{/red-fg} {bold}{white-fg}${blockerId}{/white-fg}{/bold} — ${title}`
    );

    if (card) {
      lines.push(
        `      Type: ${card.type}  Priority: {${pColor}-fg}${card.priority}{/${pColor}-fg}  ` +
        `Status: {yellow-fg}${card.status}{/yellow-fg}`
      );
      if (card.description) {
        lines.push(`      ${truncate(card.description, width - 10)}`);
      }
    }
  }

  lines.push("");
  lines.push(
    "   {yellow-fg}⚠ These cards have been split but still need attention.{/yellow-fg}"
  );

  return lines;
}

// ── Detail View ──

export function renderDetailView(state, selectedCardId, width) {
  const card = state.cards.find((c) => c.id === selectedCardId);
  if (!card) return [];

  const pColor = priorityColor(card.priority);
  const icon = typeIcon(card.type);
  const isBlocked = state.blockers.includes(card.id);
  const lines = [];

  lines.push("");
  lines.push(` {bold}${icon} Card Detail{/bold}`);
  lines.push(" " + "─".repeat(Math.min(width - 2, 78)));

  lines.push("");
  lines.push(`   {bold}ID:{/bold}       ${card.id}`);
  lines.push(`   {bold}Title:{/bold}    ${card.title}`);
  lines.push(`   {bold}Type:{/bold}     ${card.type}`);
  lines.push(`   {bold}Priority:{/bold} {${pColor}-fg}${card.priority}{/${pColor}-fg}`);
  lines.push(`   {bold}Status:{/bold}   {yellow-fg}${card.status}{/yellow-fg}`);
  lines.push(`   {bold}Column:{/bold}   ${card.column}`);
  lines.push(`   {bold}Created:{/bold}  ${card.created}`);
  lines.push(`   {bold}Started:{/bold}  ${card.started}`);
  lines.push(`   {bold}Completed:{/bold} ${card.completed}`);

  if (isBlocked) {
    lines.push(
      `   {bold}Stuck:{/bold}   {red-fg}Yes — split or help-requested{/red-fg}`
    );
  }

  if (card.description) {
    lines.push("");
    lines.push("   {bold}Description:{/bold}");
    for (const descLine of card.description.split("\n")) {
      lines.push(`     ${descLine}`);
    }
  }

  lines.push("");
  lines.push("   [esc] Back to board   [q] Quit");

  return lines;
}
