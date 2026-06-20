/**
 * WebUI Frontend Core App
 *
 * Main application controller managing navigation, authentication,
 * theme, notifications, and rendering.
 */

import { HashRouter } from "./router.js";
import type {
	AppState,
	NotificationItem,
	PageName,
	ThemeConfig,
	ThemeMode,
} from "./types.js";

const VALID_PAGES: PageName[] = [
	"chat",
	"plugins",
	"config",
	"sessions",
	"media",
	"analytics",
];
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
			defaultPage: "chat",
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
		this.state.theme.fontSize = Math.max(
			MIN_FONT_SIZE,
			Math.min(MAX_FONT_SIZE, size),
		);
	}

	// ── Notifications ──────────────────────────────────────────────────────────

	addNotification(type: NotificationItem["type"], message: string): void {
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

	// ── Theme Toggle ───────────────────────────────────────────────────────────

	toggleTheme(): void {
		const newMode: ThemeMode =
			this.state.theme.mode === "dark" ? "light" : "dark";
		this.setThemeMode(newMode);
		this.addNotification("info", `Switched to ${newMode} mode`);
	}

	// ── Event Listener Initialization ──────────────────────────────────────────

	/**
	 * Generate the inline script that wires up all button click handlers.
	 * This is injected into the rendered HTML to make the UI interactive.
	 */
	initEventListenersScript(): string {
		return `<script>
(function() {
  var app = window.app;
  if (!app) return;

  // ── Navigation (delegated) ──────────────────────────────────────────────
  document.querySelector('nav')?.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    var href = link.getAttribute('href');
    if (!href) return;
    var page = href.replace(/^#/, '').replace(/\\/$/, '');
    if (page) app.navigate(page);
  });

  // ── Theme Toggle ────────────────────────────────────────────────────────
  document.getElementById('theme-toggle')?.addEventListener('click', function() {
    app.toggleTheme();
  });

  // ── Authentication ──────────────────────────────────────────────────────
  document.getElementById('login-btn')?.addEventListener('click', function() {
    var input = document.getElementById('api-key-input');
    var key = input ? input.value.trim() : '';
    if (app.authenticate(key)) {
      app.addNotification('success', 'Authenticated successfully');
    } else {
      app.addNotification('error', 'Authentication failed: invalid API key');
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', function() {
    app.logout();
    app.addNotification('info', 'Logged out');
  });

  // ── Chat Send ───────────────────────────────────────────────────────────
  document.getElementById('send-button')?.addEventListener('click', function() {
    var input = document.getElementById('message-input');
    var content = input ? input.value.trim() : '';
    if (!content) return;
    if (app.state.activeSessionId) {
      app.addNotification('info', 'Message sent to session ' + app.state.activeSessionId);
    } else {
      app.addNotification('warning', 'No active session selected');
    }
    if (input) input.value = '';
  });

  // Allow Enter key to send messages
  document.getElementById('message-input')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('send-button')?.click();
    }
  });

  // ── Session Select ──────────────────────────────────────────────────────
  document.getElementById('session-select')?.addEventListener('change', function() {
    var value = this.value;
    if (value) {
      app.setActiveSession(value);
      app.addNotification('info', 'Switched to session ' + value);
    } else {
      app.clearActiveSession();
    }
  });

  // ── Plugin Toggle (delegated) ───────────────────────────────────────────
  document.querySelector('.plugin-list')?.addEventListener('change', function(e) {
    var checkbox = e.target.closest('input.plugin-toggle');
    if (!checkbox) return;
    var card = checkbox.closest('.plugin-card');
    var nameEl = card ? card.querySelector('.plugin-name') : null;
    var name = nameEl ? nameEl.textContent : '';
    if (!name) return;
    if (checkbox.checked) {
      app.addNotification('success', 'Plugin "' + name + '" enabled');
    } else {
      app.addNotification('info', 'Plugin "' + name + '" disabled');
    }
  });

  // ── Session Delete (delegated) ──────────────────────────────────────────
  document.querySelector('.session-list')?.addEventListener('click', function(e) {
    var btn = e.target.closest('.session-delete-btn');
    if (!btn) return;
    var card = btn.closest('.session-card');
    var idEl = card ? card.querySelector('.session-id') : null;
    var id = idEl ? idEl.textContent : '';
    if (id && confirm('Delete session ' + id + '?')) {
      app.addNotification('info', 'Session ' + id + ' deleted');
    }
  });

  // ── Config Save ─────────────────────────────────────────────────────────
  document.getElementById('config-save-btn')?.addEventListener('click', function() {
    app.addNotification('success', 'Configuration saved');
  });

  // ── Notification Dismiss (delegated) ────────────────────────────────────
  document.querySelector('.notifications-container')?.addEventListener('click', function(e) {
    var btn = e.target.closest('.notification-dismiss');
    if (!btn) return;
    var notification = btn.closest('.notification-item');
    var idEl = notification ? notification.querySelector('.notification-id') : null;
    var id = idEl ? idEl.dataset.id : '';
    if (id) app.dismissNotification(id);
  });

  // ── Media Remove (delegated) ────────────────────────────────────────────
  document.querySelector('.media-grid')?.addEventListener('click', function(e) {
    var btn = e.target.closest('.media-remove-btn');
    if (!btn) return;
    var item = btn.closest('.media-item');
    var nameEl = item ? item.querySelector('.media-filename') : null;
    var name = nameEl ? nameEl.textContent : '';
    if (name && confirm('Remove ' + name + '?')) {
      app.addNotification('info', 'Media "' + name + '" removed');
    }
  });

  // ── Clear All Sessions ──────────────────────────────────────────────────
  document.getElementById('clear-sessions-btn')?.addEventListener('click', function() {
    if (confirm('Clear all sessions?')) {
      app.addNotification('info', 'All sessions cleared');
    }
  });

  // ── Font Size Controls ──────────────────────────────────────────────────
  document.getElementById('font-increase-btn')?.addEventListener('click', function() {
    app.setFontSize(app.state.theme.fontSize + 1);
  });

  document.getElementById('font-decrease-btn')?.addEventListener('click', function() {
    app.setFontSize(app.state.theme.fontSize - 1);
  });

  // ── Primary Color Picker ────────────────────────────────────────────────
  document.getElementById('primary-color-input')?.addEventListener('input', function() {
    app.setPrimaryColor(this.value);
  });
})();
</script>`;
	}

	// ── Rendering ──────────────────────────────────────────────────────────────

	render(): string {
		const themeClass =
			this.state.theme.mode === "dark" ? "theme-dark" : "theme-light";

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
  ${this.initEventListenersScript()}
</body>
</html>`;
	}

	private renderPage(): string {
		switch (this.state.currentPage) {
			case "chat":
				return '<div id="chat-page"><h2>Chat</h2><p>Select a session to start chatting.</p></div>';
			case "analytics":
				return '<div id="analytics-page"><h2>Analytics</h2><p>System metrics and status.</p></div>';
			case "plugins":
				return '<div id="plugins-page"><h2>Plugins</h2><p>Manage installed plugins.</p></div>';
			case "config":
				return '<div id="config-page"><h2>Configuration</h2><p>Edit system settings.</p></div>';
			case "sessions":
				return '<div id="sessions-page"><h2>Sessions</h2><p>Manage active sessions.</p></div>';
			case "media":
				return '<div id="media-page"><h2>Media</h2><p>Preview uploaded media.</p></div>';
			default:
				return "<div><p>Page not found</p></div>";
		}
	}
}
