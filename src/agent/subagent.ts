/**
 * Subagent Spawner
 * Manages creation, execution, and monitoring of subagent instances.
 * Subagents are lightweight AgentLoop instances that run concurrently
 * with their parent, each with their own context window and LLM calls.
 */

import { randomUUID } from "node:crypto";
import { SimpleLogger } from "../core/logger.js";
import type { LLMProvider } from "../providers/types.js";
import { AgentLoop } from "./loop.js";
import type {
	AgentHooks,
	AgentLoopConfig,
	AgentLoopResult,
	AgentMessage,
	SubagentConfig,
	SubagentResult,
} from "./types.js";

export class SubagentSpawner {
	private logger: SimpleLogger;
	private activeSubagents: Map<string, SubagentResult>;
	private maxConcurrent: number;

	constructor(maxConcurrent: number = 5) {
		this.logger = new SimpleLogger({
			level: "info",
			prefix: "synthtek-subagent",
		});
		this.activeSubagents = new Map();
		this.maxConcurrent = maxConcurrent;
	}

	/**
	 * Spawn a new subagent with the given configuration.
	 * The subagent runs concurrently and returns its result when complete.
	 */
	async spawn(
		config: SubagentConfig,
		parentProvider: LLMProvider,
		parentContext?: AgentMessage[],
	): Promise<SubagentResult> {
		const id = randomUUID();

		// Check concurrency limit
		const activeCount = this.activeSubagents.size;
		if (activeCount >= this.maxConcurrent) {
			this.logger.warn("Max concurrent subagents reached", {
				active: activeCount,
				max: this.maxConcurrent,
			});
			return {
				id,
				response: `Cannot spawn subagent: max concurrent limit (${this.maxConcurrent}) reached. Please wait for existing subagents to complete.`,
				tokensUsed: 0,
				toolCallsMade: 0,
				duration: 0,
				errors: [`Max concurrent subagents (${this.maxConcurrent}) reached`],
				status: "failed",
			};
		}

		this.logger.info("Spawning subagent", {
			id: id.slice(0, 8),
			task: config.task.slice(0, 100),
		});

		// Build subagent config
		const loopConfig: AgentLoopConfig = {
			systemPrompt:
				config.systemPrompt ??
				"You are a helpful AI assistant working on a specific task.",
			maxToolCalls: config.maxToolCalls ?? 15,
			model: config.model,
			temperature: config.temperature,
			maxTokens: config.maxTokens,
			contextWindow: {
				maxTokens: config.maxTokens ?? 128_000,
				compactThreshold: 100_000,
				minRecentMessages: 10,
				summarizeOldMessages: true,
			},
		};

		// Build hooks for the subagent
		const hooks: AgentHooks = {
			onBeforeMessage: async (_message) => {
				this.logger.debug("Subagent processing message", {
					id: id.slice(0, 8),
				});
			},
			onAfterMessage: async (result) => {
				this.logger.debug("Subagent message processed", {
					id: id.slice(0, 8),
					tokens: result.tokensUsed,
					duration: `${result.duration}ms`,
				});
			},
			onBeforeLLMCall: async (messages) => {
				this.logger.debug("Subagent LLM call", {
					id: id.slice(0, 8),
					messageCount: messages.length,
				});
			},
			onAfterLLMCall: async (_response, tokens) => {
				this.logger.debug("Subagent LLM response", {
					id: id.slice(0, 8),
					tokens,
				});
			},
		};

		// Create the subagent loop
		const subagentLoop = new AgentLoop(loopConfig, hooks);
		await subagentLoop.start();

		// Prepare context if inheriting from parent
		let initialMessages: AgentMessage[] = [];
		if (parentContext && config.inheritContext) {
			// Include only the most recent messages to avoid context bloat
			const recentCount = Math.min(parentContext.length, 20);
			initialMessages = parentContext.slice(-recentCount);
		}

		// Create the user message for the subagent
		const subagentMessage: AgentMessage = {
			role: "user",
			content: `You are a specialized subagent. Your task is:\n\n${config.task}\n\nPlease complete this task thoroughly. If you need to use tools, do so to gather information and complete the work.`,
			metadata: {
				subagentId: id,
				parentId: "parent",
				inheritContext: config.inheritContext ?? false,
			},
		};

		// Add initial messages if inheriting context
		for (const msg of initialMessages) {
			subagentLoop.getContext().addMessage(msg);
		}

		// Execute with timeout
		let result: AgentLoopResult;
		let status: SubagentResult["status"] = "completed";
		const errors: string[] = [];

		const timeoutMs = (config.timeout ?? 300) * 1000; // default 300 seconds

		try {
			const timeoutPromise = new Promise<never>((_, reject) => {
				const timer = setTimeout(() => {
					status = "timeout";
					reject(new Error(`Subagent timed out after ${config.timeout}s`));
				}, timeoutMs);
				if (timer.unref) timer.unref();
			});

			const executionPromise = subagentLoop.processMessage(
				subagentMessage,
				parentProvider,
			);

			result = await Promise.race([executionPromise, timeoutPromise]);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			errors.push(errorMsg);
			status = "failed";
			result = {
				response: `Subagent failed: ${errorMsg}`,
				tokensUsed: 0,
				toolCallsMade: 0,
				duration: 0,
				errors,
			};
		} finally {
			await subagentLoop.stop();
		}

		// Build the result
		const subagentResult: SubagentResult = {
			id,
			response: result.response,
			tokensUsed: result.tokensUsed,
			toolCallsMade: result.toolCallsMade,
			duration: result.duration,
			errors: result.errors.length > 0 ? result.errors : errors,
			status,
		};

		// Store the result
		this.activeSubagents.set(id, subagentResult);

		// Clean up if not merging results
		if (!config.mergeResults) {
			// Keep result for a while but allow GC of the loop
			setTimeout(() => {
				this.activeSubagents.delete(id);
			}, 60_000); // Remove after 1 minute
		}

		this.logger.info("Subagent completed", {
			id: id.slice(0, 8),
			status,
			tokens: result.tokensUsed,
			duration: `${result.duration}ms`,
		});

		return subagentResult;
	}

	/**
	 * Get the result of a subagent by ID.
	 */
	getResult(id: string): SubagentResult | undefined {
		return this.activeSubagents.get(id);
	}

	/**
	 * Get all active subagent results.
	 */
	getResults(): SubagentResult[] {
		return Array.from(this.activeSubagents.values());
	}

	/**
	 * Get the number of active subagents.
	 */
	getActiveCount(): number {
		return this.activeSubagents.size;
	}

	/**
	 * Cancel a running subagent (if possible).
	 * Note: Since subagents run synchronously in this implementation,
	 * cancellation is limited. For true async cancellation, you'd need
	 * AbortController integration.
	 */
	async cancel(id: string): Promise<boolean> {
		const result = this.activeSubagents.get(id);
		if (!result) {
			return false;
		}

		// If the subagent has already completed, just remove it
		if (result.status !== "completed" && result.status !== "failed") {
			// In a real implementation, you'd use AbortController to cancel
			// For now, mark as cancelled (the subagent will complete naturally)
			this.activeSubagents.set(id, { ...result, status: "cancelled" });
		}

		return true;
	}

	/**
	 * Clear all subagent results.
	 */
	clearResults(): void {
		this.activeSubagents.clear();
	}
}
