/**
 * Subagent Spawner
 * Manages creation, execution, and monitoring of subagent instances.
 * Subagents are lightweight AgentLoop instances that run concurrently
 * with their parent, each with their own context window and LLM calls.
 */

import { randomUUID } from "node:crypto";
import { getSystemPrompt } from "../config/agent-config.js";
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
	private activeSubagents: Map<
		string,
		{ result: SubagentResult; abort: AbortController }
	>;
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
				getSystemPrompt() +
					"\n\nYou are working on a specific delegated task for the main agent.",
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
		const abort = new AbortController();

		const timeoutMs = (config.timeout ?? 300) * 1000; // default 300 seconds

		try {
			const cancellationPromise = new Promise<never>((_, reject) => {
				abort.signal.addEventListener("abort", () => {
					status = "cancelled";
					reject(new Error("Subagent cancelled"));
				});
			});

			const timeoutPromise = new Promise<never>((_, reject) => {
				const timer = setTimeout(() => {
					status = "timeout";
					abort.abort();
					reject(new Error(`Subagent timed out after ${config.timeout}s`));
				}, timeoutMs);
				if (timer.unref) timer.unref();
			});

			const executionPromise = subagentLoop.processMessage(
				subagentMessage,
				parentProvider,
			);

			result = await Promise.race([
				executionPromise,
				timeoutPromise,
				cancellationPromise,
			]);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			errors.push(errorMsg);
			if (status === "completed") status = "failed";
			result = {
				response: `Subagent ${status}: ${errorMsg}`,
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

		// Store result + abort handle for cancellation
		this.activeSubagents.set(id, { result: subagentResult, abort });

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
		return this.activeSubagents.get(id)?.result;
	}

	/**
	 * Get all active subagent results.
	 */
	getResults(): SubagentResult[] {
		return Array.from(this.activeSubagents.values()).map((e) => e.result);
	}

	/**
	 * Get the number of active subagents.
	 */
	getActiveCount(): number {
		return this.activeSubagents.size;
	}

	/**
	 * Cancel a running subagent.
	 * Uses AbortController to signal cancellation to the running loop.
	 */
	async cancel(id: string): Promise<boolean> {
		const entry = this.activeSubagents.get(id);
		if (!entry) {
			return false;
		}

		// If the subagent has already completed, just remove it
		if (
			entry.result.status !== "completed" &&
			entry.result.status !== "failed"
		) {
			entry.abort.abort();
			entry.result.status = "cancelled";
			entry.result.response = `Subagent cancelled.`;
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
