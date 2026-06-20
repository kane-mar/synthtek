/**
 * Tests for WebUI Session Manager Component
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { SessionManagerComponent } from "../../src/webui/frontend/session-manager.js";
import type { SessionInfo } from "../../src/webui/frontend/types.js";

describe("SessionManagerComponent", () => {
	let manager: SessionManagerComponent;

	beforeEach(() => {
		manager = new SessionManagerComponent();
	});

	describe("constructor", () => {
		it("creates session manager", () => {
			ok(manager, "manager created");
		});

		it("starts with empty session list", () => {
			strictEqual(manager.sessions.length, 0);
		});
	});

	describe("session creation", () => {
		it("creates a new session", () => {
			const session = manager.createSession("user123");
			ok(session, "session created");
			strictEqual(session.userId, "user123");
			ok(session.id, "has session ID");
		});

		it("adds session to list", () => {
			manager.createSession("user123");
			strictEqual(manager.sessions.length, 1);
		});

		it("generates unique session IDs", () => {
			manager.createSession("user1");
			manager.createSession("user2");
			ok(manager.sessions[0].id !== manager.sessions[1].id, "IDs are unique");
		});
	});

	describe("session retrieval", () => {
		it("finds session by ID", () => {
			const created = manager.createSession("user123");
			const found = manager.getSession(created?.id);
			ok(found, "session found");
			strictEqual(found.id, created?.id);
		});

		it("returns null for non-existent session", () => {
			const found = manager.getSession("nonexistent");
			strictEqual(found, null);
		});

		it("lists all sessions", () => {
			manager.createSession("user1");
			manager.createSession("user2");
			strictEqual(manager.listSessions().length, 2);
		});
	});

	describe("session deletion", () => {
		it("deletes a session", () => {
			const created = manager.createSession("user123");
			manager.deleteSession(created?.id);
			strictEqual(manager.sessions.length, 0);
		});

		it("returns false for non-existent session", () => {
			ok(!manager.deleteSession("nonexistent"), "returns false");
		});

		it("clears all sessions", () => {
			manager.createSession("user1");
			manager.createSession("user2");
			manager.clearAllSessions();
			strictEqual(manager.sessions.length, 0);
		});
	});

	describe("session filtering", () => {
		it("filters by user ID", () => {
			manager.createSession("user1");
			manager.createSession("user2");
			const filtered = manager.filterByUserId("user1");
			strictEqual(filtered.length, 1);
		});

		it("filters by activity threshold", () => {
			const oldSession: SessionInfo = {
				id: "old",
				userId: "user1",
				createdAt: Date.now() - 86400000, // 24 hours ago
				lastActivity: Date.now() - 86400000,
				messageCount: 5,
			};
			manager.sessions.push(oldSession);
			const active = manager.filterActive(3600000); // 1 hour threshold
			strictEqual(active.length, 0);
		});

		it("sorts sessions by last activity", () => {
			manager.createSession("user1");
			manager.createSession("user2");
			const sorted = manager.sortByActivity();
			ok(sorted.length === 2, "all sessions sorted");
		});
	});

	describe("session stats", () => {
		it("returns total session count", () => {
			manager.createSession("user1");
			manager.createSession("user2");
			strictEqual(manager.getTotalCount(), 2);
		});

		it("returns total message count", () => {
			manager.createSession("user1");
			manager.sessions[0].messageCount = 10;
			manager.createSession("user2");
			manager.sessions[1].messageCount = 5;
			strictEqual(manager.getTotalMessageCount(), 15);
		});

		it("returns unique user count", () => {
			manager.createSession("user1");
			manager.createSession("user1");
			manager.createSession("user2");
			strictEqual(manager.getUniqueUserCount(), 2);
		});
	});

	describe("session timeout", () => {
		it("expires old sessions", () => {
			const oldSession: SessionInfo = {
				id: "old",
				userId: "user1",
				createdAt: Date.now() - 86400000,
				lastActivity: Date.now() - 86400000,
				messageCount: 5,
			};
			manager.sessions.push(oldSession);
			manager.expireOldSessions(3600000); // 1 hour threshold
			strictEqual(manager.sessions.length, 0);
		});

		it("keeps recent sessions", () => {
			manager.createSession("user1");
			manager.expireOldSessions(3600000);
			strictEqual(manager.sessions.length, 1);
		});
	});

	describe("render", () => {
		it("renders session list HTML", () => {
			manager.createSession("user123");
			const html = manager.render();
			ok(typeof html === "string", "renders string");
			ok(html.includes("user123"), "includes user ID");
		});

		it("renders empty state", () => {
			const html = manager.render();
			ok(html.includes("No sessions"), "shows empty state");
		});

		it("renders session count", () => {
			manager.createSession("user1");
			manager.createSession("user2");
			const html = manager.render();
			ok(html.includes("2"), "shows session count");
		});

		it("renders session activity time", () => {
			manager.createSession("user1");
			const html = manager.render();
			ok(html.includes("activity"), "shows activity info");
		});
	});

	describe("session search", () => {
		it("searches sessions by user ID", () => {
			manager.createSession("john");
			manager.createSession("jane");
			const results = manager.searchSessions("john");
			strictEqual(results.length, 1);
		});

		it("returns empty for no matches", () => {
			manager.createSession("user1");
			const results = manager.searchSessions("nonexistent");
			strictEqual(results.length, 0);
		});
	});
});
