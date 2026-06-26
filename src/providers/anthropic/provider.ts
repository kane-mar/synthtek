/**
 * Anthropic Provider — Claude models with streaming, prompt caching, and adaptive thinking
 */

import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
	ContentPart,
	LLMProvider,
	ProviderConfig,
	ProviderMessage,
	StreamChunk,
} from "../types.js";
import { buildProviderConfig } from "../base-provider.js";

const DEFAULT_CONFIG: Partial<ProviderConfig> = {
	baseUrl: "https://api.anthropic.com/v1",
	model: "claude-3-opus-20240229",
	timeout: 60_000,
	retries: 3,
	retryDelay: 1000,
};

/** Anthropic API version */
const API_VERSION = "2023-06-01";

/** Adaptive thinking system prompt */
const ADAPTIVE_THINKING_SYSTEM_PROMPT = `You are an advanced reasoning assistant. Before answering, think through the problem step by step. Consider multiple perspectives, identify potential pitfalls, and verify your reasoning. Show your work clearly.`;

/** Convert provider messages to Anthropic format with multimodal support */
function toAnthropicMessages(messages: ProviderMessage[]): Array<{
	role: string;
	content:
		| string
		| Array<{
				type: string;
				text?: string;
				source?: {
					type: string;
					media_type?: string;
					data?: string;
					url?: string;
				};
		  }>;
}> {
	return messages
		.filter((m) => m.role !== "system")
		.map((m) => {
			if (m.contentParts && m.contentParts.length > 0) {
				const contentBlocks: Array<{
					type: string;
					text?: string;
					source?: {
						type: string;
						media_type?: string;
						data?: string;
						url?: string;
					};
				}> = m.contentParts.map((part: ContentPart) => {
					if (part.type === "text") {
						return { type: "text", text: part.text };
					}
					if (part.type === "image_url" && part.imageUrl) {
						// Handle base64 data URLs
						if (part.imageUrl.url.startsWith("data:")) {
							const [header, data] = part.imageUrl.url.split(",");
							const mediaType =
								header.match(/data:([^;]+)/)?.[1] || "image/png";
							return {
								type: "image",
								source: {
									type: "base64",
									media_type: mediaType,
									data: data,
								},
							};
						}
						// Handle regular URLs
						return {
							type: "image",
							source: {
								type: "url",
								url: part.imageUrl.url,
							},
						};
					}
					return { type: "text", text: "" };
				});
				return {
					role: m.role === "assistant" ? "assistant" : "user",
					content: contentBlocks,
				};
			}
			return {
				role: m.role === "assistant" ? "assistant" : "user",
				content: m.content,
			};
		});
}

/** Anthropic content block type for cache markers */
type AnthropicContentBlock = {
	type: string;
	text?: string;
	cache_control?: { type: string };
	source?: { type: string; media_type?: string; data?: string; url?: string };
};

type AnthropicMessage = {
	role: string;
	content: string | AnthropicContentBlock[];
};

/** Add cache_control markers for prompt caching */
function addCacheMarkers(
	system: string | undefined,
	messages: AnthropicMessage[],
): {
	system: AnthropicContentBlock[] | undefined;
	messages: AnthropicMessage[];
} {
	if (!system) {
		return { system: undefined, messages };
	}

	// Add cache control to system prompt
	const cachedSystem: AnthropicContentBlock[] = [
		{ type: "text", text: system, cache_control: { type: "ephemeral" } },
	];

	// Add cache control to last 4 user messages
	const userMessages = messages.filter((m) => m.role === "user");
	const lastFourUserIndices = userMessages.slice(-4);

	const updatedMessages = messages.map((msg) => {
		if (msg.role !== "user") return msg;

		// Check if this message is in the last 4 user messages
		const isLastFour = lastFourUserIndices.some((lm) => lm === msg);

		if (!isLastFour) return msg;

		if (typeof msg.content === "string") {
			return {
				...msg,
				content: [
					{
						type: "text",
						text: msg.content,
						cache_control: { type: "ephemeral" },
					},
				],
			};
		}

		// If content is already an array, add cache_control to text blocks
		if (Array.isArray(msg.content)) {
			const updatedContent = msg.content.map((block: AnthropicContentBlock) => {
				if (block.type === "text") {
					return { ...block, cache_control: { type: "ephemeral" } };
				}
				return block;
			});
			return { ...msg, content: updatedContent };
		}

		return msg;
	});

	return { system: cachedSystem, messages: updatedMessages };
}

/** Anthropic cost per 1M tokens */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
	"claude-3-opus-20240229": { input: 15, output: 75 },
	"claude-3-sonnet-20240229": { input: 3, output: 15 },
	"claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
	"claude-3-5-sonnet-20241022": { input: 3, output: 15 },
};

export class AnthropicProvider implements LLMProvider {
	readonly name = "anthropic";
	private config: Required<ProviderConfig>;
	private promptCaching: boolean;
	private adaptiveThinking: boolean;
	private extendedThinking: boolean;
	private thinkingBudget: number;

	constructor(config: ProviderConfig) {
		this.config = buildProviderConfig(config, DEFAULT_CONFIG, "anthropic");
		this.promptCaching = (config.promptCaching as boolean) ?? false;
		this.adaptiveThinking = (config.adaptiveThinking as boolean) ?? false;
		this.extendedThinking = (config.extendedThinking as boolean) ?? false;
		this.thinkingBudget = (config.thinkingBudget as number) ?? 1024;
	}

	getConfig(): ProviderConfig {
		return { ...this.config };
	}

	async listModels(): Promise<string[]> {
		const response = await this.fetchWithRetry(
			`${this.config.baseUrl}/messages`,
			{ method: "GET" },
		);

		if (!response.ok) {
			throw new Error(`Failed to list models: ${response.status}`);
		}

		// Anthropic doesn't have a models endpoint, return known models
		return [
			"claude-3-opus-20240229",
			"claude-3-sonnet-20240229",
			"claude-3-haiku-20240307",
			"claude-3-5-sonnet-20241022",
		];
	}

	async healthCheck(): Promise<boolean> {
		try {
			const response = await this.fetchWithRetry(
				`${this.config.baseUrl}/messages`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": this.config.apiKey,
						"anthropic-version": API_VERSION,
					},
					body: JSON.stringify({
						model: this.config.model,
						messages: [{ role: "user", content: "test" }],
						max_tokens: 1,
					}),
				},
			);
			return response.ok;
		} catch {
			return false;
		}
	}

	async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
		const model = request.model || this.config.model;
		let messages = toAnthropicMessages(request.messages);

		let systemText = request.system;

		// Add adaptive thinking system prompt
		if (this.adaptiveThinking) {
			systemText = systemText
				? `${ADAPTIVE_THINKING_SYSTEM_PROMPT}\n\n${systemText}`
				: ADAPTIVE_THINKING_SYSTEM_PROMPT;
		}

		// Apply prompt caching
		let system: string | AnthropicContentBlock[] | undefined = systemText;
		if (this.promptCaching) {
			const cached = addCacheMarkers(systemText, messages);
			system = cached.system;
			messages = cached.messages;
		}

		const body: Record<string, unknown> = {
			model,
			messages,
			max_tokens: request.maxTokens || 4096,
			system,
			temperature: request.temperature,
			top_p: request.topP,
			stop_sequences: request.stop,
		};

		// Add extended thinking support
		if (this.extendedThinking) {
			body.thinking = true;
			body.budget_tokens = this.thinkingBudget;
		}

		if (request.tools) {
			body.tools = request.tools.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.parameters,
			}));
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"x-api-key": this.config.apiKey,
			"anthropic-version": API_VERSION,
			...this.config.headers,
		};

		// Add prompt caching header
		if (this.promptCaching) {
			headers["anthropic-beta"] = "prompt-caching-2024-07-31";
		}

		const response = await this.fetchWithRetry(
			`${this.config.baseUrl}/messages`,
			{
				method: "POST",
				headers,
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
		}

		const data = (await response.json()) as {
			id: string;
			model: string;
			content: Array<{
				type: string;
				text?: string;
				thinking?: string;
				input?: Record<string, unknown>;
			}>;
			usage: {
				input_tokens: number;
				output_tokens: number;
				thinking_tokens?: number;
				cache_creation_input_tokens?: number;
				cache_read_input_tokens?: number;
			};
			stop_reason: string;
		};

		const inputTokens = data.usage?.input_tokens || 0;
		const outputTokens = data.usage?.output_tokens || 0;
		const totalTokens = inputTokens + outputTokens;

		// Extract text content and reasoning/thinking content
		let content = "";
		let reasoningContent: string | undefined;
		for (const block of data.content) {
			if (block.type === "text" && block.text) {
				content += block.text;
			}
			if (block.type === "thinking" && block.thinking) {
				reasoningContent = reasoningContent
					? `${reasoningContent}\n${block.thinking}`
					: block.thinking;
			}
		}

		// Estimate cost
		const costInfo =
			COST_PER_1M[model] || COST_PER_1M["claude-3-opus-20240229"];
		const cost =
			(inputTokens / 1_000_000) * costInfo.input +
			(outputTokens / 1_000_000) * costInfo.output;

		return {
			content,
			model: data.model,
			inputTokens,
			outputTokens,
			totalTokens,
			cost,
			reasoning: reasoningContent,
			finishReason: data.stop_reason,
			id: data.id,
			usage: {
				promptTokens: inputTokens,
				completionTokens: outputTokens,
				totalTokens,
				reasoningTokens: data.usage?.thinking_tokens,
				cacheCreationTokens: data.usage?.cache_creation_input_tokens,
				cacheReadTokens: data.usage?.cache_read_input_tokens,
			},
		};
	}

	async *chatStream(
		request: ChatCompletionRequest,
	): AsyncIterable<StreamChunk> {
		const model = request.model || this.config.model;
		let messages = toAnthropicMessages(request.messages);

		let systemText = request.system;

		// Add adaptive thinking system prompt
		if (this.adaptiveThinking) {
			systemText = systemText
				? `${ADAPTIVE_THINKING_SYSTEM_PROMPT}\n\n${systemText}`
				: ADAPTIVE_THINKING_SYSTEM_PROMPT;
		}

		// Apply prompt caching
		let system: string | AnthropicContentBlock[] | undefined = systemText;
		if (this.promptCaching) {
			const cached = addCacheMarkers(systemText, messages);
			system = cached.system;
			messages = cached.messages;
		}

		const body: Record<string, unknown> = {
			model,
			messages,
			max_tokens: request.maxTokens || 4096,
			system,
			temperature: request.temperature,
			top_p: request.topP,
			stop_sequences: request.stop,
			stream: true,
		};

		if (request.tools) {
			body.tools = request.tools.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.parameters,
			}));
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"x-api-key": this.config.apiKey,
			"anthropic-version": API_VERSION,
			...this.config.headers,
		};

		// Add prompt caching header
		if (this.promptCaching) {
			headers["anthropic-beta"] = "prompt-caching-2024-07-31";
		}

		const response = await this.fetchWithRetry(
			`${this.config.baseUrl}/messages`,
			{
				method: "POST",
				headers,
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("No response body reader");
		}

		const decoder = new TextDecoder();
		let buffer = "";

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const data = line.slice(6);

					try {
						const parsed = JSON.parse(data) as {
							type: string;
							delta?: { text?: string };
							usage?: { input_tokens?: number; output_tokens?: number };
						};

						if (parsed.type === "content_block_delta" && parsed.delta?.text) {
							yield {
								delta: parsed.delta.text,
								done: false,
								model,
							};
						} else if (parsed.type === "message_stop") {
							yield { delta: "", done: true };
						}
					} catch {
						// Skip invalid JSON
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private async fetchWithRetry(
		url: string,
		options: RequestInit,
		retryCount = 0,
	): Promise<Response> {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), this.config.timeout);

			const response = await fetch(url, {
				...options,
				signal: controller.signal,
			});

			clearTimeout(timeout);
			return response;
		} catch (error) {
			if (retryCount < (this.config.retries ?? 3)) {
				await new Promise((resolve) =>
					setTimeout(resolve, this.config.retryDelay ?? 1000),
				);
				return this.fetchWithRetry(url, options, retryCount + 1);
			}
			throw error;
		}
	}
}
