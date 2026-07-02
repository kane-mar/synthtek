/**
 * AgentLoop tests — integration-style via public API
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LLMProvider, StreamChunk } from "../providers/types.js";
import { AgentLoop } from "./loop.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A fake provider that returns a canned response (no tool calls) */
function echoProvider(response: string): LLMProvider {
	return {
		name: "test-echo",
		chat: async () => ({
			content: response,
			model: "echo",
			totalTokens: 10,
		}),
		chatStream: async function* () {
			// Yield content first, then done chunk (matches real provider behavior)
			yield { delta: response, done: false };
			yield {
				delta: "",
				done: true,
				usage: { promptTokens: 0, completionTokens: 10, totalTokens: 10 },
			};
		},
		listModels: async () => [],
		healthCheck: async () => true,
		getConfig: () => ({ provider: "echo", apiKey: "" }),
	};
}

/** A fake provider that responds with a tool call, then a final response */
function toolCallProvider(
	toolName: string,
	finalResponse: string,
): LLMProvider {
	let callCount = 0;
	return {
		name: "test-tool",
		chat: async () => {
			callCount++;
			if (callCount === 1) {
				return {
					content: "",
					model: "tool",
					totalTokens: 10,
					toolCalls: [{ id: "call_1", name: toolName, arguments: {} }],
				};
			}
			return { content: finalResponse, model: "tool", totalTokens: 10 };
		},
		chatStream: async function* () {
			callCount++;
			if (callCount === 1) {
				yield {
					delta: "",
					done: false,
					toolCalls: [{ id: "call_1", name: toolName, arguments: {} }],
				};
				yield { delta: "", done: true };
			} else {
				yield { delta: finalResponse, done: false };
				yield {
					delta: "",
					done: true,
					usage: { promptTokens: 0, completionTokens: 10, totalTokens: 10 },
				};
			}
		},
		listModels: async () => [],
		healthCheck: async () => true,
		getConfig: () => ({ provider: "tool", apiKey: "" }),
	};
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("AgentLoop — processMessage (non-streaming)", () => {
	it("returns a simple text response", async () => {
		const loop = new AgentLoop({ systemPrompt: "Be helpful." });
		loop.registerTool(
			{
				name: "ping",
				description: "test",
				parameters: { type: "object", properties: {} },
			},
			async () => ({ content: "pong" }),
		);

		const result = await loop.processMessage(
			{ role: "user", content: "say hello" },
			echoProvider("Hello world!"),
		);

		assert.equal(result.response, "Hello world!");
		assert.equal(result.toolCallsMade, 0);
		assert.ok(result.duration >= 0);
		assert.ok(result.tokensUsed > 0);
	});

	it("executes tool calls when LLM requests them", async () => {
		const loop = new AgentLoop({ systemPrompt: "Be helpful." });
		loop.registerTool(
			{
				name: "get_time",
				description: "Returns current time",
				parameters: { type: "object", properties: {} },
			},
			async () => ({ content: "12:00" }),
		);

		const result = await loop.processMessage(
			{ role: "user", content: "what time is it" },
			toolCallProvider("get_time", "The time is 12:00."),
		);

		assert.equal(result.response, "The time is 12:00.");
		assert.equal(result.toolCallsMade, 1);
	});

	it("respects maxToolCalls limit", async () => {
		const loop = new AgentLoop({
			systemPrompt: "Be helpful.",
			maxToolCalls: 1,
		});
		loop.registerTool(
			{
				name: "ping",
				description: "test",
				parameters: { type: "object", properties: {} },
			},
			async () => ({ content: "pong" }),
		);

		// Provider that always returns a tool call (will hit maxToolCalls=1)
		const infiniteToolProvider: LLMProvider = {
			name: "infinite-tool",
			chat: async () => ({
				content: "",
				model: "tool",
				totalTokens: 10,
				toolCalls: [{ id: "call_1", name: "ping", arguments: {} }],
			}),
			chatStream: async function* () {
				yield {
					delta: "",
					done: false,
					toolCalls: [{ id: "call_1", name: "ping", arguments: {} }],
				};
				yield { delta: "", done: true };
			},
			listModels: async () => [],
			healthCheck: async () => true,
			getConfig: () => ({ provider: "tool", apiKey: "" }),
		};

		const result = await loop.processMessage(
			{ role: "user", content: "do something" },
			infiniteToolProvider,
		);

		assert.ok(result.toolCallsMade >= 1);
		assert.ok(
			result.errors.length > 0 || result.response.includes("tool call"),
		);
	});
});

describe("AgentLoop — processMessageStream (streaming)", () => {
	it("yields chunks and returns final result", async () => {
		const loop = new AgentLoop({ systemPrompt: "Be helpful." });
		const gen = loop.processMessageStream(
			{ role: "user", content: "say hello" },
			echoProvider("Hello world!"),
		);

		const chunks: StreamChunk[] = [];
		let result: Awaited<ReturnType<typeof gen.next>>;
		do {
			result = await gen.next();
			if (result.value && !(result.value as StreamChunk).done)
				chunks.push(result.value as StreamChunk);
		} while (!result.done);

		assert.ok(chunks.length > 0);
		assert.equal(result.value.response, "Hello world!");
	});

	it("executes tool calls via streaming path", async () => {
		const loop = new AgentLoop({ systemPrompt: "Be helpful." });
		loop.registerTool(
			{
				name: "get_time",
				description: "Returns current time",
				parameters: { type: "object", properties: {} },
			},
			async () => ({ content: "12:00" }),
		);

		const gen = loop.processMessageStream(
			{ role: "user", content: "what time is it" },
			toolCallProvider("get_time", "The time is 12:00."),
		);

		const chunks: StreamChunk[] = [];
		let result: Awaited<ReturnType<typeof gen.next>>;
		do {
			result = await gen.next();
			if (result.value && !(result.value as StreamChunk).done)
				chunks.push(result.value as StreamChunk);
		} while (!result.done);

		assert.equal(result.value.response, "The time is 12:00.");
		assert.equal(result.value.toolCallsMade, 1);
	});
});

describe("AgentLoop — parity (streaming ≈ non-streaming)", () => {
	it("produces same response for simple text", async () => {
		const loop1 = new AgentLoop({ systemPrompt: "Be concise." });
		const nonStreamingResult = await loop1.processMessage(
			{ role: "user", content: "say ping" },
			echoProvider("pong"),
		);

		const loop2 = new AgentLoop({ systemPrompt: "Be concise." });
		const gen = loop2.processMessageStream(
			{ role: "user", content: "say ping" },
			echoProvider("pong"),
		);

		let result: Awaited<ReturnType<typeof gen.next>>;
		do {
			result = await gen.next();
		} while (!result.done);
		const streamingResult = result.value;

		assert.equal(streamingResult.response, nonStreamingResult.response);
		assert.equal(
			streamingResult.toolCallsMade,
			nonStreamingResult.toolCallsMade,
		);
	});

	it("produces same response with tool calls", async () => {
		const loop1 = new AgentLoop({ systemPrompt: "Be helpful." });
		loop1.registerTool(
			{
				name: "ping",
				description: "test",
				parameters: { type: "object", properties: {} },
			},
			async () => ({ content: "pong" }),
		);
		const nonStreamingResult = await loop1.processMessage(
			{ role: "user", content: "ping" },
			toolCallProvider("ping", "pong received"),
		);

		const loop2 = new AgentLoop({ systemPrompt: "Be helpful." });
		loop2.registerTool(
			{
				name: "ping",
				description: "test",
				parameters: { type: "object", properties: {} },
			},
			async () => ({ content: "pong" }),
		);
		const gen = loop2.processMessageStream(
			{ role: "user", content: "ping" },
			toolCallProvider("ping", "pong received"),
		);
		let result: Awaited<ReturnType<typeof gen.next>>;
		do {
			result = await gen.next();
		} while (!result.done);
		const streamingResult = result.value;

		assert.equal(streamingResult.response, nonStreamingResult.response);
		assert.equal(
			streamingResult.toolCallsMade,
			nonStreamingResult.toolCallsMade,
		);
	});
});
