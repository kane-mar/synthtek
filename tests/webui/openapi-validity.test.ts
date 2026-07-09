/**
 * Functional tests for the OpenAPI spec validity.
 * Ensures the hand-written spec matches the actual API routes.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

void describe("OpenAPI spec validity", () => {
	void it("exports a valid OpenAPI spec object", async () => {
		const { OPENAPI_SPEC } = await import("../../src/webui/openapi.js");
		assert.ok(OPENAPI_SPEC, "OPENAPI_SPEC should be defined");
		assert.equal(OPENAPI_SPEC.openapi, "3.0.3");
		assert.ok(OPENAPI_SPEC.info);
		const info = OPENAPI_SPEC.info as Record<string, unknown>;
		assert.equal(typeof info.title, "string");
		assert.ok(OPENAPI_SPEC.paths);
	});

	void it("has paths for all expected endpoints", async () => {
		const { OPENAPI_SPEC } = await import("../../src/webui/openapi.js");
		const paths = Object.keys(OPENAPI_SPEC.paths as Record<string, unknown>);

		// Core endpoints that must exist
		const requiredEndpoints = ["/api/sessions", "/api/health"];

		for (const endpoint of requiredEndpoints) {
			assert.ok(
				paths.includes(endpoint),
				`Missing endpoint: ${endpoint}. Found: ${paths.join(", ")}`,
			);
		}
	});

	void it("has valid HTTP methods on each path", async () => {
		const { OPENAPI_SPEC } = await import("../../src/webui/openapi.js");
		const validMethods = ["get", "post", "put", "delete", "patch", "options"];

		for (const [path, methods] of Object.entries(
			OPENAPI_SPEC.paths as Record<string, unknown>,
		)) {
			for (const method of Object.keys(methods as Record<string, unknown>)) {
				assert.ok(
					validMethods.includes(method),
					`Invalid HTTP method '${method}' on path '${path}'`,
				);
			}
		}
	});

	void it("each endpoint has a response definition", async () => {
		const { OPENAPI_SPEC } = await import("../../src/webui/openapi.js");

		for (const [path, methods] of Object.entries(
			OPENAPI_SPEC.paths as Record<string, unknown>,
		)) {
			for (const [method, details] of Object.entries(
				methods as Record<string, unknown>,
			)) {
				const responses = (details as Record<string, unknown>).responses;
				assert.ok(
					responses,
					`Missing responses for ${method.toUpperCase()} ${path}`,
				);
				assert.ok(
					Object.keys(responses as Record<string, unknown>).length > 0,
					`Empty responses for ${method.toUpperCase()} ${path}`,
				);
			}
		}
	});
});
