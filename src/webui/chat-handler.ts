/**
 * Chat Completion Handler
 *
 * Handles POST /api/chat/completions — calls the LLM provider.
 * Reports provider outcomes to the AnalyticsTracker for rate-limit
 * monitoring and health status in the sidebar.
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

/** Classify an error message into a provider event type */
function classifyProviderError(
	message: string,
): "rate_limit" | "timeout" | "network" | "error" {
	const lowered = message.toLowerCase();
	if (
		/rate.?limit/i.test(lowered) ||
		/too many requests/i.test(lowered) ||
		/429/i.test(lowered)
	) {
		return "rate_limit";
	}
	if (/timeout/i.test(lowered) || /etimedout/i.test(lowered)) {
		return "timeout";
	}
	if (
		/network/i.test(lowered) ||
		/connection refuse/i.test(lowered) ||
		/econnreset/i.test(lowered) ||
		/eai_again/i.test(lowered) ||
		/enotfound/i.test(lowered)
	) {
		return "network";
	}
	return "error";
}

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
		const providerLabel = provider?.name || provider?.type || "unknown";

		if (!provider) {
			const error = chatReq.providerId
				? "Specified provider not found or inactive"
				: "No active LLM providers configured. Go to Settings to add one.";
			const status = chatReq.providerId ? 404 : 422;
			backend.analytics.trackProviderEvent(providerLabel, "error");
			return sendJson(res, status, { error });
		}

		// Create provider instance via registry
		const registry = getRegistry();
		const providerType =
			provider.type as import("../providers/types.js").ProviderType;
		if (!registry.has(providerType)) {
			backend.analytics.trackProviderEvent(providerLabel, "error");
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
		const startTime = Date.now();
		const response = await llmProvider.chat(completionReq);
		const latencyMs = Date.now() - startTime;

		// Track token usage and request in analytics
		backend.analytics.trackRequest({
			provider: providerLabel,
			model: response.model || providerConfig.model || "unknown",
			promptTokens: response.inputTokens ?? 0,
			completionTokens: response.outputTokens ?? 0,
			latencyMs,
			cost: response.cost ?? 0,
			success: true,
		});

		// Report success
		backend.analytics.trackProviderEvent(providerLabel, "success");

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
		// Get provider label for error tracking
		let providerLabel = "unknown";
		try {
			const p = providerManager.getActiveProvider(chatReq.providerId);
			if (p) providerLabel = p.name || p.type || "unknown";
		} catch {
			// ignore — can't determine provider
		}
		const eventType = classifyProviderError(message);
		backend.analytics.trackProviderEvent(providerLabel, eventType);

		return sendJson(res, 500, {
			error: `Chat completion failed: ${message}`,
		});
	}
}
