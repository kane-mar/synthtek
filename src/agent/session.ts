/**
 * AgentSession — unified session-based agent interface.
 *
 * Wraps AgentLoop + tools + conversation store + history management
 * into a single consistent interface. All entry points (WebUI, TUI,
 * channels) use this the same way, ensuring seamless hand-offs
 * and identical tool availability.
 *
 * Usage:
 *   const session = new AgentSession(provider, { systemPrompt });
 *   const reply = await session.processMessage("hello", "conv_123");
 *   console.log(reply);
 */

import { ConversationStore } from "../messaging/conversation-store.js";
import type { LLMProvider } from "../providers/types.js";
import { registerBuiltinTools } from "./builtin-tools.js";
import { AgentLoop } from "./loop.js";
import type { AgentLoopConfig, AgentLoopResult } from "./types.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface AgentSessionConfig {
	/** System prompt for the agent */
	systemPrompt?: string;
	/** Maximum tool calls per message */
	maxToolCalls?: number;
	/** Response format */
	responseFormat?: "markdown" | "json" | "plain" | "structured";
	/** Additional AgentLoop config overrides */
	loopConfig?: Partial<AgentLoopConfig>;
	/** Workspace directory for ConversationStore */
	workspaceDir?: string;
	/** Whether to auto-persist messages to ConversationStore (default true) */
	autoPersist?: boolean;
	/** Callback after each message is processed */
	onResult?: (result: AgentLoopResult) => void;
}

// ─── AgentSession ────────────────────────────────────────────────────────────

export class AgentSession {
	private loop: AgentLoop;
	private provider: LLMProvider;
	private config: Required<AgentSessionConfig>;
	private store: ConversationStore;
	private sessionCount = 0;

	constructor(
		provider: LLMProvider,
		config: AgentSessionConfig = {},
	) {
		this.provider = provider;
		this.config = {
			systemPrompt: config.systemPrompt || "You are a helpful AI assistant.",
			maxToolCalls: config.maxToolCalls ?? 15,
			responseFormat: config.responseFormat ?? "markdown",
			loopConfig: config.loopConfig ?? {},
			workspaceDir: config.workspaceDir ?? process.env.SYNTHTEK_WORKSPACE ?? process.cwd(),
			autoPersist: config.autoPersist ?? true,
			onResult: config.onResult ?? (() => {}),
		};

		this.store = new ConversationStore(this.config.workspaceDir);
		this.loop = this.createLoop();
	}

	/**
	 * Create a fresh AgentLoop with tools registered.
	 * Called once at construction; can be called again to reset state.
	 */
	private createLoop(): AgentLoop {
		const loop = new AgentLoop({
			systemPrompt: this.config.systemPrompt,
			maxToolCalls: this.config.maxToolCalls,
			responseFormat: this.config.responseFormat,
			...this.config.loopConfig,
		});
		registerBuiltinTools(loop);
		return loop;
	}

	/**
	 * Reset the internal AgentLoop (clears context, resets tool call count).
	 * Useful when switching conversations or after errors.
	 */
	reset(): void {
		this.loop = this.createLoop();
	}

	/**
	 * Process a user message through the agent loop.
	 *
	 * @param content - The user's message text.
	 * @param conversationId - Optional. If provided, history is loaded from
	 *   ConversationStore and the response is auto-persisted.
	 * @param historyMessages - Optional pre-built message history (used by
	 *   WebUI which sends history in the request body). Takes precedence
	 *   over ConversationStore loading.
	 * @returns The full AgentLoopResult including response text, tool calls,
	 *   tokens used, and any errors.
	 */
	async processMessage(
		content: string,
		conversationId?: string,
		historyMessages?: Array<{ role: string; content: string }>,
	): Promise<AgentLoopResult> {
		this.sessionCount++;

		// ── Load conversation history ────────────────────────────
		let loadedFromStore = false;
		if (historyMessages && historyMessages.length > 0) {
			// Use provided history (WebUI pattern: whole conversation in request)
			this.loop.loadHistory(
				historyMessages.map((m) => ({
					role: m.role as "user" | "assistant" | "system",
					content: m.content,
				})),
			);
		} else if (conversationId) {
			// Load from ConversationStore (channel/TUI pattern)
			const conv = this.store.get(conversationId);
			if (conv && conv.messages.length > 0) {
				this.loop.loadHistory(
					conv.messages.map((m) => ({
						role: m.role,
						content: m.content,
					})),
				);
				loadedFromStore = true;
			}
		}

		// ── Persist user message ─────────────────────────────────
		if (this.config.autoPersist && conversationId) {
			if (!loadedFromStore) {
				// Ensure conversation exists
				let conv = this.store.get(conversationId);
				if (!conv) {
					conv = this.store.create(`Conversation ${conversationId.slice(0, 8)}`);
					conv.id = conversationId;
					this.store.save(conv);
				}
			}
			this.store.addMessage(conversationId, { role: "user", content });
		}

		// ── Run agent loop ───────────────────────────────────────
		const result = await this.loop.processMessage(
			{ role: "user", content },
			this.provider,
		);

		// ── Callback ─────────────────────────────────────────────
		this.config.onResult(result);

		// ── Persist assistant response ───────────────────────────
		if (this.config.autoPersist && conversationId) {
			this.store.addMessage(conversationId, {
				role: "assistant",
				content: result.response,
			});
		}

		return result;
	}

	/**
	 * Get access to the underlying ConversationStore.
	 * Useful for listing conversations or manual management.
	 */
	getStore(): ConversationStore {
		return this.store;
	}

	/**
	 * Get the current session statistics.
	 */
	getStats(): { sessionCount: number } {
		return { sessionCount: this.sessionCount };
	}
}
