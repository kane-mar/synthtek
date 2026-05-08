/**
 * WebUI Frontend Core App
 * 
 * Main application controller managing navigation, authentication,
 * theme, notifications, and rendering.
 */

import type {
  ThemeConfig,
  ThemeMode,
  AppState,
  PageName,
  NotificationItem,
} from './types.js';
import { HashRouter } from './router.js';

const VALID_PAGES: PageName[] = ['chat', 'dashboard', 'plugins', 'config', 'sessions', 'media'];
const MAX_NOTIFICATIONS = 25;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;

function generateId(): string {
  return `_${Math.random().toString(36).slice(2, 11)}`;
}

export class FrontendApp {
  public readonly state: AppState;
  private readonly router: HashRouter;

  constructor(theme: ThemeConfig) {
    this.router = new HashRouter({
      defaultPage: 'chat',
      validPages: VALID_PAGES,
    });

    this.state = {
      currentPage: this.router.currentPage,
      activeSessionId: null,
      theme,
      isAuthenticated: false,
      notifications: [],
    };

    // Sync router page changes with app state
    this.router.onPageChange((page) => {
      this.state.currentPage = page;
    });

    (window as unknown as Record<string, unknown>).app = this;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  navigate(page: PageName): void {
    this.router.navigate(page);
    this.state.currentPage = this.router.currentPage;
  }

  // ── Authentication ─────────────────────────────────────────────────────────

  authenticate(apiKey: string): boolean {
    if (!apiKey || apiKey.length === 0) {
      return false;
    }
    this.state.isAuthenticated = true;
    return true;
  }

  logout(): void {
    this.state.isAuthenticated = false;
    this.state.activeSessionId = null;
  }

  // ── Theme Management ───────────────────────────────────────────────────────

  setThemeMode(mode: ThemeMode): void {
    this.state.theme.mode = mode;
  }

  setPrimaryColor(color: string): void {
    this.state.theme.primaryColor = color;
  }

  setFontSize(size: number): void {
    this.state.theme.fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  addNotification(type: NotificationItem['type'], message: string): void {
    if (this.state.notifications.length >= MAX_NOTIFICATIONS) {
      this.state.notifications.shift();
    }

    const notification: NotificationItem = {
      id: generateId(),
      type,
      message,
      timestamp: Date.now(),
      dismissed: false,
    };

    this.state.notifications.push(notification);
  }

  dismissNotification(id: string): void {
    for (const notification of this.state.notifications) {
      if (notification.id === id) {
        notification.dismissed = true;
        return;
      }
    }
  }

  clearNotifications(): void {
    this.state.notifications = [];
  }

  // ── Session Management ─────────────────────────────────────────────────────

  setActiveSession(sessionId: string): void {
    this.state.activeSessionId = sessionId;
  }

  clearActiveSession(): void {
    this.state.activeSessionId = null;
  }

  // ── State ──────────────────────────────────────────────────────────────────

  getState(): Readonly<AppState> {
    return this.state;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  render(): string {
    const themeClass = this.state.theme.mode === 'dark' ? 'theme-dark' : 'theme-light';

    return `<!DOCTYPE html>
<html lang="en" class="${themeClass}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Synthtek WebUI</title>
  <style>
    :root {
      --primary-color: ${this.state.theme.primaryColor};
      --font-size: ${this.state.theme.fontSize}px;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: var(--font-size);
      margin: 0;
      padding: 0;
    }
    .theme-dark {
      background-color: #1a1a2e;
      color: #e0e0e0;
    }
    .theme-light {
      background-color: #ffffff;
      color: #1a1a1a;
    }
  </style>
</head>
<body>
  <header>
    <h1>synthtek</h1>
    <nav>
      ${this.router.renderNavLinks()}
    </nav>
  </header>
  <main>
    ${this.renderPage()}
  </main>
  <footer>
    <p>Synthtek AI Agent Framework</p>
  </footer>
</body>
</html>`;
  }

  private renderPage(): string {
    switch (this.state.currentPage) {
      case 'chat':
        return '<div id="chat-page"><h2>Chat</h2><p>Select a session to start chatting.</p></div>';
      case 'dashboard':
        return '<div id="dashboard-page"><h2>Dashboard</h2><p>System metrics and status.</p></div>';
      case 'plugins':
        return '<div id="plugins-page"><h2>Plugins</h2><p>Manage installed plugins.</p></div>';
      case 'config':
        return '<div id="config-page"><h2>Configuration</h2><p>Edit system settings.</p></div>';
      case 'sessions':
        return '<div id="sessions-page"><h2>Sessions</h2><p>Manage active sessions.</p></div>';
      case 'media':
        return '<div id="media-page"><h2>Media</h2><p>Preview uploaded media.</p></div>';
      default:
        return '<div><p>Page not found</p></div>';
    }
  }
}
