import blessed from "blessed";
import chokidar from "chokidar";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readBoardState } from "./board-state.js";
import {
  renderBoardView,
  renderMetricsView,
  renderBlockersView,
  renderDetailView,
  renderStatusBar,
  renderHelpBar,
} from "./renderers.js";

export class KanbanTUI {
  constructor(cwd) {
    this.cwd = cwd;
    this.currentView = "board";
    this.selectedCardId = null;
    this.state = readBoardState(cwd);
    this.sortByPriority = true;

    this._initScreen();
    this._initLayout();
    this._initKeyboard();
    this._initFileWatcher();
    this._render();
  }

  // ── Screen Setup ──

  _initScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Kanban Board",
      cursor: { artificial: true, shape: "underline", blink: true },
      dockBorders: true,
      fullUnicode: true,
      terminal: process.env.TERM || "xterm-256color",
    });

    this.screen.key(["C-c"], () => this._quit());
    this.screen.on("resize", () => {
      this._layout();
      this._render();
    });
  }

  _initLayout() {
    this.statusBar = blessed.box({
      top: 0,
      left: 0,
      width: "100%",
      height: 1,
      tags: true,
      style: { fg: "white", bg: "blue" },
    });

    this.boardBox = blessed.box({
      top: 1,
      left: 0,
      width: "100%",
      height: "100%-2",
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: "│",
        track: { bg: "black" },
        style: { bg: "gray" },
      },
      style: { fg: "white", bg: "black" },
    });

    this.helpBar = blessed.box({
      bottom: 0,
      left: 0,
      width: "100%",
      height: 1,
      tags: true,
      style: { fg: "black", bg: "white" },
    });

    this.screen.append(this.statusBar);
    this.screen.append(this.boardBox);
    this.screen.append(this.helpBar);
    this._layout();
  }

  _layout() {
    if (!this.screen.width || !this.screen.height) return;
    this.boardBox.height = Math.max(1, this.screen.height - 2);
  }

  // ── Keyboard ──

  _initKeyboard() {
    const handlers = {
      q: () => this._quit(),
      escape: () => this._onEscape(),
      b: () => this._switchView("board"),
      m: () => this._switchView("metrics"),
      s: () => this._switchView("blockers"),
      enter: () => this._onEnter(),
      up: () => this._navigate(-1),
      down: () => this._navigate(1),
      k: () => this._navigate(-1),
      j: () => this._navigate(1),
      r: () => this._refresh(),
      p: () => this._toggleSort(),
    };

    for (const [key, handler] of Object.entries(handlers)) {
      this.screen.key(key, handler);
    }
  }

  _onEscape() {
    if (this.currentView === "detail") {
      this.currentView = "board";
      this._render();
    }
  }

  _switchView(view) {
    this.currentView = view;
    this.selectedCardId = null;
    this._render();
  }

  _onEnter() {
    if (this.currentView === "board" && this.selectedCardId) {
      this.currentView = "detail";
      this._render();
    }
  }

  _navigate(direction) {
    if (this.currentView !== "board") return;

    const ordered = this._orderedCards();
    if (ordered.length === 0) return;

    const index = this.selectedCardId
      ? ordered.findIndex((c) => c.id === this.selectedCardId)
      : -1;

    const nextIndex = Math.max(0, Math.min(ordered.length - 1, index + direction));
    this.selectedCardId = ordered[nextIndex].id;
    this._render();
  }

  _orderedCards() {
    const { columns, cards } = this.state;
    const result = [];

    for (const column of columns) {
      const colCards = cards.filter((c) => c.column === column.name);
      const ordered = this.sortByPriority
        ? this._sortByPriority(colCards)
        : colCards;
      result.push(...ordered);
    }

    return result;
  }

  _sortByPriority(cards) {
    const order = { high: 0, urgent: 0, critical: 0, medium: 1, low: 2 };
    return [...cards].sort((a, b) => {
      const pa = order[a.priority] !== undefined ? order[a.priority] : 2;
      const pb = order[b.priority] !== undefined ? order[b.priority] : 2;
      return pa !== pb ? pa - pb : a.id.localeCompare(b.id);
    });
  }

  _toggleSort() {
    this.sortByPriority = !this.sortByPriority;
    this._render();
  }

  _refresh() {
    this.state = readBoardState(this.cwd);
    this._render();
  }

  _quit() {
    this.watcher?.close();
    this.screen.destroy();
    process.exit(0);
  }

  // ── File Watcher ──

  _initFileWatcher() {
    const kanbanDir = join(this.cwd, ".kanban");
    if (!existsSync(kanbanDir)) return;

    this.watcher = chokidar.watch(kanbanDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 3,
    });

    const debouncedRefresh = () => {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this.state = readBoardState(this.cwd);
        this._render();
        this._debounceTimer = null;
      }, 100);
    };

    this.watcher.on("change", debouncedRefresh);
    this.watcher.on("add", debouncedRefresh);
    this.watcher.on("unlink", debouncedRefresh);
    this.watcher.on("error", () => {});
  }

  // ── Rendering ──

  _render() {
    this.statusBar.setContent(renderStatusBar(this.state));
    this.helpBar.setContent(renderHelpBar(this.currentView));

    const width = Math.max(20, this.boardBox.width || 80);
    const renderers = {
      board: () =>
        renderBoardView(this.state, width, this.selectedCardId, this.sortByPriority),
      metrics: () => renderMetricsView(this.state, width),
      blockers: () => renderBlockersView(this.state, width),
      detail: () => renderDetailView(this.state, this.selectedCardId, width),
    };

    const renderFn = renderers[this.currentView] || renderers.board;
    const lines = renderFn();

    this.boardBox.setContent(lines.join("\n"));
    this.screen.render();
  }
}
