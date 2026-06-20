/**
 * vLLM Provider Tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderConfig } from "../../src/providers/types.js";
import { VLLMProvider } from "../../src/providers/vllm/provider.js";

const TEST_CONFIG: ProviderConfig = {
	provider: "vllm",
	apiKey: "vllm",
	model: "meta-llama/Llama-2-7b-chat-hf",
};

test("VLLMProvider has correct name", () => {
	const provider = new VLLMProvider(TEST_CONFIG);
	assert.equal(provider.name, "vllm");
});

test("VLLMProvider returns config", () => {
	const provider = new VLLMProvider(TEST_CONFIG);
	const config = provider.getConfig();

	assert.equal(config.provider, "vllm");
	assert.equal(config.apiKey, "vllm");
	assert.equal(config.model, "meta-llama/Llama-2-7b-chat-hf");
	assert.equal(config.baseUrl, "http://localhost:8000/v1");
	assert.equal(config.timeout, 120_000);
	assert.equal(config.retries, 2);
	assert.equal(config.retryDelay, 1000);
});

test("VLLMProvider uses default baseUrl", () => {
	const provider = new VLLMProvider({
		provider: "vllm",
		apiKey: "vllm",
	});
	const config = provider.getConfig();
	assert.equal(config.baseUrl, "http://localhost:8000/v1");
});

test("VLLMProvider uses custom baseUrl", () => {
	const provider = new VLLMProvider({
		provider: "vllm",
		apiKey: "vllm",
		baseUrl: "http://remote-server:8000/v1",
	});
	const config = provider.getConfig();
	assert.equal(config.baseUrl, "http://remote-server:8000/v1");
});

test("VLLMProvider healthCheck returns boolean", async () => {
	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({ data: [] }),
		}) as unknown as Response;

	try {
		const provider = new VLLMProvider(TEST_CONFIG);
		const result = await provider.healthCheck();
		assert.equal(typeof result, "boolean");
	} finally {
		global.fetch = originalFetch;
	}
});

test("VLLMProvider chat returns response with required fields", async () => {
	const provider = new VLLMProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-vllm-123",
				model: "meta-llama/Llama-2-7b-chat-hf",
				choices: [
					{
						message: {
							role: "assistant",
							content: "Hello from vLLM!",
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
			model: "meta-llama/Llama-2-7b-chat-hf",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.equal(response.content, "Hello from vLLM!");
		assert.equal(response.model, "meta-llama/Llama-2-7b-chat-hf");
		assert.equal(response.inputTokens, 10);
		assert.equal(response.outputTokens, 8);
		assert.equal(response.totalTokens, 18);
		assert.equal(response.cost, 0); // vLLM is free (local)
		assert.equal(response.finishReason, "stop");
		assert.equal(response.id, "chatcmpl-vllm-123");
	} finally {
		global.fetch = originalFetch;
	}
});

test("VLLMProvider chat handles tool calls", async () => {
	const provider = new VLLMProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-vllm-456",
				model: "meta-llama/Llama-2-7b-chat-hf",
				choices: [
					{
						message: {
							role: "assistant",
							content: null,
							tool_calls: [
								{
									id: "call_vllm_123",
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
			model: "meta-llama/Llama-2-7b-chat-hf",
			messages: [{ role: "user", content: "Search for something" }],
		});

		assert.ok(response.toolCalls);
		assert.equal(response.toolCalls?.length, 1);
		assert.equal(response.toolCalls?.[0].id, "call_vllm_123");
		assert.equal(response.toolCalls?.[0].name, "search");
		assert.deepStrictEqual(response.toolCalls?.[0].arguments, {
			query: "test",
		});
	} finally {
		global.fetch = originalFetch;
	}
});

test("VLLMProvider chatStream yields chunks", async () => {
	const provider = new VLLMProvider(TEST_CONFIG);

	const chunks = [
		'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n',
		'data: {"choices":[{"delta":{"content":" from"},"finish_reason":null}]}\n',
		'data: {"choices":[{"delta":{"content":"vLLM"},"finish_reason":null}]}\n',
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
			model: "meta-llama/Llama-2-7b-chat-hf",
			messages: [{ role: "user", content: "Hi" }],
		})) {
			received.push(chunk.delta);
		}

		assert.equal(received.length, 4);
		assert.equal(received[0], "Hello");
		assert.equal(received[1], " from");
		assert.equal(received[2], "vLLM");
		assert.equal(received[3], "");
	} finally {
		global.fetch = originalFetch;
	}
});

test("VLLMProvider listModels returns array", async () => {
	const provider = new VLLMProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				data: [
					{
						id: "meta-llama/Llama-2-7b-chat-hf",
						object: "model",
						owned_by: "vllm",
					},
					{
						id: "mistralai/Mistral-7B-Instruct-v0.2",
						object: "model",
						owned_by: "vllm",
					},
				],
			}),
		}) as unknown as Response;

	try {
		const models = await provider.listModels();
		assert.ok(Array.isArray(models));
		assert.equal(models.length, 2);
		assert.ok(models.includes("meta-llama/Llama-2-7b-chat-hf"));
		assert.ok(models.includes("mistralai/Mistral-7B-Instruct-v0.2"));
	} finally {
		global.fetch = originalFetch;
	}
});

test("VLLMProvider handles API errors", async () => {
	const provider = new VLLMProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: false,
			status: 500,
			text: async () => "Internal Server Error",
		}) as unknown as Response;

	try {
		await assert.rejects(
			() =>
				provider.chat({
					model: "meta-llama/Llama-2-7b-chat-hf",
					messages: [{ role: "user", content: "Hi" }],
				}),
			/vLLM API error \(500\)/,
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("VLLMProvider respects system prompt", async () => {
	const provider = new VLLMProvider(TEST_CONFIG);

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("chat/completions")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			json: async () => ({
				id: "chatcmpl-vllm-789",
				model: "meta-llama/Llama-2-7b-chat-hf",
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
			model: "meta-llama/Llama-2-7b-chat-hf",
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

test("VLLMProvider cost is always zero (local)", async () => {
	const provider = new VLLMProvider(TEST_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-vllm-cost",
				model: "meta-llama/Llama-2-7b-chat-hf",
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
					prompt_tokens: 100,
					completion_tokens: 200,
					total_tokens: 300,
				},
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "meta-llama/Llama-2-7b-chat-hf",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.equal(response.cost, 0);
	} finally {
		global.fetch = originalFetch;
	}
});
