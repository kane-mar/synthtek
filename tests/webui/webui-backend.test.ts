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
			const messages = backend.syncAndGetMessages(session!.id);
			strictEqual(messages.length, 2);
		});

		it("returns empty array for session with no messages", () => {
			const session = backend.createSession("user789");
			const messages = backend.syncAndGetMessages(session!.id);
			strictEqual(messages.length, 0);
		});
	});

	describe("authentication (delegated to auth.ts)", () => {
		it("auth is handled by server.ts via createAuthenticator, not backend", () => {
			// Backend no longer has authenticate() — auth is centralized in auth.ts
			strictEqual(
				typeof (backend as unknown as Record<string, unknown>).authenticate,
				"undefined",
			);
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

		it("auth is centralized in auth.ts — backend no longer has authenticate()", () => {
			strictEqual(
				typeof (openBackend as unknown as Record<string, unknown>).authenticate,
				"undefined",
			);
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

	describe("WebSocket (removed — dead code)", () => {
		it("WebSocket methods removed, handled via channels/websocket", () => {
			strictEqual(
				typeof (backend as unknown as Record<string, unknown>).handleWebSocket,
				"undefined",
			);
			strictEqual(
				typeof (backend as unknown as Record<string, unknown>).broadcast,
				"undefined",
			);
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

		it("returns version via GET /api/version", () => {
			const handler = backend.handleRequest("GET", "/api/version", {});
			ok(handler, "handler returns response");
			strictEqual(handler.status, 200);
			const body = handler.body as { version?: string };
			ok(body.version, "version string is present");
			ok(typeof body.version === "string", "version is a string");
			ok(body.version.length > 0, "version is non-empty");
		});
	});

	describe("OpenAPI specification", () => {
		it("serves OpenAPI spec at /api/openapi.json", () => {
			const handler = backend.handleRequest("GET", "/api/openapi.json", {});
			strictEqual(handler.status, 200);
			const spec = handler.body as Record<string, unknown>;
			ok(spec.openapi, "should have openapi version");
			strictEqual(spec.openapi, "3.0.3");
			ok(spec.info, "should have info section");
			ok(spec.paths, "should have paths section");
			ok(
				(spec.paths as Record<string, unknown>)["/api/sessions"],
				"should document /api/sessions",
			);
			ok(
				(spec.paths as Record<string, unknown>)["/api/health"],
				"should document /api/health",
			);
			ok(
				(spec.paths as Record<string, unknown>)["/api/openapi.json"],
				"should self-document",
			);
			ok(spec.components, "should have components section");
			ok(
				(spec.components as Record<string, unknown>).schemas,
				"should have schemas",
			);
		});

		it("validates OpenAPI spec structure", async () => {
			const { getOpenApiSpec } = await import("../../src/webui/openapi.js");
			const spec = getOpenApiSpec();
			// Standard OpenAPI 3.0 fields
			strictEqual(spec.openapi, "3.0.3");
			const info = spec.info as Record<string, unknown> | undefined;
			ok(info?.title, "should have title");
			ok(typeof info?.version === "string", "should have version");

			// All paths should have at least one operation
			const paths = spec.paths as Record<string, Record<string, unknown>>;
			for (const [path, operations] of Object.entries(paths)) {
				ok(
					Object.keys(operations).length > 0,
					`${path} should have at least one operation`,
				);
			}
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
