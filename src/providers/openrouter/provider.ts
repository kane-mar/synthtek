/**
 * OpenRouter Provider — Model routing and fallback across providers
 */

import type {
	LLMProvider,
	ChatCompletionRequest,
	ChatCompletionResponse,
	
	ProviderConfig,
	ProviderMessage,
	StreamChunk,
} from "../types.js";
import { buildProviderConfig } from "../base-provider.js";

const DEFAULT_CONFIG: Partial<ProviderConfig> = {
	baseUrl: "https://openrouter.ai/api/v1",
	model: "openai/gpt-4o",
	timeout: 60_000,
	retries: 3,
	retryDelay: 1000,
};

/** Convert provider messages to OpenRouter format (OpenAI-compatible) */
function toOpenRouterMessages(messages: ProviderMessage[]): Array<{
	role: string;
	content: string;
	tool_call_id?: string;
	name?: string;
}> {
	return messages.map((m) => ({
		role: m.role,
		content: m.content,
		tool_call_id: m.toolCallId,
		name: m.metadata?.name as string | undefined,
	}));
}

/** OpenRouter cost per 1M tokens (varies by model) */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
	"openai/gpt-4o": { input: 2.5, output: 10 },
	"openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
	"anthropic/claude-3-opus": { input: 15, output: 75 },
	"anthropic/claude-3-sonnet": { input: 3, output: 15 },
	"google/gemini-pro": { input: 1.25, output: 3.75 },
};

export class OpenRouterProvider implements LLMProvider {
	readonly name = "openrouter";
	private config: Required<ProviderConfig>;

	constructor(config: ProviderConfig) {
		this.config = buildProviderConfig(config, DEFAULT_CONFIG, "openrouter");
	}

	getConfig(): ProviderConfig {
		return { ...this.config };
	}

	async listModels(): Promise<string[]> {
		const response = await this.fetchWithRetry(
			`${this.config.baseUrl}/models`,
			{ method: "GET" },
		);

		if (!response.ok) {
			throw new Error(`Failed to list models: ${response.status}`);
		}

		const data = (await response.json()) as {
			data: Array<{ id: string; name: string }>;
		};
		return data.data.map((m) => m.id);
	}

	async healthCheck(): Promise<boolean> {
		try {
			const response = await this.fetchWithRetry(
				`${this.config.baseUrl}/models`,
				{ method: "GET" },
			);
			return response.ok;
		} catch {
			return false;
		}
	}

	async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
		const model = request.model || this.config.model;
		const messages = [
			...(request.system ? [{ role: "system", content: request.system }] : []),
			...toOpenRouterMessages(request.messages),
		];

		const body: Record<string, unknown> = {
			model,
			messages,
			max_tokens: request.maxTokens,
			temperature: request.temperature,
			top_p: request.topP,
			stop: request.stop,
			stream: false,
		};

		if (request.tools) {
			body.tools = request.tools.map((t) => ({
				type: "function",
				function: {
					name: t.name,
					description: t.description,
					parameters: t.parameters,
				},
			}));
		}

		if (request.toolChoice) {
			body.tool_choice = request.toolChoice;
		}

		const response = await this.fetchWithRetry(
			`${this.config.baseUrl}/chat/completions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.config.apiKey}`,
					"HTTP-Referer": "https://synthtek.dev",
					"X-Title": "Synthtek Agent",
					...this.config.headers,
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`OpenRouter API error (${response.status}): ${errorText}`,
			);
		}

		const data = (await response.json()) as {
			id: string;
			model: string;
			choices: Array<{
				message: {
					role: string;
					content: string | null;
					tool_calls?: Array<{
						id: string;
						type: string;
						function: string;
					}>;
				};
				finish_reason: string;
			}>;
			usage: {
				prompt_tokens: number;
				completion_tokens: number;
				total_tokens: number;
			};
			provider?: {
				name?: string;
				weights?: number[];
			};
		};

		const choice = data.choices[0];
		const inputTokens = data.usage?.prompt_tokens || 0;
		const outputTokens = data.usage?.completion_tokens || 0;
		const totalTokens = data.usage?.total_tokens || 0;

		// Estimate cost
		const costInfo = COST_PER_1M[model] || { input: 3, output: 15 };
		const cost =
			(inputTokens / 1_000_000) * costInfo.input +
			(outputTokens / 1_000_000) * costInfo.output;

		return {
			content: choice.message.content || "",
			model: data.model,
			inputTokens,
			outputTokens,
			totalTokens,
			cost,
			toolCalls: choice.message.tool_calls
				? choice.message.tool_calls.map((tc) => {
						let args: Record<string, unknown> = {};
						try {
							args = JSON.parse(tc.function);
						} catch {
							args = { raw: tc.function };
						}
						return { id: tc.id, name: tc.function, arguments: args };
					})
				: undefined,
			finishReason: choice.finish_reason,
			id: data.id,
			usage: {
				promptTokens: inputTokens,
				completionTokens: outputTokens,
				totalTokens,
			},
			// Store provider info for cost tracking
			[Symbol("provider")]: data.provider,
		};
	}

	async *chatStream(
		request: ChatCompletionRequest,
	): AsyncIterable<StreamChunk> {
		const model = request.model || this.config.model;
		const messages = [
			...(request.system ? [{ role: "system", content: request.system }] : []),
			...toOpenRouterMessages(request.messages),
		];

		const body: Record<string, unknown> = {
			model,
			messages,
			max_tokens: request.maxTokens,
			temperature: request.temperature,
			top_p: request.topP,
			stop: request.stop,
			stream: true,
		};

		if (request.tools) {
			body.tools = request.tools.map((t) => ({
				type: "function",
				function: {
					name: t.name,
					description: t.description,
					parameters: t.parameters,
				},
			}));
		}

		if (request.toolChoice) {
			body.tool_choice = request.toolChoice;
		}

		const response = await this.fetchWithRetry(
			`${this.config.baseUrl}/chat/completions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.config.apiKey}`,
					"HTTP-Referer": "https://synthtek.dev",
					"X-Title": "Synthtek Agent",
					...this.config.headers,
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`OpenRouter API error (${response.status}): ${errorText}`,
			);
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
					if (data === "[DONE]") {
						yield { delta: "", done: true };
						break;
					}

					try {
						const parsed = JSON.parse(data) as {
							choices: Array<{
								delta: { content?: string; role?: string };
								finish_reason: string | null;
							}>;
							usage?: {
								prompt_tokens: number;
								completion_tokens: number;
								total_tokens: number;
							};
						};

						const delta = parsed.choices?.[0]?.delta;
						if (delta?.content) {
							yield {
								delta: delta.content,
								done: false,
								model,
								usage: parsed.usage
									? {
											promptTokens: parsed.usage.prompt_tokens,
											completionTokens: parsed.usage.completion_tokens,
											totalTokens: parsed.usage.total_tokens,
										}
									: undefined,
							};
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
