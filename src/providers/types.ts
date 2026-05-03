/**
 * Provider Abstraction Layer — Core types and interfaces
 * Unified interface so all providers work the same way.
 */

// ─── Message ────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Content part for multimodal messages */
export interface ContentPart {
  /** Type of content: 'text' or 'image_url' */
  type: 'text' | 'image_url';
  /** Text content (required when type is 'text') */
  text?: string;
  /** Image URL or base64 data (required when type is 'image_url') */
  imageUrl?: { url: string; detail?: 'low' | 'auto' | 'high' };
}

export interface ProviderMessage {
  role: MessageRole;
  /** Plain text content (convenience; use contentParts for multimodal) */
  content: string;
  /** Multimodal content parts (text + images) */
  contentParts?: ContentPart[];
  /** Optional metadata (channel, timestamp, etc.) */
  metadata?: Record<string, unknown>;
  /** For tool messages: the tool call ID this result belongs to */
  toolCallId?: string;
}

// ─── Chat Completion ────────────────────────────────────────────────────────

export interface ChatCompletionRequest {
  /** Model to use (e.g., 'gpt-4', 'claude-3-opus') */
  model: string;
  /** Messages to send to the model */
  messages: ProviderMessage[];
  /** System prompt */
  system?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0.0–2.0) */
  temperature?: number;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stop?: string[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Tool definitions for function calling */
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  /** Whether to force tool usage */
  toolChoice?: string | { type: string; name?: string };
  /** Extra provider-specific options */
  [key: string]: unknown;
}

export interface ChatCompletionResponse {
  /** Generated text content */
  content: string;
  /** Model used */
  model: string;
  /** Number of input tokens */
  inputTokens?: number;
  /** Number of output tokens */
  outputTokens?: number;
  /** Total tokens used */
  totalTokens?: number;
  /** Estimated cost in USD */
  cost?: number;
  /** Reasoning if available */
  reasoning?: string;
  /** Tool calls made by the model */
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  /** Finish reason */
  finishReason?: string;
  /** Response ID */
  id?: string;
  /** Usage metadata */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    /** Reasoning/thinking tokens (if applicable) */
    reasoningTokens?: number;
    /** Cache creation tokens (if applicable) */
    cacheCreationTokens?: number;
    /** Cache read tokens (if applicable) */
    cacheReadTokens?: number;
  };
}

export interface StreamChunk {
  /** Partial content delta */
  delta: string;
  /** Whether this is the last chunk */
  done: boolean;
  /** Model used */
  model?: string;
  /** Token usage for this chunk */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─── Provider Interface ─────────────────────────────────────────────────────

export interface LLMProvider {
  /** Provider name (e.g., 'openai', 'anthropic') */
  readonly name: string;

  /** List available models */
  listModels(): Promise<string[]>;

  /** Check if the provider is healthy */
  healthCheck(): Promise<boolean>;

  /** Get provider-specific config */
  getConfig(): ProviderConfig;

  /** Send a chat completion request */
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /** Send a streaming chat completion request */
  chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;
}

// ─── Provider Config ────────────────────────────────────────────────────────

export interface ProviderConfig {
  /** Provider name */
  provider: string;
  /** API key */
  apiKey: string;
  /** Base URL (for custom endpoints) */
  baseUrl?: string;
  /** Default model */
  model?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry settings */
  retries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Extra headers */
  headers?: Record<string, string>;
  /** Provider-specific options */
  [key: string]: unknown;
}

// ─── Provider Factory ───────────────────────────────────────────────────────

export interface ProviderFactory {
  /** Create a provider instance from config */
  create(config: ProviderConfig): LLMProvider;
}

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'ollama'
  | 'lmstudio'
  | 'llamacpp'
  | 'deepseek'
  | 'gemini'
  | 'mistral'
  | 'azure'
  | 'vllm';
