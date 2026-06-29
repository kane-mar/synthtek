/**
 * Chat Completion Handler
 *
 * Handles POST /api/chat/completions — runs the user message through
 * the AgentLoop so the LLM can use tools (read/write files, exec, grep, etc.)
 * before responding. Reports outcomes to the AnalyticsTracker.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AgentLoop } from "../agent/loop.js";
import { getRegistry } from "../providers/index.js";
import type {
	ChatCompletionRequest,
	LLMProvider,
	ProviderConfig,
} from "../providers/types.js";
import type { WebUIBackend } from "./backend.js";
import { sendJson } from "./helpers.js";
import type { ProviderManager } from "./provider-manager.js";

const SAFE_WORKSPACE = resolve(process.env.SYNTHTEK_WORKSPACE || process.cwd());

// ── Tool Implementations ───────────────────────────────────────────────────

/** Ensure a path is within the workspace (prevent path traversal) */
function safePath(requested: string): string {
	const abs = resolve(SAFE_WORKSPACE, requested);
	if (!abs.startsWith(SAFE_WORKSPACE + sep) && abs !== SAFE_WORKSPACE) {
		throw new Error(`Path "${requested}" is outside the workspace`);
	}
	return abs;
}

function registerBuiltinTools(agent: AgentLoop): void {
	// ── read_file ───────────────────────────────────────────────
	agent.registerTool(
		{
			name: "read_file",
			description: "Read the contents of a file. Use offset and limit to paginate large files.",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string", description: "Path to the file (relative to workspace)" },
					offset: { type: "number", description: "Line number to start from (1-indexed)" },
					limit: { type: "number", description: "Maximum number of lines to read" },
				},
				required: ["path"],
			},
		},
		async (args) => {
			try {
				const filePath = safePath(String(args.path));
				if (!existsSync(filePath)) {
					return { callId: "", name: "read_file", content: "", error: `File not found: ${args.path}` };
				}
				const content = readFileSync(filePath, "utf-8");
				const lines = content.split("\n");
				const offset = Number(args.offset) || 1;
				const limit = Number(args.limit) || lines.length;
				const selected = lines.slice(offset - 1, offset - 1 + limit);
				return { callId: "", name: "read_file", content: selected.join("\n") };
			} catch (err) {
				return { callId: "", name: "read_file", content: "", error: String(err) };
			}
		},
	);

	// ── write_file ─────────────────────────────────────────────
	agent.registerTool(
		{
			name: "write_file",
			description: "Create a new file or overwrite an existing one with the given content.",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string", description: "Path to the file (relative to workspace)" },
					content: { type: "string", description: "Full file content to write" },
				},
				required: ["path", "content"],
			},
		},
		async (args) => {
			try {
				const filePath = safePath(String(args.path));
				writeFileSync(filePath, String(args.content), "utf-8");
				return { callId: "", name: "write_file", content: `Written ${String(args.path).split("/").pop()}` };
			} catch (err) {
				return { callId: "", name: "write_file", content: "", error: String(err) };
			}
		},
	);

	agent.registerTool(
		{
			name: "edit_file",
			description: "Edit a file by replacing old_text with new_text. Supports partial matching.",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string", description: "Path to the file" },
					old_text: { type: "string", description: "The exact text to find and replace" },
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
					return { callId: "", name: "edit_file", content: "", error: `Text not found in ${args.path}` };
				}
				const updated = content.replace(oldText, newText);
				writeFileSync(filePath, updated, "utf-8");
				return { callId: "", name: "edit_file", content: "File updated successfully" };
			} catch (err) {
				return { callId: "", name: "edit_file", content: "", error: String(err) };
			}
		},
	);

	// ── exec ───────────────────────────────────────────────────
	agent.registerTool(
		{
			name: "exec",
			description: "Execute a shell command and return its output. Use with caution.",
			parameters: {
				type: "object",
				properties: {
					command: { type: "string", description: "The shell command to execute" },
					timeout: { type: "number", description: "Timeout in seconds (default 30)" },
				},
				required: ["command"],
			},
		},
		async (args) => {
			try {
				const cmd = String(args.command);
				const timeout = (Number(args.timeout) || 30) * 1000;
				const output = execSync(cmd, { timeout, encoding: "utf-8", cwd: SAFE_WORKSPACE, maxBuffer: 5 * 1024 * 1024 });
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
					pattern: { type: "string", description: "Glob pattern (e.g. '**/*.ts')" },
					path: { type: "string", description: "Subdirectory to search (default: workspace root)" },
				},
				required: ["pattern"],
			},
		},
		async (args) => {
			try {
				const pattern = String(args.pattern);
				const searchDir = args.path ? safePath(String(args.path)) : SAFE_WORKSPACE;
				const { globSync } = await import("glob");
				const results = globSync(pattern, { cwd: searchDir, nodir: true, dot: true });
				const truncated = results.slice(0, 200);
				return {
					callId: "", name: "glob", content: truncated.join("\n") + (results.length > 200 ? `\n... and ${results.length - 200} more` : ""),
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
			description: "Search file contents with a pattern. Returns matching file paths.",
			parameters: {
				type: "object",
				properties: {
					pattern: { type: "string", description: "Regex or text pattern to search for" },
					path: { type: "string", description: "File or directory to search in" },
					case_insensitive: { type: "boolean", description: "Case-insensitive search" },
				},
				required: ["pattern"],
			},
		},
		async (args) => {
			try {
				const pattern = String(args.pattern);
				const searchPath = args.path ? safePath(String(args.path)) : SAFE_WORKSPACE;
				const ignoreCase = args.case_insensitive === true;
				const flag = ignoreCase ? "i" : "";
				const cmd = `grep -r${flag}l "${pattern.replace(/"/g, '\\"')}" "${searchPath}" 2>/dev/null | head -100`;
				const output = execSync(cmd, { encoding: "utf-8", timeout: 15_000 });
				const files = output.trim();
				return { callId: "", name: "grep", content: files || "No matches found" };
			} catch (err) {
				return { callId: "", name: "grep", content: "", error: String(err) };
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
				const response = await fetch(url);
				const text = await response.text();
				return { callId: "", name: "web_fetch", content: text.slice(0, 50_000) };
			} catch (err) {
				return { callId: "", name: "web_fetch", content: "", error: String(err) };
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
					path: { type: "string", description: "Directory path (relative to workspace)" },
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
						} catch { }
					}
					return info;
				});
				return { callId: "", name: "list_dir", content: lines.join("\n") };
			} catch (err) {
				return { callId: "", name: "list_dir", content: "", error: String(err) };
			}
		},
	);
}

// ── Chat Handler ────────────────────────────────────────────────────────────

/** Classify an error message into a provider event type */
function classifyProviderError(
	message: string,
): "rate_limit" | "timeout" | "network" | "error" {
	const lowered = message.toLowerCase();
	if (/rate.?limit/i.test(lowered) || /too many requests/i.test(lowered) || /429/i.test(lowered)) return "rate_limit";
	if (/timeout/i.test(lowered) || /etimedout/i.test(lowered)) return "timeout";
	if (/network/i.test(lowered) || /connection refuse/i.test(lowered) || /econnreset/i.test(lowered) || /eai_again/i.test(lowered) || /enotfound/i.test(lowered)) return "network";
	return "error";
}

export async function handleChatCompletion(
	_req: IncomingMessage,
	res: ServerResponse,
	body: unknown,
	providerManager: ProviderManager,
	backend: WebUIBackend,
): Promise<void> {
	const chatReq = body as ChatCompletionRequest & { providerId?: string };

	try {
		// Resolve provider
		const provider = providerManager.getActiveProvider(chatReq.providerId);
		const providerLabel = provider?.name || provider?.type || "unknown";
		if (!provider) {
			const status = chatReq.providerId ? 404 : 422;
			backend.analytics.trackProviderEvent(providerLabel, "error");
			return sendJson(res, status, {
				error: chatReq.providerId
					? "Specified provider not found or inactive"
					: "No active LLM providers configured. Go to Settings to add one.",
			});
		}

		const registry = getRegistry();
		const providerType = provider.type as import("../providers/types.js").ProviderType;
		if (!registry.has(providerType)) {
			backend.analytics.trackProviderEvent(providerLabel, "error");
			return sendJson(res, 500, { error: `Provider type "${provider.type}" not supported` });
		}

		const providerConfig: ProviderConfig = {
			provider: providerType,
			apiKey: provider.apiKey || "",
			baseUrl: provider.baseUrl,
			model: chatReq.model || provider.defaultModel,
			timeout: provider.timeoutMs,
			headers: provider.headers,
		};

		const llmProvider: LLMProvider = registry.create(providerType, providerConfig);

		// ── Agent Loop ────────────────────────────────────────────
		// Extract messages: all but the last are history, last is the new user message
		const allMessages = chatReq.messages || [];
		const lastMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;
		if (!lastMessage || lastMessage.role !== "user") {
			return sendJson(res, 422, { error: "Last message must be from user" });
		}

		// Build system prompt
		const systemContent = chatReq.system || "You are a helpful AI assistant.";

		// Create agent loop with tools
		const agentLoop = new AgentLoop({
			systemPrompt: systemContent,
			maxToolCalls: 15,
			responseFormat: "markdown",
			retry: { maxRetries: 2, initialDelay: 1000, maxDelay: 10000, multiplier: 2 },
		});
		registerBuiltinTools(agentLoop);

		// Pre-load conversation history (all messages except the last)
		const historyMessages = allMessages.slice(0, -1) as Array<{ role: string; content: string }>;
		agentLoop.loadHistory(
			historyMessages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content || "" })),
		);

		// Run the agent loop
		const startTime = Date.now();
		const result = await agentLoop.processMessage(
			{ role: "user", content: lastMessage.content || "" },
			llmProvider,
		);

		// Track analytics
		backend.analytics.trackRequest({
			provider: providerLabel,
			model: providerConfig.model || "unknown",
			promptTokens: result.tokensUsed,
			completionTokens: 0,
			latencyMs: Date.now() - startTime,
			cost: 0,
			success: true,
		});
		backend.analytics.trackProviderEvent(providerLabel, "success");

		// Store assistant response in session
		const sessionId = (chatReq as Record<string, unknown>).sessionId as string | undefined;
		if (sessionId) {
			backend.addMessage(sessionId, { role: "assistant", content: result.response });
		}

		return sendJson(res, 200, {
			content: result.response,
			model: providerConfig.model,
			toolCallsMade: result.toolCallsMade,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Unknown error";
		let providerLabel = "unknown";
		try {
			const p = providerManager.getActiveProvider((body as any)?.providerId);
			if (p) providerLabel = p.name || p.type || "unknown";
		} catch { /* ignore */ }
		backend.analytics.trackProviderEvent(providerLabel, classifyProviderError(message));
		return sendJson(res, 500, { error: `Chat completion failed: ${message}` });
	}
}
