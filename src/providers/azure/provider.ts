/**
 * Azure OpenAI Provider — Chat completions via Azure OpenAI Service
 * Uses Azure-specific auth (api-key header, deployment-based URLs, api-version query param)
 * Base URL format: https://{resource}.openai.azure.com/openai/deployments/{deployment}
 */

import { BaseProvider } from "../base-provider.js";
import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
	ProviderConfig,
	ProviderMessage,
	StreamChunk,
} from "../types.js";

const DEFAULT_CONFIG: Partial<ProviderConfig> = {
	baseUrl: "https://openai.azure.com",
	model: "gpt-4o",
	timeout: 60_000,
	retries: 3,
	retryDelay: 1000,
};

/** Azure API version */
const AZURE_API_VERSION = "2024-10-01-preview";

/** Convert provider messages to Azure OpenAI format */
function toAzureMessages(messages: ProviderMessage[]): Array<{
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

/** Azure OpenAI cost per 1M tokens (same as OpenAI) */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
	"gpt-4o": { input: 2.5, output: 10 },
	"gpt-4o-mini": { input: 0.15, output: 0.6 },
	"gpt-4-turbo": { input: 10, output: 30 },
	"gpt-4": { input: 30, output: 60 },
	"gpt-35-turbo": { input: 0.5, output: 1.5 },
};

export class AzureOpenAIProvider extends BaseProvider {
	private deployment: string;
	private apiVersion: string;

	constructor(config: ProviderConfig) {
		super(config, DEFAULT_CONFIG);
		// Azure uses deployment name instead of model in the URL
		this.deployment = (config.deployment as string) || this.config.model;
		this.apiVersion = (config.apiVersion as string) || AZURE_API_VERSION;
	}

	async listModels(): Promise<string[]> {
		const response = await this.fetchWithRetry(
			`${this.getBaseUrl()}/models?api-version=${this.apiVersion}`,
			{ method: "GET" },
		);

		if (!response.ok) {
			throw new Error(`Failed to list Azure OpenAI models: ${response.status}`);
		}

		const data = (await response.json()) as { data: Array<{ id: string }> };
		return data.data.map((m) => m.id);
	}

	async healthCheck(): Promise<boolean> {
		try {
			const response = await this.fetchWithRetry(
				`${this.getBaseUrl()}/models?api-version=${this.apiVersion}`,
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
			...toAzureMessages(request.messages),
		];

		const body: Record<string, unknown> = {
			model,
			messages,
			max_tokens: request.maxTokens,
			temperature: request.temperature,
			top_p: request.topP,
			stop: request.stop,
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
			`${this.getChatUrl()}?api-version=${this.apiVersion}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"api-key": this.config.apiKey,
					...this.config.headers,
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Azure OpenAI API error (${response.status}): ${errorText}`,
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
		const costInfo = COST_PER_1M[model] || COST_PER_1M["gpt-4o"];
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
			...toAzureMessages(request.messages),
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
			`${this.getChatUrl()}?api-version=${this.apiVersion}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"api-key": this.config.apiKey,
					...this.config.headers,
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Azure OpenAI API error (${response.status}): ${errorText}`,
			);
		}

		yield* this.parseSSEStream(response, model);
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	/** Get the base URL for the Azure resource */
	private getBaseUrl(): string {
		const baseUrl = this.config.baseUrl.replace(/\/+$/, "");
		return baseUrl;
	}

	/** Get the chat completions URL with deployment */
	private getChatUrl(): string {
		return `${this.getBaseUrl()}/openai/deployments/${this.deployment}/chat/completions`;
	}
}
