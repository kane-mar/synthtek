/**
 * Skill Injector Tests
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ToolRegistry } from "../../src/agent/tools.js";
import { SkillInjector } from "../../src/skills/injector.js";

function makeRegistry(): ToolRegistry {
	return new ToolRegistry();
}

describe("SkillInjector", () => {
	describe("injectLangChain", () => {
		it("registers a LangChain-style tool", async () => {
			const r = makeRegistry();
			const inj = new SkillInjector(r);

			inj.injectLangChain({
				name: "weather",
				description: "Get weather for a city",
				schema: {
					type: "object",
					properties: { city: { type: "string" } },
				},
				handler: async (args) => `Weather in ${args.city}: sunny 22°C`,
			});

			const tools = r.getTools();
			assert.equal(tools.length, 1);
			assert.equal(tools[0].name, "weather");

			const result = await r.execute({
				id: "1",
				name: "weather",
				arguments: { city: "London" },
			});
			assert.equal(result.error, undefined);
			assert.match(result.content, /London/);
		});

		it("handles handler errors gracefully", async () => {
			const r = makeRegistry();
			const inj = new SkillInjector(r);

			inj.injectLangChain({
				name: "failing",
				description: "Always fails",
				schema: { type: "object", properties: {} },
				handler: async () => {
					throw new Error("boom");
				},
			});

			const result = await r.execute({
				id: "1",
				name: "failing",
				arguments: {},
			});
			assert.match(result.error || "", /boom/);
		});

		it("registers multiple tools", () => {
			const r = makeRegistry();
			const inj = new SkillInjector(r);

			inj.injectLangChain({
				name: "a",
				description: "A",
				schema: {},
				handler: async () => "ok",
			});
			inj.injectLangChain({
				name: "b",
				description: "B",
				schema: {},
				handler: async () => "ok",
			});

			assert.equal(r.getToolCount(), 2);
		});
	});

	describe("injectExecutor", () => {
		it("registers and executes a shell command", async () => {
			const r = makeRegistry();
			const inj = new SkillInjector(r);

			inj.injectExecutor("echo", {
				command: "echo hello_from_injector",
				inputSchema: { type: "object", properties: {} },
			});

			const tools = r.getTools();
			assert.equal(tools.length, 1);
			assert.equal(tools[0].name, "echo");

			const result = await r.execute({ id: "1", name: "echo", arguments: {} });
			assert.equal(result.error, undefined);
			assert.match(result.content, /hello_from_injector/);
		});

		it("env vars are passed to the child process", async () => {
			const r = makeRegistry();
			const inj = new SkillInjector(r);

			inj.injectExecutor("env-test", {
				command: "node -e 'console.log(process.env.TEST_VAR)'",
				inputSchema: {
					type: "object",
					properties: { TEST_VAR: { type: "string" } },
				},
				inputMode: "env",
			});

			const result = await r.execute({
				id: "1",
				name: "env-test",
				arguments: { TEST_VAR: "HelloWorld" },
			});
			assert.equal(result.error, undefined);
			assert.match(result.content, /HelloWorld/);
		});

		it("reports exec errors", async () => {
			const r = makeRegistry();
			const inj = new SkillInjector(r);

			inj.injectExecutor("bad", {
				command: "nonexistent_command_xyz",
				inputSchema: {},
				timeout: 5000,
			});

			const result = await r.execute({ id: "1", name: "bad", arguments: {} });
			assert.ok(result.error);
		});
	});

	describe("injectHttp", () => {
		it("registers an HTTP skill", () => {
			const r = makeRegistry();
			const inj = new SkillInjector(r);

			inj.injectHttp("api", {
				url: "https://httpbin.org/get",
				method: "GET",
				inputSchema: { type: "object", properties: { q: { type: "string" } } },
			});

			assert.equal(r.getToolCount(), 1);
			assert.equal(r.getTools()[0].name, "api");
		});
	});

	describe("integration", () => {
		it("mixed injection types all register", () => {
			const r = makeRegistry();
			const inj = new SkillInjector(r);

			inj.injectLangChain({
				name: "lc",
				description: "LC",
				schema: {},
				handler: async () => "ok",
			});
			inj.injectExecutor("exec", { command: "true", inputSchema: {} });
			inj.injectHttp("http", { url: "https://example.com", inputSchema: {} });

			assert.equal(r.getToolCount(), 3);
			assert.deepEqual(
				r
					.getTools()
					.map((t) => t.name)
					.sort(),
				["exec", "http", "lc"],
			);
		});
	});
});
