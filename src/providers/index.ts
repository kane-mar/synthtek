/**
 * Provider Module — Exports all providers and registry
 */

export * from "./registry.js";
export * from "./types.js";

// ─── Provider Re-exports ────────────────────────────────────────────────────

import { AnthropicProvider } from "./anthropic/provider.js";
import { AzureOpenAIProvider } from "./azure/provider.js";
import { DeepSeekProvider } from "./deepseek/provider.js";
import { GeminiProvider } from "./gemini/provider.js";
import { LlamaCppProvider } from "./llamacpp/provider.js";
import { LMStudioProvider } from "./lmstudio/provider.js";
import { MistralProvider } from "./mistral/provider.js";
import { OllamaProvider } from "./ollama/provider.js";
import { OpenAIProvider } from "./openai/provider.js";
import { OpenRouterProvider } from "./openrouter/provider.js";
import { QwenProvider } from "./qwen/provider.js";
import { VLLMProvider } from "./vllm/provider.js";

export {
	AnthropicProvider,
	AzureOpenAIProvider,
	DeepSeekProvider,
	GeminiProvider,
	LlamaCppProvider,
	LMStudioProvider,
	MistralProvider,
	OllamaProvider,
	OpenAIProvider,
	OpenRouterProvider,
	VLLMProvider,
};

// ─── Provider Constructor Map ───────────────────────────────────────────────

import { getRegistry } from "./registry.js";
import type {
	LLMProvider,
	ProviderConfig,
	ProviderFactory,
	ProviderType,
} from "./types.js";

const PROVIDER_MAP: Record<
	ProviderType,
	new (
		config: ProviderConfig,
	) => LLMProvider
> = {
	openai: OpenAIProvider,
	anthropic: AnthropicProvider,
	openrouter: OpenRouterProvider,
	ollama: OllamaProvider,
	lmstudio: LMStudioProvider,
	llamacpp: LlamaCppProvider,
	deepseek: DeepSeekProvider,
	gemini: GeminiProvider,
	mistral: MistralProvider,
	azure: AzureOpenAIProvider,
	vllm: VLLMProvider,
	qwen: QwenProvider,
};

/**
 * Generic factory that creates a provider from the constructor map.
 * Used internally for default registration.
 */
function createProviderFactory(
	Type: new (config: ProviderConfig) => LLMProvider,
): ProviderFactory {
	return { create: (config) => new Type(config) };
}

/** Initialize the default registry with all providers */
export function registerDefaultProviders(): void {
	const registry = getRegistry();
	for (const [type, Type] of Object.entries(PROVIDER_MAP)) {
		if (!registry.has(type as ProviderType)) {
			registry.register(type as ProviderType, createProviderFactory(Type));
		}
	}
}

// Auto-registration removed — call registerDefaultProviders() explicitly
// from your application entry point or runner constructor.
