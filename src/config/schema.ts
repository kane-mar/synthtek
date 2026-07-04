/**
 * Configuration schema definitions and validation
 *
 * Types for config file serialization and env-var parsing.
 * Runtime agent types are imported from the canonical source in agent/types.ts.
 */

export type ProviderType =
	| "openai"
	| "anthropic"
	| "openrouter"
	| "ollama"
	| "lmstudio"
	| "llamacpp"
	| "deepseek"
	| "gemini"
	| "mistral"
	| "azure"
	| "vllm"
	| "qwen";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type ResponseFormat = "markdown" | "json" | "plain" | "structured";

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
	strategy?: "sequential" | "parallel";
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

/**
 * Agent Loop Config — used for config file validation and env-var construction.
 *
 * Re-exported from agent/types.ts (canonical source) to eliminate duplication.
 * Config-file-specific sub-types (RetryConfig, CircuitBreakerConfig) use the
 * canonical definitions via Partial — config files provide full objects that
 * satisfy the runtime's Partial expectations.
 */
import type { AgentLoopConfig } from "../agent/types.js";

export type { AgentLoopConfig };

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

export function validateProviderConfig(
	config: ProviderConfig,
): ValidationResult {
	const errors: string[] = [];

	if (!config.provider) {
		errors.push("provider is required");
	}

	// apiKey is optional — providers will fail at runtime if needed but not provided

	if (config.provider === "openai" && !config.model) {
		errors.push("model is required for openai provider");
	}

	if (config.provider === "anthropic" && !config.model) {
		errors.push("model is required for anthropic provider");
	}

	if (config.provider === "openrouter" && !config.model) {
		errors.push("model is required for openrouter provider");
	}

	if (config.timeout !== undefined && config.timeout < 1000) {
		errors.push("timeout must be at least 1000ms");
	}

	if (config.maxRetries !== undefined && config.maxRetries < 0) {
		errors.push("maxRetries must be non-negative");
	}

	return { valid: errors.length === 0, errors };
}

export function validateAgentConfig(config: AgentConfig): ValidationResult {
	const errors: string[] = [];

	if (!config.name) {
		errors.push("name is required");
	}

	if (!config.version) {
		errors.push("version is required");
	}

	if (!config.workspace) {
		errors.push("workspace is required");
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
				errors.push(
					...providerValidation.errors.map((e) => `fallback provider: ${e}`),
				);
			}
		}
	}

	if (config.loopConfig) {
		if (
			config.loopConfig.maxToolCalls !== undefined &&
			config.loopConfig.maxToolCalls < 1
		) {
			errors.push("maxToolCalls must be at least 1");
		}

		if (config.loopConfig.retry) {
			if (
				config.loopConfig.retry.maxRetries !== undefined &&
				config.loopConfig.retry.maxRetries < 0
			) {
				errors.push("retry.maxRetries must be non-negative");
			}
			if (
				config.loopConfig.retry.initialDelay !== undefined &&
				config.loopConfig.retry.initialDelay < 100
			) {
				errors.push("retry.initialDelay must be at least 100ms");
			}
			if (
				config.loopConfig.retry.maxDelay !== undefined &&
				config.loopConfig.retry.initialDelay !== undefined &&
				config.loopConfig.retry.maxDelay < config.loopConfig.retry.initialDelay
			) {
				errors.push("retry.maxDelay must be >= retry.initialDelay");
			}
		}

		if (config.loopConfig.circuitBreaker) {
			if (
				config.loopConfig.circuitBreaker.failureThreshold !== undefined &&
				config.loopConfig.circuitBreaker.failureThreshold < 1
			) {
				errors.push("circuitBreaker.failureThreshold must be at least 1");
			}
			if (
				config.loopConfig.circuitBreaker.recoveryTimeout !== undefined &&
				config.loopConfig.circuitBreaker.recoveryTimeout < 1000
			) {
				errors.push("circuitBreaker.recoveryTimeout must be at least 1000ms");
			}
		}
	}

	if (config.telegram) {
		if (!config.telegram.token) {
			errors.push("telegram.token is required when telegram config is present");
		}
	}

	return { valid: errors.length === 0, errors };
}

export function validateConfigFile(config: ConfigFile): ValidationResult {
	const errors: string[] = [];

	if (
		config.logLevel &&
		!["debug", "info", "warn", "error"].includes(config.logLevel)
	) {
		errors.push(`invalid logLevel: ${config.logLevel}`);
	}

	if (config.maxExecTimeout !== undefined && config.maxExecTimeout < 1) {
		errors.push("maxExecTimeout must be at least 1");
	}

	if (config.maxExecRetries !== undefined && config.maxExecRetries < 0) {
		errors.push("maxExecRetries must be non-negative");
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
				errors.push(
					...providerValidation.errors.map((e) => `fallback provider: ${e}`),
				);
			}
		}
	}

	if (config.loopConfig) {
		if (
			config.loopConfig.maxToolCalls !== undefined &&
			config.loopConfig.maxToolCalls < 1
		) {
			errors.push("maxToolCalls must be at least 1");
		}
	}

	return { valid: errors.length === 0, errors };
}
