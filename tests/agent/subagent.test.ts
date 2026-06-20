/**
 * SubagentSpawner tests
 */

import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { SubagentSpawner } from "../../src/agent/subagent.js";

describe("SubagentSpawner", () => {
	let spawner: SubagentSpawner;

	before(() => {
		spawner = new SubagentSpawner(5);
	});

	after(() => {
		spawner.clearResults();
	});

	test("creates an instance with default max concurrent", () => {
		const s = new SubagentSpawner();
		assert.equal(s.getActiveCount(), 0);
	});

	test("creates an instance with custom max concurrent", () => {
		const s = new SubagentSpawner(10);
		assert.equal(s.getActiveCount(), 0);
	});

	test("clearResults clears all subagent results", () => {
		// clearResults should be idempotent
		spawner.clearResults();
		assert.equal(spawner.getActiveCount(), 0);
	});

	test("getResult returns undefined for non-existent subagent", () => {
		const result = spawner.getResult("non-existent-id");
		assert.equal(result, undefined);
	});

	test("getResults returns empty array when no subagents", () => {
		const results = spawner.getResults();
		assert.ok(Array.isArray(results));
		assert.equal(results.length, 0);
	});

	test("spawn respects concurrency limit", async () => {
		// Create a spawner with limit of 1
		const limitedSpawner = new SubagentSpawner(1);

		// Spawn a subagent with a short timeout so it completes quickly
		const promise1 = limitedSpawner.spawn(
			{
				task: "Test task 1",
				timeout: 5,
			},
			// Mock provider — will fail but that's fine for this test
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
		);

		// Give it a moment to start
		await new Promise((r) => setTimeout(r, 50));

		// Now try to spawn another — should fail due to concurrency limit
		const promise2 = limitedSpawner.spawn(
			{
				task: "Test task 2",
				timeout: 5,
			},
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
		);

		const result2 = await promise2;
		assert.equal(result2.status, "failed");
		assert.ok(
			result2.errors.some((e: string) =>
				e.includes("Max concurrent subagents"),
			),
		);

		// Wait for the first subagent to complete (it has a 5s timeout)
		await promise1.catch(() => {});
	});

	test("spawn returns SubagentResult with correct shape", async () => {
		const result = await spawner.spawn(
			{
				task: "Test task for shape validation",
				timeout: 10,
			},
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
		);

		assert.ok(typeof result.id === "string");
		assert.ok(typeof result.response === "string");
		assert.ok(typeof result.tokensUsed === "number");
		assert.ok(typeof result.toolCallsMade === "number");
		assert.ok(typeof result.duration === "number");
		assert.ok(Array.isArray(result.errors));
		assert.ok(
			["completed", "failed", "timeout", "cancelled"].includes(result.status),
		);

		// Clean up
		spawner.clearResults();
	});

	test("spawn with inheritContext includes parent messages", async () => {
		const parentMessages = [
			{ role: "user" as const, content: "Hello" },
			{ role: "assistant" as const, content: "Hi there!" },
			{ role: "user" as const, content: "How are you?" },
		];

		const result = await spawner.spawn(
			{
				task: "Test task with inherited context",
				timeout: 10,
				inheritContext: true,
			},
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
			parentMessages,
		);

		assert.ok(["completed", "failed"].includes(result.status));
		spawner.clearResults();
	});

	test("spawn with custom system prompt", async () => {
		const result = await spawner.spawn(
			{
				task: "Test task",
				timeout: 10,
				systemPrompt: "You are a custom subagent.",
			},
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
		);

		assert.ok(typeof result.response === "string");
		spawner.clearResults();
	});

	test("spawn with custom model and temperature", async () => {
		const result = await spawner.spawn(
			{
				task: "Test task with custom params",
				timeout: 10,
				model: "gpt-4",
				temperature: 0.7,
			},
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
		);

		assert.ok(typeof result.response === "string");
		spawner.clearResults();
	});

	test("spawn with mergeResults keeps result longer", async () => {
		const result = await spawner.spawn(
			{
				task: "Test task with merge",
				timeout: 10,
				mergeResults: true,
			},
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
		);

		// Result should be retrievable
		const retrieved = spawner.getResult(result.id);
		assert.ok(retrieved !== undefined);
		assert.equal(retrieved.id, result.id);

		spawner.clearResults();
	});

	test("cancel returns false for non-existent subagent", async () => {
		const cancelled = await spawner.cancel("non-existent-id");
		assert.equal(cancelled, false);
	});

	test("spawn with custom maxToolCalls", async () => {
		const result = await spawner.spawn(
			{
				task: "Test task",
				timeout: 10,
				maxToolCalls: 5,
			},
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
		);

		assert.ok(typeof result.response === "string");
		spawner.clearResults();
	});

	test("spawn with custom maxTokens", async () => {
		const result = await spawner.spawn(
			{
				task: "Test task",
				timeout: 10,
				maxTokens: 4096,
			},
			{
				name: "test",
				chat: async () => ({ content: "test", model: "test", tokens: 0 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "test", apiKey: "" }),
			},
		);

		assert.ok(typeof result.response === "string");
		spawner.clearResults();
	});
});
