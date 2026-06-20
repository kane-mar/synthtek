/**
 * Short-term Memory (Context Window Management)
 *
 * Manages in-context message history with token tracking,
 * automatic summarization, and context window limits.
 */

import type {
	ContextMessage,
	ContextSummary,
	InjectionResult,
	ShortTermMemoryConfig,
	ShortTermMemoryService,
} from "./types.js";

const DEFAULT_CONFIG: Required<ShortTermMemoryConfig> = {
	maxMessages: 100,
	maxTokens: 128000,
	summarizationThreshold: 50,
};

/**
 * Rough token estimation (4 chars ≈ 1 token for English text)
 */
function estimateTokens(text: string): number {
	return Math.max(1, Math.ceil(text.length / 4));
}

export class ShortTermMemoryImpl implements ShortTermMemoryService {
	private messages: ContextMessage[] = [];
	private summaries: ContextSummary[] = [];
	private config: Required<ShortTermMemoryConfig>;
	private activeTasks: Set<string> = new Set();

	constructor(config?: Partial<ShortTermMemoryConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	addMessage(message: ContextMessage): void {
		if (!message.timestamp) {
			message.timestamp = new Date();
		}
		if (message.tokenCount === undefined) {
			message.tokenCount = estimateTokens(message.content);
		}

		this.messages.push(message);
		this.enforceLimits();
	}

	getMessages(): ContextMessage[] {
		return this.getMessagesWithOptions();
	}

	getMessagesWithOptions(options?: {
		limit?: number;
		includeSummaries?: boolean;
	}): ContextMessage[] {
		const { limit, includeSummaries = true } = options ?? {};

		let result: ContextMessage[] = [];

		if (includeSummaries && this.summaries.length > 0) {
			// Add the latest summary as a system message for context continuity
			const latestSummary = this.summaries[this.summaries.length - 1];
			result.push({
				role: "system",
				content: `[Previous conversation summary]: ${latestSummary.summary}`,
				timestamp: latestSummary.createdAt,
				tokenCount: estimateTokens(latestSummary.summary),
			});
		}

		result = result.concat(this.messages);

		if (limit !== undefined) {
			result = result.slice(-limit);
		}

		return result;
	}

	clear(): void {
		this.messages = [];
	}

	getStats(): {
		messageCount: number;
		totalTokens: number;
		summaryCount: number;
	} {
		return {
			messageCount: this.messages.length,
			totalTokens: this.messages.reduce(
				(sum, m) => sum + (m.tokenCount ?? 0),
				0,
			),
			summaryCount: this.summaries.length,
		};
	}

	/**
	 * Summarize older messages to free up context space.
	 * Returns null if summarization is not needed yet.
	 */
	async summarize(): Promise<ContextSummary | null> {
		if (this.messages.length < this.config.summarizationThreshold) {
			return null;
		}

		// Keep the last 20 messages, summarize the rest
		// Skip messages belonging to active tasks
		const keepCount = Math.min(20, Math.floor(this.messages.length / 2));
		const activeTaskIds = Array.from(this.activeTasks);
		const toSummarize = this.messages
			.slice(0, this.messages.length - keepCount)
			.filter((m) => !activeTaskIds.includes(m.taskId ?? ""));

		if (toSummarize.length === 0) {
			return null;
		}

		const tokensToSummarize = toSummarize.reduce(
			(sum, m) => sum + (m.tokenCount ?? 0),
			0,
		);

		// Build a concise summary of the conversation
		const userMessages = toSummarize.filter((m) => m.role === "user");
		const assistantMessages = toSummarize.filter((m) => m.role === "assistant");

		const topics: string[] = [];
		for (let i = 0; i < userMessages.length && i < 5; i++) {
			const userMsg = userMessages[i].content.slice(0, 100);
			const assistantMsg = assistantMessages[i]?.content.slice(0, 100);
			topics.push(`User: ${userMsg} → Assistant: ${assistantMsg}`);
		}

		const summary = `Conversation covered ${toSummarize.length} messages. Key exchanges: ${topics.join("; ")}.`;

		const summaryTokens = estimateTokens(summary);

		const contextSummary: ContextSummary = {
			summary,
			messageCount: toSummarize.length,
			tokensSaved: tokensToSummarize - summaryTokens,
			createdAt: new Date(),
		};

		this.summaries.push(contextSummary);
		this.messages = this.messages.slice(-keepCount);

		return contextSummary;
	}

	// ── Message Merging ────────────────────────────────────────────────────────

	/**
	 * Merge consecutive user messages into a single message.
	 * Returns the number of messages merged.
	 */
	mergeConsecutiveUserMessages(maxAgeMs?: number): number {
		let merged = 0;
		const result: ContextMessage[] = [];

		for (let i = 0; i < this.messages.length; i++) {
			const msg = this.messages[i];
			if (msg.role !== "user") {
				result.push(msg);
				continue;
			}

			// Collect consecutive user messages within the time window
			const group: ContextMessage[] = [msg];
			while (
				i + 1 < this.messages.length &&
				this.messages[i + 1].role === "user"
			) {
				const next = this.messages[i + 1];
				if (maxAgeMs && msg.timestamp && next.timestamp) {
					if (next.timestamp.getTime() - msg.timestamp.getTime() > maxAgeMs) {
						break;
					}
				}
				group.push(next);
				i++;
			}

			if (group.length > 1) {
				merged += group.length - 1;
				const combinedContent = group.map((m) => m.content).join("\n");
				const combinedTokens = group.reduce(
					(s, m) => s + (m.tokenCount ?? 0),
					0,
				);
				result.push({
					role: "user",
					content: combinedContent,
					timestamp: group[0].timestamp,
					tokenCount: combinedTokens,
					taskId: group[0].taskId,
				});
			} else {
				result.push(msg);
			}
		}

		this.messages = result;
		return merged;
	}

	// ── Active Task Protection ─────────────────────────────────────────────────

	markTaskActive(taskId: string): void {
		this.activeTasks.add(taskId);
	}

	markTaskComplete(taskId: string): void {
		this.activeTasks.delete(taskId);
	}

	// ── Session Poisoning Protection ───────────────────────────────────────────

	private readonly injectionPatterns: RegExp[] = [
		/ignore\s+(all\s+)?(previous\s+)?instructions?/i,
		/you\s+are\s+(now\s+)?(?:called|named|a\s+)/i,
		/system\s+(prompt|message|instruction)/i,
		/disregard\s+(the\s+)?(above\s+)?(instructions?|rules?)/i,
		/forget\s+(your\s+)?(instructions?|rules?|training)/i,
		/repeat\s+(the\s+)?(above\s+)?(text|prompt|instructions?)/i,
		/output\s+(the\s+)?(original\s+)?(system\s+)?prompt/i,
		/print\s+(the\s+)?(full\s+)?(system\s+)?prompt/i,
		/return\s+(the\s+)?(initial\s+)?(system\s+)?prompt/i,
		/act\s+as\s+(if\s+)?(?:you\s+are|a\s+)/i,
		/pretend\s+(to\s+)?(?:be\s+)?(?:you\s+are|a\s+)/i,
		/override\s+(the\s+)?(current\s+)?(settings?|config|rules?)/i,
		/bypass\s+(the\s+)?(security\s+)?(filters?|rules?|restrictions?)/i,
		/jailbreak/i,
		/dan\s*(mode|\.?mode|\.?protocol)/i,
	];

	checkForInjection(message: string): InjectionResult {
		const detectedPatterns: string[] = [];

		for (const pattern of this.injectionPatterns) {
			if (pattern.test(message)) {
				detectedPatterns.push(pattern.source);
			}
		}

		if (detectedPatterns.length === 0) {
			return { detected: false, patterns: [], severity: "low" };
		}

		let severity: "low" | "medium" | "high" = "low";
		if (detectedPatterns.length >= 3) {
			severity = "high";
		} else if (detectedPatterns.length >= 2) {
			severity = "medium";
		}

		return { detected: true, patterns: detectedPatterns, severity };
	}

	sanitizeMessage(message: string): string {
		const result = this.checkForInjection(message);
		if (!result.detected) {
			return message;
		}

		// Remove detected injection patterns
		let sanitized = message;
		for (const pattern of this.injectionPatterns) {
			sanitized = sanitized.replace(pattern, "[filtered]");
		}

		return sanitized;
	}

	reset(): void {
		this.messages = [];
		this.summaries = [];
		this.activeTasks.clear();
	}

	/**
	 * Enforce message count and token limits.
	 * Oldest messages are removed first.
	 */
	private enforceLimits(): void {
		// Enforce message count limit
		while (this.messages.length > this.config.maxMessages) {
			this.messages.shift();
		}

		// Enforce token limit
		let totalTokens = this.messages.reduce(
			(sum, m) => sum + (m.tokenCount ?? 0),
			0,
		);

		while (totalTokens > this.config.maxTokens && this.messages.length > 1) {
			const removed = this.messages.shift();
			if (removed) {
				totalTokens -= removed.tokenCount ?? 0;
			}
		}
	}
}
