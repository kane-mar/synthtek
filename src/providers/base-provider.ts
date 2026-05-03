/**
 * Base Provider — Shared functionality for all LLM providers
 *
 * Handles:
 * - Configuration validation
 * - fetchWithRetry with timeout and exponential backoff
 * - SSE stream parsing with debug logging
 * - Cost calculation
 * - TLS options for local providers
 */

import {
  LLMProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
} from './types.js';

// ─── Config Validation ───────────────────────────────────────────────────────

/**
 * Validate a provider configuration for correctness.
 * Throws descriptive errors for invalid configurations.
 */
export function validateProviderConfig(config: ProviderConfig): void {
  if (!config.provider || typeof config.provider !== 'string') {
    throw new ProviderConfigError('Provider name is required and must be a string');
  }

  if (!config.apiKey && config.provider !== 'ollama' && config.provider !== 'lmstudio') {
    throw new ProviderConfigError(`API key is required for provider "${config.provider}"`);
  }

  if (config.timeout !== undefined) {
    if (!Number.isFinite(config.timeout) || config.timeout <= 0) {
      throw new ProviderConfigError('Timeout must be a positive number (milliseconds)');
    }
    if (config.timeout > 600_000) {
      throw new ProviderConfigError('Timeout must not exceed 600000ms (10 minutes)');
    }
  }

  if (config.retries !== undefined) {
    if (!Number.isInteger(config.retries) || config.retries < 0) {
      throw new ProviderConfigError('Retries must be a non-negative integer');
    }
    if (config.retries > 10) {
      throw new ProviderConfigError('Retries must not exceed 10');
    }
  }

  if (config.retryDelay !== undefined) {
    if (!Number.isFinite(config.retryDelay) || config.retryDelay <= 0) {
      throw new ProviderConfigError('Retry delay must be a positive number (milliseconds)');
    }
  }

  if (config.baseUrl !== undefined) {
    if (typeof config.baseUrl !== 'string' || config.baseUrl.length === 0) {
      throw new ProviderConfigError('Base URL must be a non-empty string');
    }
    // Validate URL format
    try {
      new URL(config.baseUrl);
    } catch {
      throw new ProviderConfigError(`Invalid base URL format: "${config.baseUrl}"`);
    }
  }
}

// ─── Provider Config Error ───────────────────────────────────────────────────

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

// ─── Base Provider ───────────────────────────────────────────────────────────

/**
 * Abstract base class for LLM providers.
 * Provides common functionality like retry logic, stream parsing,
 * and cost calculation.
 */
export abstract class BaseProvider implements LLMProvider {
  readonly name: string;
  protected config: {
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    timeout: number;
    retries: number;
    retryDelay: number;
    headers: Record<string, string>;
  };
  protected skippedLinesCounter: number = 0;

  constructor(config: ProviderConfig, defaults: Partial<ProviderConfig>) {
    // Validate config before constructing
    validateProviderConfig(config);

    this.name = config.provider;
    this.config = {
      provider: config.provider,
      apiKey: config.apiKey ?? '',
      baseUrl: config.baseUrl ?? (defaults.baseUrl as string ?? ''),
      model: config.model ?? (defaults.model as string ?? ''),
      timeout: config.timeout ?? (defaults.timeout as number ?? 60_000),
      retries: config.retries ?? (defaults.retries as number ?? 3),
      retryDelay: config.retryDelay ?? (defaults.retryDelay as number ?? 1000),
      headers: config.headers ?? (defaults.headers as Record<string, string> ?? {}),
    };
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  /**
   * List available models — must be implemented by subclasses.
   */
  abstract listModels(): Promise<string[]>;

  /**
   * Check if the provider is healthy — must be implemented by subclasses.
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Send a chat completion request — must be implemented by subclasses.
   */
  abstract chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /**
   * Send a streaming chat completion request — must be implemented by subclasses.
   */
  abstract chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;

  // ── Shared: fetchWithRetry ─────────────────────────────────────────────

  /**
   * Fetch with retry and timeout support.
   * Uses exponential backoff for retries.
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount = 0,
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response;
    } catch (error: unknown) {
      if (retryCount < this.config.retries) {
        // Exponential backoff: delay * 2^retryCount
        const backoffDelay = (this.config.retryDelay as number) * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  // ── Shared: SSE Stream Parsing ─────────────────────────────────────────

  /**
   * Parse an SSE stream response into StreamChunks.
   * Logs skipped lines at debug level for diagnostics.
   */
  protected async *parseSSEStream(
    response: Response,
    model: string,
    onDone?: () => void,
  ): AsyncIterable<StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(`[${this.name}] No response body reader`);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    this.skippedLinesCounter = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            onDone?.();
            yield { delta: '', done: true, model };
            break;
          }

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string; role?: string };
                finish_reason?: string | null;
              }>;
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
              };
            };

            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              const finishReason = parsed.choices?.[0]?.finish_reason;
              yield {
                delta: delta.content,
                done: finishReason !== null && finishReason !== undefined,
                model,
                usage: parsed.usage
                  ? {
                      promptTokens: parsed.usage.prompt_tokens ?? 0,
                      completionTokens: parsed.usage.completion_tokens ?? 0,
                      totalTokens: parsed.usage.total_tokens ?? 0,
                    }
                  : undefined,
              };
            }
          } catch {
            // Log skipped lines for diagnostics
            this.skippedLinesCounter++;
            if (this.skippedLinesCounter <= 5) {
              console.debug(
                `[${this.name}] Skipped invalid SSE line (count: ${this.skippedLinesCounter}): ${data.slice(0, 100)}`,
              );
            } else if (this.skippedLinesCounter === 6) {
              console.debug(
                `[${this.name}] Suppressing further skipped line logs. Total skipped so far: 6+`,
              );
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Report total skipped lines if any
    if (this.skippedLinesCounter > 0) {
      console.debug(
        `[${this.name}] Stream complete. Total skipped lines: ${this.skippedLinesCounter}`,
      );
    }
  }

  // ── Shared: Cost Calculation ───────────────────────────────────────────

  /**
   * Calculate estimated cost based on token usage and pricing.
   *
   * @param costPer1M - Cost per 1M tokens for input and output
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @returns Estimated cost in USD
   */
  protected calculateCost(
    costPer1M: { input: number; output: number },
    inputTokens: number,
    outputTokens: number,
  ): number {
    return (
      (inputTokens / 1_000_000) * costPer1M.input +
      (outputTokens / 1_000_000) * costPer1M.output
    );
  }

  // ── Shared: Get Skipped Lines Count ────────────────────────────────────

  /**
   * Get the number of skipped lines in the last stream.
   * Useful for diagnostics.
   */
  getSkippedLinesCount(): number {
    return this.skippedLinesCounter;
  }
}
