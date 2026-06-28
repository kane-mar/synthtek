/**
 * Tool Registry
 * Manages registration, discovery, and execution of agent tools.
 *
 * Features:
 * - Timeout per tool (AbortSignal)
 * - Parallel execution with isolated failures
 * - Result size truncation
 * - Retry for transient failures (exponential backoff)
 * - Structured error codes
 * - Output schema validation
 * - Deduplication of identical calls
 */

import type { ToolCall, ToolError, ToolResult } from "./types.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESULT_LENGTH = 10_000;
const MAX_CACHE_SIZE = 200;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ToolDefinition {
	/** Unique tool name */
	name: string;
	/** Human-readable description */
	description: string;
	/** JSON Schema for the tool's parameters */
	parameters: Record<string, unknown>;
	/** Whether the tool is enabled */
	enabled?: boolean;
	/** Timeout in milliseconds for this tool's execution (default: 30000) */
	timeout?: number;
	/** Maximum characters allowed in the returned content (default: 10000) */
	maxResultLength?: number;
	/** JSON Schema for validating the tool's output content */
	outputSchema?: Record<string, unknown>;
	/** Maximum retry attempts for transient failures (default: 0) */
	maxRetries?: number;
}

export type ToolHandler = (
	args: Record<string, unknown>,
) => Promise<ToolResult>;

// ── Retryable Error Detection ────────────────────────────────────────────────

const RETRYABLE_PATTERNS = [
	/\brate\s*limit\b/i,
	/\btoo\s*many\s*requests\b/i,
	/\b429\b/,
	/\b503\b/,
	/\b502\b/,
	/\btimeout\b/i,
	/\btimed?\s*out\b/i,
	/\bdeadline\b/i,
	/\bunavailable\b/i,
	/\boverloaded\b/i,
	/\bretry\b/i,
	/\bnetwork\s*error\b/i,
	/\bconnection\b.*\b(refused|reset|closed|timeout)\b/i,
];

function isRetryable(errorMessage: string): boolean {
	return RETRYABLE_PATTERNS.some((p) => p.test(errorMessage));
}

/** Map an error message to a machine-readable code. */
function classifyError(message: string): string {
	const lower = message.toLowerCase();
	if (/rate\s*limit|too\s*many|429/.test(lower)) return "rate_limit";
	if (/timeout|timed?\s*out|deadline/.test(lower)) return "timeout";
	if (/unavailable|overloaded|503|502/.test(lower)) return "service_unavailable";
	if (/network|connection\s*(refused|reset|closed|timeout)/.test(lower))
		return "network";
	if (/disabled/.test(lower)) return "disabled";
	if (/unknown\s*tool/.test(lower)) return "unknown_tool";
	if (/not\s*found|not found|enoent/.test(lower)) return "not_found";
	if (/invalid|bad request|validation/.test(lower)) return "invalid_input";
	return "handler_error";
}

// ── Output Schema Validator ─────────────────────────────────────────────────

/** Lightweight JSON schema validation for tool outputs. */
function validateOutput(
	content: string,
	schema: Record<string, unknown>,
): string | null {
	if (!schema || !schema.type) return null;

	const expectedType = String(schema.type);
	let actualType: string;

	try {
		const parsed = JSON.parse(content);
		if (Array.isArray(parsed)) {
			actualType = "array";
		} else if (parsed === null) {
			actualType = "null";
		} else {
			actualType = typeof parsed;
		}
	} catch {
		// Not valid JSON — check if schema expects string
		if (expectedType === "string") return null;
		actualType = "string"; // unparseable content is a string
	}

	if (expectedType === actualType) return null;
	if (expectedType === "object" && actualType === "array") return null; // arrays are objects

	return `output schema validation: expected type "${expectedType}", got "${actualType}"`;
}

// ── ToolRegistry ──────────────────────────────────────────────────────────────

export class ToolRegistry {
	private tools: Map<string, ToolDefinition> = new Map();
	private handlers: Map<string, ToolHandler> = new Map();
	private readonly cache: Map<string, ToolResult> = new Map();

	/** Register a tool with its handler */
	register(tool: ToolDefinition, handler: ToolHandler): void {
		if (this.tools.has(tool.name)) {
			throw new Error(`Tool "${tool.name}" is already registered`);
		}
		this.tools.set(tool.name, tool);
		this.handlers.set(tool.name, handler);
		this.cache.clear(); // invalidate cache on new registration
	}

	/** Unregister a tool */
	unregister(name: string): void {
		this.tools.delete(name);
		this.handlers.delete(name);
		this.cache.clear();
	}

	/** Get all registered tool definitions */
	getTools(): ToolDefinition[] {
		return Array.from(this.tools.values()).filter((t) => t.enabled !== false);
	}

	/** Check if a tool is registered */
	hasTool(name: string): boolean {
		return this.tools.has(name);
	}

	/** Clear the deduplication cache */
	clearCache(): void {
		this.cache.clear();
	}

	// ── Error Builders ─────────────────────────────────────────────────

	private makeError(
		call: ToolCall,
		code: string,
		message: string,
		retryable: boolean,
	): ToolResult {
		return {
			callId: call.id,
			name: call.name,
			content: "",
			error: message,
			errorDetails: { code, message, retryable },
		};
	}

	private makeSuccess(call: ToolCall, content: string): ToolResult {
		return {
			callId: call.id,
			name: call.name,
			content,
			error: undefined,
			errorDetails: undefined,
		};
	}

	// ── Execution ──────────────────────────────────────────────────────

	/** Execute a tool call and return the result */
	async execute(call: ToolCall): Promise<ToolResult> {
		// Deduplicate identical calls
		const cacheKey = this.cacheKey(call);
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

		const handler = this.handlers.get(call.name);
		if (!handler) {
			return this.makeError(call, "unknown_tool", `Unknown tool: ${call.name}`, false);
		}

		const tool = this.tools.get(call.name);
		if (tool?.enabled === false) {
			return this.makeError(call, "disabled", `Tool "${call.name}" is disabled`, false);
		}

		const timeout = tool?.timeout ?? DEFAULT_TIMEOUT_MS;
		const maxLength = tool?.maxResultLength ?? DEFAULT_MAX_RESULT_LENGTH;
		const maxRetries = tool?.maxRetries ?? 0;
		const outputSchema = tool?.outputSchema;

		// Execute with retry + timeout
		const result = await this.executeWithRetry(
			call,
			handler,
			maxRetries,
			timeout,
		);

		// Truncate oversized content
		if (!result.error && result.content.length > maxLength) {
			result.content = result.content.slice(0, Math.max(0, maxLength - 1)) + "…";
		}

		// Validate output schema
		if (!result.error && outputSchema) {
			const validationIssue = validateOutput(result.content, outputSchema);
			if (validationIssue) {
				// Warn but don't fail — the LLM still gets the content
				result.error = validationIssue;
				result.errorDetails = {
					code: "output_validation",
					message: validationIssue,
					retryable: false,
				};
			}
		}

		// Cache only successful results
		if (!result.error) {
			this.setCache(cacheKey, result);
		}

		return result;
	}

	/** Execute a handler with retry logic and timeout. */
	private async executeWithRetry(
		call: ToolCall,
		handler: ToolHandler,
		maxRetries: number,
		timeoutMs: number,
	): Promise<ToolResult> {
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			if (attempt > 0) {
				// Exponential backoff: 1s, 2s, 4s, ...
				const delay = Math.min(1000 * 2 ** (attempt - 1), 10_000);
				await new Promise((r) => setTimeout(r, delay));
			}

			try {
				// Race handler against a timeout
				const result = await Promise.race([
					handler(call.arguments),
					new Promise<never>((_, reject) => {
						setTimeout(
							() => reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" })),
							timeoutMs,
						);
					}),
				]);
				return {
					callId: call.id,
					name: call.name,
					content: result.content,
					error: result.error,
					errorDetails: result.errorDetails,
				};
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				const isTimeout =
					error instanceof Error && (error as any).code === "TIMEOUT";
				lastError =
					error instanceof Error ? error : new Error(String(error));

				// Timeout
				if (isTimeout) {
					const msg = `Tool "${call.name}" timed out after ${timeoutMs}ms`;
					return this.makeError(call, "timeout", msg, true);
				}

				// Check if retryable
				if (isRetryable(message) && attempt < maxRetries) {
					continue; // retry
				}

				// Not retryable or out of retries
				const code = isRetryable(message) ? classifyError(message) : "handler_error";
				const retryable = isRetryable(message);
				return this.makeError(call, code, message, retryable);
			}
		}

		// All retries exhausted
		const msg = lastError?.message ?? "Unknown error";
		return this.makeError(call, classifyError(msg), msg, true);
	}

	/** Execute multiple tool calls in parallel. */
	async executeAll(calls: ToolCall[]): Promise<ToolResult[]> {
		if (calls.length === 0) return [];
		const results = await Promise.allSettled(
			calls.map((call) => this.execute(call)),
		);
		return results.map((r, i) => {
			if (r.status === "fulfilled") return r.value;
			return this.makeError(
				calls[i],
				"handler_error",
				r.reason instanceof Error ? r.reason.message : String(r.reason),
				false,
			);
		});
	}

	/** Get the number of registered tools */
	getToolCount(): number {
		return this.tools.size;
	}

	// ── Cache ──────────────────────────────────────────────────────────

	private cacheKey(call: ToolCall): string {
		return `${call.name}:${JSON.stringify(call.arguments)}`;
	}

	private setCache(key: string, result: ToolResult): void {
		if (this.cache.size >= MAX_CACHE_SIZE) {
			// Evict oldest entry
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) this.cache.delete(firstKey);
		}
		this.cache.set(key, result);
	}
}
