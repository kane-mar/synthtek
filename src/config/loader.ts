/**
 * Configuration loader — reads from JSON/YAML files and environment variables
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ConfigFile, AgentConfig, ProviderConfig, FallbackConfig, AgentLoopConfig, TelegramConfig, LogLevel } from './schema.js';

// ── Default values ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  name: 'synthtek',
  version: '1.0.0',
  workspace: process.cwd(),
  logLevel: 'info',
  maxExecTimeout: 60,
  maxExecRetries: 3,
  spawnTimeout: 300,
};

// ── Environment variable helpers ─────────────────────────────────────────────

function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

function getEnvBool(key: string, fallback: boolean = false): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.toLowerCase() === 'true' || val === '1';
}

function getEnvNumber(key: string, fallback?: number): number | undefined {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const num = parseInt(val, 10);
  return isNaN(num) ? fallback : num;
}

// ── Provider config from env ─────────────────────────────────────────────────

function providerConfigFromEnv(): ProviderConfig | undefined {
  const provider = getEnv('SYNTHTEK_PROVIDER');
  if (!provider) return undefined;

  return {
    provider: provider as any,
    apiKey: getEnv('SYNTHTEK_API_KEY', '') ?? '',
    baseUrl: getEnv('SYNTHTEK_BASE_URL'),
    model: getEnv('SYNTHTEK_MODEL'),
    timeout: getEnvNumber('SYNTHTEK_TIMEOUT'),
    maxRetries: getEnvNumber('SYNTHTEK_MAX_RETRIES'),
  };
}

// ── Fallback providers from env ──────────────────────────────────────────────

function fallbackProvidersFromEnv(): FallbackConfig | undefined {
  const fallbackStr = getEnv('SYNTHTEK_FALLBACK_PROVIDERS');
  if (!fallbackStr) return undefined;

  try {
    const providers: ProviderConfig[] = JSON.parse(fallbackStr);
    return { providers, log: true };
  } catch {
    return undefined;
  }
}

// ── Loop config from env ─────────────────────────────────────────────────────

function loopConfigFromEnv(): AgentLoopConfig | undefined {
  const systemPrompt = getEnv('SYNTHTEK_SYSTEM_PROMPT');
  if (!systemPrompt) return undefined;

  return {
    systemPrompt,
    maxToolCalls: getEnvNumber('SYNTHTEK_MAX_TOOL_CALLS', 20) ?? 20,
    responseFormat: (getEnv('SYNTHTEK_RESPONSE_FORMAT') as any) ?? 'markdown',
    model: getEnv('SYNTHTEK_MODEL'),
    maxTokens: getEnvNumber('SYNTHTEK_MAX_TOKENS'),
    temperature: getEnvNumber('SYNTHTEK_TEMPERATURE'),
    topP: getEnvNumber('SYNTHTEK_TOP_P'),
    stop: getEnv('SYNTHTEK_STOP')?.split(','),
    retry: {
      maxRetries: getEnvNumber('SYNTHTEK_MAX_RETRIES', 3) ?? 3,
      initialDelay: getEnvNumber('SYNTHTEK_RETRY_DELAY', 1000) ?? 1000,
      maxDelay: getEnvNumber('SYNTHTEK_MAX_RETRY_DELAY', 30000) ?? 30000,
      multiplier: getEnvNumber('SYNTHTEK_RETRY_MULTIPLIER', 2) ?? 2,
    },
    circuitBreaker: {
      failureThreshold: getEnvNumber('SYNTHTEK_CB_THRESHOLD', 5) ?? 5,
      recoveryTimeout: getEnvNumber('SYNTHTEK_CB_RECOVERY', 60000) ?? 60000,
    },
  };
}

// ── Telegram config from env ─────────────────────────────────────────────────

function telegramConfigFromEnv(): TelegramConfig | undefined {
  const token = getEnv('SYNTHTEK_TELEGRAM_TOKEN');
  if (!token) return undefined;

  return {
    token,
    webhookUrl: getEnv('SYNTHTEK_TELEGRAM_WEBHOOK_URL'),
    usePolling: getEnvBool('SYNTHTEK_TELEGRAM_POLLING', true),
    pollingTimeout: getEnvNumber('SYNTHTEK_TELEGRAM_POLLING_TIMEOUT'),
    maxRetries: getEnvNumber('SYNTHTEK_TELEGRAM_MAX_RETRIES'),
    retryDelay: getEnvNumber('SYNTHTEK_TELEGRAM_RETRY_DELAY'),
  };
}

// ── Config file discovery ────────────────────────────────────────────────────

const CONFIG_FILE_NAMES = [
  '.synthtek-config.json',
  '.synthtek-config.yaml',
  '.synthtek-config.yml',
  'synthtek.config.json',
  'synthtek.config.yaml',
  'synthtek.config.yml',
];

function findConfigFile(startDir: string): string | null {
  let dir = resolve(startDir);

  // Search upward through parent directories
  const visited = new Set<string>();
  while (dir && !visited.has(dir)) {
    visited.add(dir);

    for (const name of CONFIG_FILE_NAMES) {
      const fullPath = join(dir, name);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }

    const parent = resolve(dir, '..');
    if (parent === dir) break; // reached root
    dir = parent;
  }

  return null;
}

// ── Config file parsing ──────────────────────────────────────────────────────

function parseConfigFile(path: string): ConfigFile | null {
  if (!existsSync(path)) return null;

  const ext = path.split('.').pop();

  if (ext === 'json') {
    try {
      const raw = readFileSync(path, 'utf-8');
      return JSON.parse(raw) as ConfigFile;
    } catch {
      return null;
    }
  }

  // YAML support — requires js-yaml or yaml package
  // For now, return null and log a warning
  if (ext === 'yaml' || ext === 'yml') {
    console.warn(`YAML config files not supported yet. Install 'yaml' package for YAML support.`);
    return null;
  }

  return null;
}

// ── Merge config sources ─────────────────────────────────────────────────────

function mergeConfigs(
  fileConfig: ConfigFile | null,
  envConfig: Partial<AgentConfig>,
): AgentConfig {
  const result: AgentConfig = { ...DEFAULT_CONFIG };

  // File config takes precedence over env, env over defaults
  if (fileConfig) {
    if (fileConfig.name) result.name = fileConfig.name;
    if (fileConfig.version) result.version = fileConfig.version;
    if (fileConfig.workspace) result.workspace = fileConfig.workspace;
    if (fileConfig.logLevel) result.logLevel = fileConfig.logLevel;
    if (fileConfig.maxExecTimeout !== undefined) result.maxExecTimeout = fileConfig.maxExecTimeout;
    if (fileConfig.maxExecRetries !== undefined) result.maxExecRetries = fileConfig.maxExecRetries;
    if (fileConfig.spawnTimeout !== undefined) result.spawnTimeout = fileConfig.spawnTimeout;
    if (fileConfig.provider) result.provider = fileConfig.provider;
    if (fileConfig.fallbackProviders) result.fallbackProviders = fileConfig.fallbackProviders;
    if (fileConfig.loopConfig) result.loopConfig = fileConfig.loopConfig;
    if (fileConfig.telegram) result.telegram = fileConfig.telegram;
    if (fileConfig.plugins) result.plugins = fileConfig.plugins;
  }

  // Environment variables override file config
  if (envConfig.name) result.name = envConfig.name;
  if (envConfig.version) result.version = envConfig.version;
  if (envConfig.workspace) result.workspace = envConfig.workspace;
  if (envConfig.logLevel) result.logLevel = envConfig.logLevel;
  if (envConfig.maxExecTimeout !== undefined) result.maxExecTimeout = envConfig.maxExecTimeout;
  if (envConfig.maxExecRetries !== undefined) result.maxExecRetries = envConfig.maxExecRetries;
  if (envConfig.spawnTimeout !== undefined) result.spawnTimeout = envConfig.spawnTimeout;
  if (envConfig.provider) result.provider = envConfig.provider;
  if (envConfig.fallbackProviders) result.fallbackProviders = envConfig.fallbackProviders;
  if (envConfig.loopConfig) result.loopConfig = envConfig.loopConfig;
  if (envConfig.telegram) result.telegram = envConfig.telegram;

  return result;
}

// ── Config loader class ──────────────────────────────────────────────────────

export class ConfigLoader {
  private config: AgentConfig;
  private configPath: string | null;
  private envOverrides: Partial<AgentConfig>;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = null;
    this.envOverrides = {};
  }

  /** Load configuration from file and environment variables */
  load(startDir?: string): AgentConfig {
    const dir = startDir ?? process.cwd();
    this.configPath = findConfigFile(dir);

    // Parse file config
    const fileConfig = this.configPath ? parseConfigFile(this.configPath) : null;

    // If file was found but couldn't be parsed, treat as not found
    if (this.configPath && !fileConfig) {
      this.configPath = null;
    }

    // Build env overrides
    this.envOverrides = {
      provider: providerConfigFromEnv(),
      fallbackProviders: fallbackProvidersFromEnv(),
      loopConfig: loopConfigFromEnv(),
      telegram: telegramConfigFromEnv(),
      logLevel: (getEnv('SYNTHTEK_LOG_LEVEL') as LogLevel) ?? undefined,
      workspace: getEnv('SYNTHTEK_WORKSPACE'),
    };

    // Merge all sources
    this.config = mergeConfigs(fileConfig, this.envOverrides);

    return this.config;
  }

  /** Get the loaded configuration */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /** Get the path to the loaded config file (if any) */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /** Reload configuration (useful for hot-reload) */
  reload(): AgentConfig {
    if (this.configPath) {
      this.config = this.load(resolve(this.configPath, '..'));
    }
    return this.config;
  }

  /** Check if a config file was found */
  hasConfigFile(): boolean {
    return this.configPath !== null;
  }

  /** Get environment variable overrides */
  getEnvOverrides(): Partial<AgentConfig> {
    return { ...this.envOverrides };
  }
}
