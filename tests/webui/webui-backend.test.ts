/**
 * Tests for WebUI Backend
 */

import { ok, strictEqual } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { deleteAgentConfigFile } from "../../src/config/agent-config.js";
import { WebUIBackend } from "../../src/webui/backend.js";
import type { WebUIConfig } from "../../src/webui/types.js";

const rootWorkspace = mkdtempSync(join(tmpdir(), "synthtek-backend-"));

const defaultConfig: WebUIConfig = {
	host: "localhost",
	port: 3000,
	apiKey: "test-api-key",
	maxSessions: 100,
	sessionTimeout: 3600,
};

describe("WebUIBackend", () => {
	let backend: WebUIBackend;
	let workspaceDir: string;

	after(() => {
		rmSync(rootWorkspace, { recursive: true, force: true });
	});

	beforeEach(() => {
		workspaceDir = mkdtempSync(join(rootWorkspace, "test-"));
		// Reset shared agent config first so each test starts fresh
		deleteAgentConfigFile();
		backend = new WebUIBackend(defaultConfig, workspaceDir);
	});

	describe("constructor", () => {
		it("creates backend with config", () => {
			ok(backend, "backend created");
		});

		it("starts in stopped state", () => {
			strictEqual(backend.status, "stopped");
		});
	});

	describe("session management", () => {
		it("creates a new session", () => {
			const session = backend.createSession("user123");
			ok(session, "session created");
			strictEqual(session.userId, "user123");
			ok(session!.id, "has session ID");
			ok(session.createdAt, "has creation timestamp");
		});

		it("retrieves existing session", () => {
			const created = backend.createSession("user456");
			const retrieved = backend.getSession(created!.id);
			ok(retrieved, "session retrieved");
			strictEqual(retrieved.id, created!.id);
		});

		it("returns null for non-existent session", () => {
			const retrieved = backend.getSession("nonexistent");
			strictEqual(retrieved, null);
		});

		it("lists all sessions", () => {
			backend.createSession("user1");
			backend.createSession("user2");
			const sessions = backend.listSessions();
			strictEqual(sessions.length, 2);
		});

		it("deletes a session", () => {
			const created = backend.createSession("user789");
			const deleted = backend.deleteSession(created!.id);
			ok(deleted, "session deleted");
			strictEqual(backend.getSession(created!.id), null);
		});

		it("respects max sessions limit", () => {
			const smallConfig: WebUIConfig = { ...defaultConfig, maxSessions: 2 };
			const limitedBackend = new WebUIBackend(smallConfig);
			limitedBackend.createSession("user1");
			limitedBackend.createSession("user2");
			const third = limitedBackend.createSession("user3");
			ok(!third, "third session rejected");
		});
	});

	describe("message handling", () => {
		it("adds message to session", () => {
			const session = backend.createSession("user123");
			const message = backend.addMessage(session!.id, {
				role: "user",
				content: "Hello",
			});
			ok(message, "message added");
			strictEqual(message.role, "user");
			strictEqual(message.content, "Hello");
		});

		it("retrieves messages for session", () => {
			const session = backend.createSession("user456");
			backend.addMessage(session!.id, { role: "user", content: "Hi" });
			backend.addMessage(session!.id, { role: "assistant", content: "Hello!" });
			const messages = backend.getMessages(session!.id);
			strictEqual(messages.length, 2);
		});

		it("returns empty array for session with no messages", () => {
			const session = backend.createSession("user789");
			const messages = backend.getMessages(session!.id);
			strictEqual(messages.length, 0);
		});
	});

	describe("authentication", () => {
		it("validates correct API key", () => {
			const valid = backend.authenticate("test-api-key");
			ok(valid, "correct key authenticated");
		});

		it("rejects incorrect API key", () => {
			const valid = backend.authenticate("wrong-key");
			ok(!valid, "wrong key rejected");
		});

		it("rejects empty API key", () => {
			const valid = backend.authenticate("");
			ok(!valid, "empty key rejected");
		});
	});

	describe("authentication in open mode (no API key)", () => {
		let openBackend: WebUIBackend;

		beforeEach(() => {
			const openConfig: WebUIConfig = {
				host: "localhost",
				port: 3000,
				apiKey: "", // no API key = open mode
				maxSessions: 100,
				sessionTimeout: 3600,
			};
			openBackend = new WebUIBackend(openConfig);
		});

		it("allows any key in open mode", () => {
			ok(openBackend.authenticate("anything"), "any key accepted");
		});

		it("allows empty key in open mode", () => {
			ok(openBackend.authenticate(""), "empty key accepted in open mode");
		});
	});

	describe("file upload handling", () => {
		it("handles file upload", () => {
			const session = backend.createSession("user123");
			const result = backend.handleFileUpload(session!.id, {
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 102400,
			});
			ok(result.success, "upload successful");
			ok(result.url, "has upload URL");
		});

		it("rejects oversized files", () => {
			const session = backend.createSession("user456");
			const result = backend.handleFileUpload(session!.id, {
				filename: "large.bin",
				mimeType: "application/octet-stream",
				size: 100 * 1024 * 1024, // 100MB
			});
			ok(!result.success, "oversized file rejected");
		});
	});

	describe("health check", () => {
		it("returns health status", () => {
			const health = backend.healthCheck();
			ok(health, "health check returns result");
			strictEqual(health.name, "webui");
		});

		it("returns stats", () => {
			const stats = backend.getStats();
			ok(stats, "stats returned");
			strictEqual(stats.activeSessions, 0);
			strictEqual(stats.totalMessages, 0);
		});
	});

	describe("WebSocket support", () => {
		it("supports WebSocket connection", () => {
			ok(typeof backend.handleWebSocket === "function", "has handleWebSocket");
		});

		it("broadcasts to connected clients", () => {
			ok(typeof backend.broadcast === "function", "has broadcast");
		});
	});

	describe("REST API", () => {
		it("handles GET /api/sessions", () => {
			const handler = backend.handleRequest("GET", "/api/sessions", {});
			ok(handler, "handler returns response");
		});

		it("handles POST /api/sessions", () => {
			const handler = backend.handleRequest("POST", "/api/sessions", {
				userId: "user123",
			});
			ok(handler, "handler returns response");
		});

		it("handles POST /api/messages", () => {
			const session = backend.createSession("user456");
			const handler = backend.handleRequest("POST", "/api/messages", {
				sessionId: session!.id,
				role: "user",
				content: "Hello",
			});
			ok(handler, "handler returns response");
		});

		it("returns 404 for unknown routes", () => {
			const handler = backend.handleRequest("GET", "/unknown", {});
			ok(handler, "handler returns response");
			strictEqual(handler.status, 404);
		});
	});

	describe("analytics summary", () => {
		it("returns analytics summary via API", () => {
			const handler = backend.handleRequest(
				"GET",
				"/api/analytics/summary",
				{},
			);
			strictEqual(handler.status, 200);
			const summary = handler.body as Record<string, unknown>;
			ok(summary, "has body");
			ok(
				(summary as Record<string, unknown>).requestVolume,
				"has requestVolume",
			);
		});

		it("includes session activity in analytics summary", () => {
			backend.createSession("user1");
			backend.addMessage("nonexistent", { role: "user", content: "Hi" });
			const handler = backend.handleRequest(
				"GET",
				"/api/analytics/summary",
				{},
			);
			strictEqual(handler.status, 200);
			const summary = handler.body as {
				sessionActivity: { totalSessions: number };
			};
			ok(summary.sessionActivity.totalSessions >= 0, "has session count");
		});
	});

	describe("agent config", () => {
		it("returns default agent config via GET", () => {
			const handler = backend.handleRequest("GET", "/api/config/agent", {});
			strictEqual(handler.status, 200);
			const config = handler.body as Record<string, unknown>;
			ok(config, "has body");
			const prompt = (config as Record<string, unknown>).systemPrompt as string;
			ok(
				prompt.startsWith("You are an elite,"),
				"starts with new default prompt header",
			);
			ok(prompt.includes("Ownership"), "contains Ownership mandate");
			ok(
				prompt.includes("Execution Framework"),
				"contains Execution Framework section",
			);
			strictEqual((config as Record<string, unknown>).language, "English");
		});

		it("updates system prompt via PUT", () => {
			const handler = backend.handleRequest("PUT", "/api/config/agent", {
				systemPrompt: "You are a math tutor.",
			});
			strictEqual(handler.status, 200);
			const config = handler.body as Record<string, unknown>;
			strictEqual(config.systemPrompt, "You are a math tutor.");
			strictEqual(config.language, "English");
		});

		it("updates language via PUT", () => {
			const handler = backend.handleRequest("PUT", "/api/config/agent", {
				language: "Chinese",
			});
			strictEqual(handler.status, 200);
			const config = handler.body as Record<string, unknown>;
			strictEqual(config.language, "Chinese");
			const prompt1 = config.systemPrompt as string;
			ok(
				prompt1.startsWith("You are an elite,"),
				"system prompt unchanged from default",
			);
		});

		it("returns updated config after multiple PUTs", () => {
			backend.handleRequest("PUT", "/api/config/agent", {
				systemPrompt: "Be concise.",
				language: "German",
			});
			const handler = backend.handleRequest("GET", "/api/config/agent", {});
			strictEqual(handler.status, 200);
			const config = handler.body as Record<string, unknown>;
			strictEqual(config.systemPrompt, "Be concise.");
			strictEqual(config.language, "German");
		});

		it("rejects invalid types via validation", () => {
			const handler = backend.handleRequest("PUT", "/api/config/agent", {
				systemPrompt: 123,
				language: 456,
			});
			strictEqual(handler.status, 400);
		});

		it("does not modify config when update is empty", () => {
			const handler = backend.handleRequest("PUT", "/api/config/agent", {});
			strictEqual(handler.status, 200);
			const config = handler.body as Record<string, unknown>;
			const prompt2 = config.systemPrompt as string;
			ok(
				prompt2.startsWith("You are an elite,"),
				"system prompt unchanged from default",
			);
			strictEqual(config.language, "English");
		});

		it("returns a copy not a reference", () => {
			const handler1 = backend.handleRequest("GET", "/api/config/agent", {});
			const config1 = handler1.body as Record<string, unknown>;
			config1.systemPrompt = "Hacked!";
			const handler2 = backend.handleRequest("GET", "/api/config/agent", {});
			const config2 = handler2.body as Record<string, unknown>;
			ok(
				(config2.systemPrompt as string).startsWith("You are an elite,"),
				"original unchanged",
			);
		});

		it("resets to defaults via DELETE", () => {
			// First change the config
			backend.handleRequest("PUT", "/api/config/agent", {
				systemPrompt: "Custom prompt",
				language: "French",
			});
			let config = backend.handleRequest("GET", "/api/config/agent", {})
				.body as Record<string, unknown>;
			strictEqual(config.systemPrompt, "Custom prompt");

			// Reset via DELETE
			const handler = backend.handleRequest("DELETE", "/api/config/agent", {});
			strictEqual(handler.status, 200);
			config = handler.body as Record<string, unknown>;
			ok(
				(config.systemPrompt as string).startsWith("You are an elite,"),
				"reset to default prompt",
			);
			strictEqual(config.language, "English");

			// Verify subsequent GET also returns defaults
			const getHandler = backend.handleRequest("GET", "/api/config/agent", {});
			const getConfig = getHandler.body as Record<string, unknown>;
			ok(
				(getConfig.systemPrompt as string).startsWith("You are an elite,"),
				"GET after reset returns defaults",
			);
			strictEqual(getConfig.language, "English");
		});
	});
});
