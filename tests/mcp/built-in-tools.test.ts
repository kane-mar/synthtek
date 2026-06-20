/**
 * Tests for MCP Server built-in tools integration
 */

import { ok } from "node:assert";
import { before, describe, it } from "node:test";
import { AsyncExecutor } from "../../src/core/executor.js";
import { AsyncFileService } from "../../src/core/filesystem.js";
import { SearchService } from "../../src/core/search.js";
import { registerBuiltInTools } from "../../src/mcp/built-in-tools.js";
import { MCPServer } from "../../src/mcp/server.js";

describe("MCPServer built-in tools", () => {
	let server: MCPServer;

	before(() => {
		server = new MCPServer({
			name: "synthtek",
			version: "1.0.0",
			workspace: "/tmp/synthtek-mcp-test",
		});
	});

	describe("filesystem tools", () => {
		it("registers read_file tool", async () => {
			const fs = new AsyncFileService();
			registerBuiltInTools(server, {
				filesystem: fs,
				executor: null,
				search: null,
			});

			const tools = await server.listTools();
			const readFileTool = tools.find(
				(t: { name: string }) => t.name === "read_file",
			);
			ok(readFileTool, "read_file tool registered");
			ok(
				readFileTool.description.toLowerCase().includes("read"),
				"description mentions read",
			);
		});

		it("read_file tool reads a file", async () => {
			const fs = new AsyncFileService();
			registerBuiltInTools(server, {
				filesystem: fs,
				executor: null,
				search: null,
			});

			// Create a test file first
			await fs.write({
				path: "/tmp/synthtek-mcp-test/test.txt",
				content: "Hello MCP",
				createDirectories: true,
			});

			const result = await server.callTool("read_file", {
				path: "/tmp/synthtek-mcp-test/test.txt",
			});

			ok(result, "result returned");
			ok(result.content.length > 0, "result has content");
			ok(
				(result.content[0].text as string).includes("Hello MCP"),
				"content contains file text",
			);
		});

		it("registers write_file tool", async () => {
			const fs = new AsyncFileService();
			registerBuiltInTools(server, {
				filesystem: fs,
				executor: null,
				search: null,
			});

			const tools = await server.listTools();
			const writeFileTool = tools.find(
				(t: { name: string }) => t.name === "write_file",
			);
			ok(writeFileTool, "write_file tool registered");
		});

		it("write_file tool writes content to a file", async () => {
			const fs = new AsyncFileService();
			registerBuiltInTools(server, {
				filesystem: fs,
				executor: null,
				search: null,
			});

			const result = await server.callTool("write_file", {
				path: "/tmp/synthtek-mcp-test/output.txt",
				content: "Written by MCP",
			});

			ok(result, "result returned");
			ok(
				(result.content[0].text as string).includes("success"),
				"write succeeded",
			);

			// Verify file was actually written
			const readResult = await fs.read({
				path: "/tmp/synthtek-mcp-test/output.txt",
			});
			ok(
				readResult.content.includes("Written by MCP"),
				"file contains written content",
			);
		});
	});

	describe("executor tools", () => {
		it("registers exec_tool", async () => {
			const executor = new AsyncExecutor();
			registerBuiltInTools(server, {
				filesystem: null,
				executor,
				search: null,
			});

			const tools = await server.listTools();
			const execTool = tools.find((t: { name: string }) => t.name === "exec");
			ok(execTool, "exec tool registered");
		});

		it("exec tool runs a command", async () => {
			const executor = new AsyncExecutor();
			registerBuiltInTools(server, {
				filesystem: null,
				executor,
				search: null,
			});

			const result = await server.callTool("exec", {
				command: "echo MCP works",
			});

			ok(result, "result returned");
			ok(
				(result.content[0].text as string).includes("MCP works"),
				"output contains command result",
			);
		});
	});

	describe("search tools", () => {
		it("registers glob tool", async () => {
			const search = new SearchService();
			registerBuiltInTools(server, {
				filesystem: null,
				executor: null,
				search,
			});

			const tools = await server.listTools();
			const globTool = tools.find((t: { name: string }) => t.name === "glob");
			ok(globTool, "glob tool registered");
		});

		it("glob tool finds files", async () => {
			const search = new SearchService();
			registerBuiltInTools(server, {
				filesystem: null,
				executor: null,
				search,
			});

			const result = await server.callTool("glob", {
				pattern: "*.ts",
				path: ".",
			});

			ok(result, "result returned");
			ok(
				(result.content[0].text as string).includes(".ts"),
				"output contains TypeScript files",
			);
		});
	});
});
