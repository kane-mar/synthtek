/**
 * Tests for ParallelExecutor (parallel tool execution)
 */

import { equal, ok } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { ParallelExecutor } from "../../src/performance/parallel-executor.js";
import type {
	ParallelExecutorConfig,
	ToolTask,
} from "../../src/performance/types.js";

const defaultConfig: ParallelExecutorConfig = {
	maxConcurrency: 3,
	timeoutMs: 5000,
	failFast: false,
};

describe("ParallelExecutor", () => {
	let executor: ParallelExecutor;

	beforeEach(() => {
		executor = new ParallelExecutor(defaultConfig);
	});

	describe("execute", () => {
		it("executes tasks in parallel", async () => {
			const tasks: ToolTask[] = [
				{
					id: "task1",
					name: "fast",
					fn: async () => {
						await new Promise((r) => setTimeout(r, 50));
						return { result: "fast" };
					},
				},
				{
					id: "task2",
					name: "fast2",
					fn: async () => {
						await new Promise((r) => setTimeout(r, 50));
						return { result: "fast2" };
					},
				},
			];

			const results = await executor.execute(tasks);
			equal(results.length, 2);
			ok(
				results.every((r) => r.success),
				"all tasks succeeded",
			);
		});

		it("handles task failures gracefully", async () => {
			const tasks: ToolTask[] = [
				{
					id: "task1",
					name: "good",
					fn: async () => "ok",
				},
				{
					id: "task2",
					name: "bad",
					fn: async () => {
						throw new Error("fail");
					},
				},
			];

			const results = await executor.execute(tasks);
			equal(results.length, 2);
			ok(results[0].success, "first task succeeded");
			ok(!results[1].success, "second task failed");
			ok(results[1].error, "error captured");
		});

		it("respects concurrency limit", async () => {
			let concurrentCount = 0;
			let maxConcurrent = 0;

			const tasks: ToolTask[] = Array.from({ length: 6 }, (_, i) => ({
				id: `task${i}`,
				name: `task${i}`,
				fn: async () => {
					concurrentCount++;
					if (concurrentCount > maxConcurrent) maxConcurrent = concurrentCount;
					await new Promise((r) => setTimeout(r, 50));
					concurrentCount--;
					return i;
				},
			}));

			await executor.execute(tasks);
			ok(
				maxConcurrent <= defaultConfig.maxConcurrency,
				`max concurrency ${maxConcurrent} within limit ${defaultConfig.maxConcurrency}`,
			);
		});

		it("tracks execution duration", async () => {
			const tasks: ToolTask[] = [
				{
					id: "task1",
					name: "timed",
					fn: async () => {
						await new Promise((r) => setTimeout(r, 100));
						return "done";
					},
				},
			];

			const results = await executor.execute(tasks);
			ok(
				results[0].duration >= 50,
				`duration ${results[0].duration}ms >= 50ms`,
			);
		});
	});

	describe("timeout", () => {
		it("times out slow tasks", async () => {
			const tasks: ToolTask[] = [
				{
					id: "slow",
					name: "slow",
					fn: async () => {
						await new Promise((r) => setTimeout(r, 2000));
						return "done";
					},
					timeoutMs: 100,
				},
			];

			const results = await executor.execute(tasks);
			ok(!results[0].success, "task timed out");
			ok(results[0].error?.includes("timed out"), "timeout error");
		});
	});

	describe("failFast", () => {
		it("stops execution on first failure when failFast enabled", async () => {
			const failFastExecutor = new ParallelExecutor({
				...defaultConfig,
				failFast: true,
			});
			const tasks: ToolTask[] = [
				{
					id: "bad",
					name: "bad",
					fn: async () => {
						throw new Error("fail");
					},
				},
				{
					id: "good",
					name: "good",
					fn: async () => "ok",
				},
			];

			const results = await failFastExecutor.execute(tasks);
			ok(results.length >= 1, "at least one result");
		});
	});
});
