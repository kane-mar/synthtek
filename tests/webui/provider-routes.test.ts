/**
 * Provider Routes Tests
 *
 * Tests that provider CRUD routes handle persistence errors correctly.
 */

import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { ProviderManager } from "../../src/webui/provider-manager.js";
import { handleProviderRoutes } from "../../src/webui/provider-routes.js";

const isRoot = typeof process.getuid === "function" && process.getuid() === 0;

describe("ProviderRoutes", () => {
	const baseDir = mkdtempSync(join(tmpdir(), "synthtek-pr-"));

	function freshWorkspace() {
		return mkdtempSync(join(baseDir, "w-"));
	}

	it("returns 201 on POST /api/providers", () => {
		const mgr = new ProviderManager(freshWorkspace());
		const result = handleProviderRoutes(
			"POST",
			"/api/providers",
			{
				name: "Test",
				type: "openai",
				baseUrl: "",
				apiKey: "sk-test",
				models: [],
				defaultModel: "",
			},
			mgr,
		);
		assert.equal(result.handled, true);
		assert.ok(result.response);
		assert.equal(result.response.status, 201);
		const apiBody = result.response.body as { id: string; name: string };
		assert.ok(apiBody.id);
		assert.equal(apiBody.name, "Test");
	});

	it("returns 400 on POST /api/providers with missing name", () => {
		const mgr = new ProviderManager(freshWorkspace());
		const result = handleProviderRoutes(
			"POST",
			"/api/providers",
			{
				type: "openai",
			},
			mgr,
		);
		assert.equal(result.handled, true);
		assert.ok(result.response);
		assert.equal(result.response.status, 400);
	});

	it("returns provider list on GET /api/providers", () => {
		const ws = freshWorkspace();
		const mgr = new ProviderManager(ws);
		mgr.create({
			name: "A",
			type: "openai",
			baseUrl: "",
			apiKey: "",
			models: [],
			defaultModel: "",
		});
		const result = handleProviderRoutes("GET", "/api/providers", {}, mgr);
		assert.equal(result.handled, true);
		assert.ok(result.response);
		assert.equal(result.response.status, 200);
		assert.equal((result.response.body as Array<unknown>).length, 1);
	});

	it("returns diagnostics on GET /api/providers/diagnostics", () => {
		const ws = freshWorkspace();
		const mgr = new ProviderManager(ws);
		const result = handleProviderRoutes(
			"GET",
			"/api/providers/diagnostics",
			{},
			mgr,
		);
		assert.equal(result.handled, true);
		assert.ok(result.response);
		assert.equal(result.response.status, 200);
		const diagBody = result.response.body as {
			dataPath: string;
			providerCount: number;
		};
		assert.ok(diagBody.dataPath);
		assert.equal(diagBody.providerCount, 0);
	});

	it("returns 200 on PUT /api/providers/:id", () => {
		const ws = freshWorkspace();
		const mgr = new ProviderManager(ws);
		const p = mgr.create({
			name: "Update Target",
			type: "openai",
			baseUrl: "",
			apiKey: "",
			models: [],
			defaultModel: "",
		});
		const result = handleProviderRoutes(
			"PUT",
			`/api/providers/${p.id}`,
			{ name: "Updated" },
			mgr,
		);
		assert.equal(result.handled, true);
		assert.ok(result.response);
		assert.equal(result.response.status, 200);
	});

	it("returns 404 on PUT /api/providers/nonexistent", () => {
		const mgr = new ProviderManager(freshWorkspace());
		const result = handleProviderRoutes(
			"PUT",
			"/api/providers/nonexistent",
			{ name: "Nope" },
			mgr,
		);
		assert.equal(result.handled, true);
		assert.ok(result.response);
		assert.equal(result.response.status, 404);
	});

	it("returns 200 on DELETE /api/providers/:id", () => {
		const ws = freshWorkspace();
		const mgr = new ProviderManager(ws);
		const p = mgr.create({
			name: "Delete Target",
			type: "openai",
			baseUrl: "",
			apiKey: "",
			models: [],
			defaultModel: "",
		});
		const result = handleProviderRoutes(
			"DELETE",
			`/api/providers/${p.id}`,
			{},
			mgr,
		);
		assert.equal(result.handled, true);
		assert.ok(result.response);
		assert.equal(result.response.status, 200);
	});

	it("returns 404 on DELETE /api/providers/nonexistent", () => {
		const mgr = new ProviderManager(freshWorkspace());
		const result = handleProviderRoutes(
			"DELETE",
			"/api/providers/nonexistent",
			{},
			mgr,
		);
		assert.equal(result.handled, true);
		assert.ok(result.response);
		assert.equal(result.response.status, 404);
	});

	it("returns 500 on POST when persistence fails", { skip: isRoot }, () => {
		const ws = freshWorkspace();
		// Make the config directory read-only
		const configDir = join(ws, "config");
		mkdirSync(configDir, { recursive: true });
		chmodSync(ws, 0o444);
		try {
			const mgr = new ProviderManager(ws);
			const result = handleProviderRoutes(
				"POST",
				"/api/providers",
				{
					name: "Should Fail",
					type: "openai",
					baseUrl: "",
					apiKey: "",
					models: [],
					defaultModel: "",
				},
				mgr,
			);
			assert.equal(result.handled, true);
			assert.ok(result.response);
			assert.equal(result.response.status, 500);
			assert.ok(
				(result.response.body as { error: string }).error.includes(
					"Failed to persist",
				),
			);
		} finally {
			chmodSync(ws, 0o755);
		}
	});

	after(() => rmSync(baseDir, { recursive: true, force: true }));
});
