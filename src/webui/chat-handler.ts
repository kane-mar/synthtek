/**
 * Chat Completion Handler
 *
 * Handles POST /api/chat/completions — runs the user message through
 * the AgentLoop so the LLM can use tools before responding.
 * Reports outcomes to the AnalyticsTracker.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { AgentLoop } from "../agent/loop.js";
import { registerBuiltinTools } from "../agent/builtin-tools.js";
import { getRegistry } from "../providers/index.js";
import type {
	ChatCompletionRequest,
	LLMProvider,
	ProviderConfig,
} from "../providers/types.js";
import type { WebUIBackend } from "./backend.js";
import { sendJson } from "./helpers.js";
import type { ProviderManager } from "./provider-manager.js";

// ── Chat Handler ────────────────────────────────────────────────────────────

/** Classify an error message into a provider event type */
function classifyProviderError(
	message: string,
): "rate_limit" | "timeout" | "network" | "error" {
	const lowered = message.toLowerCase();
	if (/rate.?limit/i.test(lowered) || /too many requests/i.test(lowered) || /429/i.test(lowered)) return "rate_limit";
	if (/timeout/i.test(lowered) || /etimedout/i.test(lowered)) return "timeout";
	if (/network/i.test(lowered) || /connection refuse/i.test(lowered) || /econnreset/i.test(lowered) || /eai_again/i.test(lowered) || /enotfound/i.test(lowered)) return "network";
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
		// Resolve provider
		const provider = providerManager.getActiveProvider(chatReq.providerId);
		const providerLabel = provider?.name || provider?.type || "unknown";
		if (!provider) {
			const status = chatReq.providerId ? 404 : 422;
			backend.analytics.trackProviderEvent(providerLabel, "error");
			return sendJson(res, status, {
				error: chatReq.providerId
					? "Specified provider not found or inactive"
					: "No active LLM providers configured. Go to Settings to add one.",
			});
		}

		const registry = getRegistry();
		const providerType = provider.type as import("../providers/types.js").ProviderType;
		if (!registry.has(providerType)) {
			backend.analytics.trackProviderEvent(providerLabel, "error");
			return sendJson(res, 500, { error: `Provider type "${provider.type}" not supported` });
		}

		const providerConfig: ProviderConfig = {
			provider: providerType,
			apiKey: provider.apiKey || "",
			baseUrl: provider.baseUrl,
			model: chatReq.model || provider.defaultModel,
			timeout: provider.timeoutMs,
			headers: provider.headers,
		};

		const llmProvider: LLMProvider = registry.create(providerType, providerConfig);

		// ── Agent Loop ────────────────────────────────────────────
		// Extract messages: all but the last are history, last is the new user message
		const allMessages = chatReq.messages || [];
		const lastMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;
		if (!lastMessage || lastMessage.role !== "user") {
			return sendJson(res, 422, { error: "Last message must be from user" });
		}

		const systemContent = chatReq.system || "You are a helpful AI assistant.";

		// Create agent loop and register tools
		const agentLoop = new AgentLoop({
			systemPrompt: systemContent,
			maxToolCalls: 15,
			responseFormat: "markdown",
			retry: { maxRetries: 2, initialDelay: 1000, maxDelay: 10000, multiplier: 2 },
		});
		registerBuiltinTools(agentLoop);

		// Pre-load conversation history (all messages except the last)
		const historyMessages = allMessages.slice(0, -1) as Array<{ role: string; content: string }>;
		agentLoop.loadHistory(
			historyMessages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content || "" })),
		);

		// Run the agent loop
		const startTime = Date.now();
		const result = await agentLoop.processMessage(
			{ role: "user", content: lastMessage.content || "" },
			llmProvider,
		);

		// Track analytics
		backend.analytics.trackRequest({
			provider: providerLabel,
			model: providerConfig.model || "unknown",
			promptTokens: result.tokensUsed,
			completionTokens: 0,
			latencyMs: Date.now() - startTime,
			cost: 0,
			success: true,
		});
		backend.analytics.trackProviderEvent(providerLabel, "success");

		// Store assistant response in session
		const sessionId = (chatReq as Record<string, unknown>).sessionId as string | undefined;
		if (sessionId) {
			backend.addMessage(sessionId, { role: "assistant", content: result.response });
		}

		return sendJson(res, 200, {
			content: result.response,
			model: providerConfig.model,
			toolCallsMade: result.toolCallsMade,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Unknown error";
		let providerLabel = "unknown";
		try {
			const p = providerManager.getActiveProvider((body as any)?.providerId);
			if (p) providerLabel = p.name || p.type || "unknown";
		} catch { /* ignore */ }
		backend.analytics.trackProviderEvent(providerLabel, classifyProviderError(message));
		return sendJson(res, 500, { error: `Chat completion failed: ${message}` });
	}
}
