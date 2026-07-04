/**
 * OpenRouter Provider — Model routing and fallback across providers
 */

import { BaseProvider } from "../base-provider.js";
import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
	ProviderConfig,
	ProviderMessage,
	StreamChunk,
} from "../types.js";
import { getMetadataString } from "../types.js";

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
		name: getMetadataString(m, "name"),
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

export class OpenRouterProvider extends BaseProvider {
	constructor(config: ProviderConfig) {
		super(config, DEFAULT_CONFIG);
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

		yield* this.parseSSEStream(response, model);
	}
}
