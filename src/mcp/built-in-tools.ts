/**
 * Built-in MCP tools for synthtek core services
 *
 * Wraps FileService, Executor, and Search as MCP tools.
 */

import type {
	ExecutorService,
	FileSystemService,
	SearcherService,
} from "../core/types.js";
import type { MCPServer } from "./server.js";

export interface BuiltInToolsOptions {
	filesystem?: FileSystemService | null;
	executor?: ExecutorService | null;
	search?: SearcherService | null;
}

export function registerBuiltInTools(
	server: MCPServer,
	options: BuiltInToolsOptions,
): void {
	if (options.filesystem) {
		registerFileSystemTools(server, options.filesystem);
	}
	if (options.executor) {
		registerExecutorTools(server, options.executor);
	}
	if (options.search) {
		registerSearchTools(server, options.search);
	}
}

// ── File System Tools ───────────────────────────────────────────────────────

function registerFileSystemTools(
	server: MCPServer,
	fs: FileSystemService,
): void {
	server.registerTool({
		name: "read_file",
		description:
			"Read the contents of a file. Supports offset and limit for large files.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the file" },
				offset: {
					type: "number",
					description: "Line number to start from (1-indexed)",
				},
				limit: {
					type: "number",
					description: "Maximum number of lines to read",
				},
			},
			required: ["path"],
		},
		handler: async (args: Record<string, unknown>) => {
			const path = args.path as string;
			const offset = args.offset ? Number(args.offset) : undefined;
			const limit = args.limit ? Number(args.limit) : undefined;

			const result = await fs.read({ path, offset, limit });

			if (!result.success) {
				return {
					content: [{ type: "text", text: `Error: ${result.error}` }],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text",
						text: result.content,
					},
				],
			};
		},
	});

	server.registerTool({
		name: "write_file",
		description:
			"Write content to a file. Creates parent directories if needed.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the file" },
				content: { type: "string", description: "Content to write" },
				createDirectories: {
					type: "boolean",
					description: "Create parent directories if they do not exist",
				},
				overwrite: {
					type: "boolean",
					description: "Overwrite existing file",
				},
			},
			required: ["path", "content"],
		},
		handler: async (args: Record<string, unknown>) => {
			const path = args.path as string;
			const content = args.content as string;
			const createDirectories = args.createDirectories
				? (args.createDirectories as boolean)
				: true;
			const overwrite = args.overwrite ? (args.overwrite as boolean) : true;

			const result = await fs.write({
				path,
				content,
				createDirectories,
				overwrite,
			});

			if (!result.success) {
				return {
					content: [{ type: "text", text: `Error: ${result.error}` }],
					isError: true,
				};
			}

			return {
				content: [{ type: "text", text: `success: file written to ${path}` }],
			};
		},
	});

	server.registerTool({
		name: "list_directory",
		description: "List the contents of a directory.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the directory" },
				recursive: {
					type: "boolean",
					description: "Recursively list subdirectories",
				},
			},
			required: ["path"],
		},
		handler: async (args: Record<string, unknown>) => {
			const path = args.path as string;
			const recursive = args.recursive ? (args.recursive as boolean) : false;

			const result = await fs.list(path, recursive);

			if (!result.success) {
				return {
					content: [{ type: "text", text: `Error: ${result.error}` }],
					isError: true,
				};
			}

			const lines = result.entries.map(
				(e) => `${e.isDirectory ? "📁" : "📄"} ${e.name}`,
			);

			return {
				content: [
					{
						type: "text",
						text: `Contents of ${path}:\n${lines.join("\n")}`,
					},
				],
			};
		},
	});
}

// ── Executor Tools ──────────────────────────────────────────────────────────

function registerExecutorTools(
	server: MCPServer,
	executor: ExecutorService,
): void {
	server.registerTool({
		name: "exec",
		description: "Execute a shell command and return its output.",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string", description: "Shell command to execute" },
				workingDir: {
					type: "string",
					description: "Working directory for the command",
				},
				timeout: {
					type: "number",
					description: "Timeout in seconds",
				},
			},
			required: ["command"],
		},
		handler: async (args: Record<string, unknown>) => {
			const command = args.command as string;
			const workingDir = args.workingDir
				? (args.workingDir as string)
				: undefined;
			const timeout = args.timeout ? Number(args.timeout) : 60;

			const result = await executor.execute({
				command,
				workingDir,
				timeout,
				shell: true,
			});

			const outputParts: string[] = [];
			outputParts.push(`Command: ${command}`);
			outputParts.push(`Exit code: ${result.code}`);
			if (result.stdout) {
				outputParts.push(`stdout: ${result.stdout}`);
			}
			if (result.stderr) {
				outputParts.push(`stderr: ${result.stderr}`);
			}
			outputParts.push(`Duration: ${result.duration}ms`);

			return {
				content: [{ type: "text", text: outputParts.join("\n") }],
				isError: !result.success,
			};
		},
	});
}

// ── Search Tools ────────────────────────────────────────────────────────────

function registerSearchTools(server: MCPServer, search: SearcherService): void {
	server.registerTool({
		name: "glob",
		description: "Find files matching a glob pattern.",
		parameters: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "Glob pattern to match" },
				path: { type: "string", description: "Directory to search from" },
				headLimit: {
					type: "number",
					description: "Maximum number of matches to return",
				},
			},
			required: ["pattern"],
		},
		handler: async (args: Record<string, unknown>) => {
			const pattern = args.pattern as string;
			const path = args.path ? (args.path as string) : undefined;
			const headLimit = args.headLimit ? Number(args.headLimit) : undefined;

			const result = await search.glob({ pattern, path, headLimit });

			const lines = result.matches.map((m) => m);
			return {
				content: [
					{
						type: "text",
						text: `Found ${result.total} matches:\n${lines.join("\n")}`,
					},
				],
			};
		},
	});

	server.registerTool({
		name: "grep",
		description: "Search file contents with a regex pattern.",
		parameters: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "Regex or plain text pattern" },
				path: { type: "string", description: "File or directory to search in" },
				glob: {
					type: "string",
					description: "File filter pattern (e.g. *.py)",
				},
				outputMode: {
					type: "string",
					description: "Output mode: content, files_with_matches, or count",
				},
			},
			required: ["pattern"],
		},
		handler: async (args: Record<string, unknown>) => {
			const pattern = args.pattern as string;
			const path = args.path ? (args.path as string) : undefined;
			const glob = args.glob ? (args.glob as string) : undefined;
			const outputMode = args.outputMode
				? (args.outputMode as "content" | "files_with_matches" | "count")
				: "files_with_matches";

			const result = await search.grep({
				pattern,
				path,
				glob,
				outputMode,
			});

			if (outputMode === "count") {
				const lines = Object.entries(result.counts).map(
					([file, count]) => `${file}: ${count}`,
				);
				return {
					content: [
						{
							type: "text",
							text: `Match counts:\n${lines.join("\n")}`,
						},
					],
				};
			}

			if (outputMode === "files_with_matches") {
				return {
					content: [
						{
							type: "text",
							text: `Files with matches:\n${result.filesWithMatches.join("\n")}`,
						},
					],
				};
			}

			// content mode
			const lines = result.matches.map(
				(m) => `${m.file}:${m.line}: ${m.content}`,
			);
			return {
				content: [
					{
						type: "text",
						text: `Matches:\n${lines.join("\n")}`,
					},
				],
			};
		},
	});
}
