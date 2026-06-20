/**
 * Tests for WebUI Frontend Core App
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { FrontendApp } from "../../src/webui/frontend/app.js";
import type { ThemeConfig } from "../../src/webui/frontend/types.js";

// Mock window for Node.js environment
const mockWindow = {
	history: {
		pushState: () => {},
	},
	addEventListener: () => {},
	removeEventListener: () => {},
	location: {
		hash: "",
	},
};
(globalThis as unknown as Window & typeof globalThis).window =
	mockWindow as never;

const defaultTheme: ThemeConfig = {
	mode: "light",
	primaryColor: "#3b82f6",
	fontSize: 14,
};

describe("FrontendApp", () => {
	let app: FrontendApp;

	beforeEach(() => {
		app = new FrontendApp(defaultTheme);
	});

	describe("constructor", () => {
		it("creates app with default theme", () => {
			ok(app, "app created");
		});

		it("starts on chat page", () => {
			strictEqual(app.state.currentPage, "chat");
		});

		it("starts unauthenticated", () => {
			strictEqual(app.state.isAuthenticated, false);
		});

		it("has empty notifications", () => {
			strictEqual(app.state.notifications.length, 0);
		});

		it("has no active session", () => {
			strictEqual(app.state.activeSessionId, null);
		});
	});

	describe("navigation", () => {
		it("navigates to analytics", () => {
			app.navigate("analytics");
			strictEqual(app.state.currentPage, "analytics");
		});

		it("navigates to plugins page", () => {
			app.navigate("plugins");
			strictEqual(app.state.currentPage, "plugins");
		});

		it("navigates to config page", () => {
			app.navigate("config");
			strictEqual(app.state.currentPage, "config");
		});

		it("navigates to sessions page", () => {
			app.navigate("sessions");
			strictEqual(app.state.currentPage, "sessions");
		});

		it("navigates to media page", () => {
			app.navigate("media");
			strictEqual(app.state.currentPage, "media");
		});

		it("stays on current page for invalid navigation", () => {
			app.navigate("analytics");
			const prevPage = app.state.currentPage;
			app.navigate("nonexistent" as never);
			strictEqual(app.state.currentPage, prevPage);
		});
	});

	describe("authentication", () => {
		it("authenticates with valid key", () => {
			app.authenticate("valid-api-key");
			strictEqual(app.state.isAuthenticated, true);
		});

		it("rejects empty key", () => {
			app.authenticate("");
			strictEqual(app.state.isAuthenticated, false);
		});

		it("logs out", () => {
			app.authenticate("valid-key");
			app.logout();
			strictEqual(app.state.isAuthenticated, false);
			strictEqual(app.state.activeSessionId, null);
		});
	});

	describe("theme management", () => {
		it("switches to dark theme", () => {
			app.setThemeMode("dark");
			strictEqual(app.state.theme.mode, "dark");
		});

		it("switches to light theme", () => {
			app.setThemeMode("light");
			strictEqual(app.state.theme.mode, "light");
		});

		it("switches to system theme", () => {
			app.setThemeMode("system");
			strictEqual(app.state.theme.mode, "system");
		});

		it("changes primary color", () => {
			app.setPrimaryColor("#ef4444");
			strictEqual(app.state.theme.primaryColor, "#ef4444");
		});

		it("changes font size", () => {
			app.setFontSize(16);
			strictEqual(app.state.theme.fontSize, 16);
		});

		it("clamps font size to minimum", () => {
			app.setFontSize(4);
			strictEqual(app.state.theme.fontSize, 10);
		});

		it("clamps font size to maximum", () => {
			app.setFontSize(100);
			strictEqual(app.state.theme.fontSize, 32);
		});
	});

	describe("notifications", () => {
		it("adds info notification", () => {
			app.addNotification("info", "Test message");
			strictEqual(app.state.notifications.length, 1);
			strictEqual(app.state.notifications[0].type, "info");
		});

		it("adds success notification", () => {
			app.addNotification("success", "Operation completed");
			strictEqual(app.state.notifications[0].type, "success");
		});

		it("adds warning notification", () => {
			app.addNotification("warning", "Something might be wrong");
			strictEqual(app.state.notifications[0].type, "warning");
		});

		it("adds error notification", () => {
			app.addNotification("error", "Something failed");
			strictEqual(app.state.notifications[0].type, "error");
		});

		it("dismisses notification by id", () => {
			app.addNotification("info", "Test");
			const notif = app.state.notifications[0];
			app.dismissNotification(notif.id);
			ok(notif.dismissed, "notification dismissed");
		});

		it("clears all notifications", () => {
			app.addNotification("info", "First");
			app.addNotification("warning", "Second");
			app.clearNotifications();
			strictEqual(app.state.notifications.length, 0);
		});

		it("limits notification count", () => {
			for (let i = 0; i < 50; i++) {
				app.addNotification("info", `Message ${i}`);
			}
			ok(app.state.notifications.length <= 25, "notifications capped");
		});
	});

	describe("session management", () => {
		it("sets active session", () => {
			app.setActiveSession("session-123");
			strictEqual(app.state.activeSessionId, "session-123");
		});

		it("clears active session", () => {
			app.setActiveSession("session-123");
			app.clearActiveSession();
			strictEqual(app.state.activeSessionId, null);
		});
	});

	describe("render", () => {
		it("renders chat page HTML", () => {
			const html = app.render();
			ok(typeof html === "string", "renders string");
			ok(html.includes("synthtek"), "includes app name");
		});

		it("renders analytics page HTML", () => {
			app.navigate("analytics");
			const html = app.render();
			ok(html.includes("Analytics"), "includes analytics title");
		});

		it("includes theme class in HTML", () => {
			app.setThemeMode("dark");
			const html = app.render();
			ok(html.includes("theme-dark"), "includes dark theme class");
		});

		it("includes font size in HTML", () => {
			app.setFontSize(16);
			const html = app.render();
			ok(html.includes("font-size"), "includes font size style");
		});
	});

	describe("toggleTheme", () => {
		it("toggles from light to dark", () => {
			app.setThemeMode("light");
			app.toggleTheme();
			strictEqual(app.state.theme.mode, "dark");
		});

		it("toggles from dark to light", () => {
			app.setThemeMode("dark");
			app.toggleTheme();
			strictEqual(app.state.theme.mode, "light");
		});

		it("adds notification on toggle", () => {
			app.toggleTheme();
			strictEqual(app.state.notifications.length, 1);
			strictEqual(app.state.notifications[0].type, "info");
		});
	});

	describe("initEventListenersScript", () => {
		it("returns a string containing script tags", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("<script>"), "includes script open tag");
			ok(script.includes("</script>"), "includes script close tag");
		});

		it("includes navigation handler", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("app.navigate"), "includes navigation handler");
		});

		it("includes theme toggle handler", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("app.toggleTheme"), "includes theme toggle handler");
		});

		it("includes authentication handlers", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("app.authenticate"), "includes authenticate handler");
			ok(script.includes("app.logout"), "includes logout handler");
		});

		it("includes chat send handler", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("send-button"), "includes send button handler");
		});

		it("includes session select handler", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("session-select"), "includes session select handler");
		});

		it("includes plugin toggle handler", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("plugin-toggle"), "includes plugin toggle handler");
		});

		it("includes config save handler", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("config-save-btn"), "includes config save handler");
		});

		it("includes notification dismiss handler", () => {
			const script = app.initEventListenersScript();
			ok(
				script.includes("notification-dismiss"),
				"includes notification dismiss handler",
			);
		});

		it("includes media remove handler", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("media-remove-btn"), "includes media remove handler");
		});

		it("includes font size controls", () => {
			const script = app.initEventListenersScript();
			ok(
				script.includes("font-increase-btn"),
				"includes font increase handler",
			);
			ok(
				script.includes("font-decrease-btn"),
				"includes font decrease handler",
			);
		});

		it("includes primary color picker", () => {
			const script = app.initEventListenersScript();
			ok(
				script.includes("primary-color-input"),
				"includes color picker handler",
			);
		});

		it("includes clear sessions handler", () => {
			const script = app.initEventListenersScript();
			ok(
				script.includes("clear-sessions-btn"),
				"includes clear sessions handler",
			);
		});

		it("includes Enter key handler for chat", () => {
			const script = app.initEventListenersScript();
			ok(script.includes("keydown"), "includes keydown handler");
			ok(script.includes("Enter"), "handles Enter key");
		});
	});

	describe("render with event listeners", () => {
		it("includes event listener script in rendered HTML", () => {
			const html = app.render();
			ok(html.includes("<script>"), "includes script tag");
			ok(html.includes("window.app"), "includes app reference");
		});

		it("includes event listener script after footer", () => {
			const html = app.render();
			const footerIndex = html.indexOf("<footer>");
			const scriptIndex = html.indexOf("<script>");
			ok(scriptIndex > footerIndex, "script appears after footer");
		});
	});

	describe("state snapshot", () => {
		it("returns state snapshot", () => {
			const snapshot = app.getState();
			ok(snapshot, "snapshot returned");
			strictEqual(snapshot.currentPage, "chat");
		});

		it("snapshot reflects navigation changes", () => {
			app.navigate("analytics");
			const snapshot = app.getState();
			strictEqual(snapshot.currentPage, "analytics");
		});
	});
});
