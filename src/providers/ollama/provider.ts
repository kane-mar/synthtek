/**
 * Ollama Provider — Local LLM inference via Ollama
 * Ollama exposes an OpenAI-compatible API at http://localhost:11434/v1
 */

import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
  ProviderMessage,
} from '../types.js';
import { BaseProvider } from '../base-provider.js';

const DEFAULT_CONFIG: Partial<ProviderConfig> = {
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3',
  timeout: 120_000, // Ollama can be slow for large models
  retries: 2,
  retryDelay: 1000,
};

/** Convert provider messages to Ollama format */
function toOllamaMessages(messages: ProviderMessage[]): Array<{
  role: string;
  content: string;
}> {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

/** Ollama cost — free (local inference) */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'llama3': { input: 0, output: 0 },
  'llama3.1': { input: 0, output: 0 },
  'mistral': { input: 0, output: 0 },
  'gemma2': { input: 0, output: 0 },
  'phi3': { input: 0, output: 0 },
  'codellama': { input: 0, output: 0 },
  'llama2': { input: 0, output: 0 },
  'default': { input: 0, output: 0 },
};

export class OllamaProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config, DEFAULT_CONFIG as Partial<ProviderConfig>);
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/models`,
      { method: 'GET' },
    );

    if (!response.ok) {
      throw new Error(`Failed to list Ollama models: ${response.status}`);
    }

    const data = await response.json() as {
      models: Array<{ name: string; model: string; modified_at: string; size: number; digest: string; details: { parent_model: string; format: string; family: string; families: string[]; parameter_size: string; quantization_level: string } }>;
    };
    return data.models.map((m) => m.name);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry(
        `${this.config.baseUrl}/tags`,
        { method: 'GET' },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model || this.config.model;
    const messages = toOllamaMessages(request.messages);

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature,
        top_p: request.topP,
        num_predict: request.maxTokens,
        stop: request.stop,
      },
    };

    if (request.system) {
      // Ollama uses a separate system parameter
      (body as { system?: string }).system = request.system;
    }

    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      model: string;
      message: { role: string; content: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> };
      done: boolean;
      total_duration?: number;
      load_duration?: number;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const inputTokens = data.prompt_eval_count || 0;
    const outputTokens = data.eval_count || 0;
    const totalTokens = inputTokens + outputTokens;

    // Estimate cost (free for local)
    const costInfo = COST_PER_1M[model] || COST_PER_1M['default'];
    const cost =
      (inputTokens / 1_000_000) * costInfo.input +
      (outputTokens / 1_000_000) * costInfo.output;

    return {
      content: data.message.content || '',
      model: data.model,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      finishReason: data.done ? 'stop' : undefined,
      id: `ollama_${Date.now()}`,
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
    const messages = toOllamaMessages(request.messages);

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      options: {
        temperature: request.temperature,
        top_p: request.topP,
        num_predict: request.maxTokens,
        stop: request.stop,
      },
    };

    if (request.system) {
      (body as { system?: string }).system = request.system;
    }

    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
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
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line) as {
              model: string;
              message: { content: string };
              done: boolean;
              total_duration?: number;
              prompt_eval_count?: number;
              eval_count?: number;
            };

            if (parsed.message?.content) {
              yield {
                delta: parsed.message.content,
                done: false,
                model: parsed.model,
                usage: parsed.eval_count
                  ? {
                      promptTokens: parsed.prompt_eval_count || 0,
                      completionTokens: parsed.eval_count,
                      totalTokens: (parsed.prompt_eval_count || 0) + parsed.eval_count,
                    }
                  : undefined,
              };
            }

            if (parsed.done) {
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
}
