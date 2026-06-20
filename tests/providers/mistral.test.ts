/**
 * Mistral Provider Tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import { MistralProvider } from "../../src/providers/mistral/provider.js";
import type { ProviderConfig } from "../../src/providers/types.js";

const TEST_CONFIG: ProviderConfig = {
	provider: "mistral",
	apiKey: "test-key",
	model: "mistral-large-latest",
};

test("MistralProvider has correct name", () => {
	const provider = new MistralProvider(TEST_CONFIG);
	assert.equal(provider.name, "mistral");
});

test("MistralProvider returns config", () => {
	const provider = new MistralProvider(TEST_CONFIG);
	const config = provider.getConfig();

	assert.equal(config.provider, "mistral");
	assert.equal(config.apiKey, "test-key");
	assert.equal(config.model, "mistral-large-latest");
	assert.equal(config.baseUrl, "https://api.mistral.ai/v1");
	assert.equal(config.timeout, 60_000);
	assert.equal(config.retries, 3);
	assert.equal(config.retryDelay, 1000);
});

test("MistralProvider uses default baseUrl", () => {
	const provider = new MistralProvider({
		provider: "mistral",
		apiKey: "test-key",
	});
	const config = provider.getConfig();
	assert.equal(config.baseUrl, "https://api.mistral.ai/v1");
});

test("MistralProvider uses custom baseUrl", () => {
	const provider = new MistralProvider({
		provider: "mistral",
		apiKey: "test-key",
		baseUrl: "https://custom.mistral.ai/v1",
	});
	const config = provider.getConfig();
	assert.equal(config.baseUrl, "https://custom.mistral.ai/v1");
});

test("MistralProvider healthCheck returns boolean", async () => {
	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({ data: [] }),
		}) as unknown as Response;

	try {
		const provider = new MistralProvider(TEST_CONFIG);
		const result = await provider.healthCheck();
		assert.equal(typeof result, "boolean");
	} finally {
		global.fetch = originalFetch;
	}
});

test("MistralProvider chat returns response with required fields", async () => {
	const provider = new MistralProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-ms-123",
				model: "mistral-large-latest",
				choices: [
					{
						message: {
							role: "assistant",
							content: "Hello from Mistral!",
							tool_calls: undefined,
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 8,
					total_tokens: 18,
				},
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "mistral-large-latest",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.equal(response.content, "Hello from Mistral!");
		assert.equal(response.model, "mistral-large-latest");
		assert.equal(response.inputTokens, 10);
		assert.equal(response.outputTokens, 8);
		assert.equal(response.totalTokens, 18);
		assert.ok(typeof response.cost === "number");
		assert.equal(response.finishReason, "stop");
		assert.equal(response.id, "chatcmpl-ms-123");
	} finally {
		global.fetch = originalFetch;
	}
});

test("MistralProvider chat handles tool calls", async () => {
	const provider = new MistralProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-ms-456",
				model: "mistral-large-latest",
				choices: [
					{
						message: {
							role: "assistant",
							content: null,
							tool_calls: [
								{
									id: "call_ms_123",
									type: "function",
									function: { name: "search", arguments: '{"query":"test"}' },
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
				usage: {
					prompt_tokens: 20,
					completion_tokens: 10,
					total_tokens: 30,
				},
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "mistral-large-latest",
			messages: [{ role: "user", content: "Search for something" }],
		});

		assert.ok(response.toolCalls);
		assert.equal(response.toolCalls?.length, 1);
		assert.equal(response.toolCalls?.[0].id, "call_ms_123");
		assert.equal(response.toolCalls?.[0].name, "search");
		assert.deepStrictEqual(response.toolCalls?.[0].arguments, {
			query: "test",
		});
	} finally {
		global.fetch = originalFetch;
	}
});

test("MistralProvider chatStream yields chunks", async () => {
	const provider = new MistralProvider(TEST_CONFIG);

	const chunks = [
		'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n',
		'data: {"choices":[{"delta":{"content":" from"},"finish_reason":null}]}\n',
		'data: {"choices":[{"delta":{"content":"Mistral"},"finish_reason":null}]}\n',
		"data: [DONE]\n",
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
		for await (const chunk of provider.chatStream({
			model: "mistral-large-latest",
			messages: [{ role: "user", content: "Hi" }],
		})) {
			received.push(chunk.delta);
		}

		assert.equal(received.length, 4);
		assert.equal(received[0], "Hello");
		assert.equal(received[1], " from");
		assert.equal(received[2], "Mistral");
		assert.equal(received[3], "");
	} finally {
		global.fetch = originalFetch;
	}
});

test("MistralProvider listModels returns array", async () => {
	const provider = new MistralProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				data: [
					{ id: "mistral-large-latest" },
					{ id: "mistral-small-latest" },
					{ id: "mistral-tiny" },
				],
			}),
		}) as unknown as Response;

	try {
		const models = await provider.listModels();
		assert.ok(Array.isArray(models));
		assert.equal(models.length, 3);
		assert.ok(models.includes("mistral-large-latest"));
		assert.ok(models.includes("mistral-small-latest"));
		assert.ok(models.includes("mistral-tiny"));
	} finally {
		global.fetch = originalFetch;
	}
});

test("MistralProvider handles API errors", async () => {
	const provider = new MistralProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: false,
			status: 401,
			text: async () => "Invalid API key",
		}) as unknown as Response;

	try {
		await assert.rejects(
			() =>
				provider.chat({
					model: "mistral-large-latest",
					messages: [{ role: "user", content: "Hi" }],
				}),
			/Mistral API error \(401\)/,
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("MistralProvider respects system prompt", async () => {
	const provider = new MistralProvider(TEST_CONFIG);

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("chat/completions")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			json: async () => ({
				id: "chatcmpl-ms-789",
				model: "mistral-large-latest",
				choices: [
					{
						message: {
							role: "assistant",
							content: "Response",
							tool_calls: undefined,
						},
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
			}),
		} as unknown as Response;
	};

	try {
		await provider.chat({
			model: "mistral-large-latest",
			system: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.ok(capturedBody);
		const msgs = (capturedBody as Record<string, unknown>).messages as Array<{
			role: string;
			content: string;
		}>;
		assert.ok(Array.isArray(msgs));
		assert.equal(msgs[0].role, "system");
		assert.equal(msgs[0].content, "You are a helpful assistant.");
	} finally {
		global.fetch = originalFetch;
	}
});

test("MistralProvider calculates cost correctly", async () => {
	const provider = new MistralProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-ms-cost",
				model: "mistral-large-latest",
				choices: [
					{
						message: {
							role: "assistant",
							content: "Response",
							tool_calls: undefined,
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 1_000_000,
					completion_tokens: 1_000_000,
					total_tokens: 2_000_000,
				},
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "mistral-large-latest",
			messages: [{ role: "user", content: "Hi" }],
		});

		// mistral-large-latest: $3 input + $9 output per 1M = $12 for 1M each
		assert.equal(response.cost, 12);
	} finally {
		global.fetch = originalFetch;
	}
});
