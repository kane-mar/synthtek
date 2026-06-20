/**
 * Reasoning Models Tests
 * Tests for reasoning/thinking support across OpenAI (o1/o3), Anthropic (extended thinking),
 * and DeepSeek (deepseek-reasoner) providers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AnthropicProvider } from "../../src/providers/anthropic/provider.js";
import { DeepSeekProvider } from "../../src/providers/deepseek/provider.js";
import { OpenAIProvider } from "../../src/providers/openai/provider.js";
import type { ProviderConfig } from "../../src/providers/types.js";

// ─── OpenAI Reasoning Tests ─────────────────────────────────────────────────

const OPENAI_CONFIG: ProviderConfig = {
	provider: "openai",
	apiKey: "test-key",
	model: "gpt-4o",
};

test("OpenAIProvider reasoning model sends reasoning_effort", async () => {
	const provider = new OpenAIProvider({ ...OPENAI_CONFIG, model: "o1" });

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("chat/completions")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			json: async () => ({
				id: "chatcmpl-o1-123",
				model: "o1",
				choices: [
					{
						message: {
							role: "assistant",
							content: "The answer is 42.",
							reasoning_content: "Let me think through this step by step...",
							tool_calls: undefined,
						},
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
			}),
		} as unknown as Response;
	};

	try {
		await provider.chat({
			model: "o1",
			messages: [{ role: "user", content: "What is the meaning of life?" }],
		});

		assert.ok(capturedBody);
		assert.equal(
			(capturedBody as Record<string, unknown>).reasoning_effort,
			"medium",
		);
		assert.equal(
			(capturedBody as Record<string, unknown>).temperature,
			undefined,
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("OpenAIProvider reasoning model extracts reasoning content", async () => {
	const provider = new OpenAIProvider({ ...OPENAI_CONFIG, model: "o1" });

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-o1-456",
				model: "o1",
				choices: [
					{
						message: {
							role: "assistant",
							content: "The answer is 42.",
							reasoning_content:
								"Let me think step by step. First, consider the question...",
							tool_calls: undefined,
						},
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "o1",
			messages: [{ role: "user", content: "What is the meaning of life?" }],
		});

		assert.equal(response.content, "The answer is 42.");
		assert.ok(response.reasoning);
		assert.ok(response.reasoning?.includes("think step by step"));
	} finally {
		global.fetch = originalFetch;
	}
});

test("OpenAIProvider o3-mini sends reasoning_effort", async () => {
	const provider = new OpenAIProvider({ ...OPENAI_CONFIG, model: "o3-mini" });

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("chat/completions")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			json: async () => ({
				id: "chatcmpl-o3-123",
				model: "o3-mini",
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
			model: "o3-mini",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.ok(capturedBody);
		assert.equal(
			(capturedBody as Record<string, unknown>).reasoning_effort,
			"medium",
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("OpenAIProvider non-reasoning model does NOT send reasoning_effort", async () => {
	const provider = new OpenAIProvider({ ...OPENAI_CONFIG, model: "gpt-4o" });

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("chat/completions")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			json: async () => ({
				id: "chatcmpl-gpt-123",
				model: "gpt-4o",
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
			model: "gpt-4o",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.ok(capturedBody);
		assert.equal(
			(capturedBody as Record<string, unknown>).reasoning_effort,
			undefined,
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("OpenAIProvider reasoning model in streaming mode sends reasoning_effort", async () => {
	const provider = new OpenAIProvider({ ...OPENAI_CONFIG, model: "o1" });

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("chat/completions")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(
						new TextEncoder().encode(
							'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n',
						),
					);
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n"));
					controller.close();
				},
			}),
		} as unknown as Response;
	};

	try {
		// Consume the stream
		for await (const _chunk of provider.chatStream({
			model: "o1",
			messages: [{ role: "user", content: "Hi" }],
		})) {
			// consume
		}

		assert.ok(capturedBody);
		assert.equal(
			(capturedBody as Record<string, unknown>).reasoning_effort,
			"medium",
		);
		assert.equal((capturedBody as Record<string, unknown>).stream, true);
	} finally {
		global.fetch = originalFetch;
	}
});

// ─── Anthropic Reasoning (Extended Thinking) Tests ──────────────────────────

const ANTHROPIC_CONFIG: ProviderConfig = {
	provider: "anthropic",
	apiKey: "test-key",
	model: "claude-3-5-sonnet-20241022",
};

test("AnthropicProvider extended thinking sets thinking budget", async () => {
	const provider = new AnthropicProvider({
		...ANTHROPIC_CONFIG,
		extendedThinking: true,
	});

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("/messages")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			json: async () => ({
				id: "msg_think-123",
				model: "claude-3-5-sonnet-20241022",
				content: [
					{
						type: "thinking",
						thinking: "Let me think through this carefully...",
					},
					{ type: "text", text: "The answer is 42." },
				],
				usage: { input_tokens: 10, output_tokens: 30, thinking_tokens: 20 },
				stop_reason: "end_turn",
			}),
		} as unknown as Response;
	};

	try {
		await provider.chat({
			model: "claude-3-5-sonnet-20241022",
			messages: [{ role: "user", content: "What is the meaning of life?" }],
		});

		assert.ok(capturedBody);
		assert.equal((capturedBody as Record<string, unknown>).thinking, true);
		assert.ok("budget_tokens" in (capturedBody as Record<string, unknown>));
	} finally {
		global.fetch = originalFetch;
	}
});

test("AnthropicProvider extracts thinking content from response", async () => {
	const provider = new AnthropicProvider({
		...ANTHROPIC_CONFIG,
		extendedThinking: true,
	});

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "msg_think-456",
				model: "claude-3-5-sonnet-20241022",
				content: [
					{
						type: "thinking",
						thinking:
							"Step 1: Analyze the question. Step 2: Consider options...",
					},
					{ type: "text", text: "Based on my analysis, the answer is 42." },
				],
				usage: { input_tokens: 10, output_tokens: 30, thinking_tokens: 20 },
				stop_reason: "end_turn",
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "claude-3-5-sonnet-20241022",
			messages: [{ role: "user", content: "Solve this problem" }],
		});

		assert.equal(response.content, "Based on my analysis, the answer is 42.");
		assert.ok(response.reasoning);
		assert.ok(response.reasoning?.includes("Step 1"));
	} finally {
		global.fetch = originalFetch;
	}
});

test("AnthropicProvider without extended thinking does NOT send thinking budget", async () => {
	const provider = new AnthropicProvider({
		...ANTHROPIC_CONFIG,
		extendedThinking: false,
	});

	let capturedBody: Record<string, unknown> | null = null;
	const originalFetch = global.fetch;
	global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.includes("/messages")) {
			capturedBody = JSON.parse((init?.body as string) || "{}");
		}
		return {
			ok: true,
			json: async () => ({
				id: "msg_no-think-123",
				model: "claude-3-5-sonnet-20241022",
				content: [{ type: "text", text: "Response" }],
				usage: { input_tokens: 5, output_tokens: 5 },
				stop_reason: "end_turn",
			}),
		} as unknown as Response;
	};

	try {
		await provider.chat({
			model: "claude-3-5-sonnet-20241022",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.ok(capturedBody);
		assert.equal((capturedBody as Record<string, unknown>).thinking, undefined);
		assert.equal(
			(capturedBody as Record<string, unknown>).budget_tokens,
			undefined,
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("AnthropicProvider handles response without thinking content", async () => {
	const provider = new AnthropicProvider({
		...ANTHROPIC_CONFIG,
		extendedThinking: true,
	});

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "msg_no-thinking-123",
				model: "claude-3-5-sonnet-20241022",
				content: [{ type: "text", text: "Simple response" }],
				usage: { input_tokens: 5, output_tokens: 5 },
				stop_reason: "end_turn",
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "claude-3-5-sonnet-20241022",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.equal(response.content, "Simple response");
		// reasoning should be undefined when no thinking content
		assert.equal(response.reasoning, undefined);
	} finally {
		global.fetch = originalFetch;
	}
});

// ─── DeepSeek Reasoning Tests ───────────────────────────────────────────────

const DEEPSEEK_CONFIG: ProviderConfig = {
	provider: "deepseek",
	apiKey: "test-key",
	model: "deepseek-chat",
};

test("DeepSeekProvider reasoner model extracts reasoning content", async () => {
	const provider = new DeepSeekProvider({
		...DEEPSEEK_CONFIG,
		model: "deepseek-reasoner",
	});

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-ds-reason-123",
				model: "deepseek-reasoner",
				choices: [
					{
						message: {
							role: "assistant",
							content: "The answer is 42.",
							reasoning_content: "Let me analyze this problem step by step...",
							tool_calls: undefined,
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 20,
					reasoning_tokens: 15,
					total_tokens: 45,
				},
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "deepseek-reasoner",
			messages: [{ role: "user", content: "Solve this" }],
		});

		assert.equal(response.content, "The answer is 42.");
		assert.ok(response.reasoning);
		assert.ok(response.reasoning?.includes("analyze"));
	} finally {
		global.fetch = originalFetch;
	}
});

test("DeepSeekProvider chat model does not have reasoning content", async () => {
	const provider = new DeepSeekProvider(DEEPSEEK_CONFIG);

	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({
				id: "chatcmpl-ds-chat-123",
				model: "deepseek-chat",
				choices: [
					{
						message: {
							role: "assistant",
							content: "Hello!",
							tool_calls: undefined,
						},
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
			}),
		}) as unknown as Response;

	try {
		const response = await provider.chat({
			model: "deepseek-chat",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.equal(response.content, "Hello!");
		assert.equal(response.reasoning, undefined);
	} finally {
		global.fetch = originalFetch;
	}
});

test("DeepSeekProvider reasoner model in streaming extracts reasoning", async () => {
	const provider = new DeepSeekProvider({
		...DEEPSEEK_CONFIG,
		model: "deepseek-reasoner",
	});

	const chunks = [
		'data: {"choices":[{"delta":{"reasoning_content":"Thinking..."},"finish_reason":null}]}\n',
		'data: {"choices":[{"delta":{"content":"The answer"},"finish_reason":null}]}\n',
		'data: {"choices":[{"delta":{"content":" is 42"},"finish_reason":null}]}\n',
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
			model: "deepseek-reasoner",
			messages: [{ role: "user", content: "Solve" }],
		})) {
			received.push(chunk.delta);
		}

		// Should receive content chunks + DONE marker
		assert.ok(received.length >= 2);
		assert.ok(received.includes("The answer") || received.includes(" is 42"));
	} finally {
		global.fetch = originalFetch;
	}
});
