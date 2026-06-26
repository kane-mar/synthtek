/**
 * WebUI Chat Adapter — Wires ChatService into the WebUI server.
 *
 * Provides a completion handler that uses the provider registry
 * to make actual LLM calls, while ChatService handles state management.
 */

import { ChatService } from "../messaging/chat-service.js";
import type { ChatMessage, ChatResponse } from "../messaging/types.js";
import { getRegistry } from "../providers/index.js";
import type { ProviderConfig } from "../providers/types.js";
import type { ProviderManager } from "./provider-manager.js";

export function createWebUIChatService(
	providerManager: ProviderManager,
): ChatService {
	return new ChatService(providerManager, {
		completionHandler: async (provider, messages) => {
			return executeCompletion(providerManager, provider, messages);
		},
	});
}

async function executeCompletion(
	providerManager: ProviderManager,
	provider: { id: string; name: string; type: string },
	messages: ChatMessage[],
): Promise<ChatResponse> {
	const registry = getRegistry();
	const providerType = provider.type as never;
	if (!registry.has(providerType)) {
		return {
			content: "",
			error: `Provider type "${provider.type}" not supported`,
		};
	}

	const configs = providerManager.list();
	const fullConfig = configs.find((c) => c.id === provider.id);
	if (!fullConfig) {
		return { content: "", error: "Provider configuration not found" };
	}

	const providerConfig: ProviderConfig = {
		provider: providerType,
		apiKey: fullConfig.apiKey || "",
		baseUrl: fullConfig.baseUrl || "",
		model: fullConfig.defaultModel || "",
		timeout: fullConfig.timeoutMs,
		headers: fullConfig.headers,
	};

	const llmProvider = registry.create(providerType, providerConfig);

	const completionReq = {
		model: providerConfig.model || "",
		messages,
		maxTokens: fullConfig.maxTokens || 4096,
		temperature: fullConfig.temperature ?? 0.7,
		stream: false,
	};

	const response = await llmProvider.chat(completionReq);

	return {
		content: response.content,
		error: undefined,
	};
}
