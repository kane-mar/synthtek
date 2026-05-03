/**
 * Configuration schema definitions and validation
 */

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

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ResponseFormat = 'markdown' | 'json' | 'plain' | 'structured';

export interface ProviderConfig {
  provider: ProviderType;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface FallbackConfig {
  providers: ProviderConfig[];
  log: boolean;
  strategy?: 'sequential' | 'parallel';
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  retryableErrors?: RegExp[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
}

export interface ContextWindowConfig {
  maxTokens: number;
  minTokens: number;
  compactionThreshold: number;
  compactionStrategy: 'trim' | 'summarize' | 'hybrid';
}

export interface AgentLoopConfig {
  systemPrompt: string;
  maxToolCalls: number;
  responseFormat: ResponseFormat;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  toolChoice?: string | { type: string; name?: string };
  contextWindow?: ContextWindowConfig;
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface TelegramConfig {
  token: string;
  webhookUrl?: string;
  usePolling?: boolean;
  pollingTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface AgentConfig {
  name: string;
  version: string;
  workspace: string;
  logLevel: LogLevel;
  maxExecTimeout: number;
  maxExecRetries: number;
  spawnTimeout: number;
  messageChannel?: string;
  messageWebhook?: string;
  provider?: ProviderConfig;
  fallbackProviders?: FallbackConfig;
  loopConfig?: AgentLoopConfig;
  telegram?: TelegramConfig;
  plugins?: PluginConfig[];
}

export interface ConfigFile {
  name?: string;
  version?: string;
  workspace?: string;
  logLevel?: LogLevel;
  maxExecTimeout?: number;
  maxExecRetries?: number;
  spawnTimeout?: number;
  provider?: ProviderConfig;
  fallbackProviders?: FallbackConfig;
  loopConfig?: AgentLoopConfig;
  telegram?: TelegramConfig;
  plugins?: PluginConfig[];
  env?: Record<string, string>;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateProviderConfig(config: ProviderConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.provider) {
    errors.push('provider is required');
  }

  if (!config.apiKey && !['ollama', 'lmstudio', 'llamacpp', 'vllm'].includes(config.provider)) {
    errors.push('apiKey is required');
  }

  if (config.provider === 'openai' && !config.model) {
    errors.push('model is required for openai provider');
  }

  if (config.provider === 'anthropic' && !config.model) {
    errors.push('model is required for anthropic provider');
  }

  if (config.provider === 'openrouter' && !config.model) {
    errors.push('model is required for openrouter provider');
  }

  if (config.timeout !== undefined && config.timeout < 1000) {
    errors.push('timeout must be at least 1000ms');
  }

  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    errors.push('maxRetries must be non-negative');
  }

  return { valid: errors.length === 0, errors };
}

export function validateAgentConfig(config: AgentConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('name is required');
  }

  if (!config.version) {
    errors.push('version is required');
  }

  if (!config.workspace) {
    errors.push('workspace is required');
  }

  if (config.provider) {
    const providerValidation = validateProviderConfig(config.provider);
    if (!providerValidation.valid) {
      errors.push(...providerValidation.errors.map((e) => `provider: ${e}`));
    }
  }

  if (config.fallbackProviders) {
    for (const fp of config.fallbackProviders.providers) {
      const providerValidation = validateProviderConfig(fp);
      if (!providerValidation.valid) {
        errors.push(...providerValidation.errors.map((e) => `fallback provider: ${e}`));
      }
    }
  }

  if (config.loopConfig) {
    if (config.loopConfig.maxToolCalls !== undefined && config.loopConfig.maxToolCalls < 1) {
      errors.push('maxToolCalls must be at least 1');
    }

    if (config.loopConfig.retry) {
      if (config.loopConfig.retry.maxRetries < 0) {
        errors.push('retry.maxRetries must be non-negative');
      }
      if (config.loopConfig.retry.initialDelay < 100) {
        errors.push('retry.initialDelay must be at least 100ms');
      }
      if (config.loopConfig.retry.maxDelay < config.loopConfig.retry.initialDelay) {
        errors.push('retry.maxDelay must be >= retry.initialDelay');
      }
    }

    if (config.loopConfig.circuitBreaker) {
      if (config.loopConfig.circuitBreaker.failureThreshold < 1) {
        errors.push('circuitBreaker.failureThreshold must be at least 1');
      }
      if (config.loopConfig.circuitBreaker.recoveryTimeout < 1000) {
        errors.push('circuitBreaker.recoveryTimeout must be at least 1000ms');
      }
    }
  }

  if (config.telegram) {
    if (!config.telegram.token) {
      errors.push('telegram.token is required when telegram config is present');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateConfigFile(config: ConfigFile): ValidationResult {
  const errors: string[] = [];

  if (config.logLevel && !['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
    errors.push(`invalid logLevel: ${config.logLevel}`);
  }

  if (config.maxExecTimeout !== undefined && config.maxExecTimeout < 1) {
    errors.push('maxExecTimeout must be at least 1');
  }

  if (config.maxExecRetries !== undefined && config.maxExecRetries < 0) {
    errors.push('maxExecRetries must be non-negative');
  }

  if (config.provider) {
    const providerValidation = validateProviderConfig(config.provider);
    if (!providerValidation.valid) {
      errors.push(...providerValidation.errors.map((e) => `provider: ${e}`));
    }
  }

  if (config.fallbackProviders) {
    for (const fp of config.fallbackProviders.providers) {
      const providerValidation = validateProviderConfig(fp);
      if (!providerValidation.valid) {
        errors.push(...providerValidation.errors.map((e) => `fallback provider: ${e}`));
      }
    }
  }

  if (config.loopConfig) {
    if (config.loopConfig.maxToolCalls !== undefined && config.loopConfig.maxToolCalls < 1) {
      errors.push('maxToolCalls must be at least 1');
    }
  }

  return { valid: errors.length === 0, errors };
}
