/**
 * ToolRegistry Tests — TDD for tool execution improvements
 */

import { deepStrictEqual, equal, ok, rejects, doesNotReject } from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { ToolRegistry } from "../../src/agent/tools.js";
import type { ToolCall, ToolResult } from "../../src/agent/types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCall(name = "test", args: Record<string, unknown> = {}): ToolCall {
	return { id: "c1", name, arguments: args };
}

function slowHandler(ms: number) {
	return async () => {
		await new Promise((r) => setTimeout(r, ms));
		return { callId: "c1", name: "test", content: "done" };
	};
}

function resultOf(r: ToolResult): string {
	return r.error ? `ERROR:${r.error}` : r.content;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ToolRegistry — improved execution", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	// ── 1. Timeout ───────────────────────────────────────────────────────
	describe("timeout", () => {
		it("aborts a tool that exceeds its timeout", async () => {
			registry.register(
				{ name: "slow", description: "Slow tool", parameters: {}, timeout: 50 },
				slowHandler(500),
			);
			const result = await registry.execute(makeCall("slow"));
			equal(result.error, "Tool \"slow\" timed out after 50ms");
			equal(result.errorDetails?.code, "timeout");
			equal(result.errorDetails?.retryable, true);
		});

		it("completes a tool within its timeout", async () => {
			registry.register(
				{ name: "fast", description: "Fast tool", parameters: {}, timeout: 500 },
				slowHandler(10),
			);
			const result = await registry.execute(makeCall("fast"));
			equal(result.content, "done");
			equal(result.error, undefined);
		});

		it("uses default timeout of 30s when none specified", async () => {
			registry.register(
				{ name: "instant", description: "No timeout set", parameters: {} },
				async () => ({ callId: "c1", name: "instant", content: "ok" }),
			);
			// Should complete normally
			const result = await registry.execute(makeCall("instant"));
			equal(result.content, "ok");
		});
	});

	// ── 2. Parallel execution ───────────────────────────────────────────
	describe("parallel execution", () => {
		it("executeAll runs tools in parallel and returns all results", async () => {
			const order: number[] = [];
			registry.register(
				{ name: "a", description: "A", parameters: {}, timeout: 200 },
				async () => {
					await new Promise((r) => setTimeout(r, 50));
					order.push(1);
					return { callId: "c1", name: "a", content: "a" };
				},
			);
			registry.register(
				{ name: "b", description: "B", parameters: {}, timeout: 200 },
				async () => {
					await new Promise((r) => setTimeout(r, 10));
					order.push(2);
					return { callId: "c2", name: "b", content: "b" };
				},
			);

			const results = await registry.executeAll([
				makeCall("a"),
				makeCall("b"),
			]);
			equal(results.length, 2);
			// Both should complete — order is indeterminate but both run
			const contents = results.map((r) => r.content).sort();
			deepStrictEqual(contents, ["a", "b"]);
			// "b" is faster, so if sequential it would be [1,2], but parallel
			// means "b" finishes first — we just verify both ran
			equal(order.includes(1), true);
			equal(order.includes(2), true);
		});

		it("executeAll continues on individual tool failures", async () => {
			registry.register(
				{ name: "good", description: "Works", parameters: {} },
				async () => ({ callId: "c1", name: "good", content: "ok" }),
			);
			registry.register(
				{ name: "bad", description: "Fails", parameters: {} },
				async () => { throw new Error("boom"); },
			);

			const results = await registry.executeAll([
				makeCall("good"),
				makeCall("bad"),
			]);
			equal(results.length, 2);
			equal(results[0].content || results[1].content, "ok");
			const errors = results.filter((r) => r.error);
			equal(errors.length, 1);
		});
	});

	// ── 3. Result size guard ─────────────────────────────────────────────
	describe("result size guard", () => {
		it("truncates oversized tool output", async () => {
			registry.register(
				{
					name: "verbose",
					description: "Wordy tool",
					parameters: {},
					maxResultLength: 20,
				},
				async () => ({
					callId: "c1",
					name: "verbose",
					content: "this is a very long response that should be truncated",
				}),
			);

			const result = await registry.execute(makeCall("verbose"));
			equal(result.content.length, 20);
			ok(result.content.endsWith("…"));
		});

		it("does not truncate short output", async () => {
			registry.register(
				{
					name: "brief",
					description: "Brief tool",
					parameters: {},
					maxResultLength: 100,
				},
				async () => ({
					callId: "c1",
					name: "brief",
					content: "short",
				}),
			);

			const result = await registry.execute(makeCall("brief"));
			equal(result.content, "short");
		});
	});

	// ── 4. Retry transient failures ────────────────────────────────────
	describe("retry transient failures", () => {
		it("retries on retryable error and succeeds", async () => {
			let attempts = 0;
			registry.register(
				{
					name: "flaky",
					description: "Flaky tool",
					parameters: {},
					maxRetries: 2,
				},
				async () => {
					attempts++;
					if (attempts < 3) throw new Error("rate limit exceeded");
					return { callId: "c1", name: "flaky", content: "success" };
				},
			);

			const result = await registry.execute(makeCall("flaky"));
			equal(result.content, "success");
			equal(attempts, 3); // initial + 2 retries
		});

		it("returns error after exhausting retries", async () => {
			let attempts = 0;
			registry.register(
				{
					name: "always_bad",
					description: "Always fails",
					parameters: {},
					maxRetries: 2,
				},
				async () => {
					attempts++;
					throw new Error("rate limit exceeded");
				},
			);

			const result = await registry.execute(makeCall("always_bad"));
			ok(result.error?.includes("rate limit exceeded"));
			equal(attempts, 3); // initial + 2 retries
			equal(result.errorDetails?.code, "rate_limit");
			equal(result.errorDetails?.retryable, true);
		});

		it("does not retry non-retryable errors", async () => {
			let attempts = 0;
			registry.register(
				{
					name: "bad_input",
					description: "Bad input",
					parameters: {},
					maxRetries: 2,
				},
				async () => {
					attempts++;
					throw new Error("Invalid argument: file not found");
				},
			);

			const result = await registry.execute(makeCall("bad_input"));
			equal(attempts, 1); // no retry
		});

		it("does not retry when maxRetries is 0", async () => {
			let attempts = 0;
			registry.register(
				{
					name: "no_retry",
					description: "No retry",
					parameters: {},
					maxRetries: 0,
				},
				async () => {
					attempts++;
					throw new Error("rate limit");
				},
			);

			await registry.execute(makeCall("no_retry"));
			equal(attempts, 1);
		});
	});

	// ── 5. Structured errors ───────────────────────────────────────────
	describe("structured errors", () => {
		it("includes errorDetails for unknown tool", async () => {
			const result = await registry.execute(makeCall("nope"));
			equal(result.error, "Unknown tool: nope");
			equal(result.errorDetails?.code, "unknown_tool");
			equal(result.errorDetails?.retryable, false);
		});

		it("includes errorDetails for disabled tool", async () => {
			registry.register(
				{ name: "off", description: "Off", parameters: {}, enabled: false },
				async () => ({ callId: "c1", name: "off", content: "" }),
			);
			const result = await registry.execute(makeCall("off"));
			equal(result.error, 'Tool "off" is disabled');
			equal(result.errorDetails?.code, "disabled");
			equal(result.errorDetails?.retryable, false);
		});

		it("includes errorDetails for handler crash", async () => {
			registry.register(
				{ name: "crash", description: "Crashes", parameters: {} },
				async () => { throw new Error("segfault"); },
			);
			const result = await registry.execute(makeCall("crash"));
			equal(result.error, "segfault");
			equal(result.errorDetails?.code, "handler_error");
			equal(result.errorDetails?.retryable, false);
		});
	});

	// ── 6. Output validation ───────────────────────────────────────────
	describe("output validation", () => {
		it("passes when output matches schema", async () => {
			registry.register(
				{
					name: "valid",
					description: "Valid output",
					parameters: {},
					outputSchema: { type: "object" },
				},
				async () => ({
					callId: "c1",
					name: "valid",
					content: JSON.stringify({ key: "value" }),
				}),
			);

			const result = await registry.execute(makeCall("valid"));
			equal(result.content, JSON.stringify({ key: "value" }));
			// Should not set error when output is valid
			equal(result.error, undefined);
		});

		it("warns when output does not match schema (non-object)", async () => {
			registry.register(
				{
					name: "invalid",
					description: "Invalid output",
					parameters: {},
					outputSchema: { type: "object" },
				},
				async () => ({
					callId: "c1",
					name: "invalid",
					content: "not an object",
				}),
			);

			const result = await registry.execute(makeCall("invalid"));
			// Should still return content but with a warning about schema mismatch
			ok(result.error?.includes("output schema validation"));
			equal(result.content, "not an object");
		});
	});

	// ── 7. Deduplication ──────────────────────────────────────────────
	describe("deduplication", () => {
		it("caches identical tool calls", async () => {
			let callCount = 0;
			registry.register(
				{ name: "fetch", description: "Fetch", parameters: {} },
				async () => {
					callCount++;
					return { callId: "c1", name: "fetch", content: "data" };
				},
			);

			const call = makeCall("fetch", { url: "https://example.com" });
			const r1 = await registry.execute(call);
			const r2 = await registry.execute(call);

			equal(callCount, 1); // handler called only once
			equal(r1.content, "data");
			equal(r2.content, "data");
		});

		it("does not cache different arguments", async () => {
			let callCount = 0;
			registry.register(
				{ name: "fetch", description: "Fetch", parameters: {} },
				async () => {
					callCount++;
					return { callId: "c1", name: "fetch", content: "data" };
				},
			);

			await registry.execute(makeCall("fetch", { url: "a" }));
			await registry.execute(makeCall("fetch", { url: "b" }));

			equal(callCount, 2); // different args, different calls
		});

		it("clearCache resets the cache", async () => {
			let callCount = 0;
			registry.register(
				{ name: "fetch", description: "Fetch", parameters: {} },
				async () => {
					callCount++;
					return { callId: "c1", name: "fetch", content: "data" };
				},
			);

			const call = makeCall("fetch", { url: "x" });
			await registry.execute(call);
			await registry.execute(call);
			equal(callCount, 1); // cached

			registry.clearCache();
			await registry.execute(call);
			equal(callCount, 2); // cache cleared, handler called again
		});
	});
});
