/**
 * Context Window Manager
 * Manages token counting, compaction, and message history for the agent loop.
 */

import type {
	AgentMessage,
	ContextCompactionResult,
	ContextSnapshot,
	ContextWindowConfig,
} from "./types.js";

const DEFAULT_CONFIG: ContextWindowConfig = {
	maxTokens: 128_000,
	compactThreshold: 100_000,
	minRecentMessages: 10,
	summarizeOldMessages: true,
};

/**
 * Rough token estimator: ~4 chars per token for English text.
 * This is a heuristic — real token counts depend on the model's tokenizer.
 */
function estimateTokens(text: string): number {
	if (text.length === 0) return 0;
	// More accurate: count newlines (each is ~1 token), then chars/4
	const newlineCount = (text.match(/\n/g) || []).length;
	const charTokens = Math.ceil(text.length / 4);
	return charTokens + newlineCount;
}

export class ContextWindowManager {
	private config: ContextWindowConfig;
	private messages: AgentMessage[];
	private tokenCount: number;

	constructor(config?: Partial<ContextWindowConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.messages = [];
		this.tokenCount = 0;
	}

	/** Add a message to the context window */
	addMessage(message: AgentMessage): void {
		const tokens = estimateTokens(message.content);
		this.messages.push(message);
		this.tokenCount += tokens;
	}

	/** Replace the entire message history */
	setMessages(messages: AgentMessage[]): void {
		this.messages = [...messages];
		this.tokenCount = messages.reduce(
			(sum, m) => sum + estimateTokens(m.content),
			0,
		);
	}

	/** Get all messages in the context window */
	getMessages(): AgentMessage[] {
		return [...this.messages];
	}

	/** Get the current token count */
	getTokenCount(): number {
		return this.tokenCount;
	}

	/** Check if compaction is needed */
	needsCompaction(): boolean {
		return this.tokenCount > this.config.compactThreshold;
	}

	/**
	 * Compact the context window by summarizing older messages.
	 * Keeps the system prompt and recent messages intact.
	 */
	compact(): ContextCompactionResult {
		if (!this.needsCompaction()) {
			return {
				messages: [...this.messages],
				tokenCount: this.tokenCount,
				needed: false,
				summary: "No compaction needed",
			};
		}

		const messages = [...this.messages];
		const systemMessages = messages.filter((m) => m.role === "system");
		const recentCount = Math.max(
			this.config.minRecentMessages,
			Math.ceil(messages.length * 0.3),
		);
		const recentMessages = messages.slice(-recentCount);
		const oldMessages = messages.slice(0, -recentCount);

		// Create a summary of old messages
		const summary = this.summarizeMessages(oldMessages);

		// Build compacted message list
		const compacted: AgentMessage[] = [
			...systemMessages,
			{
				role: "system",
				content: `[Context Summary — ${oldMessages.length} older messages summarized]\n${summary}`,
			},
			...recentMessages,
		];

		const newTokenCount = compacted.reduce(
			(sum, m) => sum + estimateTokens(m.content),
			0,
		);

		this.messages = compacted;
		this.tokenCount = newTokenCount;

		return {
			messages: [...compacted],
			tokenCount: newTokenCount,
			needed: true,
			summary: `Summarized ${oldMessages.length} messages into ${recentCount} recent messages. Reduced from ~${this.tokenCount + estimateTokens(summary)} to ~${newTokenCount} tokens.`,
		};
	}

	/**
	 * Get a snapshot of the current context window.
	 */
	getSnapshot(): ContextSnapshot {
		return {
			messages: [...this.messages],
			tokenCount: this.tokenCount,
			truncated: this.tokenCount > this.config.maxTokens,
		};
	}

	/**
	 * Trim messages from the beginning to fit within maxTokens.
	 */
	trimToMaxTokens(): ContextSnapshot {
		if (this.tokenCount <= this.config.maxTokens) {
			return this.getSnapshot();
		}

		const messages = [...this.messages];
		const systemMessages = messages.filter((m) => m.role === "system");
		const nonSystemMessages = messages.filter((m) => m.role !== "system");

		// Keep system messages, trim from the oldest non-system messages
		let trimmedTokens = systemMessages.reduce(
			(sum, m) => sum + estimateTokens(m.content),
			0,
		);

		// Keep messages from the end until we fit
		let keptMessages: AgentMessage[] = [];
		for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
			const msg = nonSystemMessages[i];
			const msgTokens = estimateTokens(msg.content);
			if (trimmedTokens + msgTokens <= this.config.maxTokens) {
				keptMessages.unshift(msg);
				trimmedTokens += msgTokens;
			}
		}

		// If we couldn't fit even one message, keep the most recent one
		if (keptMessages.length === 0 && nonSystemMessages.length > 0) {
			const lastMsg = nonSystemMessages[nonSystemMessages.length - 1];
			keptMessages = [lastMsg];
			trimmedTokens = estimateTokens(lastMsg.content);
		}

		const finalMessages = [...systemMessages, ...keptMessages];
		this.messages = finalMessages;
		this.tokenCount = trimmedTokens;

		return {
			messages: [...finalMessages],
			tokenCount: this.tokenCount,
			truncated: true,
		};
	}

	/**
	 * Clear all messages from the context window.
	 */
	clear(): void {
		this.messages = [];
		this.tokenCount = 0;
	}

	/**
	 * Get the number of messages in the context window.
	 */
	getMessageCount(): number {
		return this.messages.length;
	}

	/**
	 * Get messages formatted for LLM API (role/content pairs).
	 */
	getFormattedMessages(): Array<{
		role: string;
		content: string;
		toolCallId?: string;
		toolCalls?: Array<{
			id: string;
			name: string;
			arguments: Record<string, unknown>;
		}>;
	}> {
		return this.messages.map((m) => ({
			role: m.role,
			content: m.content,
			...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
			...(m.toolCalls && m.toolCalls.length > 0 ? { toolCalls: m.toolCalls } : {}),
		}));
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private summarizeMessages(messages: AgentMessage[]): string {
		if (messages.length === 0) return "";

		// Group by role for a structured summary
		const userMessages = messages.filter((m) => m.role === "user");
		const assistantMessages = messages.filter((m) => m.role === "assistant");
		const toolMessages = messages.filter((m) => m.role === "tool");

		const parts: string[] = [];

		if (userMessages.length > 0) {
			const lastFew = userMessages.slice(-3);
			parts.push(`User (${userMessages.length} messages, showing last 3):`);
			for (const msg of lastFew) {
				const preview =
					msg.content.length > 200
						? `${msg.content.slice(0, 200)}...`
						: msg.content;
				parts.push(`  - ${preview}`);
			}
		}

		if (assistantMessages.length > 0) {
			const lastFew = assistantMessages.slice(-3);
			parts.push(
				`Assistant (${assistantMessages.length} messages, showing last 3):`,
			);
			for (const msg of lastFew) {
				const preview =
					msg.content.length > 200
						? `${msg.content.slice(0, 200)}...`
						: msg.content;
				parts.push(`  - ${preview}`);
			}
		}

		if (toolMessages.length > 0) {
			parts.push(`Tool results (${toolMessages.length} results):`);
			const lastFew = toolMessages.slice(-3);
			for (const msg of lastFew) {
				const preview =
					msg.content.length > 200
						? `${msg.content.slice(0, 200)}...`
						: msg.content;
				parts.push(`  - ${preview}`);
			}
		}

		return parts.join("\n");
	}
}
