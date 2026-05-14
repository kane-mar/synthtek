/**
 * Multi-Provider Fallback — Try multiple providers in order
 */

import {
  LLMProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
  ProviderType,
  getRegistry,
} from './index.js';

export interface FallbackConfig {
  /** Ordered list of provider configs to try */
  providers: ProviderConfig[];
  /** Maximum number of providers to try before giving up */
  maxRetries?: number;
  /** Whether to log fallback attempts */
  log?: boolean;
}

/**
 * MultiProvider wraps multiple LLM providers and tries them in order
 * until one succeeds.
 */
export class MultiProvider implements LLMProvider {
  readonly name = 'multi-fallback';
  private providers: LLMProvider[];
  private log: boolean;

  constructor(config: FallbackConfig) {
    const registry = getRegistry();
    this.providers = config.providers.map((p) => registry.create(p.provider as ProviderType, p));
    this.log = config.log ?? false;
  }

  getConfig(): ProviderConfig {
    return {
      provider: 'multi-fallback',
      apiKey: '',
    };
  }

  async listModels(): Promise<string[]> {
    const allModels = new Set<string>();
    for (const provider of this.providers) {
      try {
        const models = await provider.listModels();
        models.forEach((m) => allModels.add(m));
      } catch {
        if (this.log) console.warn(`Failed to list models for ${provider.name}`);
      }
    }
    return Array.from(allModels);
  }

  async healthCheck(): Promise<boolean> {
    for (const provider of this.providers) {
      try {
        const healthy = await provider.healthCheck();
        if (healthy) return true;
      } catch {
        // Try next provider
      }
    }
    return false;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const errors: Array<{ provider: string; error: Error }> = [];

    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const provider = this.providers[attempt];
      try {
        if (this.log) {
          console.log(`[fallback] Trying provider: ${provider.name}`);
        }
        return await provider.chat(request);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ provider: provider.name, error: err });
        if (this.log) {
          console.warn(`[fallback] Provider ${provider.name} failed: ${err.message}`);
        }
      }
    }

    // Aggregate all errors
    const errorDetails = errors
      .map((e) => `${e.provider}: ${e.error.message}`)
      .join('; ');
    throw new Error(`All providers failed (${errors.length}/${this.providers.length}): ${errorDetails}`);
  }

  async *chatStream(
    request: ChatCompletionRequest,
  ): AsyncIterable<StreamChunk> {
    const errors: Array<{ provider: string; error: Error }> = [];

    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const provider = this.providers[attempt];
      try {
        if (this.log) {
          console.log(`[fallback] Trying provider: ${provider.name}`);
        }

        let firstChunk = true;
        for await (const chunk of provider.chatStream(request)) {
          if (firstChunk) {
            firstChunk = false;
            if (this.log) {
              console.log(`[fallback] Successfully streaming from: ${provider.name}`);
            }
          }
          yield chunk;
        }
        return;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ provider: provider.name, error: err });
        if (this.log) {
          console.warn(`[fallback] Provider ${provider.name} failed: ${err.message}`);
        }
      }
    }

    // Aggregate all errors
    const errorDetails = errors
      .map((e) => `${e.provider}: ${e.error.message}`)
      .join('; ');
    throw new Error(`All providers failed (${errors.length}/${this.providers.length}): ${errorDetails}`);
  }
}

/**
 * Create a fallback provider from multiple provider configs
 */
export function createFallbackProvider(config: FallbackConfig): MultiProvider {
  return new MultiProvider(config);
}
