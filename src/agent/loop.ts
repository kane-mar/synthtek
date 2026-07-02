/**
 * Agent Loop — Core implementation
 * Handles the message-in → LLM-decides → tools-execute → response-out cycle.
 */

import { EventEmitter } from "node:events";
import { getSystemPrompt } from "../config/agent-config.js";
import type { LLMProvider, StreamChunk } from "../providers/types.js";
import { ContextWindowManager } from "./context.js";
import { AgentErrorHandler } from "./error-handler.js";
import { ResponseFormatter } from "./response-formatter.js";
import { ToolRegistry } from "./tools.js";
import type {
	AgentHooks,
	AgentLoopConfig,
	AgentLoopResult,
	AgentLoopState,
	AgentMessage,
	AgentState,
	ToolCall,
} from "./types.js";

/** LLM call result from non-streaming or streaming strategy */
interface LlmCallResult {
	content: string;
	tokens: number;
	toolCalls:
		| Array<{ id: string; name: string; arguments: Record<string, unknown> }>
		| undefined;
}

/** Strategy type for abstracting streaming vs non-streaming LLM calls */
type LlmCallStrategy = (
	messages: Array<{ role: string; content: string }>,
) => Promise<LlmCallResult>;

const DEFAULT_LOOP_CONFIG: AgentLoopConfig = {
	systemPrompt: getSystemPrompt(),
	maxToolCalls: 20,
	retry: {
		maxRetries: 3,
		initialDelay: 1000,
		maxDelay: 30000,
		multiplier: 2,
	},
	circuitBreaker: {
		failureThreshold: 5,
		recoveryTimeout: 60000,
	},
};

/**
 * Normalize a parsed JSON item or array into ToolCall objects.
 */
function toToolCalls(parsed: unknown, offset: number): ToolCall[] {
	const calls: ToolCall[] = [];
	const items = Array.isArray(parsed) ? parsed : [parsed];
	for (const item of items) {
		if (
			item &&
			typeof item === "object" &&
			"name" in item &&
			"arguments" in item
		) {
			const tool = item as { id?: string; name: unknown; arguments: unknown };
			calls.push({
				id: tool.id || `call_${Date.now()}_${offset + calls.length}`,
				name: String(tool.name),
				arguments: tool.arguments as Record<string, unknown>,
			});
		}
	}
	return calls;
}

/**
 * Parse LLM response to extract tool calls.
 * Handles both JSON format and markdown code block format.
 */
function parseToolCalls(content: string): ToolCall[] {
	const result: ToolCall[] = [];

	// Collect JSON candidate strings (code blocks first, then full content)
	const candidates: string[] = [];
	const jsonPattern = /```(?:json)?\s*\n?([\s\S]*?)```/g;
	let match: RegExpExecArray | null = jsonPattern.exec(content);
	while (match !== null) {
		candidates.push(match[1]);
		match = jsonPattern.exec(content);
	}
	if (candidates.length === 0) {
		candidates.push(content);
	}

	// Try parsing each candidate until we extract tool calls
	let offset = 0;
	for (const json of candidates) {
		try {
			const parsed = JSON.parse(json);
			const calls = toToolCalls(parsed, offset);
			if (calls.length > 0) {
				result.push(...calls);
				offset += calls.length;
				// If we found calls in a code block, don't fall through to full content
				if (json !== content) break;
			}
		} catch {
			// Silently ignore — expected JSON parse failure
			// Not valid JSON, try next candidate
		}
	}

	return result;
}

export class AgentLoop {
	private config: AgentLoopConfig;
	private context: ContextWindowManager;
	private tools: ToolRegistry;
	private hooks: AgentHooks;
	private state: AgentLoopState;
	private stats: AgentState;
	private events: EventEmitter;
	private running: boolean;
	private errorHandler: AgentErrorHandler;
	private responseFormatter: ResponseFormatter;

	constructor(config?: Partial<AgentLoopConfig>, hooks?: AgentHooks) {
		this.config = { ...DEFAULT_LOOP_CONFIG, ...config };
		this.context = new ContextWindowManager(this.config.contextWindow);
		this.tools = new ToolRegistry();
		this.hooks = hooks || {};
		this.state = "idle";
		this.stats = {
			status: "idle",
			messagesProcessed: 0,
			tokensUsed: 0,
			toolCallsMade: 0,
			currentTokens: 0,
		};
		this.events = new EventEmitter();
		this.running = false;
		this.errorHandler = new AgentErrorHandler(this.config);
		this.responseFormatter = new ResponseFormatter(this.config);
	}

	// ── Lifecycle ────────────────────────────────────────────────────────────

	async start(): Promise<void> {
		this.running = true;
		this.state = "idle";
		this.stats.status = "running";
		this.stats.startedAt = new Date();
		this.events.emit("agent:started");

		if (this.hooks.onInit) {
			await this.hooks.onInit();
		}
	}

	async stop(): Promise<void> {
		this.running = false;
		this.state = "idle";
		this.stats.status = "idle";
		this.events.emit("agent:stopped");

		if (this.hooks.onDestroy) {
			await this.hooks.onDestroy();
		}
	}

	// ── Retry & Circuit Breaker (delegated to AgentErrorHandler) ──────────────

	/**
	 * Check if the circuit breaker is open (blocking requests).
	 */
	private isCircuitBreakerOpen(): boolean {
		if (this.errorHandler.isCircuitOpen()) {
			return true;
		}
		return false;
	}

	/**
	 * Record a successful LLM call (resets failure counter).
	 * Emits event only on state transition.
	 */
	private recordSuccess(): void {
		const changed = this.errorHandler.recordSuccess();
		if (changed) {
			this.events.emit("agent:circuit_breaker:closed");
		}
	}

	/**
	 * Record a failed LLM call (may open circuit breaker).
	 * Emits event only on state transition.
	 */
	private recordFailure(): void {
		const changed = this.errorHandler.recordFailure();
		if (changed) {
			this.events.emit("agent:circuit_breaker:open");
		}
	}

	/**
	 * Calculate exponential backoff delay for a given retry attempt.
	 */
	private getBackoffDelay(attempt: number): number {
		return this.errorHandler.calculateRetryDelay(attempt);
	}

	/**
	 * Check if an error is retryable based on configured patterns.
	 * By default, retries most errors except context-related ones.
	 * When custom retryableErrors patterns are configured, only matches those.
	 */
	private isRetryableError(error: Error): boolean {
		const retry = this.config.retry;

		// Context errors are never retryable
		if (/context|token limit/i.test(error.message)) {
			return false;
		}

		// If custom patterns are configured, only retry matching errors
		if (retry?.retryableErrors) {
			return retry.retryableErrors.some((p) => p.test(error.message));
		}

		// Default: retry most errors (be permissive)
		return true;
	}

	/**
	 * Sleep for a given number of milliseconds.
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Call the LLM with retry logic and exponential backoff.
	 */
	private async callLLMWithRetry(
		llmProvider: LLMProvider,
		request: Parameters<LLMProvider["chat"]>[0],
	): Promise<Awaited<ReturnType<LLMProvider["chat"]>>> {
		const retry = this.config.retry;
		const maxRetries = retry?.maxRetries ?? 3;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			// Check circuit breaker before each attempt
			if (this.isCircuitBreakerOpen()) {
				throw new Error(
					"Circuit breaker is open — LLM calls are temporarily disabled",
				);
			}

			try {
				const result = await llmProvider.chat(request);
				this.recordSuccess();
				return result;
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				lastError = err;

				// If this is the last attempt, don't sleep
				if (attempt < maxRetries) {
					// Check if the error is retryable
					if (!this.isRetryableError(err)) {
						throw err; // Non-retryable error — fail immediately
					}

					const delay = this.getBackoffDelay(attempt);
					this.events.emit("agent:retry", {
						attempt: attempt + 1,
						maxRetries,
						error: err.message,
						delay,
					});

					await this.sleep(delay);
				}
			}
		}

		// All retries exhausted
		this.recordFailure();
		throw lastError ?? new Error("LLM call failed with unknown error");
	}

	// ── Response Formatting (delegated to ResponseFormatter) ──────────────────

	/**
	 * Format a response according to the specified format type.
	 */
	formatResponse(
		content: string,
		format: "markdown" | "json" | "plain" | "structured" = "markdown",
	): string {
		return this.responseFormatter.format(content, format);
	}

	// ── Core Loop ────────────────────────────────────────────────────────────

	/**
	 * Build the standard LLM request from current config and messages.
	 */
	private buildLlmRequest(
		llmProvider: LLMProvider,
		messages: Array<{ role: string; content: string }>,
	): Parameters<LLMProvider["chat"]>[0] {
		return {
			messages: messages as import("../providers/types.js").ProviderMessage[],
			model: this.config.model ?? llmProvider.getConfig().model ?? "default",
			system: this.config.systemPrompt,
			maxTokens: this.config.maxTokens,
			temperature: this.config.temperature,
			topP: this.config.topP,
			stop: this.config.stop,
			tools: this.config.tools,
			toolChoice: this.config.toolChoice,
		};
	}

	/**
	 * Non-streaming LLM call strategy with retry logic.
	 */
	private createNonStreamingStrategy(
		llmProvider: LLMProvider,
	): LlmCallStrategy {
		return async (messages): Promise<LlmCallResult> => {
			const result = await this.callLLMWithRetry(
				llmProvider,
				this.buildLlmRequest(llmProvider, messages),
			);
			return {
				content: result.content,
				tokens: result.totalTokens || 0,
				toolCalls: result.toolCalls,
			};
		};
	}

	/**
	 * Create a streaming LLM call strategy.
	 * @param onChunk — called for each streaming chunk (allows yielding to caller)
	 */
	private createStreamingStrategy(
		llmProvider: LLMProvider,
		onChunk: (chunk: import("../providers/types.js").StreamChunk) => void,
	): LlmCallStrategy {
		return async (messages): Promise<LlmCallResult> => {
			const retry = this.config.retry;
			const maxRetries = retry?.maxRetries ?? 3;
			let lastError: Error | null = null;

			for (let attempt = 0; attempt <= maxRetries; attempt++) {
				if (this.isCircuitBreakerOpen()) {
					throw new Error(
						"Circuit breaker is open — LLM calls are temporarily disabled",
					);
				}

				try {
					let content = "";
					let tokens = 0;
					let toolCalls: LlmCallResult["toolCalls"];

					for await (const chunk of llmProvider.chatStream(
						this.buildLlmRequest(llmProvider, messages),
					)) {
						onChunk(chunk);
						if (!chunk.done) {
							content += chunk.delta;
						}
						if (chunk.usage) {
							tokens = chunk.usage.totalTokens;
						}
						if (chunk.toolCalls && chunk.toolCalls.length > 0) {
							toolCalls = chunk.toolCalls;
						}
					}

					this.recordSuccess();
					return { content, tokens, toolCalls: toolCalls ?? [] };
				} catch (error) {
					lastError = error instanceof Error ? error : new Error(String(error));

					if (!this.isRetryableError(lastError) || attempt === maxRetries) {
						throw lastError;
					}

					this.events.emit("agent:retry", {
						attempt: attempt + 1,
						maxRetries,
						error: lastError.message,
						delay: this.getBackoffDelay(attempt),
					});

					await this.sleep(this.getBackoffDelay(attempt));
				}
			}

			throw lastError ?? new Error("Streaming LLM call failed");
		};
	}

	/**
	 * Ensure context is healthy by compacting and trimming if needed.
	 * Shared between streaming and non-streaming agent loops.
	 */
	private async ensureContextHealthy(errors: string[]): Promise<void> {
		if (this.context.needsCompaction()) {
			const result = this.context.compact();
			errors.push(`Context compacted: ${result.summary}`);
		}
		const snapshot = this.context.getSnapshot();
		if (snapshot.truncated) {
			this.context.trimToMaxTokens();
		}
	}

	/**
	 * Shared tool-call loop — the core "LLM decides → tools execute → repeat"
	 * cycle used by both streaming and non-streaming paths.
	 *
	 * Returns the accumulated response content, tool call count, errors,
	 * and whether the non-streaming caller should short-circuit on error.
	 */
	private async runToolLoop(
		message: AgentMessage,
		llmStrategy: LlmCallStrategy,
		onError: (
			errorMsg: string,
			errors: string[],
			toolCallsMade: number,
		) => { shouldReturn: boolean; errorResult?: AgentLoopResult },
	): Promise<{
		responseContent: string;
		toolCallsMade: number;
		errors: string[];
	}> {
		const errors: string[] = [];
		let toolCallsMade = 0;

		// Update state
		this.state = "processing";
		this.stats.status = "running";
		this.stats.lastActivityAt = new Date();

		// Call before-message hook
		if (this.hooks.onBeforeMessage) {
			await this.hooks.onBeforeMessage(message);
		}

		// Add user message to context
		this.context.addMessage(message);

		// Main loop: iterate until LLM returns plain text (no tool calls)
		let currentMessages = this.context.getFormattedMessages();
		let responseContent = "";

		while (toolCallsMade < this.config.maxToolCalls) {
			// Context management (compaction + trimming)
			await this.ensureContextHealthy(errors);
			currentMessages = this.context.getFormattedMessages();

			// Call before-LLM hook
			if (this.hooks.onBeforeLLMCall) {
				await this.hooks.onBeforeLLMCall(currentMessages as AgentMessage[]);
			}

			// Call LLM via strategy
			let llmResponse: string;
			let llmTokens: number;
			let nativeToolCalls:
				| Array<{
						id: string;
						name: string;
						arguments: Record<string, unknown>;
				  }>
				| undefined;
			try {
				const llmResult = await llmStrategy(currentMessages);
				llmResponse = llmResult.content;
				llmTokens = llmResult.tokens;
				nativeToolCalls = llmResult.toolCalls;
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				errors.push(`LLM call failed after retries: ${errorMsg}`);
				this.state = "error";
				const { shouldReturn } = onError(errorMsg, errors, toolCallsMade);
				if (shouldReturn) {
					return { responseContent: "", toolCallsMade, errors };
				}
				continue;
			}

			// Call after-LLM hook
			if (this.hooks.onAfterLLMCall) {
				await this.hooks.onAfterLLMCall(llmResponse, llmTokens);
			}

			this.stats.tokensUsed += llmTokens;

			// Check if the response contains tool calls
			const toolCallsMadeRef = { value: toolCallsMade };
			const currentMessagesRef = { value: currentMessages };
			const toolResult = await this.executeToolCalls(
				llmResponse,
				nativeToolCalls,
				toolCallsMadeRef,
				currentMessagesRef,
				errors,
			);
			toolCallsMade = toolCallsMadeRef.value;
			currentMessages = currentMessagesRef.value;
			responseContent = toolResult.responseContent;
			if (toolResult.shouldContinue) {
				continue;
			}
			break;
		}

		// If we hit max tool calls, return what we have
		if (toolCallsMade >= this.config.maxToolCalls) {
			errors.push(`Reached maximum tool calls (${this.config.maxToolCalls})`);
			responseContent =
				responseContent ||
				`I've made ${this.config.maxToolCalls} tool calls. The task may be too complex. Please try breaking it down.`;
		}

		return { responseContent, toolCallsMade, errors };
	}

	/**
	 * Non-streaming agent loop execution.
	 * Delegates the tool-call loop to runToolLoop and wraps the result.
	 */
	private async executeAgentLoop(
		message: AgentMessage,
		llmStrategy: LlmCallStrategy,
		onLlmError: (
			errorMsg: string,
			errors: string[],
			toolCallsMade: number,
			startTime: number,
		) => AgentLoopResult,
	): Promise<AgentLoopResult> {
		const startTime = Date.now();
		const { responseContent, toolCallsMade, errors } = await this.runToolLoop(
			message,
			llmStrategy,
			(_errorMsg, _errs, _made) => {
				return { shouldReturn: true };
			},
		);

		// If runToolLoop returned early due to an error, build the error result
		if (this.state === "error") {
			const lastError = errors[errors.length - 1] || "Unknown error";
			return onLlmError(lastError, errors, toolCallsMade, startTime);
		}

		return this.buildAgentLoopResult(
			responseContent,
			toolCallsMade,
			startTime,
			errors,
		);
	}

	/**
	 * Execute tool calls from an LLM response.
	 * Returns { shouldContinue, responseContent } where shouldContinue is true
	 * if tool calls were executed (loop should continue), false otherwise.
	 */
	private async executeToolCalls(
		llmResponse: string,
		nativeToolCalls:
			| Array<{ id: string; name: string; arguments: Record<string, unknown> }>
			| undefined,
		toolCallsMadeRef: { value: number },
		currentMessagesRef: { value: Array<{ role: string; content: string }> },
		errors: string[],
	): Promise<{ shouldContinue: boolean; responseContent: string }> {
		const toolCalls =
			nativeToolCalls && nativeToolCalls.length > 0
				? nativeToolCalls
				: parseToolCalls(llmResponse);

		if (toolCalls.length === 0) {
			this.context.addMessage({ role: "assistant", content: llmResponse });
			return { shouldContinue: false, responseContent: llmResponse };
		}

		toolCallsMadeRef.value += toolCalls.length;
		this.context.addMessage({
			role: "assistant",
			content: llmResponse,
			...(nativeToolCalls && nativeToolCalls.length > 0
				? { toolCalls: nativeToolCalls }
				: {}),
		});

		// Execute all tools in parallel
		this.stats.toolCallsMade += toolCalls.length;
		this.state = "waiting_for_tool";

		// Call before-hooks sequentially (side effects may depend on order)
		for (const call of toolCalls) {
			if (this.hooks.onBeforeToolCall) {
				await this.hooks.onBeforeToolCall(call);
			}
		}

		// Run all tools in parallel via executeAll
		const results = await this.tools.executeAll(toolCalls);

		// Process results — call after-hooks and add to context
		for (let i = 0; i < toolCalls.length; i++) {
			const call = toolCalls[i];
			const result = results[i];

			if (this.hooks.onAfterToolCall) {
				await this.hooks.onAfterToolCall(result);
			}

			this.context.addMessage({
				role: "tool",
				content: result.content || "",
				toolCallId: call.id,
				metadata: { toolName: call.name, error: result.error },
			});

			if (result.error) {
				errors.push(`Tool "${call.name}" failed: ${result.error}`);
			}
		}

		this.state = "processing";
		currentMessagesRef.value = this.context.getFormattedMessages();
		return { shouldContinue: true, responseContent: "" };
	}

	/**
	 * Build the final AgentLoopResult and update state.
	 */
	private buildAgentLoopResult(
		responseContent: string,
		toolCallsMade: number,
		startTime: number,
		errors: string[],
	): AgentLoopResult {
		const formattedResponse = this.formatResponse(
			responseContent,
			this.config.responseFormat,
		);

		const result: AgentLoopResult = {
			response: formattedResponse,
			tokensUsed: this.stats.tokensUsed,
			toolCallsMade,
			duration: Date.now() - startTime,
			errors,
		};

		this.stats.messagesProcessed++;
		this.stats.currentTokens = this.context.getTokenCount();

		if (this.hooks.onAfterMessage) {
			this.hooks.onAfterMessage(result);
		}

		this.events.emit("agent:message_processed", result);

		this.state = "idle";
		this.stats.status = "idle";

		return result;
	}

	/**
	 * Process a user message through the agent loop.
	 * This is the main entry point: message in → LLM → tools → response out.
	 */
	async processMessage(
		message: AgentMessage,
		llmProvider: LLMProvider,
	): Promise<AgentLoopResult> {
		const strategy = this.createNonStreamingStrategy(llmProvider);

		const onError = (
			errorMsg: string,
			errors: string[],
			toolCallsMade: number,
			startTime: number,
		): AgentLoopResult => {
			const result: AgentLoopResult = {
				response: `Error processing your message: ${errorMsg}`,
				tokensUsed: this.stats.tokensUsed,
				toolCallsMade,
				duration: Date.now() - startTime,
				errors,
			};
			if (this.hooks.onAfterMessage) {
				this.hooks.onAfterMessage(result);
			}
			this.state = "idle";
			this.stats.status = "idle";
			return result;
		};

		return this.executeAgentLoop(message, strategy, onError);
	}

	/**
	 * Process a user message through the agent loop with streaming output.
	 * Yields StreamChunk objects as they arrive from the LLM.
	 * Returns the final AgentLoopResult after all tool calls complete.
	 */
	async *processMessageStream(
		message: AgentMessage,
		llmProvider: LLMProvider,
	): AsyncGenerator<StreamChunk, AgentLoopResult, unknown> {
		const startTime = Date.now();
		const errors: string[] = [];
		let toolCallsMade = 0;
		let totalTokens = 0;

		// Update state
		this.state = "processing";
		this.stats.status = "running";
		this.stats.lastActivityAt = new Date();

		// Call before-message hook
		if (this.hooks.onBeforeMessage) {
			await this.hooks.onBeforeMessage(message);
		}

		// Add user message to context
		this.context.addMessage(message);

		// Main loop: iterate until LLM returns plain text (no tool calls)
		let currentMessages = this.context.getFormattedMessages();
		let responseContent = "";

		const strategy = this.createStreamingStrategy(llmProvider, (chunk) => {
			// Yield chunks as they arrive from the streaming strategy
			// Using a side channel since async generators can't yield from callbacks
			pendingChunks.push(chunk);
		});

		const pendingChunks: StreamChunk[] = [];

		while (toolCallsMade < this.config.maxToolCalls) {
			// Context management (compaction + trimming)
			await this.ensureContextHealthy(errors);
			currentMessages = this.context.getFormattedMessages();

			// Call before-LLM hook
			if (this.hooks.onBeforeLLMCall) {
				await this.hooks.onBeforeLLMCall(currentMessages as AgentMessage[]);
			}

			// Call LLM via streaming strategy
			let llmResponse: string;
			let llmTokens: number;
			let nativeToolCalls:
				| Array<{
						id: string;
						name: string;
						arguments: Record<string, unknown>;
				  }>
				| undefined;

			try {
				// Clear pending chunks before each LLM call
				pendingChunks.length = 0;

				const llmResult = await strategy(currentMessages);

				// Yield all chunks that were collected during this LLM call
				for (const chunk of pendingChunks.splice(0)) {
					if (!chunk.done && chunk.delta) {
						yield chunk;
					}
				}

				llmResponse = llmResult.content;
				llmTokens = llmResult.tokens;
				nativeToolCalls = llmResult.toolCalls;
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				errors.push(`LLM call failed after retries: ${errorMsg}`);
				this.state = "error";

				yield { delta: `\n\n[Error: ${errorMsg}]`, done: true };

				const result: AgentLoopResult = {
					response: `Error processing your message: ${errorMsg}`,
					tokensUsed: this.stats.tokensUsed,
					toolCallsMade,
					duration: Date.now() - startTime,
					errors,
				};

				if (this.hooks.onAfterMessage) {
					await this.hooks.onAfterMessage(result);
				}

				this.state = "idle";
				this.stats.status = "idle";
				return result;
			}

			// Call after-LLM hook
			if (this.hooks.onAfterLLMCall) {
				await this.hooks.onAfterLLMCall(llmResponse, llmTokens);
			}

			totalTokens += llmTokens;
			this.stats.tokensUsed += llmTokens;

			// Check if the response contains tool calls
			const toolCallsMadeRef = { value: toolCallsMade };
			const currentMessagesRef = { value: currentMessages };
			const toolResult = await this.executeToolCalls(
				llmResponse,
				nativeToolCalls,
				toolCallsMadeRef,
				currentMessagesRef,
				errors,
			);
			toolCallsMade = toolCallsMadeRef.value;
			currentMessages = currentMessagesRef.value;
			responseContent = toolResult.responseContent;
			if (toolResult.shouldContinue) {
				continue;
			}
			break;
		}

		// If we hit max tool calls, return what we have
		if (toolCallsMade >= this.config.maxToolCalls) {
			errors.push(`Reached maximum tool calls (${this.config.maxToolCalls})`);
			responseContent =
				responseContent ||
				`I've made ${this.config.maxToolCalls} tool calls. The task may be too complex. Please try breaking it down.`;
		}

		// Yield final chunk with result
		yield {
			delta: "",
			done: true,
			usage: {
				promptTokens: 0,
				completionTokens: totalTokens,
				totalTokens: totalTokens,
			},
		};

		return this.buildAgentLoopResult(
			responseContent,
			toolCallsMade,
			startTime,
			errors,
		);
	}

	/**
	 * Process a message with a simple callback-based LLM provider.
	 */
	async processMessageWithCallback(
		message: AgentMessage,
		chatCallback: (request: {
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
		}) => Promise<{ content: string; tokens?: number }>,
	): Promise<AgentLoopResult> {
		const provider: LLMProvider = {
			name: "callback",
			chat: async (req) => {
				const result = await chatCallback(req);
				return { ...result, model: "callback", totalTokens: result.tokens };
			},
			chatStream: async function* () {
				yield { delta: "", done: true };
			},
			listModels: async () => [],
			healthCheck: async () => true,
			getConfig: () => ({ provider: "callback", apiKey: "" }),
		};
		return this.processMessage(message, provider);
	}

	// ── Context Management ───────────────────────────────────────────────────

	getContext(): ContextWindowManager {
		return this.context;
	}

	getSnapshot() {
		return this.context.getSnapshot();
	}

	clearContext(): void {
		this.context.clear();
	}

	// ── Tool Management ──────────────────────────────────────────────────────

	getTools(): ToolRegistry {
		return this.tools;
	}

	/** Register a tool: adds handler + sends definition to the LLM. */
	registerTool(
		tool: {
			name: string;
			description: string;
			parameters: Record<string, unknown>;
		},
		handler: (
			args: Record<string, unknown>,
		) => Promise<{ content: string; error?: string }>,
	): void {
		this.tools.register(tool, async (args) => {
			const result = await handler(args);
			return {
				callId: "",
				name: tool.name,
				content: result.content,
				error: result.error,
			};
		});
		// Also add to config.tools so the LLM receives the tool definitions
		const toolDefs = this.config.tools || [];
		toolDefs.push({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		});
		this.config.tools = toolDefs;
	}

	/**
	 * Pre-load conversation history into the context window.
	 * Call before processMessage() to maintain continuity across turns.
	 */
	loadHistory(messages: AgentMessage[]): void {
		for (const msg of messages) {
			this.context.addMessage(msg);
		}
	}

	// ── State & Stats ────────────────────────────────────────────────────────

	getState(): AgentLoopState {
		return this.state;
	}

	getStats(): AgentState {
		return { ...this.stats };
	}

	isRunning(): boolean {
		return this.running;
	}

	// ── Events ──────────────────────────────────────────────────────────────
	//
	// Event map (documented):
	//   "agent:started"                     → ()
	//   "agent:stopped"                     → ()
	//   "agent:state_changed"               → (state: string)
	//   "agent:message_processed"           → (result: AgentLoopResult)
	//   "agent:circuit_breaker:open"        → ()
	//   "agent:circuit_breaker:closed"      → ()
	//   "agent:retry"                       → ({ attempt, maxRetries, error, delay })

	on(event: string, listener: (...args: unknown[]) => void): void {
		this.events.on(event, listener);
	}

	off(event: string, listener: (...args: unknown[]) => void): void {
		this.events.off(event, listener);
	}

	once(event: string, listener: (...args: unknown[]) => void): void {
		this.events.once(event, listener);
	}
}
