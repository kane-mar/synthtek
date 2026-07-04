/**
 * Qwen Provider — Chat completions via Alibaba Cloud DashScope API (OpenAI-compatible)
 * Qwen exposes an OpenAI-compatible API at https://dashscope.aliyuncs.com/compatible-mode/v1
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
	baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	model: "qwen-max",
	timeout: 60_000,
	retries: 3,
	retryDelay: 1000,
};

/** Convert provider messages to Qwen format (OpenAI-compatible) */
function toQwenMessages(messages: ProviderMessage[]): Array<{
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

/** Qwen cost per 1M tokens (approximate) */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
	"qwen-max": { input: 2.0, output: 6.0 },
	"qwen-plus": { input: 0.8, output: 2.0 },
	"qwen-turbo": { input: 0.3, output: 0.6 },
};

export class QwenProvider extends BaseProvider {
	constructor(config: ProviderConfig) {
		super(config, DEFAULT_CONFIG);
	}

	async listModels(): Promise<string[]> {
		const response = await this.fetchWithRetry(
			`${this.config.baseUrl}/models`,
			{ method: "GET" },
		);

		if (!response.ok) {
			throw new Error(`Failed to list Qwen models: ${response.status}`);
		}

		const data = (await response.json()) as { data: Array<{ id: string }> };
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
			...toQwenMessages(request.messages),
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
					...this.config.headers,
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Qwen API error (${response.status}): ${errorText}`);
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
						function: { name: string; arguments: string };
					}>;
				};
				finish_reason: string;
			}>;
			usage: {
				prompt_tokens: number;
				completion_tokens: number;
				total_tokens: number;
			};
		};

		const choice = data.choices[0];
		const inputTokens = data.usage?.prompt_tokens || 0;
		const outputTokens = data.usage?.completion_tokens || 0;
		const totalTokens = data.usage?.total_tokens || 0;

		// Estimate cost
		const costInfo = COST_PER_1M[model] || COST_PER_1M["qwen-max"];
		const cost =
			(inputTokens / 1_000_000) * costInfo.input +
			(outputTokens / 1_000_000) * costInfo.output;

		// Parse tool calls if present
		let toolCalls:
			| Array<{ id: string; name: string; arguments: Record<string, unknown> }>
			| undefined;
		if (choice.message.tool_calls) {
			toolCalls = choice.message.tool_calls.map((tc) => {
				let args: Record<string, unknown> = {};
				try {
					args = JSON.parse(tc.function.arguments);
				} catch {
					args = { raw: tc.function.arguments };
				}
				return { id: tc.id, name: tc.function.name, arguments: args };
			});
		}

		return {
			content: choice.message.content || "",
			model: data.model,
			inputTokens,
			outputTokens,
			totalTokens,
			cost,
			toolCalls,
			finishReason: choice.finish_reason,
			id: data.id,
			usage: {
				promptTokens: inputTokens,
				completionTokens: outputTokens,
				totalTokens,
			},
		};
	}

	async *chatStream(
		request: ChatCompletionRequest,
	): AsyncIterable<StreamChunk> {
		const model = request.model || this.config.model;
		const messages = [
			...(request.system ? [{ role: "system", content: request.system }] : []),
			...toQwenMessages(request.messages),
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
					...this.config.headers,
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Qwen API error (${response.status}): ${errorText}`);
		}

		yield* this.parseSSEStream(response, model);
	}

	// ── Private helpers ──────────────────────────────────────────────────────
}
