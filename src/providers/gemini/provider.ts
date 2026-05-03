/**
 * Gemini Provider — Chat completions via Google Gemini API
 * Uses Google's chat completions format at https://generativelanguage.googleapis.com/v1beta
 */

import {
  LLMProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
  ProviderMessage,
} from '../types.js';

const DEFAULT_CONFIG: Partial<ProviderConfig> = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-1.5-pro',
  timeout: 60_000,
  retries: 3,
  retryDelay: 1000,
};

/** Gemini cost per 1M tokens */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-1.5-pro': { input: 2.5, output: 10 },
  'gemini-1.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
};

/** Convert provider messages to Gemini format */
function toGeminiMessages(
  system: string | undefined,
  messages: ProviderMessage[],
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const geminiMessages: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // System prompt becomes the first user message if present
  if (system) {
    geminiMessages.push({
      role: 'user',
      parts: [{ text: `System: ${system}` }],
    });
  }

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    geminiMessages.push({
      role,
      parts: [{ text: msg.content }],
    });
  }

  return geminiMessages;
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private config: Required<ProviderConfig>;

  constructor(config: ProviderConfig) {
    this.config = {
      provider: 'gemini',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? (DEFAULT_CONFIG.baseUrl as string),
      model: config.model || (DEFAULT_CONFIG.model as string),
      timeout: config.timeout || (DEFAULT_CONFIG.timeout as number),
      retries: config.retries ?? (DEFAULT_CONFIG.retries as number),
      retryDelay: config.retryDelay || (DEFAULT_CONFIG.retryDelay as number),
      headers: config.headers || {},
    };
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  async listModels(): Promise<string[]> {
    // Gemini doesn't have a simple models listing endpoint, return known models
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
    ];
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry(
        `${this.config.baseUrl}/models/${this.config.model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.config.apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'test' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model || this.config.model;
    const geminiMessages = toGeminiMessages(request.system, request.messages);

    const body: Record<string, unknown> = {
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature,
        topP: request.topP,
        stopSequences: request.stop,
      },
    };

    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.config.apiKey,
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      candidates: Array<{
        content: {
          parts: Array<{ text: string }>;
        };
        finishReason: string;
      }>;
      usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
    };

    const candidate = data.candidates?.[0];
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = data.usageMetadata?.totalTokenCount || 0;

    // Extract text content
    let content = '';
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content += part.text;
        }
      }
    }

    // Estimate cost
    const costInfo = COST_PER_1M[model] || COST_PER_1M['gemini-1.5-pro'];
    const cost =
      (inputTokens / 1_000_000) * costInfo.input +
      (outputTokens / 1_000_000) * costInfo.output;

    return {
      content,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      finishReason: candidate?.finishReason,
      id: `gemini_${Date.now()}`,
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
    const geminiMessages = toGeminiMessages(request.system, request.messages);

    const body: Record<string, unknown> = {
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature,
        topP: request.topP,
        stopSequences: request.stop,
      },
    };

    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.config.apiKey,
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

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

          try {
            const parsed = JSON.parse(data) as {
              candidates: Array<{
                content: {
                  parts: Array<{ text: string }>;
                };
                finishReason?: string;
              }>;
              usageMetadata?: {
                promptTokenCount?: number;
                candidatesTokenCount?: number;
                totalTokenCount?: number;
              };
            };

            if (parsed.candidates?.[0]?.content?.parts) {
              for (const part of parsed.candidates[0].content.parts) {
                if (part.text) {
                  yield {
                    delta: part.text,
                    done: false,
                    model,
                    usage: parsed.usageMetadata
                      ? {
                          promptTokens: parsed.usageMetadata.promptTokenCount || 0,
                          completionTokens: parsed.usageMetadata.candidatesTokenCount || 0,
                          totalTokens: parsed.usageMetadata.totalTokenCount || 0,
                        }
                      : undefined,
                  };
                }
              }
            }

            if (parsed.candidates?.[0]?.finishReason) {
              yield { delta: '', done: true };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async fetchWithRetry(
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
    } catch (error) {
      if (retryCount < (this.config.retries ?? 3)) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay ?? 1000),
        );
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }
}
