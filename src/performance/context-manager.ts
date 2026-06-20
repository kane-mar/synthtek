/**
 * Memory-efficient context manager for synthtek
 * Manages conversation context with automatic compaction
 */

import type {
	ContextManagerConfig,
	ContextMessage,
	ContextSnapshot,
	ContextStats,
} from "./types.js";

const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig = {
	maxTokens: 8000,
	maxMessages: 200,
	compactionThreshold: 7000,
	minKeptMessages: 10,
};

export class ContextManager {
	private readonly _config: ContextManagerConfig;
	private readonly _messages: ContextMessage[] = [];
	private _compactionCount = 0;

	constructor(config?: Partial<ContextManagerConfig>) {
		this._config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
	}

	addMessage(message: ContextMessage): void {
		// Enforce max messages limit
		if (this._messages.length >= this._config.maxMessages) {
			this.compact();
		}

		this._messages.push(message);
	}

	snapshot(): ContextSnapshot {
		const totalTokens = this._messages.reduce((sum, m) => sum + m.tokens, 0);

		return {
			messages: [...this._messages],
			totalTokens,
			messageCount: this._messages.length,
			truncated: totalTokens > this._config.maxTokens,
			compacted: this._compactionCount > 0,
		};
	}

	stats(): ContextStats {
		const totalTokens = this._messages.reduce((sum, m) => sum + m.tokens, 0);

		return {
			totalTokens,
			messageCount: this._messages.length,
			maxTokens: this._config.maxTokens,
			utilization: totalTokens / this._config.maxTokens,
			compactions: this._compactionCount,
		};
	}

	compact(): void {
		if (this._messages.length <= this._config.minKeptMessages) {
			return;
		}

		// Keep the most recent messages, summarize older ones
		const keepCount = Math.max(
			this._config.minKeptMessages,
			Math.floor(this._messages.length / 2),
		);

		const kept = this._messages.slice(-keepCount);
		const removed = this._messages.slice(0, -keepCount);

		// Create a summary message for removed content
		if (removed.length > 0) {
			const removedTokens = removed.reduce((sum, m) => sum + m.tokens, 0);
			kept.unshift({
				role: "system",
				content: `[Summarized ${removed.length} messages (${removedTokens} tokens)]`,
				tokens: Math.min(removedTokens, 50),
				timestamp: Date.now(),
			});
		}

		this._messages.length = 0;
		this._messages.push(...kept);
		this._compactionCount++;
	}

	clear(): void {
		this._messages.length = 0;
		this._compactionCount = 0;
	}

	get messages(): readonly ContextMessage[] {
		return this._messages;
	}
}
