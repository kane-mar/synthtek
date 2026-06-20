/**
 * Tests for AsyncExecutor
 */

import { equal, ok } from "node:assert";
import { describe, it } from "node:test";
import { AsyncExecutor } from "../src/core/executor.js";

describe("AsyncExecutor", () => {
	it("executes a simple command successfully", async () => {
		const executor = new AsyncExecutor();
		const result = await executor.execute({
			command: "echo hello",
			shell: true,
		});

		ok(result.success);
		equal(result.code, 0);
		ok(result.stdout.includes("hello"));
		equal(result.timedOut, false);
		ok(result.duration >= 0);
	});

	it("detects command failure", async () => {
		const executor = new AsyncExecutor();
		const result = await executor.execute({ command: "false", shell: true });

		equal(result.success, false);
		equal(result.code, 1);
	});

	it("captures stderr on failure", async () => {
		const executor = new AsyncExecutor();
		const result = await executor.execute({
			command: "ls /nonexistent/path",
			shell: true,
		});

		equal(result.success, false);
		ok(result.stderr.length > 0);
	});

	it("respects timeout", async () => {
		const executor = new AsyncExecutor();
		const result = await executor.execute({
			command: "sleep 2",
			timeout: 1,
			shell: true,
		});

		equal(result.success, false);
		equal(result.timedOut, true);
	});

	it("respects working directory", async () => {
		const executor = new AsyncExecutor();
		const result = await executor.execute({
			command: "pwd",
			workingDir: "/tmp",
			shell: true,
		});

		ok(result.success);
		ok(result.stdout.includes("/tmp"));
	});

	it("handles large output truncation", async () => {
		const executor = new AsyncExecutor();
		const result = await executor.execute({
			command: "seq 1 10000",
			maxOutputSize: 100,
			shell: true,
		});

		ok(result.success);
		equal(result.truncated, true);
	});

	it("returns error message on failure", async () => {
		const executor = new AsyncExecutor();
		const result = await executor.execute({
			command: "nonexistent_command_xyz",
		});

		equal(result.success, false);
		ok(result.error !== undefined);
	});
});
