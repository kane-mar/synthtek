#!/usr/bin/env node
/**
 * Standalone Kanban Board TUI
 *
 * A real-time, keyboard-navigable Kanban board that runs in its own terminal.
 * Watches .kanban/ files for changes and updates the display live.
 *
 * Usage:
 *   node index.js [project-path]
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KanbanTUI } from "./src/tui.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function main() {
  const cwd = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : process.cwd();

  const kanbanDir = join(cwd, ".kanban");
  if (!existsSync(kanbanDir)) {
    console.error("");
    console.error("  ⚠  No Kanban board found in:", cwd);
    console.error("     Expected .kanban/ directory with CONFIG.md, BOARD.md, CARDS/, etc.");
    console.error("");
    console.error("  Usage: node", process.argv[1], "[project-path]");
    console.error("");
    process.exit(1);
  }

  console.error("  📋 Starting Kanban Board TUI...");
  console.error("     Watching:", kanbanDir);
  console.error("");

  new KanbanTUI(cwd);
}

main();
