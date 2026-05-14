/**
 * Provider Module — Exports all providers and registry
 */

export * from './types.js';
export * from './registry.js';

// ─── Provider Re-exports ────────────────────────────────────────────────────

import { OpenAIProvider } from './openai/provider.js';
import { AnthropicProvider } from './anthropic/provider.js';
import { OpenRouterProvider } from './openrouter/provider.js';
import { OllamaProvider } from './ollama/provider.js';
import { LMStudioProvider } from './lmstudio/provider.js';
import { LlamaCppProvider } from './llamacpp/provider.js';
import { DeepSeekProvider } from './deepseek/provider.js';
import { GeminiProvider } from './gemini/provider.js';
import { MistralProvider } from './mistral/provider.js';
import { AzureOpenAIProvider } from './azure/provider.js';
import { VLLMProvider } from './vllm/provider.js';

export {
  OpenAIProvider,
  AnthropicProvider,
  OpenRouterProvider,
  OllamaProvider,
  LMStudioProvider,
  LlamaCppProvider,
  DeepSeekProvider,
  GeminiProvider,
  MistralProvider,
  AzureOpenAIProvider,
  VLLMProvider,
};

// ─── Provider Constructor Map ───────────────────────────────────────────────

import type { ProviderType, ProviderConfig, LLMProvider, ProviderFactory } from './types.js';
import { getRegistry } from './registry.js';

const PROVIDER_MAP: Record<ProviderType, new (config: ProviderConfig) => LLMProvider> = {
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

// Auto-register on import
registerDefaultProviders();
