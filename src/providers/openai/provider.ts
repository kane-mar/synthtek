/**
 * OpenAI Provider — Chat completions, streaming, and cost tracking
 */

import { BaseProvider } from "../base-provider.js";
import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
	ContentPart,
	ProviderConfig,
	ProviderMessage,
	StreamChunk,
} from "../types.js";
import { getMetadataString } from "../types.js";

const DEFAULT_CONFIG: Partial<ProviderConfig> = {
	baseUrl: "https://api.openai.com/v1",
	model: "gpt-4o",
	timeout: 60_000,
	retries: 3,
	retryDelay: 1000,
};

/** Reasoning models that support reasoning_effort */
const REASONING_MODELS = [
	"o1",
	"o1-mini",
	"o1-preview",
	"o1-preview-2024-09-12",
	"o1-2024-12-17",
	"o3-mini",
	"o3-mini-2025-01-31",
];

/** Check if a model is a reasoning model */
function isReasoningModel(model: string): boolean {
	return REASONING_MODELS.some((rm) => model.startsWith(rm));
}

/** Convert provider messages to OpenAI format */
function toOpenAIMessages(messages: ProviderMessage[]): Array<{
	role: string;
	content:
		| string
		| Array<{
				type: string;
				text?: string;
				image_url?: { url: string; detail?: string };
		  }>;
	tool_call_id?: string;
	name?: string;
}> {
	return messages.map((m) => {
		if (m.contentParts && m.contentParts.length > 0) {
			const parts: Array<{
				type: string;
				text?: string;
				image_url?: { url: string; detail?: string };
			}> = m.contentParts.map((part: ContentPart) => {
				if (part.type === "text") {
					return { type: "text", text: part.text };
				}
				if (part.type === "image_url" && part.imageUrl) {
					return {
						type: "image_url",
						image_url: {
							url: part.imageUrl.url,
							detail: part.imageUrl.detail || "auto",
						},
					};
				}
				return { type: "text", text: "" };
			});
			return {
				role: m.role,
				content: parts,
				tool_call_id: m.toolCallId,
				name: getMetadataString(m, "name"),
			};
		}
		return {
			role: m.role,
			content: m.content,
			tool_call_id: m.toolCallId,
			name: getMetadataString(m, "name"),
		};
	});
}

/** Convert OpenAI tool format to our format */
function fromOpenAIToolCalls(
	toolCalls: Array<{
		id: string;
		type: string;
		function: string;
	}>,
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
	return toolCalls.map((tc) => {
		let args: Record<string, unknown> = {};
		try {
			args = JSON.parse(tc.function);
		} catch {
			args = { raw: tc.function };
		}
		return { id: tc.id, name: tc.function, arguments: args };
	});
}

/** OpenAI cost per 1M tokens (GPT-4o standard) */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
	"gpt-4o": { input: 2.5, output: 10 },
	"gpt-4o-mini": { input: 0.15, output: 0.6 },
	"gpt-4-turbo": { input: 10, output: 30 },
	"gpt-4": { input: 30, output: 60 },
	"gpt-3.5-turbo": { input: 0.5, output: 1.5 },
	o1: { input: 15, output: 60 },
	"o1-mini": { input: 3, output: 12 },
	"o1-preview": { input: 15, output: 60 },
	"o3-mini": { input: 1.1, output: 4.4 },
};

export class OpenAIProvider extends BaseProvider {
	constructor(config: ProviderConfig) {
		super(config, DEFAULT_CONFIG as Partial<ProviderConfig>);
	}

	getConfig(): ProviderConfig {
		return { ...this.config };
	}

	async listModels(): Promise<string[]> {
		const response = await this.fetchWithRetry(
			`${this.config.baseUrl as string}/models`,
			{ method: "GET" },
		);

		if (!response.ok) {
			throw new Error(`Failed to list models: ${response.status}`);
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
			...toOpenAIMessages(request.messages),
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

		// Add reasoning_effort for reasoning models
		if (isReasoningModel(model)) {
			body.reasoning_effort = "medium";
			// Reasoning models don't support temperature
			delete body.temperature;
		}

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

		// Responses API fallback: if chat/completions returns 404 or 501, try /responses
		if (response.status === 404 || response.status === 501) {
			const fallbackResponse = await this.fetchWithRetry(
				`${this.config.baseUrl}/responses`,
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

			if (!fallbackResponse.ok) {
				const errorText = await fallbackResponse.text();
				throw new Error(
					`OpenAI API error (${fallbackResponse.status}): ${errorText}`,
				);
			}

			return this.parseChatResponse(fallbackResponse, model);
		}

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
		}

		return this.parseChatResponse(response, model);
	}

	async *chatStream(
		request: ChatCompletionRequest,
	): AsyncIterable<StreamChunk> {
		const model = request.model || this.config.model;
		const messages = [
			...(request.system ? [{ role: "system", content: request.system }] : []),
			...toOpenAIMessages(request.messages),
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

		// Add reasoning_effort for reasoning models
		if (isReasoningModel(model)) {
			body.reasoning_effort = "medium";
			delete body.temperature;
		}

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

		// Responses API fallback for streaming
		if (response.status === 404 || response.status === 501) {
			const fallbackResponse = await this.fetchWithRetry(
				`${this.config.baseUrl}/responses`,
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

			if (!fallbackResponse.ok) {
				const errorText = await fallbackResponse.text();
				throw new Error(
					`OpenAI API error (${fallbackResponse.status}): ${errorText}`,
				);
			}

			yield* this.streamResponse(fallbackResponse, model);
			return;
		}

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
		}

		yield* this.streamResponse(response, model);
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private async parseChatResponse(
		response: Response,
		model: string,
	): Promise<ChatCompletionResponse> {
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
		};

		const choice = data.choices[0];
		const inputTokens = data.usage?.prompt_tokens || 0;
		const outputTokens = data.usage?.completion_tokens || 0;
		const totalTokens = data.usage?.total_tokens || 0;

		// Estimate cost
		const costInfo = COST_PER_1M[model] || COST_PER_1M["gpt-4o"];
		const cost =
			(inputTokens / 1_000_000) * costInfo.input +
			(outputTokens / 1_000_000) * costInfo.output;

		// Extract reasoning content if present
		const reasoningContent = (choice.message as { reasoning_content?: string })
			.reasoning_content;

		return {
			content: choice.message.content || "",
			model: data.model,
			inputTokens,
			outputTokens,
			totalTokens,
			cost,
			reasoning: reasoningContent || undefined,
			toolCalls: choice.message.tool_calls
				? fromOpenAIToolCalls(choice.message.tool_calls)
				: undefined,
			finishReason: choice.finish_reason,
			id: data.id,
			usage: {
				promptTokens: inputTokens,
				completionTokens: outputTokens,
				totalTokens,
			},
		};
	}

	private async *streamResponse(
		response: Response,
		model: string,
	): AsyncIterable<StreamChunk> {
		yield* this.parseSSEStream(response, model);
	}
}
