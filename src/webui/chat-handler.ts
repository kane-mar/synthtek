/**
 * Chat Completion Handler
 *
 * Handles POST /api/chat/completions — calls the LLM provider.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { getRegistry } from "../providers/index.js";
import type {
	ChatCompletionRequest,
	ProviderConfig,
} from "../providers/types.js";
import type { WebUIBackend } from "./backend.js";
import { sendJson } from "./helpers.js";
import type { ProviderManager } from "./provider-manager.js";

export async function handleChatCompletion(
	_req: IncomingMessage,
	res: ServerResponse,
	body: unknown,
	providerManager: ProviderManager,
	backend: WebUIBackend,
): Promise<void> {
	const chatReq = body as ChatCompletionRequest & { providerId?: string };

	try {
		// Use shared provider resolution — same logic as ChatService
		const provider = providerManager.getActiveProvider(chatReq.providerId);

		if (!provider) {
			const error = chatReq.providerId
				? "Specified provider not found or inactive"
				: "No active LLM providers configured. Go to Settings to add one.";
			const status = chatReq.providerId ? 404 : 422;
			return sendJson(res, status, { error });
		}

		// Create provider instance via registry
		const registry = getRegistry();
		const providerType =
			provider.type as import("../providers/types.js").ProviderType;
		if (!registry.has(providerType)) {
			return sendJson(res, 500, {
				error: `Provider type "${provider.type}" not supported`,
			});
		}

		const providerConfig: ProviderConfig = {
			provider: providerType,
			apiKey: provider.apiKey || "",
			baseUrl: provider.baseUrl,
			model: chatReq.model || provider.defaultModel,
			timeout: provider.timeoutMs,
			headers: provider.headers,
		};

		const llmProvider = registry.create(providerType, providerConfig);

		// Build messages from request
		const messages = chatReq.messages || [];
		const system = chatReq.system;

		const completionReq: ChatCompletionRequest = {
			model: providerConfig.model || "",
			messages: system
				? [{ role: "system", content: system }, ...messages]
				: messages,
			maxTokens: chatReq.maxTokens || provider.maxTokens,
			temperature: chatReq.temperature ?? provider.temperature,
			stream: false,
		};

		// Call the LLM
		const response = await llmProvider.chat(completionReq);

		// Store assistant message in session if sessionId provided
		const sessionId = (chatReq as Record<string, unknown>).sessionId as
			| string
			| undefined;
		if (sessionId) {
			backend.addMessage(sessionId, {
				role: "assistant",
				content: response.content,
			});
		}

		return sendJson(res, 200, {
			content: response.content,
			model: response.model,
			usage: response.usage,
			finishReason: response.finishReason,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return sendJson(res, 500, {
			error: `Chat completion failed: ${message}`,
		});
	}
}
