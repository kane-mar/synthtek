/**
 * MCP stdio runner
 *
 * Reads JSON-RPC requests from stdin, processes them, and writes responses to stdout.
 * This is the standard MCP transport for server-mode operation.
 */

import { createInterface } from "node:readline";
import { AsyncExecutor } from "../core/executor.js";
import { AsyncFileService } from "../core/filesystem.js";
import { SearchService } from "../core/search.js";
import { registerBuiltInTools } from "./built-in-tools.js";
import { MCPServer } from "./server.js";
import { MCPTransportServer } from "./transport.js";

export interface MCPRunnerOptions {
	name?: string;
	version?: string;
	workspace?: string;
	enableFileSystem?: boolean;
	enableExecutor?: boolean;
	enableSearch?: boolean;
}

export class MCPRunner {
	private transport: MCPTransportServer;
	private rl: ReturnType<typeof createInterface> | null = null;
	private running = false;

	constructor(options: MCPRunnerOptions = {}) {
		const server = new MCPServer({
			name: options.name ?? "synthtek",
			version: options.version ?? "1.0.0",
			workspace: options.workspace,
		});

		// Register built-in tools
		registerBuiltInTools(server, {
			filesystem:
				options.enableFileSystem !== false ? new AsyncFileService() : null,
			executor: options.enableExecutor !== false ? new AsyncExecutor() : null,
			search: options.enableSearch !== false ? new SearchService() : null,
		});

		this.transport = new MCPTransportServer(server);
	}

	async start(): Promise<void> {
		this.running = true;
		this.rl = createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: false,
		});

		for await (const line of this.rl) {
			if (!this.running) break;

			try {
				const message = JSON.parse(line.trim());
				const response = await this.transport.handleRequest(message);

				if (response) {
					process.stdout.write(`${JSON.stringify(response)}\n`);
				}
			} catch (err) {
				// Parse errors or internal errors
				const errorResponse = {
					jsonrpc: "2.0",
					id: null,
					error: {
						code: -32700,
						message: (err as Error).message,
					},
				};
				process.stdout.write(`${JSON.stringify(errorResponse)}\n`);
			}
		}
	}

	async stop(): Promise<void> {
		this.running = false;
		if (this.rl) {
			this.rl.close();
			this.rl = null;
		}
	}
}

// Run directly if invoked as main module
if (import.meta.url === `file://${process.argv[1]}`) {
	const runner = new MCPRunner({
		name: "synthtek-mcp",
		version: "1.0.0",
	});

	process.on("SIGINT", async () => {
		await runner.stop();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		await runner.stop();
		process.exit(0);
	});

	runner.start().catch((err) => {
		console.error("MCP Runner error:", err);
		process.exit(1);
	});
}
