# Configuration Reference

## Overview

synthtek supports multiple configuration sources that merge with a clear precedence:

1. **Defaults** — Built-in sensible defaults
2. **Config file** — `config.json` or `config.yaml` in workspace root
3. **Environment variables** — `SYNTHTEK_*` prefix, always wins
4. **Secrets** — Resolved via `{{secret:name}}` syntax (uppercase-safe)

## Config File Formats

### JSON (`config.json`)

```json
{
  "name": "my-agent",
  "logLevel": "info",
  "workspace": "/data",
  "provider": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4"
  },
  "loopConfig": {
    "systemPrompt": "You are a helpful assistant.",
    "maxToolCalls": 20,
    "responseFormat": "markdown"
  },
  "telegram": {
    "token": "123456:ABC-DEF",
    "usePolling": true
  },
  "plugins": [
    { "name": "weather", "enabled": true, "config": { "units": "metric" } }
  ]
}
```

### YAML (`config.yaml`)

```yaml
name: my-agent
logLevel: info
workspace: /data
provider:
  provider: openai
  apiKey: sk-...
  model: gpt-4
loopConfig:
  systemPrompt: "You are a helpful assistant."
  maxToolCalls: 20
  responseFormat: markdown
telegram:
  token: "123456:ABC-DEF"
  usePolling: true
plugins:
  - name: weather
    enabled: true
    config:
      units: metric
```

## Full Schema Reference

### AgentConfig (Top-Level)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | `"synthtek"` | Agent name |
| `version` | `string` | `"1.0.0"` | Agent version |
| `workspace` | `string` | `process.cwd()` | Workspace directory |
| `logLevel` | `LogLevel` | `"info"` | `debug`, `info`, `warn`, `error` |
| `maxExecTimeout` | `number` | `60` | Max command execution timeout (seconds) |
| `maxExecRetries` | `number` | `3` | Max retries for failed commands |
| `spawnTimeout` | `number` | `300` | Subagent spawn timeout (seconds) |
| `messageChannel` | `string` | — | Default message channel |
| `messageWebhook` | `string` | — | Webhook URL for messages |
| `provider` | `ProviderConfig` | — | Primary AI provider |
| `fallbackProviders` | `FallbackConfig` | — | Fallback provider chain |
| `loopConfig` | `AgentLoopConfig` | — | Agent loop settings |
| `telegram` | `TelegramConfig` | — | Telegram channel config |
| `plugins` | `PluginConfig[]` | — | Plugin list |

### ProviderConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | `ProviderType` | ✅ | `openai`, `anthropic`, `openrouter`, `ollama`, `lmstudio`, `llamacpp`, `gemini`, `deepseek`, `custom` |
| `apiKey` | `string` | ✅ (except local) | API key |
| `baseUrl` | `string` | — | Custom API base URL |
| `model` | `string` | ✅ (openai/anthropic/openrouter) | Model name |
| `timeout` | `number` | — | Request timeout (ms, min 1000) |
| `maxRetries` | `number` | — | Retry count (≥ 0) |

### AgentLoopConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `systemPrompt` | `string` | `"You are a helpful AI assistant."` | System message |
| `maxToolCalls` | `number` | `20` | Max tool calls per turn (≥ 1) |
| `responseFormat` | `ResponseFormat` | `"markdown"` | `markdown`, `json`, `plain`, `structured` |
| `model` | `string` | — | Override model |
| `maxTokens` | `number` | — | Max output tokens |
| `temperature` | `number` | — | 0.0–2.0 |
| `topP` | `number` | — | Top-p sampling |
| `stop` | `string[]` | — | Stop sequences |
| `contextWindow` | `ContextWindowConfig` | — | Context management |
| `retry` | `RetryConfig` | — | Retry settings |
| `circuitBreaker` | `CircuitBreakerConfig` | — | Circuit breaker settings |

### RetryConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Max retries (≥ 0) |
| `initialDelay` | `number` | `1000` | Initial delay (ms, ≥ 100) |
| `maxDelay` | `number` | `30000` | Max delay (ms, ≥ initialDelay) |
| `multiplier` | `number` | `2` | Backoff multiplier |

### CircuitBreakerConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `failureThreshold` | `number` | `5` | Failures before open (≥ 1) |
| `recoveryTimeout` | `number` | `60000` | Recovery wait (ms, ≥ 1000) |

### TelegramConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | `string` | — | Bot token (required) |
| `webhookUrl` | `string` | — | Webhook URL (vs polling) |
| `usePolling` | `boolean` | `true` | Use long polling |
| `pollingTimeout` | `number` | — | Poll timeout (seconds) |
| `maxRetries` | `number` | — | Retry count |
| `retryDelay` | `number` | — | Delay between retries |

## Environment Variables

All env vars use `SYNTHTEK_` prefix and override config file values:

| Variable | Config Field | Description |
|----------|-------------|-------------|
| `SYNTHTEK_PROVIDER` | `provider.provider` | Provider type |
| `SYNTHTEK_API_KEY` | `provider.apiKey` | API key |
| `SYNTHTEK_BASE_URL` | `provider.baseUrl` | Custom base URL |
| `SYNTHTEK_MODEL` | `provider.model` | Model name |
| `SYNTHTEK_TIMEOUT` | `provider.timeout` | Timeout (ms) |
| `SYNTHTEK_MAX_RETRIES` | `provider.maxRetries` | Retry count |
| `SYNTHTEK_FALLBACK_PROVIDERS` | `fallbackProviders` | JSON array of providers |
| `SYNTHTEK_SYSTEM_PROMPT` | `loopConfig.systemPrompt` | System prompt |
| `SYNTHTEK_MAX_TOOL_CALLS` | `loopConfig.maxToolCalls` | Max tool calls |
| `SYNTHTEK_RESPONSE_FORMAT` | `loopConfig.responseFormat` | Response format |
| `SYNTHTEK_MAX_TOKENS` | `loopConfig.maxTokens` | Max tokens |
| `SYNTHTEK_TEMPERATURE` | `loopConfig.temperature` | Temperature |
| `SYNTHTEK_TOP_P` | `loopConfig.topP` | Top-p |
| `SYNTHTEK_STOP` | `loopConfig.stop` | Comma-separated stop sequences |
| `SYNTHTEK_RETRY_DELAY` | `loopConfig.retry.initialDelay` | Retry delay (ms) |
| `SYNTHTEK_MAX_RETRY_DELAY` | `loopConfig.retry.maxDelay` | Max retry delay (ms) |
| `SYNTHTEK_RETRY_MULTIPLIER` | `loopConfig.retry.multiplier` | Backoff multiplier |
| `SYNTHTEK_CB_THRESHOLD` | `loopConfig.circuitBreaker.failureThreshold` | CB threshold |
| `SYNTHTEK_CB_RECOVERY` | `loopConfig.circuitBreaker.recoveryTimeout` | CB recovery (ms) |
| `SYNTHTEK_LOG_LEVEL` | `logLevel` | Log level |
| `SYNTHTEK_WORKSPACE` | `workspace` | Workspace directory |

## Secret Management

### Secret Resolution

Use `{{secret:name}}` syntax in config values. The resolver uses an uppercase-safe regex to avoid accidentally matching normal text:

```json
{
  "provider": {
    "provider": "openai",
    "apiKey": "{{secret:OPENAI_API_KEY}}",
    "model": "gpt-4"
  }
}
```

### Secret Store

Secrets are stored in an in-memory `SecretStore` by default. You can provide a custom store:

```typescript
import { SecretManagerImpl } from './config/secrets.js';

const manager = new SecretManagerImpl(customStore, 'synthtek');
manager.set('OPENAI_API_KEY', 'sk-...');
```

## Hot-Reload

The config loader watches for file changes and reloads automatically:

```typescript
import { ConfigLoader } from './config/loader.js';

const loader = new ConfigLoader('/path/to/config.json');
const config = await loader.load();

// Watch for changes
loader.watch((newConfig) => {
  console.log('Config reloaded', newConfig);
});
```

## Validation

All configs are validated before use. Common errors:

| Error | Cause | Fix |
|-------|-------|-----|
| `provider is required` | Missing provider type | Set `provider.provider` |
| `apiKey is required` | Missing API key | Set `provider.apiKey` or use local provider |
| `model is required for openai provider` | OpenAI needs a model | Set `provider.model` |
| `timeout must be at least 1000ms` | Timeout too low | Increase to ≥ 1000 |
| `invalid logLevel: xyz` | Unknown log level | Use `debug`, `info`, `warn`, or `error` |

## Complete Example

```json
{
  "name": "production-agent",
  "version": "1.0.0",
  "workspace": "/data",
  "logLevel": "info",
  "maxExecTimeout": 120,
  "maxExecRetries": 5,
  "spawnTimeout": 600,
  "provider": {
    "provider": "openai",
    "apiKey": "{{secret:OPENAI_API_KEY}}",
    "model": "gpt-4",
    "timeout": 30000,
    "maxRetries": 3
  },
  "fallbackProviders": {
    "providers": [
      { "provider": "anthropic", "apiKey": "{{secret:ANTHROPIC_API_KEY}}", "model": "claude-3-sonnet" },
      { "provider": "openrouter", "apiKey": "{{secret:OPENROUTER_API_KEY}}", "model": "meta-llama/llama-3-70b" }
    ],
    "log": true,
    "strategy": "sequential"
  },
  "loopConfig": {
    "systemPrompt": "You are a helpful AI assistant specialized in code review.",
    "maxToolCalls": 15,
    "responseFormat": "markdown",
    "maxTokens": 4096,
    "temperature": 0.7,
    "retry": {
      "maxRetries": 3,
      "initialDelay": 1000,
      "maxDelay": 30000,
      "multiplier": 2
    },
    "circuitBreaker": {
      "failureThreshold": 5,
      "recoveryTimeout": 60000
    }
  },
  "telegram": {
    "token": "{{secret:TELEGRAM_BOT_TOKEN}}",
    "usePolling": true,
    "pollingTimeout": 60
  },
  "plugins": [
    {
      "name": "weather",
      "enabled": true,
      "config": { "units": "metric", "apiKey": "{{secret:WEATHER_API_KEY}}" }
    }
  ]
}
```
