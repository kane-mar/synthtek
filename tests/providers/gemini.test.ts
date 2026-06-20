/**
 * Gemini Provider Tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import { GeminiProvider } from "../../src/providers/gemini/provider.js";
import type { ProviderConfig } from "../../src/providers/types.js";

const TEST_CONFIG: ProviderConfig = {
	provider: "gemini",
	apiKey: "test-key",
	model: "gemini-1.5-pro",
};

test("GeminiProvider has correct name", () => {
	const provider = new GeminiProvider(TEST_CONFIG);
	assert.equal(provider.name, "gemini");
});

test("GeminiProvider returns config", () => {
	const provider = new GeminiProvider(TEST_CONFIG);
	const config = provider.getConfig();

	assert.equal(config.provider, "gemini");
	assert.equal(config.apiKey, "test-key");
	assert.equal(config.model, "gemini-1.5-pro");
	assert.equal(
		config.baseUrl,
		"https://generativelanguage.googleapis.com/v1beta",
	);
	assert.equal(config.timeout, 60_000);
	assert.equal(config.retries, 3);
	assert.equal(config.retryDelay, 1000);
});

test("GeminiProvider uses default baseUrl", () => {
	const provider = new GeminiProvider({
		provider: "gemini",
		apiKey: "test-key",
	});
	const config = provider.getConfig();
	assert.equal(
		config.baseUrl,
		"https://generativelanguage.googleapis.com/v1beta",
	);
});

test("GeminiProvider uses custom baseUrl", () => {
	const provider = new GeminiProvider({
		provider: "gemini",
		apiKey: "test-key",
		baseUrl: "https://custom.gemini.com/v1beta",
	});
	const config = provider.getConfig();
	assert.equal(config.baseUrl, "https://custom.gemini.com/v1beta");
});

test("GeminiProvider healthCheck returns boolean", async () => {
	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({}),
		}) as unknown as Response;

	try {
		const provider = new GeminiProvider(TEST_CONFIG);
		const result = await provider.healthCheck();
		assert.equal(typeof result, "boolean");
	} finally {
		global.fetch = originalFetch;
	}
});

test("GeminiProvider chat returns response with required fields", async () => {
	const provider = new GeminiProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				candidates: [
					{
						content: {
							parts: [{ text: "Hello from Gemini!" }],
						},
						finishReason: "STOP",
					},
				],
				usageMetadata: {
					promptTokenCount: 10,
					candidatesTokenCount: 8,
					totalTokenCount: 18,
				},
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "gemini-1.5-pro",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.equal(response.content, "Hello from Gemini!");
		assert.equal(response.model, "gemini-1.5-pro");
		assert.equal(response.inputTokens, 10);
		assert.equal(response.outputTokens, 8);
		assert.equal(response.totalTokens, 18);
		assert.ok(typeof response.cost === "number");
		assert.equal(response.finishReason, "STOP");
	} finally {
		global.fetch = originalFetch;
	}
});

test("GeminiProvider chatStream yields chunks", async () => {
	const provider = new GeminiProvider(TEST_CONFIG);

	const chunks = [
		'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n',
		'data: {"candidates":[{"content":{"parts":[{"text":" from"}]}}]}\n',
		'data: {"candidates":[{"content":{"parts":[{"text":"Gemini"}]},"finishReason":"STOP"}]}\n',
	];

	const readableStream = new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(new TextEncoder().encode(chunk));
			}
			controller.close();
		},
	});

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			body: readableStream,
		}) as unknown as Response;

	try {
		const received: string[] = [];
		let doneReceived = false;
		for await (const chunk of provider.chatStream({
			model: "gemini-1.5-pro",
			messages: [{ role: "user", content: "Hi" }],
		})) {
			received.push(chunk.delta);
			if (chunk.done) doneReceived = true;
		}

		// Verify all text parts were received and stream completed
		const combinedText = received.join("");
		assert.ok(combinedText.includes("Hello"), 'should contain "Hello"');
		assert.ok(combinedText.includes(" from"), 'should contain " from"');
		assert.ok(combinedText.includes("Gemini"), 'should contain "Gemini"');
		assert.ok(doneReceived, "should receive done signal");
	} finally {
		global.fetch = originalFetch;
	}
});

test("GeminiProvider listModels returns known models", async () => {
	const provider = new GeminiProvider(TEST_CONFIG);

	const models = await provider.listModels();
	assert.ok(Array.isArray(models));
	assert.ok(models.includes("gemini-1.5-pro"));
	assert.ok(models.includes("gemini-1.5-flash"));
	assert.ok(models.includes("gemini-2.0-flash"));
});

test("GeminiProvider handles API errors", async () => {
	const provider = new GeminiProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: false,
			status: 400,
			text: async () => "Bad Request",
		}) as unknown as Response;

	try {
		await assert.rejects(
			() =>
				provider.chat({
					model: "gemini-1.5-pro",
					messages: [{ role: "user", content: "Hi" }],
				}),
			/Gemini API error \(400\)/,
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("GeminiProvider respects system prompt", async () => {
	const provider = new GeminiProvider(TEST_CONFIG);

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("generateContent")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			json: async () => ({
				candidates: [
					{
						content: { parts: [{ text: "Response" }] },
						finishReason: "STOP",
					},
				],
				usageMetadata: {
					promptTokenCount: 5,
					candidatesTokenCount: 5,
					totalTokenCount: 10,
				},
			}),
		} as unknown as Response;
	};

	try {
		await provider.chat({
			model: "gemini-1.5-pro",
			system: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.ok(capturedBody);
		const contents = (capturedBody as Record<string, unknown>)
			.contents as Array<{ role: string; parts: Array<{ text: string }> }>;
		assert.ok(Array.isArray(contents));
		assert.equal(contents[0].role, "user");
		assert.ok(contents[0].parts[0].text.includes("System:"));
	} finally {
		global.fetch = originalFetch;
	}
});
