# Kanban Board TUI — Standalone Terminal UI

A real-time, keyboard-navigable Kanban board that runs in its **own terminal tab** — completely independent of pi.

## Quick Start

```bash
# 1. Install dependencies
cd /path/to/kanban-board/tui
npm install

# 2. Run from your project directory (where .kanban/ lives)
cd /path/to/your-project
node /path/to/kanban-board/tui/index.js

# Or specify the project path as an argument
node /path/to/kanban-board/tui/index.js /path/to/your-project
```

## Features

- **Real-time updates** — watches `.kanban/` files with `chokidar`; board refreshes as cards move
- **Four views**: Board, Metrics, Blockers, Card Detail
- **Key navigation**: arrow keys or `j/k` to navigate cards, `[enter]` for detail
- **WIP limit indicators**: color-coded bars show how full each column is
- **Priority display**: cards are color-coded by priority (high=red, medium=yellow, low=blue)
- **Throughput metrics**: cycle times, lead times, 7-day and 30-day throughput
- **Stuck work view**: shows cards that have been split or need help
- **Terminal resize**: handles window resizing gracefully

## Keyboard Shortcuts

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

## Example

```bash
# Terminal tab 1: work on your project
cd ~/my-project
# ... cards move as you work ...

# Terminal tab 2: watch the board in real-time
cd ~/my-project
node /path/to/kanban-board/tui/index.js
```

Cards will appear, move, and update live as you work in the other tab.

## Architecture

```
tui/
  package.json     — Dependencies (blessed + chokidar)
  index.js         — Main TUI application (~700 lines)
  README.md        — This file
```

- **`blessed`** — Terminal UI library for Node.js (widgets, layouts, colors)
- **`chokidar`** — File system watcher (replaces fs.watch with better cross-platform support)
