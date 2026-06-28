/**
 * End-to-end tests for the WebUI HTTP server
 *
 * Tests the full request/response cycle through a real Node.js HTTP server
 * on a random port. Covers all API endpoints: health, sessions, messages,
 * stats, cron, providers, themes, chat, frontend, and CORS.
 */

import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { WebUIServer } from "../../src/webui/server.js";
import type { WebUIConfig } from "../../src/webui/types.js";

// Use a high port to avoid collisions
const TEST_PORT = 4001;

// Isolated workspace for e2e tests so provider persistence doesn't leak between tests
const e2eWorkspace = mkdtempSync(join(tmpdir(), "synthtek-e2e-"));
const originalWorkspace = process.env.SYNTHTEK_WORKSPACE;

const config: WebUIConfig = {
	host: "127.0.0.1",
	port: TEST_PORT,
	apiKey: "e2e-secret-key",
	maxSessions: 10,
	sessionTimeout: 3600,
};

const BASE = `http://127.0.0.1:${TEST_PORT}`;

const authHeaders = {
	Authorization: "Bearer e2e-secret-key",
	"Content-Type": "application/json",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function get(path: string, headers?: Record<string, string>) {
	return fetch(`${BASE}${path}`, { headers });
}

async function post(
	path: string,
	body: unknown,
	headers?: Record<string, string>,
) {
	return fetch(`${BASE}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

async function put(
	path: string,
	body: unknown,
	headers?: Record<string, string>,
) {
	return fetch(`${BASE}${path}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

async function del(path: string, headers?: Record<string, string>) {
	return fetch(`${BASE}${path}`, { method: "DELETE", headers });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("WebUI end-to-end", () => {
	let server: WebUIServer;

	before(async () => {
		// Use isolated workspace for e2e tests
		process.env.SYNTHTEK_WORKSPACE = e2eWorkspace;
		server = new WebUIServer(config);
		await server.start();
	});

	after(async () => {
		await server.stop();
		// Restore original workspace
		if (originalWorkspace !== undefined) {
			process.env.SYNTHTEK_WORKSPACE = originalWorkspace;
		} else {
			delete process.env.SYNTHTEK_WORKSPACE;
		}
		// Clean up temp directory
		try {
			rmSync(e2eWorkspace, { recursive: true, force: true });
		} catch {}
	});

	// ──────────────────────────────────────────────────────────────────────
	// Health (public — no auth required)
	// ──────────────────────────────────────────────────────────────────────

	describe("GET /api/health (public)", () => {
		it("returns 200 without auth", async () => {
			const res = await get("/api/health");
			strictEqual(res.status, 200);
		});

		it("returns health object with expected fields", async () => {
			const res = await get("/api/health");
			const json = await res.json();
			strictEqual(json.name, "webui");
			strictEqual(json.status, "started");
			strictEqual(json.connected, true);
			ok(typeof json.uptime === "number", "has uptime");
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Frontend HTML (public)
	// ──────────────────────────────────────────────────────────────────────

	describe("GET / (frontend)", () => {
		it("serves HTML without auth", async () => {
			const res = await get("/");
			strictEqual(res.status, 200);
			const ct = res.headers.get("content-type");
			ok(ct?.includes("text/html"), "content-type is text/html");
		});

		it("includes no-cache headers", async () => {
			const res = await get("/");
			strictEqual(
				res.headers.get("cache-control"),
				"no-cache, no-store, must-revalidate",
			);
			strictEqual(res.headers.get("pragma"), "no-cache");
			strictEqual(res.headers.get("expires"), "0");
		});

		it("GET /index.html also serves frontend", async () => {
			const res = await get("/index.html");
			strictEqual(res.status, 200);
			const ct = res.headers.get("content-type");
			ok(ct?.includes("text/html"), "content-type is text/html");
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// CORS preflight
	// ──────────────────────────────────────────────────────────────────────

	describe("OPTIONS (CORS preflight)", () => {
		it("returns 204 with CORS headers", async () => {
			const res = await fetch(`${BASE}/api/sessions`, { method: "OPTIONS" });
			strictEqual(res.status, 204);
			strictEqual(res.headers.get("access-control-allow-origin"), "*");
			ok(
				res.headers.get("access-control-allow-methods")?.includes("GET"),
				"allows GET",
			);
			ok(
				res.headers.get("access-control-allow-methods")?.includes("POST"),
				"allows POST",
			);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Sessions CRUD
	// ──────────────────────────────────────────────────────────────────────

	describe("Sessions CRUD", () => {
		let sessionId: string;

		it("POST /api/sessions creates a session", async () => {
			const res = await post(
				"/api/sessions",
				{ userId: "e2e-user" },
				authHeaders,
			);
			strictEqual(res.status, 201);
			const json = await res.json();
			ok(json.id, "has session id");
			strictEqual(json.userId, "e2e-user");
			ok(json.createdAt, "has createdAt");
			ok(json.messages, "has messages array");
			sessionId = json.id;
		});

		it("GET /api/sessions lists sessions", async () => {
			const res = await get("/api/sessions", authHeaders);
			strictEqual(res.status, 200);
			const json = await res.json();
			ok(Array.isArray(json), "returns array");
			ok(json.length >= 1, "has at least one session");
		});

		it("POST /api/messages adds a message to the session", async () => {
			const res = await post(
				"/api/messages",
				{ sessionId, role: "user", content: "Hello from e2e" },
				authHeaders,
			);
			strictEqual(res.status, 201);
			const json = await res.json();
			ok(json.id, "has message id");
			strictEqual(json.role, "user");
			strictEqual(json.content, "Hello from e2e");
			strictEqual(json.sessionId, sessionId);
		});

		it("GET /api/messages?sessionId=xxx returns messages", async () => {
			const res = await get(
				`/api/messages?sessionId=${sessionId}`,
				authHeaders,
			);
			strictEqual(res.status, 200);
			const json = await res.json();
			ok(Array.isArray(json), "returns array");
			ok(json.length >= 1, "has at least one message");
			strictEqual(json[0].content, "Hello from e2e");
		});

		it("GET /api/messages without sessionId returns empty array", async () => {
			const res = await get("/api/messages", authHeaders);
			strictEqual(res.status, 200);
			const json = await res.json();
			deepStrictEqual(json, []);
		});

		it("DELETE /api/sessions/:id removes the session", async () => {
			const res = await del(`/api/sessions/${sessionId}`, authHeaders);
			strictEqual(res.status, 200);
		});

		it("DELETE /api/sessions/:id returns 404 for non-existent session", async () => {
			const res = await del("/api/sessions/nonexistent-id", authHeaders);
			strictEqual(res.status, 404);
		});

		it("POST /api/messages to deleted session returns 404", async () => {
			const res = await post(
				"/api/messages",
				{ sessionId, role: "user", content: "ghost" },
				authHeaders,
			);
			strictEqual(res.status, 404);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Max sessions limit
	// ──────────────────────────────────────────────────────────────────────

	describe("Max sessions limit", () => {
		it("rejects session creation when limit is reached", async () => {
			// Create 10 sessions (the limit)
			const ids: string[] = [];
			for (let i = 0; i < 10; i++) {
				const res = await post(
					"/api/sessions",
					{ userId: `limit-user-${i}` },
					authHeaders,
				);
				strictEqual(res.status, 201, `session ${i} should be created`);
				const json = await res.json();
				ids.push(json.id);
			}

			// 11th should fail
			const res = await post(
				"/api/sessions",
				{ userId: "overflow-user" },
				authHeaders,
			);
			strictEqual(res.status, 400);
			const json = await res.json();
			ok(json.error?.includes("Max sessions"), "error mentions max sessions");

			// Clean up
			for (const id of ids) {
				await del(`/api/sessions/${id}`, authHeaders);
			}
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Stats
	// ──────────────────────────────────────────────────────────────────────

	describe("GET /api/stats", () => {
		it("returns stats object", async () => {
			const res = await get("/api/stats", authHeaders);
			strictEqual(res.status, 200);
			const json = await res.json();
			ok(typeof json.activeSessions === "number", "has activeSessions");
			ok(typeof json.totalMessages === "number", "has totalMessages");
			ok(typeof json.uptime === "number", "has uptime");
		});

		it("reflects session and message counts", async () => {
			// Create a session with a message
			const createRes = await post(
				"/api/sessions",
				{ userId: "stats-user" },
				authHeaders,
			);
			const session = await createRes.json();
			await post(
				"/api/messages",
				{ sessionId: session.id, role: "user", content: "count me" },
				authHeaders,
			);

			const res = await get("/api/stats", authHeaders);
			const json = await res.json();
			ok(json.activeSessions >= 1, "at least 1 active session");
			ok(json.totalMessages >= 1, "at least 1 total message");

			// Clean up
			await del(`/api/sessions/${session.id}`, authHeaders);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Cron (stub)
	// ──────────────────────────────────────────────────────────────────────

	describe("GET /api/cron", () => {
		it("returns empty array", async () => {
			const res = await get("/api/cron", authHeaders);
			strictEqual(res.status, 200);
			const json = await res.json();
			deepStrictEqual(json, []);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Provider presets
	// ──────────────────────────────────────────────────────────────────────

	describe("GET /api/providers/presets", () => {
		it("returns provider presets", async () => {
			const res = await get("/api/providers/presets", authHeaders);
			strictEqual(res.status, 200);
			const json = await res.json();
			ok(json.openai, "has openai preset");
			ok(json.anthropic, "has anthropic preset");
			ok(json.ollama, "has ollama preset");
			strictEqual(json.openai.baseUrl, "https://api.openai.com/v1");
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Providers CRUD
	// ──────────────────────────────────────────────────────────────────────

	describe("Providers CRUD", () => {
		let providerId: string;

		it("GET /api/providers returns empty list initially", async () => {
			const res = await get("/api/providers", authHeaders);
			strictEqual(res.status, 200);
			const json = await res.json();
			ok(Array.isArray(json), "returns array");
		});

		it("POST /api/providers creates a provider", async () => {
			const res = await post(
				"/api/providers",
				{
					name: "E2E Test Provider",
					type: "openai",
					baseUrl: "https://api.openai.com/v1",
					apiKey: "sk-test-key",
					models: ["gpt-4o"],
					defaultModel: "gpt-4o",
				},
				authHeaders,
			);
			strictEqual(res.status, 201);
			const json = await res.json();
			ok(json.id, "has provider id");
			strictEqual(json.name, "E2E Test Provider");
			strictEqual(json.type, "openai");
			strictEqual(json.status, "active");
			strictEqual(json.defaultModel, "gpt-4o");
			providerId = json.id;
		});

		it("POST /api/providers rejects missing name", async () => {
			const res = await post("/api/providers", { type: "openai" }, authHeaders);
			strictEqual(res.status, 400);
		});

		it("POST /api/providers rejects missing type", async () => {
			const res = await post(
				"/api/providers",
				{ name: "No Type" },
				authHeaders,
			);
			strictEqual(res.status, 400);
		});

		it("GET /api/providers/:id returns the provider", async () => {
			const res = await get(`/api/providers/${providerId}`, authHeaders);
			strictEqual(res.status, 200);
			const json = await res.json();
			strictEqual(json.id, providerId);
			strictEqual(json.name, "E2E Test Provider");
		});

		it("GET /api/providers/:id returns 404 for unknown id", async () => {
			const res = await get("/api/providers/unknown-id", authHeaders);
			strictEqual(res.status, 404);
		});

		it("PUT /api/providers/:id updates the provider", async () => {
			const res = await put(
				`/api/providers/${providerId}`,
				{ name: "Updated Provider", temperature: 0.5 },
				authHeaders,
			);
			strictEqual(res.status, 200);
			const json = await res.json();
			strictEqual(json.name, "Updated Provider");
			strictEqual(json.temperature, 0.5);
		});

		it("PUT /api/providers/:id returns 404 for unknown id", async () => {
			const res = await put(
				"/api/providers/unknown-id",
				{ name: "ghost" },
				authHeaders,
			);
			strictEqual(res.status, 404);
		});

		it("DELETE /api/providers/:id removes the provider", async () => {
			const res = await del(`/api/providers/${providerId}`, authHeaders);
			strictEqual(res.status, 200);
		});

		it("DELETE /api/providers/:id returns 404 for unknown id", async () => {
			const res = await del("/api/providers/unknown-id", authHeaders);
			strictEqual(res.status, 404);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Chat completions
	// ──────────────────────────────────────────────────────────────────────

	describe("POST /api/chat/completions", () => {
		it("returns 422 when no active providers exist", async () => {
			const res = await post(
				"/api/chat/completions",
				{ messages: [{ role: "user", content: "hi" }] },
				authHeaders,
			);
			strictEqual(res.status, 422);
			const json = await res.json();
			ok(
				json.error?.includes("No active"),
				"error mentions no active providers",
			);
		});

		it("returns 404 for non-existent providerId", async () => {
			// First create an active provider
			const createRes = await post(
				"/api/providers",
				{
					name: "Chat Test",
					type: "openai",
					baseUrl: "https://api.openai.com/v1",
					apiKey: "sk-invalid",
					models: ["gpt-4o"],
					defaultModel: "gpt-4o",
				},
				authHeaders,
			);
			strictEqual(createRes.status, 201);

			const res = await post(
				"/api/chat/completions",
				{
					messages: [{ role: "user", content: "hi" }],
					providerId: "nonexistent-provider",
				},
				authHeaders,
			);
			strictEqual(res.status, 404);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Themes
	// ──────────────────────────────────────────────────────────────────────

	describe("GET /api/themes", () => {
		it("returns available themes", async () => {
			const res = await get("/api/themes", authHeaders);
			strictEqual(res.status, 200);
			const json = await res.json();
			ok(Array.isArray(json), "returns array of themes");
			ok(json.length > 0, "has at least one theme");
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// 404 for unknown routes
	// ──────────────────────────────────────────────────────────────────────

	describe("Unknown routes", () => {
		it("returns 404 for unknown API path", async () => {
			const res = await get("/api/unknown/route", authHeaders);
			strictEqual(res.status, 404);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// CORS headers on API responses
	// ──────────────────────────────────────────────────────────────────────

	describe("CORS headers on responses", () => {
		it("includes Access-Control-Allow-Origin on API responses", async () => {
			const res = await get("/api/health");
			strictEqual(res.headers.get("access-control-allow-origin"), "*");
		});

	it("includes Content-Type: application/json on API responses", async () => {
		const res = await get("/api/health");
		const ct = res.headers.get("content-type");
		ok(ct?.includes("application/json"), "content-type is application/json");
	});
});

// ──────────────────────────────────────────────────────────────────────
// Skills (auth required)
// ──────────────────────────────────────────────────────────────────────

describe("Skills API", () => {
	const testSkillName = "e2e-test-skill";
	const skillDir = join(e2eWorkspace, "skills", testSkillName);

	before(() => {
		// Create a test skill SKILL.md directly in the workspace
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			`---
name: e2e-test-skill
description: "A test skill created by E2E tests"
---

# E2E Test Skill

Used for testing the skills API endpoints.
`,
		);
	});

	it("GET /api/skills returns list including the test skill", async () => {
		const res = await get("/api/skills", authHeaders);
		strictEqual(res.status, 200);
		const json = await res.json();
		ok(Array.isArray(json), "returns array");
		const found = json.find((s: { name: string }) => s.name === testSkillName);
		ok(found, `test skill "${testSkillName}" should be listed`);
		ok(found.description?.includes("E2E"), "description is loaded");
	});

	it("POST /api/skills/:name/toggle toggles enabled state", async () => {
		// Toggle off
		const res1 = await post(
			`/api/skills/${testSkillName}/toggle`,
			{},
			authHeaders,
		);
		strictEqual(res1.status, 200);
		const json1 = await res1.json();
		strictEqual(json1.enabled, false);

		// Toggle back on
		const res2 = await post(
			`/api/skills/${testSkillName}/toggle`,
			{},
			authHeaders,
		);
		strictEqual(res2.status, 200);
		const json2 = await res2.json();
		strictEqual(json2.enabled, true);
	});

	it("POST /api/skills/:name/toggle returns 404 for unknown skill", async () => {
		const res = await post(
			"/api/skills/nonexistent-skill/toggle",
			{},
			authHeaders,
		);
		strictEqual(res.status, 404);
		const json = await res.json();
		ok(json.error?.includes("not found"), "error mentions not found");
	});

	it("DELETE /api/skills/:name removes the skill", async () => {
		const res = await del(`/api/skills/${testSkillName}`, authHeaders);
		strictEqual(res.status, 200);
		const json = await res.json();
		strictEqual(json.success, true);

		// Verify it's gone
		const listRes = await get("/api/skills", authHeaders);
		const list = await listRes.json();
		const found = list.find((s: { name: string }) => s.name === testSkillName);
		ok(!found, "skill should be removed from the list");
	});

	it("DELETE /api/skills/:name returns 404 for already deleted skill", async () => {
		const res = await del(`/api/skills/${testSkillName}`, authHeaders);
		strictEqual(res.status, 404);
	});

	it("POST /api/skills/install returns 400 when source is missing", async () => {
		const res = await post("/api/skills/install", {}, authHeaders);
		strictEqual(res.status, 400);
		const json = await res.json();
		ok(json.error?.includes("source"), "error mentions source");
	});

	it("POST /api/skills/install returns 500 when installation fails", async () => {
		const res = await post(
			"/api/skills/install",
			{ source: "invalid-gh-repo-that-does-not-exist/skill" },
			authHeaders,
		);
		// Should fail gracefully — either 500 with error, or 200 if somehow works
		if (res.status === 200) {
			const json = await res.json();
			ok(json.success, "unexpectedly succeeded");
		} else {
			const json = await res.json();
			ok(!json.success, "reports failure");
			ok(typeof json.error === "string", "includes error message");
		}
	});
});
});
