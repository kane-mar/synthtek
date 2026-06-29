/**
 * Chat Completion Handler
 *
 * Handles POST /api/chat/completions — runs the user message through
 * AgentSession (which wraps AgentLoop + tools + conversation store).
 * Reports outcomes to the AnalyticsTracker.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { AgentSession } from "../agent/session.js";
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
	if (
		/rate.?limit/i.test(lowered) ||
		/too many requests/i.test(lowered) ||
		/429/i.test(lowered)
	)
		return "rate_limit";
	if (/timeout/i.test(lowered) || /etimedout/i.test(lowered)) return "timeout";
	if (
		/network/i.test(lowered) ||
		/connection refuse/i.test(lowered) ||
		/econnreset/i.test(lowered) ||
		/eai_again/i.test(lowered) ||
		/enotfound/i.test(lowered)
	)
		return "network";
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

		const llmProvider: LLMProvider = registry.create(
			providerType,
			providerConfig,
		);

		// ── AgentSession ──────────────────────────────────────────
		const allMessages = chatReq.messages || [];
		const lastMessage =
			allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;
		if (lastMessage?.role !== "user") {
			return sendJson(res, 422, { error: "Last message must be from user" });
		}

		const systemContent = chatReq.system || "You are a helpful AI assistant.";
		const sessionId = (chatReq as Record<string, unknown>).sessionId as
			| string
			| undefined;

		// Read agent parameters from shared config
		const { getAgentConfig } = await import("../config/agent-config.js");
		const agentCfg = getAgentConfig();

		// Collect tool calls as they happen
		const madeToolCalls: Array<{
			name: string;
			args: Record<string, unknown>;
		}> = [];

		// Create session — autoPersist off because backend.addMessage handles storage
		const agent = new AgentSession(llmProvider, {
			systemPrompt: systemContent,
			maxToolCalls: agentCfg.maxToolCalls,
			maxTokens: agentCfg.maxTokens,
			responseFormat: "markdown",
			autoPersist: false,
			loopConfig: {
				retry: {
					maxRetries: agentCfg.maxRetries,
					initialDelay: 1000,
					maxDelay: 10000,
					multiplier: 2,
				},
				temperature: agentCfg.temperature,
			},
			hooks: {
				onBeforeToolCall: (toolCall) => {
					madeToolCalls.push({ name: toolCall.name, args: toolCall.arguments });
				},
			},
			onResult: () => {},
		});

		// Provide history (all messages except the last) + process the new message
		const history = allMessages.slice(0, -1) as Array<{
			role: string;
			content: string;
		}>;
		const startTime = Date.now();
		const result = await agent.processMessage(
			lastMessage.content || "",
			undefined,
			history,
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

		// Store assistant response in backend session
		if (sessionId) {
			backend.addMessage(sessionId, {
				role: "assistant",
				content: result.response,
			});
		}

		return sendJson(res, 200, {
			content: result.response,
			model: providerConfig.model,
			toolCallsMade: result.toolCallsMade,
			toolCalls: madeToolCalls,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Unknown error";
		let providerLabel = "unknown";
		try {
			const p = providerManager.getActiveProvider((body as any)?.providerId);
			if (p) providerLabel = p.name || p.type || "unknown";
		} catch {
			/* ignore */
		}
		backend.analytics.trackProviderEvent(
			providerLabel,
			classifyProviderError(message),
		);
		return sendJson(res, 500, { error: `Chat completion failed: ${message}` });
	}
}
