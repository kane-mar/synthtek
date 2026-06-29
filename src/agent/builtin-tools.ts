/**
 * Built-in tools for the AgentLoop.
 *
 * Registers common workspace tools (read/write files, exec, glob, grep, etc.)
 * that any consumer (WebUI, CLI/TUI, channels) can use.
 */

import { execSync } from "node:child_process";
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import type { AgentLoop } from "./loop.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const WORKSPACE = resolve(process.env.SYNTHTEK_WORKSPACE || process.cwd());

/** Ensure a path is within the workspace (prevent path traversal) */
function safePath(requested: string): string {
	const abs = resolve(WORKSPACE, requested);
	if (!abs.startsWith(WORKSPACE + sep) && abs !== WORKSPACE) {
		throw new Error(`Path "${requested}" is outside the workspace`);
	}
	return abs;
}

// ── Tool Registration ───────────────────────────────────────────────────────

/**
 * Register all built-in tools on an AgentLoop instance.
 *
 * Tools registered:
 *   read_file   — read file contents
 *   write_file  — create/overwrite a file
 *   edit_file   — replace text in a file
 *   exec        — run a shell command
 *   glob        — find files matching a pattern
 *   grep        — search file contents
 *   list_dir    — list directory contents
 *   web_fetch   — fetch a URL
 */
export function registerBuiltinTools(agent: AgentLoop): void {
	// ── read_file ───────────────────────────────────────────────
	agent.registerTool(
		{
			name: "read_file",
			description:
				"Read the contents of a file. Use offset and limit to paginate large files.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Path to the file (relative to workspace)",
					},
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
		},
		async (args) => {
			try {
				const filePath = safePath(String(args.path));
				if (!existsSync(filePath)) {
					return {
						callId: "",
						name: "read_file",
						content: "",
						error: `File not found: ${args.path}`,
					};
				}
				const content = readFileSync(filePath, "utf-8");
				const lines = content.split("\n");
				const offset = args.offset != null ? Number(args.offset) : 1;
				const limit = args.limit != null ? Number(args.limit) : lines.length;
				const selected = lines.slice(offset - 1, offset - 1 + limit);
				return { callId: "", name: "read_file", content: selected.join("\n") };
			} catch (err) {
				return {
					callId: "",
					name: "read_file",
					content: "",
					error: String(err),
				};
			}
		},
	);

	// ── write_file ─────────────────────────────────────────────
	agent.registerTool(
		{
			name: "write_file",
			description: "Create a new file or overwrite an existing one.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Path to the file (relative to workspace)",
					},
					content: {
						type: "string",
						description: "Full file content to write",
					},
				},
				required: ["path", "content"],
			},
		},
		async (args) => {
			try {
				const filePath = safePath(String(args.path));
				writeFileSync(filePath, String(args.content), "utf-8");
				return {
					callId: "",
					name: "write_file",
					content: `Written ${String(args.path).split("/").pop()}`,
				};
			} catch (err) {
				return {
					callId: "",
					name: "write_file",
					content: "",
					error: String(err),
				};
			}
		},
	);

	// ── edit_file ─────────────────────────────────────────────
	agent.registerTool(
		{
			name: "edit_file",
			description:
				"Edit a file by replacing old_text with new_text. Supports partial matching.",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string", description: "Path to the file" },
					old_text: {
						type: "string",
						description: "The exact text to find and replace",
					},
					new_text: { type: "string", description: "The replacement text" },
				},
				required: ["path", "old_text", "new_text"],
			},
		},
		async (args) => {
			try {
				const filePath = safePath(String(args.path));
				const content = readFileSync(filePath, "utf-8");
				const oldText = String(args.old_text);
				const newText = String(args.new_text);
				if (!content.includes(oldText)) {
					return {
						callId: "",
						name: "edit_file",
						content: "",
						error: `Text not found in ${args.path}`,
					};
				}
				const updated = content.replaceAll(oldText, newText);
				writeFileSync(filePath, updated, "utf-8");
				return {
					callId: "",
					name: "edit_file",
					content: "File updated successfully",
				};
			} catch (err) {
				return {
					callId: "",
					name: "edit_file",
					content: "",
					error: String(err),
				};
			}
		},
	);

	// ── exec ───────────────────────────────────────────────────
	agent.registerTool(
		{
			name: "exec",
			description:
				"Execute a shell command and return its output. Use with caution.",
			parameters: {
				type: "object",
				properties: {
					command: {
						type: "string",
						description: "The shell command to execute",
					},
					timeout: {
						type: "number",
						description: "Timeout in seconds (default 30)",
					},
				},
				required: ["command"],
			},
		},
		async (args) => {
			try {
				const cmd = String(args.command);
				const timeout = (Number(args.timeout) || 30) * 1000;
				const output = execSync(cmd, {
					timeout,
					encoding: "utf-8",
					cwd: WORKSPACE,
					maxBuffer: 5 * 1024 * 1024,
				});
				return { callId: "", name: "exec", content: output.slice(0, 100_000) };
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { callId: "", name: "exec", content: "", error: msg };
			}
		},
	);

	// ── glob ───────────────────────────────────────────────────
	agent.registerTool(
		{
			name: "glob",
			description: "Find files matching a glob pattern in the workspace.",
			parameters: {
				type: "object",
				properties: {
					pattern: {
						type: "string",
						description: "Glob pattern (e.g. '**/*.ts')",
					},
					path: {
						type: "string",
						description: "Subdirectory to search (default: workspace root)",
					},
				},
				required: ["pattern"],
			},
		},
		async (args) => {
			try {
				const pattern = String(args.pattern);
				const searchDir = args.path ? safePath(String(args.path)) : WORKSPACE;
				const { globSync } = await import("glob");
				const results = globSync(pattern, {
					cwd: searchDir,
					nodir: true,
					dot: true,
				});
				const truncated = results.slice(0, 200);
				return {
					callId: "",
					name: "glob",
					content:
						truncated.join("\n") +
						(results.length > 200
							? `\n... and ${results.length - 200} more`
							: ""),
				};
			} catch (err) {
				return { callId: "", name: "glob", content: "", error: String(err) };
			}
		},
	);

	// ── grep ───────────────────────────────────────────────────
	agent.registerTool(
		{
			name: "grep",
			description:
				"Search file contents with a pattern. Returns matching file paths.",
			parameters: {
				type: "object",
				properties: {
					pattern: {
						type: "string",
						description: "Regex or text pattern to search for",
					},
					path: {
						type: "string",
						description: "File or directory to search in",
					},
					case_insensitive: {
						type: "boolean",
						description: "Case-insensitive search",
					},
				},
				required: ["pattern"],
			},
		},
		async (args) => {
			try {
				const pattern = String(args.pattern);
				const searchPath = args.path ? safePath(String(args.path)) : WORKSPACE;
				const ignoreCase = args.case_insensitive === true;

				// Validate regex pattern first
				let regex: RegExp;
				try {
					regex = new RegExp(pattern, ignoreCase ? "gi" : "g");
				} catch {
					return {
						callId: "",
						name: "grep",
						content: "",
						error: `Invalid regex pattern: ${pattern}`,
					};
				}

				// Walk directory recursively and search file contents
				function walkDir(dir: string, depth = 0): string[] {
					if (depth > 20) return [];
					const results: string[] = [];
					try {
						const entries = readdirSync(dir, { withFileTypes: true });
						for (const entry of entries) {
							const fullPath = join(dir, entry.name);
							if (entry.isDirectory()) {
								if (entry.name.startsWith(".") || entry.name === "node_modules")
									continue;
								results.push(...walkDir(fullPath, depth + 1));
							} else if (entry.isFile()) {
								try {
									const stat = statSync(fullPath);
									if (stat.size > 10 * 1024 * 1024) continue; // skip files >10MB
									const content = readFileSync(fullPath, "utf-8");
									if (regex.test(content)) {
										results.push(
											fullPath.replace(searchPath, "").replace(/^\//, ""),
										);
									}
								} catch {
									// skip unreadable files
								}
							}
						}
					} catch {
						// skip unreadable directories
					}
					return results;
				}

				const matchedFiles = walkDir(searchPath).slice(0, 100);
				return {
					callId: "",
					name: "grep",
					content: matchedFiles.join("\n") || "No matches found",
				};
			} catch (err) {
				return { callId: "", name: "grep", content: "", error: String(err) };
			}
		},
	);

	// ── list_dir ───────────────────────────────────────────────
	agent.registerTool(
		{
			name: "list_dir",
			description: "List the contents of a directory in the workspace.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Directory path (relative to workspace)",
					},
				},
				required: ["path"],
			},
		},
		async (args) => {
			try {
				const dirPath = safePath(String(args.path || "."));
				const entries = readdirSync(dirPath, { withFileTypes: true });
				const lines = entries.map((e) => {
					const type = e.isDirectory() ? "dir" : e.isFile() ? "file" : "other";
					let info = `${type}\t${e.name}`;
					if (e.isFile()) {
						try {
							const st = statSync(join(dirPath, e.name));
							info += `\t${st.size} bytes`;
						} catch {
							/* stat failed */
						}
					}
					return info;
				});
				return { callId: "", name: "list_dir", content: lines.join("\n") };
			} catch (err) {
				return {
					callId: "",
					name: "list_dir",
					content: "",
					error: String(err),
				};
			}
		},
	);

	// ── web_fetch ──────────────────────────────────────────────
	agent.registerTool(
		{
			name: "web_fetch",
			description: "Fetch a URL and return its content as markdown or text.",
			parameters: {
				type: "object",
				properties: {
					url: { type: "string", description: "URL to fetch" },
				},
				required: ["url"],
			},
		},
		async (args) => {
			try {
				const url = String(args.url);
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 30_000);
				try {
					const response = await fetch(url, { signal: controller.signal });
					const text = await response.text();
					return {
						callId: "",
						name: "web_fetch",
						content: text.slice(0, 50_000),
					};
				} finally {
					clearTimeout(timeoutId);
				}
			} catch (err) {
				return {
					callId: "",
					name: "web_fetch",
					content: "",
					error: String(err),
				};
			}
		},
	);
}
