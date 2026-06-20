/**
 * Provider Registration E2E Test
 *
 * Verifies that all provider types are properly registered in the registry
 * so the chat endpoint doesn't return "Provider type ... not supported".
 *
 * Regression test for: import chain bypassed auto-registration in index.ts
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8080";
const API = `${BASE_URL}/api`;

interface ApiResponse {
	status: number;
	body: any;
}

async function apiPost(
	page: any,
	path: string,
	data: any,
): Promise<ApiResponse> {
	const response = await page.request.post(`${API}${path}`, {
		data,
		headers: { "Content-Type": "application/json" },
	});
	let body: any;
	try {
		body = await response.json();
	} catch {
		body = null;
	}
	return { status: response.status(), body };
}

async function apiGet(page: any, path: string): Promise<ApiResponse> {
	const response = await page.request.get(`${API}${path}`);
	let body: any;
	try {
		body = await response.json();
	} catch {
		body = null;
	}
	return { status: response.status(), body };
}

test.describe("Provider Registration", () => {
	test("all provider types are listed in presets", async ({ page }) => {
		await page.goto(BASE_URL);

		const { status, body: presets } = await apiGet(page, "/providers/presets");
		expect(status).toBe(200);

		// Every provider in the presets must be registered in the registry
		const providerTypes = Object.keys(presets);
		expect(providerTypes).toContain("openai");
		expect(providerTypes).toContain("deepseek");
		expect(providerTypes).toContain("anthropic");
		expect(providerTypes).toContain("openrouter");
		expect(providerTypes).toContain("ollama");
		expect(providerTypes).toContain("lmstudio");
		expect(providerTypes).toContain("llamacpp");
		expect(providerTypes).toContain("qwen");
		expect(providerTypes).not.toContain("lm-studio"); // old name
	});

	test("deepseek type is accepted by chat endpoint", async ({ page }) => {
		await page.goto(BASE_URL);

		// Step 1: Create a session
		const session = await apiPost(page, "/sessions", { userId: "e2e-test" });
		expect(session.status).toBe(201); // POST returns 201 Created
		const sessionId = session.body?.id;
		expect(sessionId).toBeTruthy();

		// Step 2: Create a DeepSeek provider
		const provider = await apiPost(page, "/providers", {
			name: "E2E DeepSeek Test",
			type: "deepseek",
			baseUrl: "https://api.deepseek.com/v1",
			apiKey: "sk-e2e-test-dummy",
			models: ["deepseek-chat"],
			defaultModel: "deepseek-chat",
		});
		expect(provider.status).toBe(201);

		// Step 3: Try to send a chat message
		// This should FAIL because there's no real API key, but it should NOT
		// fail with "Provider type 'deepseek' not supported"
		const chat = await apiPost(page, "/chat/completions", {
			sessionId,
			messages: [{ role: "user", content: "Hello" }],
			providerId: provider.body?.id,
		});

		// The error should NOT be about unsupported provider type
		if (chat.status !== 200) {
			const errorMsg = chat.body?.error || "";
			expect(errorMsg).not.toContain("not supported");
			// Expected: connection/auth error, not a registry error
			expect(errorMsg).toContain("Chat completion failed");
		}
	});

	test("every preset provider type is registered in the registry", async ({
		page,
	}) => {
		await page.goto(BASE_URL);

		const { body: presets } = await apiGet(page, "/providers/presets");
		const providerTypes = Object.keys(presets);

		// For each provider type, create it and verify the chat endpoint
		// doesn't reject it as unsupported
		const session = await apiPost(page, "/sessions", {
			userId: "e2e-bulk-test",
		});
		const sessionId = session.body?.id;

		for (const type of providerTypes) {
			// Skip 'custom' type — it has no model/defaultModel
			if (type === "custom") continue;

			// Create provider
			const provider = await apiPost(page, "/providers", {
				name: `E2E Test ${type}`,
				type,
				baseUrl: presets[type]?.baseUrl || "http://localhost:9999/v1",
				apiKey: "sk-e2e-test-dummy",
				models: presets[type]?.models || ["test-model"],
				defaultModel: presets[type]?.defaultModel || "test-model",
			});
			expect(provider.status).toBe(201);

			// Try chat — should NOT say "not supported"
			const chat = await apiPost(page, "/chat/completions", {
				sessionId,
				messages: [{ role: "user", content: "Hi" }],
				providerId: provider.body?.id,
			});

			if (chat.status !== 200) {
				const errorMsg = chat.body?.error || "";
				expect(errorMsg).not.toContain(
					"not supported",
					`Provider type "${type}" should be registered, got: ${errorMsg}`,
				);
			}
		}
	});

	test("deleting a provider and recreating it still works", async ({
		page,
	}) => {
		await page.goto(BASE_URL);

		// Create
		const created = await apiPost(page, "/providers", {
			name: "E2E Temp",
			type: "openai",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "sk-e2e-temp",
			models: ["gpt-4o"],
			defaultModel: "gpt-4o",
		});
		expect(created.status).toBe(201);
		const providerId = created.body?.id;

		// Delete
		const deleted = await page.request.delete(`${API}/providers/${providerId}`);
		expect(deleted.status()).toBe(200);

		// Recreate with same name
		const recreated = await apiPost(page, "/providers", {
			name: "E2E Temp",
			type: "openai",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "sk-e2e-temp",
			models: ["gpt-4o"],
			defaultModel: "gpt-4o",
		});
		expect(recreated.status).toBe(201);
	});
});
