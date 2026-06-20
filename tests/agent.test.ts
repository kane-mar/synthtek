/**
 * Agent Loop Tests
 * Uses Node's built-in test runner (node:test).
 */

import { deepStrictEqual, equal, ok, throws } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	AgentLoop,
	ContextWindowManager,
	HeartbeatManager,
	ToolRegistry,
} from "../src/agent/index.js";
import type {
	AgentLoopResult,
	AgentMessage,
	ToolCall,
} from "../src/agent/types.js";
import type { LLMProvider } from "../src/providers/types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createUserMessage(content: string): AgentMessage {
	return { role: "user", content };
}

function createMockLLM(
	response: { content: string; tokens?: number },
	shouldThrow?: boolean,
): LLMProvider {
	if (shouldThrow) {
		return {
			name: "mock",
			chat: async () => {
				throw new Error("API timeout");
			},
			chatStream: async function* () {
				yield { delta: "", done: true };
			},
			listModels: async () => [],
			healthCheck: async () => true,
			getConfig: () => ({ provider: "mock", apiKey: "" }),
		};
	}
	return {
		name: "mock",
		chat: async () => ({
			...response,
			model: "mock",
			totalTokens: response.tokens,
		}),
		chatStream: async function* () {
			yield { delta: "", done: true };
		},
		listModels: async () => [],
		healthCheck: async () => true,
		getConfig: () => ({ provider: "mock", apiKey: "" }),
	};
}

// ─── AgentLoop Tests ────────────────────────────────────────────────────────

describe("AgentLoop", () => {
	let loop: AgentLoop;

	afterEach(() => {
		loop.stop();
	});

	describe("lifecycle", () => {
		it("starts and stops correctly", async () => {
			loop = new AgentLoop();
			equal(loop.isRunning(), false);
			equal(loop.getState(), "idle");

			await loop.start();
			equal(loop.isRunning(), true);
			equal(loop.getStats().status, "running");

			await loop.stop();
			equal(loop.isRunning(), false);
			equal(loop.getStats().status, "idle");
		});
	});

	describe("processMessage — plain text response", () => {
		it("returns the LLM response when no tool calls are needed", async () => {
			loop = new AgentLoop();
			const mockLLM = createMockLLM({
				content: "Hello! How can I help you?",
				tokens: 100,
			});
			const message = createUserMessage("Hi there!");

			const result = await loop.processMessage(message, mockLLM);

			equal(result.response, "Hello! How can I help you?");
			equal(result.toolCallsMade, 0);
			equal(result.errors.length, 0);
			ok(result.duration > 0);
		});

		it("tracks tokens used", async () => {
			loop = new AgentLoop();
			const mockLLM = createMockLLM({ content: "Hello!", tokens: 250 });
			const message = createUserMessage("Hi!");

			const result = await loop.processMessage(message, mockLLM);

			equal(result.tokensUsed, 250);
		});

		it("handles LLM errors gracefully", async () => {
			loop = new AgentLoop();
			const mockLLM = createMockLLM({ content: "" }, true);
			const message = createUserMessage("Hi!");

			const result = await loop.processMessage(message, mockLLM);

			ok(result.response.includes("Error processing your message"));
			ok(result.response.includes("API timeout"));
			ok(result.errors.length > 0);
		});
	});

	describe("processMessage — tool calls", () => {
		it("executes tool calls and loops back to LLM", async () => {
			loop = new AgentLoop();

			loop.registerTool(
				{
					name: "read_file",
					description: "Read a file",
					parameters: {
						type: "object",
						properties: { path: { type: "string" } },
					},
				},
				async () => ({ content: "file contents here" }),
			);

			const call1: ToolCall = {
				id: "call_1",
				name: "read_file",
				arguments: { path: "/test/file.txt" },
			};

			const call2: ToolCall = {
				id: "call_2",
				name: "read_file",
				arguments: { path: "/test/other.txt" },
			};

			let callCount = 0;
			const mockLLM: LLMProvider = {
				name: "mock",
				chat: async () => {
					callCount++;
					if (callCount === 1) {
						return {
							content: `\`\`\`json\n${JSON.stringify([call1, call2])}\n\`\`\``,
							model: "mock",
							totalTokens: 50,
						};
					}
					return {
						content: "Here is the information you requested.",
						model: "mock",
						totalTokens: 100,
					};
				},
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "mock", apiKey: "" }),
			};

			const message = createUserMessage("Read these files for me.");
			const result = await loop.processMessage(message, mockLLM);

			equal(result.response, "Here is the information you requested.");
			equal(result.toolCallsMade, 2);
			equal(callCount, 2);
		});

		it("handles tool errors", async () => {
			loop = new AgentLoop();

			loop.registerTool(
				{
					name: "read_file",
					description: "Read a file",
					parameters: {
						type: "object",
						properties: { path: { type: "string" } },
					},
				},
				async () => ({ content: "", error: "File not found" }),
			);

			const call: ToolCall = {
				id: "call_1",
				name: "read_file",
				arguments: { path: "/nonexistent.txt" },
			};

			let callCount = 0;
			const mockLLM: LLMProvider = {
				name: "mock",
				chat: async () => {
					callCount++;
					if (callCount === 1) {
						return {
							content: `\`\`\`json\n${JSON.stringify([call])}\n\`\`\``,
							model: "mock",
							totalTokens: 50,
						};
					}
					return {
						content: "I could not find the file.",
						model: "mock",
						totalTokens: 80,
					};
				},
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "mock", apiKey: "" }),
			};

			const message = createUserMessage("Read this file.");
			const result = await loop.processMessage(message, mockLLM);

			equal(result.response, "I could not find the file.");
			equal(result.toolCallsMade, 1);
			ok(result.errors.some((e) => e.includes("File not found")));
		});

		it("respects maxToolCalls limit", async () => {
			const loop2 = new AgentLoop({ maxToolCalls: 3 });

			loop2.registerTool(
				{
					name: "read_file",
					description: "Read a file",
					parameters: {
						type: "object",
						properties: { path: { type: "string" } },
					},
				},
				async () => ({ content: "data" }),
			);

			const mockLLM: LLMProvider = {
				name: "mock",
				chat: async () => ({
					content:
						'```json\n[{"id":"c1","name":"read_file","arguments":{"path":"/x"}}]\n```',
					model: "mock",
					totalTokens: 50,
				}),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "mock", apiKey: "" }),
			};

			const message = createUserMessage("Keep reading files.");
			const result = await loop2.processMessage(message, mockLLM);

			ok(result.response.includes("I've made"));
			equal(result.toolCallsMade, 3);
			ok(result.errors.some((e) => e.includes("maximum")));
		});
	});

	describe("hooks", () => {
		it("calls onBeforeMessage and onAfterMessage", async () => {
			let beforeCalled = false;
			let afterCalled = false;
			let afterResult: AgentLoopResult | undefined;

			const hooks = {
				onBeforeMessage: async (msg: AgentMessage) => {
					beforeCalled = true;
					equal(msg.content, "test");
				},
				onAfterMessage: async (result: AgentLoopResult) => {
					afterCalled = true;
					afterResult = result;
				},
			};

			const loop2 = new AgentLoop({}, hooks);
			await loop2.start();

			const mockLLM: LLMProvider = {
				name: "mock",
				chat: async () => ({ content: "done", model: "mock", totalTokens: 50 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "mock", apiKey: "" }),
			};
			await loop2.processMessage(createUserMessage("test"), mockLLM);

			equal(beforeCalled, true);
			equal(afterCalled, true);
			equal(afterResult?.response, "done");

			await loop2.stop();
		});

		it("calls onBeforeToolCall and onAfterToolCall", async () => {
			let toolCallName = "";
			let toolResultContent = "";

			const hooks = {
				onBeforeToolCall: async (call: ToolCall) => {
					toolCallName = call.name;
				},
				onAfterToolCall: async (result: { content: string }) => {
					toolResultContent = result.content;
				},
			};

			const loop2 = new AgentLoop({}, hooks);

			loop2.registerTool(
				{
					name: "test_tool",
					description: "Test tool",
					parameters: {},
				},
				async () => ({ content: "tool output" }),
			);

			const call: ToolCall = {
				id: "c1",
				name: "test_tool",
				arguments: {},
			};

			let callCount = 0;
			const mockLLM: LLMProvider = {
				name: "mock",
				chat: async () => {
					callCount++;
					if (callCount === 1) {
						return {
							content: `\`\`\`json\n${JSON.stringify([call])}\n\`\`\``,
							model: "mock",
							totalTokens: 50,
						};
					}
					return { content: "done", model: "mock", totalTokens: 50 };
				},
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "mock", apiKey: "" }),
			};

			await loop2.start();
			await loop2.processMessage(createUserMessage("test"), mockLLM);
			await loop2.stop();

			equal(toolCallName, "test_tool");
			equal(toolResultContent, "tool output");
		});
	});

	describe("events", () => {
		it("emits agent:message_processed", async () => {
			const loop2 = new AgentLoop();
			let emitted = false;

			loop2.on("agent:message_processed", ((result: unknown) => {
				emitted = true;
				const r = result as AgentLoopResult;
				equal(r.response, "done");
			}) as any);

			await loop2.start();
			const mockLLM: LLMProvider = {
				name: "mock",
				chat: async () => ({ content: "done", model: "mock", totalTokens: 50 }),
				chatStream: async function* () {
					yield { delta: "", done: true };
				},
				listModels: async () => [],
				healthCheck: async () => true,
				getConfig: () => ({ provider: "mock", apiKey: "" }),
			};
			await loop2.processMessage(createUserMessage("test"), mockLLM);
			await loop2.stop();

			equal(emitted, true);
		});
	});

	describe("processMessageWithCallback", () => {
		it("works with a callback-based LLM provider", async () => {
			const loop2 = new AgentLoop();
			let capturedMessages: Array<{ role: string; content: string }> = [];

			const callback = async (request: {
				messages: Array<{ role: string; content: string }>;
				model?: string;
				system?: string;
				maxTokens?: number;
				temperature?: number;
				topP?: number;
				stop?: string[];
				tools?: Array<{
					name: string;
					description: string;
					parameters: Record<string, unknown>;
				}>;
				toolChoice?: string | { type: string; name?: string };
			}) => {
				capturedMessages = request.messages;
				return { content: "callback response", tokens: 42 };
			};

			const result = await loop2.processMessageWithCallback(
				createUserMessage("hello"),
				callback,
			);

			equal(result.response, "callback response");
			equal(result.tokensUsed, 42);
			ok(capturedMessages !== null);
			ok(capturedMessages?.length > 0);

			await loop2.stop();
		});
	});
});

// ─── ContextWindowManager Tests ─────────────────────────────────────────────

describe("ContextWindowManager", () => {
	let ctx: ContextWindowManager;

	afterEach(() => {
		ctx.clear();
	});

	describe("addMessage", () => {
		it("adds a message and tracks tokens", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "Hello world" });
			equal(ctx.getMessageCount(), 1);
			ok(ctx.getTokenCount() > 0);
		});

		it("adds multiple messages", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "Hello" });
			ctx.addMessage({ role: "assistant", content: "Hi there" });
			equal(ctx.getMessageCount(), 2);
		});
	});

	describe("setMessages", () => {
		it("replaces all messages", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "old" });
			ctx.setMessages([
				{ role: "user", content: "new1" },
				{ role: "user", content: "new2" },
			]);
			equal(ctx.getMessageCount(), 2);
		});
	});

	describe("getMessages", () => {
		it("returns a copy of messages", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "test" });
			const msgs = ctx.getMessages();
			equal(msgs.length, 1);
			equal(msgs[0].content, "test");
		});
	});

	describe("getSnapshot", () => {
		it("returns a snapshot with token count", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "Hello world" });
			const snapshot = ctx.getSnapshot();
			equal(snapshot.messages.length, 1);
			ok(snapshot.tokenCount > 0);
			equal(snapshot.truncated, false);
		});
	});

	describe("needsCompaction", () => {
		it("returns false when under threshold", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "short" });
			equal(ctx.needsCompaction(), false);
		});

		it("returns true when over threshold", () => {
			ctx = new ContextWindowManager();
			const largeContent = "x".repeat(400_000);
			ctx.addMessage({ role: "user", content: largeContent });
			ctx.addMessage({ role: "assistant", content: "response" });
			equal(ctx.needsCompaction(), true);
		});
	});

	describe("compact", () => {
		it("does nothing when compaction not needed", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "short" });
			const result = ctx.compact();
			equal(result.needed, false);
			equal(result.summary, "No compaction needed");
		});

		it("summarizes old messages when compaction is needed", () => {
			ctx = new ContextWindowManager();
			const largeContent = "x".repeat(400_000);
			ctx.addMessage({ role: "user", content: largeContent });
			ctx.addMessage({ role: "assistant", content: "response" });

			const result = ctx.compact();
			equal(result.needed, true);
			ok(result.summary.includes("Summarized"));
		});
	});

	describe("trimToMaxTokens", () => {
		it("trims messages when over max", () => {
			ctx = new ContextWindowManager({ maxTokens: 500 });
			ctx.addMessage({ role: "system", content: "system prompt" });
			ctx.addMessage({ role: "user", content: "x".repeat(2000) });
			ctx.addMessage({ role: "assistant", content: "y".repeat(2000) });

			const snapshot = ctx.trimToMaxTokens();
			equal(snapshot.truncated, true);
			ok(snapshot.tokenCount <= 500);
		});

		it("does nothing when under max", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "short" });
			const snapshot = ctx.trimToMaxTokens();
			equal(snapshot.truncated, false);
			equal(snapshot.messages.length, 1);
		});
	});

	describe("clear", () => {
		it("removes all messages", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "test" });
			ctx.clear();
			equal(ctx.getMessageCount(), 0);
			equal(ctx.getTokenCount(), 0);
		});
	});

	describe("getFormattedMessages", () => {
		it("returns messages as role/content pairs", () => {
			ctx = new ContextWindowManager();
			ctx.addMessage({ role: "user", content: "hello" });
			ctx.addMessage({ role: "assistant", content: "hi" });
			const formatted = ctx.getFormattedMessages();
			deepStrictEqual(formatted, [
				{ role: "user", content: "hello" },
				{ role: "assistant", content: "hi" },
			]);
		});
	});
});

// ─── ToolRegistry Tests ─────────────────────────────────────────────────────

describe("ToolRegistry", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	describe("register", () => {
		it("registers a tool with its handler", () => {
			const tool = {
				name: "test_tool",
				description: "A test tool",
				parameters: {},
			};
			const handler = async () => ({
				callId: "",
				name: "test_tool",
				content: "result",
			});
			registry.register(tool, handler as any);
			equal(registry.hasTool("test_tool"), true);
			equal(registry.getToolCount(), 1);
		});

		it("throws on duplicate registration", () => {
			const tool = {
				name: "dup",
				description: "dup",
				parameters: {},
			};
			registry.register(tool, async () => ({
				callId: "",
				name: "dup",
				content: "a",
			}));
			throws(
				() =>
					registry.register(tool, async () => ({
						callId: "",
						name: "dup",
						content: "b",
					})),
				/already registered/,
			);
		});
	});

	describe("unregister", () => {
		it("removes a tool", () => {
			const tool = {
				name: "test_tool",
				description: "A test tool",
				parameters: {},
			};
			registry.register(tool, async () => ({
				callId: "",
				name: "test_tool",
				content: "result",
			}));
			registry.unregister("test_tool");
			equal(registry.hasTool("test_tool"), false);
		});
	});

	describe("execute", () => {
		it("executes a registered tool", async () => {
			const tool = {
				name: "echo",
				description: "Echo tool",
				parameters: {},
			};
			registry.register(tool, async (args: any) => ({
				callId: "",
				name: "echo",
				content: `echo: ${JSON.stringify(args)}`,
			}));

			const call: ToolCall = {
				id: "c1",
				name: "echo",
				arguments: { text: "hello" },
			};

			const result = await registry.execute(call);
			equal(result.content, 'echo: {"text":"hello"}');
			equal(result.error, undefined);
		});

		it("returns error for unknown tool", async () => {
			const call: ToolCall = {
				id: "c1",
				name: "unknown_tool",
				arguments: {},
			};

			const result = await registry.execute(call);
			equal(result.error, "Unknown tool: unknown_tool");
		});

		it("returns error for disabled tool", async () => {
			const tool = {
				name: "disabled_tool",
				description: "Disabled",
				parameters: {},
				enabled: false,
			};
			registry.register(tool, async () => ({
				callId: "",
				name: "disabled_tool",
				content: "should not run",
			}));

			const call: ToolCall = {
				id: "c1",
				name: "disabled_tool",
				arguments: {},
			};

			const result = await registry.execute(call);
			equal(result.error, 'Tool "disabled_tool" is disabled');
		});

		it("handles tool errors", async () => {
			const tool = {
				name: "failing_tool",
				description: "Fails",
				parameters: {},
			};
			registry.register(tool, async () => {
				throw new Error("boom");
			});

			const call: ToolCall = {
				id: "c1",
				name: "failing_tool",
				arguments: {},
			};

			const result = await registry.execute(call);
			equal(result.error, "boom");
		});
	});

	describe("executeAll", () => {
		it("executes multiple tools", async () => {
			const tool1 = {
				name: "tool1",
				description: "Tool 1",
				parameters: {},
			};
			const tool2 = {
				name: "tool2",
				description: "Tool 2",
				parameters: {},
			};
			registry.register(tool1, async () => ({
				callId: "",
				name: "tool1",
				content: "r1",
			}));
			registry.register(tool2, async () => ({
				callId: "",
				name: "tool2",
				content: "r2",
			}));

			const calls: ToolCall[] = [
				{ id: "c1", name: "tool1", arguments: {} },
				{ id: "c2", name: "tool2", arguments: {} },
			];

			const results = await registry.executeAll(calls);
			equal(results.length, 2);
			equal(results[0].content, "r1");
			equal(results[1].content, "r2");
		});
	});

	describe("getTools", () => {
		it("returns only enabled tools", () => {
			const enabled = {
				name: "enabled",
				description: "Enabled",
				parameters: {},
			};
			const disabled = {
				name: "disabled",
				description: "Disabled",
				parameters: {},
				enabled: false,
			};
			registry.register(enabled, async () => ({
				callId: "",
				name: "enabled",
				content: "a",
			}));
			registry.register(disabled, async () => ({
				callId: "",
				name: "disabled",
				content: "b",
			}));

			const tools = registry.getTools();
			equal(tools.length, 1);
			equal(tools[0].name, "enabled");
		});
	});
});

// ─── HeartbeatManager Tests ─────────────────────────────────────────────────

describe("HeartbeatManager", () => {
	it("starts and stops", () => {
		const hb = new HeartbeatManager({ interval: 1000, onTick: () => {} });
		equal(hb.isRunning(), false);
		hb.start();
		equal(hb.isRunning(), true);
		hb.stop();
		equal(hb.isRunning(), false);
	});

	it("fires ticks at the configured interval", (t: any) => {
		let ticks = 0;
		const hb = new HeartbeatManager({
			interval: 50,
			onTick: () => {
				ticks++;
				if (ticks >= 3) {
					hb.stop();
					equal(ticks, 3);
					t.end();
				}
			},
			startImmediately: true,
		});
		hb.start();
	});

	it("tracks errors in state", async () => {
		let tickCount = 0;
		const hb = new HeartbeatManager({
			interval: 10,
			onTick: async () => {
				tickCount++;
				if (tickCount >= 2) {
					throw new Error("tick error");
				}
			},
			startImmediately: true,
		});
		hb.start();

		await new Promise<void>((resolve) => {
			setTimeout(() => {
				hb.stop();
				const state = hb.getState();
				ok(state.errors.includes("tick error"));
				resolve();
			}, 50);
		});
	});

	it("is idempotent on start", () => {
		const hb = new HeartbeatManager({ interval: 1000, onTick: () => {} });
		hb.start();
		hb.start();
		equal(hb.isRunning(), true);
		hb.stop();
	});

	it("updates interval", () => {
		const hb = new HeartbeatManager({ interval: 1000, onTick: () => {} });
		hb.start();
		hb.setInterval(500);
		equal(hb.getInterval(), 500);
		hb.stop();
	});
});
