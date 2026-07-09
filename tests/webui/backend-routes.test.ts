/**
 * Functional tests for WebUI backend routing.
 * Tests that the route table handles all expected endpoints.
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { WebUIBackend } from "../../src/webui/backend.js";

void describe("WebUIBackend routing", () => {
	let backend: WebUIBackend;

	before(async () => {
		// Minimal config for testing
		backend = new WebUIBackend(
			{ port: 0, host: "localhost" } as never,
			"/tmp/synthtek-test",
			null as never,
			null as never,
			null as never,
		);
		await backend.start();
	});

	void it("GET /api/health returns 200", () => {
		const response = backend.handleRequest("GET", "/api/health", {}, "");
		assert.equal(response.status, 200);
		assert.ok(response.body);
	});

	void it("GET /api/sessions returns sessions array", () => {
		const response = backend.handleRequest("GET", "/api/sessions", {}, "");
		assert.equal(response.status, 200);
		assert.ok(Array.isArray(response.body));
	});

	void it("DELETE /api/sessions/nonexistent returns 404", () => {
		const response = backend.handleRequest(
			"DELETE",
			"/api/sessions/nonexistent",
			{},
			"",
		);
		assert.equal(response.status, 404);
	});

	void it("GET /api/nonexistent returns 404", () => {
		const response = backend.handleRequest("GET", "/api/nonexistent", {}, "");
		assert.equal(response.status, 404);
	});

	void it("POST to read-only endpoint rejects", () => {
		// POST to a GET-only endpoint should fail
		const response = backend.handleRequest("POST", "/api/health", {}, "");
		assert.ok(response.status === 404 || response.status === 405);
	});
});
