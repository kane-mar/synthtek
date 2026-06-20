/**
 * Agent Loop — Error Handling & Retry Logic Tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AgentLoop } from "../../src/agent/loop.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockProvider(options: {
	chatResponses?: Array<{ content: string; tokens?: number; error?: Error }>;
}): {
	provider: any;
	chatCalls: Array<{ messages: unknown[]; model?: string }>;
} {
	const chatResponses = options.chatResponses || [
		{ content: "Hello!", tokens: 10 },
	];
	let callCount = 0;
	const chatCalls: Array<{ messages: unknown[]; model?: string }> = [];

	const provider = {
		name: "mock",
		chat: async (req: {
			messages: Array<{ role: string; content: string }>;
			model?: string;
		}) => {
			callCount++;
			chatCalls.push({ messages: req.messages, model: req.model });

			const response = chatResponses[callCount - 1];
			if (response?.error) {
				throw response.error;
			}
			return {
				content: response?.content || chatResponses[0].content,
				tokens: response?.tokens || 10,
				totalTokens: response?.tokens || 10,
			};
		},
		chatStream: async function* () {
			yield { delta: "", done: true };
		},
		listModels: async () => ["gpt-4o"],
		healthCheck: async () => true,
		getConfig: () => ({ provider: "mock", apiKey: "test" }),
	};

	return {
		provider,
		chatCalls,
	};
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test("AgentLoop retries on LLM failure by default", async () => {
	const responses = [
		{ content: "", error: new Error("Rate limit") },
		{ content: "", error: new Error("Rate limit") },
		{ content: "Success!", tokens: 10 },
	];

	const { provider, chatCalls } = createMockProvider({
		chatResponses: responses,
	});

	const loop = new AgentLoop(
		{
			retry: {
				maxRetries: 3,
				initialDelay: 1,
				maxDelay: 10,
				multiplier: 1,
			},
		},
		{},
	);

	await loop.start();

	const result = await loop.processMessage(
		{ role: "user", content: "Hello" },
		provider,
	);

	await loop.stop();

	assert.equal(result.response, "Success!");
	assert.equal(chatCalls.length, 3);
	assert.equal(result.errors.length, 0);
});

test("AgentLoop fails after exhausting retries", async () => {
	const responses = [
		{ content: "", error: new Error("Rate limit 1") },
		{ content: "", error: new Error("Rate limit 2") },
		{ content: "", error: new Error("Rate limit 3") },
	];

	const { provider, chatCalls } = createMockProvider({
		chatResponses: responses,
	});

	const loop = new AgentLoop(
		{
			retry: {
				maxRetries: 2, // 1 initial + 2 retries = 3 total calls
				initialDelay: 1,
				maxDelay: 10,
				multiplier: 1,
			},
		},
		{},
	);

	await loop.start();

	const result = await loop.processMessage(
		{ role: "user", content: "Hello" },
		provider,
	);

	await loop.stop();

	assert.ok(result.response.includes("Error processing"));
	assert.ok(result.errors.some((e: string) => e.includes("LLM call failed")));
	assert.equal(chatCalls.length, 3); // 1 initial + 2 retries
});

test("AgentLoop does not retry non-retryable errors", async () => {
	const responses = [{ content: "", error: new Error("Invalid API key") }];

	const { provider, chatCalls } = createMockProvider({
		chatResponses: responses,
	});

	const loop = new AgentLoop(
		{
			retry: {
				maxRetries: 3,
				initialDelay: 1,
				maxDelay: 10,
				multiplier: 1,
				retryableErrors: [/rate.?limit/i, /timeout/i],
			},
		},
		{},
	);

	await loop.start();

	const result = await loop.processMessage(
		{ role: "user", content: "Hello" },
		provider,
	);

	await loop.stop();

	assert.ok(result.response.includes("Error processing"));
	assert.equal(chatCalls.length, 1); // No retries for non-retryable error
});

test("AgentLoop emits circuit_breaker:open event after threshold", async () => {
	let circuitOpened = false;

	// Use a provider that always throws (no mock provider — it runs out of responses)
	const failProvider = {
		name: "mock",
		chat: async () => {
			throw new Error("Service unavailable");
		},
		chatStream: async function* () {
			yield { delta: "", done: true };
		},
		listModels: async () => [],
		healthCheck: async () => true,
		getConfig: () => ({ provider: "mock", apiKey: "" }),
	};

	const loop = new AgentLoop(
		{
			retry: {
				maxRetries: 1,
				initialDelay: 1,
				maxDelay: 10,
				multiplier: 1,
			},
			circuitBreaker: {
				failureThreshold: 5,
				recoveryTimeout: 60_000,
			},
		},
		{
			onAfterMessage: () => {},
		},
	);

	loop.on("agent:circuit_breaker:open", () => {
		circuitOpened = true;
	});

	await loop.start();

	// Process 5 messages to trigger circuit breaker
	for (let i = 0; i < 5; i++) {
		await loop.processMessage(
			{ role: "user", content: `Message ${i}` },
			failProvider,
		);
	}

	await loop.stop();

	assert.ok(circuitOpened, "Circuit breaker should have opened");
});

test("AgentLoop emits circuit_breaker:closed event on recovery", async () => {
	let circuitClosed = false;

	const { provider } = createMockProvider({
		chatResponses: [{ content: "Hello!", tokens: 10 }],
	});

	const loop = new AgentLoop(
		{
			retry: {
				maxRetries: 1,
				initialDelay: 1,
				maxDelay: 10,
				multiplier: 1,
			},
			circuitBreaker: {
				failureThreshold: 2,
				recoveryTimeout: 100, // Short recovery for testing
			},
		},
		{
			onAfterMessage: () => {},
		},
	);

	loop.on("agent:circuit_breaker:closed", () => {
		circuitClosed = true;
	});

	await loop.start();

	// First: cause failures to open circuit
	const failProvider = {
		name: "mock",
		chat: async () => {
			throw new Error("Service unavailable");
		},
		chatStream: async function* () {
			yield { delta: "", done: true };
		},
		listModels: async () => [],
		healthCheck: async () => true,
		getConfig: () => ({ provider: "mock", apiKey: "" }),
	};

	await loop.processMessage({ role: "user", content: "Fail 1" }, failProvider);
	await loop.processMessage({ role: "user", content: "Fail 2" }, failProvider);

	// Wait for recovery timeout
	await new Promise((r) => setTimeout(r, 150));

	// Now: successful call should close circuit
	await loop.processMessage({ role: "user", content: "Recovery" }, provider);

	await loop.stop();

	assert.ok(circuitClosed, "Circuit breaker should have closed after recovery");
});

test("AgentLoop emits retry event on each retry", async () => {
	const retryEvents: Array<{
		attempt: number;
		maxRetries: number;
		error: string;
		delay: number;
	}> = [];

	const responses = [
		{ content: "", error: new Error("Rate limit 1") },
		{ content: "", error: new Error("Rate limit 2") },
		{ content: "Success!", tokens: 10 },
	];

	const { provider } = createMockProvider({ chatResponses: responses });

	const loop = new AgentLoop(
		{
			retry: {
				maxRetries: 3,
				initialDelay: 10,
				maxDelay: 100,
				multiplier: 2,
			},
		},
		{
			onAfterMessage: () => {},
		},
	);

	loop.on("agent:retry", (event: unknown) => {
		retryEvents.push(event as (typeof retryEvents)[0]);
	});

	await loop.start();

	const result = await loop.processMessage(
		{ role: "user", content: "Hello" },
		provider,
	);

	await loop.stop();

	assert.equal(result.response, "Success!");
	assert.equal(retryEvents.length, 2); // 2 retries before success
	assert.equal(retryEvents[0].attempt, 1);
	assert.equal(retryEvents[1].attempt, 2);
	assert.ok(retryEvents[1].delay > retryEvents[0].delay); // Exponential backoff
});

test("AgentLoop respects exponential backoff delays", async () => {
	const timestamps: number[] = [];

	const responses = [
		{ content: "", error: new Error("Rate limit 1") },
		{ content: "", error: new Error("Rate limit 2") },
		{ content: "Success!", tokens: 10 },
	];

	const { provider } = createMockProvider({ chatResponses: responses });

	const loop = new AgentLoop(
		{
			retry: {
				maxRetries: 3,
				initialDelay: 50,
				maxDelay: 1000,
				multiplier: 2,
			},
		},
		{
			onAfterMessage: () => {},
		},
	);

	loop.on("agent:retry", () => {
		timestamps.push(Date.now());
	});

	await loop.start();

	const result = await loop.processMessage(
		{ role: "user", content: "Hello" },
		provider,
	);

	await loop.stop();

	assert.equal(result.response, "Success!");
	assert.ok(timestamps.length >= 2);
	// Second delay should be roughly 2x the first
	const firstDelay = timestamps[1] - timestamps[0];
	assert.ok(firstDelay >= 40, `Expected ~100ms delay, got ${firstDelay}ms`);
});

test("AgentLoop handles circuit breaker blocking requests", async () => {
	let circuitOpened = false;

	const failProvider = {
		name: "mock",
		chat: async () => {
			throw new Error("Service unavailable");
		},
		chatStream: async function* () {
			yield { delta: "", done: true };
		},
		listModels: async () => [],
		healthCheck: async () => true,
		getConfig: () => ({ provider: "mock", apiKey: "" }),
	};

	const loop = new AgentLoop(
		{
			retry: {
				maxRetries: 1,
				initialDelay: 1,
				maxDelay: 10,
				multiplier: 1,
			},
			circuitBreaker: {
				failureThreshold: 2,
				recoveryTimeout: 60_000,
			},
		},
		{
			onAfterMessage: () => {},
		},
	);

	loop.on("agent:circuit_breaker:open", () => {
		circuitOpened = true;
	});

	await loop.start();

	// Cause failures to open circuit
	await loop.processMessage({ role: "user", content: "Fail 1" }, failProvider);
	await loop.processMessage({ role: "user", content: "Fail 2" }, failProvider);

	assert.ok(circuitOpened);

	// Next call should be blocked by circuit breaker
	const successProvider = {
		name: "mock",
		chat: async () => ({
			content: "Should not reach here",
			model: "mock",
			tokens: 10,
		}),
		chatStream: async function* () {
			yield { delta: "", done: true };
		},
		listModels: async () => [],
		healthCheck: async () => true,
		getConfig: () => ({ provider: "mock", apiKey: "" }),
	};

	const result = await loop.processMessage(
		{ role: "user", content: "Blocked" },
		successProvider,
	);

	assert.ok(
		result.response.includes("Circuit breaker"),
		"Should report circuit breaker blocking",
	);

	await loop.stop();
});

test("AgentLoop with no retry config retries by default", async () => {
	const responses = [
		{ content: "", error: new Error("Transient error") },
		{ content: "Success!", tokens: 10 },
	];

	const { provider } = createMockProvider({ chatResponses: responses });

	const loop = new AgentLoop({}, { onAfterMessage: () => {} });

	await loop.start();

	const result = await loop.processMessage(
		{ role: "user", content: "Hello" },
		provider,
	);

	await loop.stop();

	assert.equal(result.response, "Success!");
});
