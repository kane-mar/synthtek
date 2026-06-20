/**
 * Tests for MCP Server
 */

import { equal, ok, strictEqual } from "node:assert";
import { before, describe, it } from "node:test";
import { MCPServer } from "../../src/mcp/server.js";

describe("MCPServer", () => {
	let server: MCPServer;

	describe("lifecycle", () => {
		it("creates a server with default config", () => {
			server = new MCPServer({ name: "synthtek", version: "1.0.0" });
			ok(server, "server instance created");
		});

		it("starts and stops cleanly", async () => {
			server = new MCPServer({ name: "synthtek", version: "1.0.0" });
			await server.start();
			ok(server.isRunning, "server is running after start");
			await server.stop();
			equal(server.isRunning, false, "server stopped");
		});
	});

	describe("tools", () => {
		before(() => {
			server = new MCPServer({ name: "synthtek", version: "1.0.0" });
		});

		it("registers a tool with name, description, and parameters", () => {
			server.registerTool({
				name: "echo",
				description: "Echo back the input message",
				parameters: {
					type: "object",
					properties: {
						message: { type: "string", description: "Message to echo" },
					},
					required: ["message"],
				},
				handler: async (args: Record<string, unknown>) => ({
					content: [{ type: "text", text: args.message as string }],
				}),
			});
			ok(true, "tool registered without error");
		});

		it("lists registered tools", async () => {
			const tools = await server.listTools();
			ok(tools.length >= 1, "at least one tool registered");
			const echoTool = tools.find((t: { name: string }) => t.name === "echo");
			ok(echoTool, "echo tool found in list");
			strictEqual(echoTool.description, "Echo back the input message");
		});

		it("calls a registered tool and returns result", async () => {
			const result = await server.callTool("echo", { message: "hello world" });
			ok(result, "result returned");
			ok(result.content.length > 0, "result has content");
			strictEqual(result.content[0].text, "hello world");
		});

		it("throws error for unknown tool", async () => {
			await server.callTool("nonexistent", {}).catch((err: unknown) => {
				ok(err, "error thrown for unknown tool");
				ok(
					(err as Error).message.includes("not found"),
					"error mentions not found",
				);
			});
		});
	});

	describe("resources", () => {
		before(() => {
			server = new MCPServer({ name: "synthtek", version: "1.0.0" });
		});

		it("registers a resource with URI and description", () => {
			server.registerResource({
				uri: "config://agent",
				name: "Agent Config",
				description: "Current agent configuration",
				mimeType: "application/json",
				handler: async () =>
					JSON.stringify({ name: "synthtek", version: "1.0.0" }),
			});
			ok(true, "resource registered without error");
		});

		it("lists registered resources", async () => {
			const resources = await server.listResources();
			ok(resources.length >= 1, "at least one resource registered");
			const configRes = resources.find(
				(r: { uri: string }) => r.uri === "config://agent",
			);
			ok(configRes, "config resource found in list");
			strictEqual(configRes.name, "Agent Config");
		});

		it("reads a registered resource and returns content", async () => {
			const result = await server.readResource("config://agent");
			ok(result, "result returned");
			const parsed = JSON.parse(result.content);
			strictEqual(parsed.name, "synthtek");
		});

		it("throws error for unknown resource", async () => {
			await server.readResource("unknown://foo").catch((err: unknown) => {
				ok(err, "error thrown for unknown resource");
			});
		});
	});

	describe("prompts", () => {
		before(() => {
			server = new MCPServer({ name: "synthtek", version: "1.0.0" });
		});

		it("registers a prompt with name, description, and arguments", () => {
			server.registerPrompt({
				name: "summarize",
				description: "Summarize a document",
				arguments: [
					{
						name: "document",
						description: "Document to summarize",
						required: true,
					},
				],
				handler: async (args: Record<string, unknown>) => ({
					messages: [
						{
							role: "user",
							content: {
								type: "text",
								text: `Please summarize: ${args.document}`,
							},
						},
					],
				}),
			});
			ok(true, "prompt registered without error");
		});

		it("lists registered prompts", async () => {
			const prompts = await server.listPrompts();
			ok(prompts.length >= 1, "at least one prompt registered");
			const summarizePrompt = prompts.find(
				(p: { name: string }) => p.name === "summarize",
			);
			ok(summarizePrompt, "summarize prompt found in list");
			strictEqual(summarizePrompt.description, "Summarize a document");
		});

		it("expands a registered prompt with arguments", async () => {
			const result = await server.getPrompt("summarize", {
				document: "This is a test document.",
			});
			ok(result, "result returned");
			ok(result.messages.length > 0, "prompt has messages");
			ok(
				result.messages[0]?.content.text?.includes("test document"),
				"message contains document content",
			);
		});

		it("throws error for unknown prompt", async () => {
			await server.getPrompt("nonexistent", {}).catch((err: unknown) => {
				ok(err, "error thrown for unknown prompt");
			});
		});
	});

	describe("capabilities", () => {
		it("reports capabilities based on registered items", async () => {
			const server2 = new MCPServer({ name: "synthtek", version: "1.0.0" });
			server2.registerTool({
				name: "test",
				description: "Test tool",
				parameters: { type: "object", properties: {} },
				handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
			});
			server2.registerResource({
				uri: "test://info",
				name: "Test",
				description: "Test resource",
				mimeType: "text/plain",
				handler: async () => "test",
			});
			server2.registerPrompt({
				name: "test_prompt",
				description: "Test prompt",
				arguments: [],
				handler: async () => ({ messages: [] }),
			});

			const caps = server2.capabilities;
			ok(caps.tools, "tools capability reported");
			ok(caps.resources, "resources capability reported");
			ok(caps.prompts, "prompts capability reported");
		});
	});
});
