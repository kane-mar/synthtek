/**
 * Configuration Schema Tests
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  validateProviderConfig,
  validateAgentConfig,
  validateConfigFile,
  ProviderConfig,
  AgentConfig,
  ConfigFile,
} from '../../src/config/schema.js';

// ── Provider Config Validation ───────────────────────────────────────────────

describe('validateProviderConfig', () => {
  test('validates a correct provider config', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4',
    };
    const result = validateProviderConfig(config);
    assert.ok(result.valid);
    assert.equal(result.errors.length, 0);
  });

  test('rejects missing provider', () => {
    const config = { apiKey: 'sk-test-key' } as ProviderConfig;
    const result = validateProviderConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('provider is required')));
  });

  test('accepts missing apiKey (optional)', () => {
    const config = { provider: 'openai', model: 'gpt-4' } as ProviderConfig;
    const result = validateProviderConfig(config);
    assert.equal(result.valid, true);
  });

  test('rejects missing model for openai', () => {
    const config = { provider: 'openai', apiKey: 'sk-test-key' } as ProviderConfig;
    const result = validateProviderConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('model is required')));
  });

  test('rejects missing model for anthropic', () => {
    const config = { provider: 'anthropic', apiKey: 'sk-test-key' } as ProviderConfig;
    const result = validateProviderConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('model is required')));
  });

  test('rejects missing model for openrouter', () => {
    const config = { provider: 'openrouter', apiKey: 'sk-test-key' } as ProviderConfig;
    const result = validateProviderConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('model is required')));
  });

  test('accepts model for openrouter with slash notation', () => {
    const config: ProviderConfig = {
      provider: 'openrouter',
      apiKey: 'sk-test-key',
      model: 'openai/gpt-4',
    };
    const result = validateProviderConfig(config);
    assert.ok(result.valid);
  });

  test('rejects timeout below 1000ms', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4',
      timeout: 500,
    };
    const result = validateProviderConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('timeout')));
  });

  test('accepts timeout of exactly 1000ms', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4',
      timeout: 1000,
    };
    const result = validateProviderConfig(config);
    assert.ok(result.valid);
  });

  test('rejects negative maxRetries', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4',
      maxRetries: -1,
    };
    const result = validateProviderConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('maxRetries')));
  });

  test('accepts zero maxRetries', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4',
      maxRetries: 0,
    };
    const result = validateProviderConfig(config);
    assert.ok(result.valid);
  });

  test('accepts baseUrl for custom providers', () => {
    const config: ProviderConfig = {
      provider: 'ollama',
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'llama3',
    };
    const result = validateProviderConfig(config);
    assert.ok(result.valid);
  });
});

// ── Agent Config Validation ──────────────────────────────────────────────────

describe('validateAgentConfig', () => {
  test('validates a correct agent config', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
    };
    const result = validateAgentConfig(config);
    assert.ok(result.valid);
  });

  test('rejects missing name', () => {
    const config = {
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
    } as AgentConfig;
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('name is required')));
  });

  test('rejects missing version', () => {
    const config = {
      name: 'test-agent',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
    } as AgentConfig;
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('version is required')));
  });

  test('rejects missing workspace', () => {
    const config = {
      name: 'test-agent',
      version: '1.0.0',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
    } as AgentConfig;
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('workspace is required')));
  });

  test('rejects invalid maxToolCalls', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      loopConfig: {
        systemPrompt: 'test',
        maxToolCalls: 0,
        responseFormat: 'markdown',
      },
    };
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('maxToolCalls')));
  });

  test('rejects negative retry maxRetries', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      loopConfig: {
        systemPrompt: 'test',
        maxToolCalls: 20,
        responseFormat: 'markdown',
        retry: {
          maxRetries: -1,
          initialDelay: 1000,
          maxDelay: 30000,
          multiplier: 2,
        },
      },
    };
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('maxRetries')));
  });

  test('rejects initialDelay below 100ms', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      loopConfig: {
        systemPrompt: 'test',
        maxToolCalls: 20,
        responseFormat: 'markdown',
        retry: {
          maxRetries: 3,
          initialDelay: 50,
          maxDelay: 30000,
          multiplier: 2,
        },
      },
    };
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('initialDelay')));
  });

  test('rejects maxDelay below initialDelay', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      loopConfig: {
        systemPrompt: 'test',
        maxToolCalls: 20,
        responseFormat: 'markdown',
        retry: {
          maxRetries: 3,
          initialDelay: 5000,
          maxDelay: 1000,
          multiplier: 2,
        },
      },
    };
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('maxDelay')));
  });

  test('rejects circuit breaker threshold below 1', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      loopConfig: {
        systemPrompt: 'test',
        maxToolCalls: 20,
        responseFormat: 'markdown',
        circuitBreaker: {
          failureThreshold: 0,
          recoveryTimeout: 60000,
        },
      },
    };
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('failureThreshold')));
  });

  test('rejects circuit breaker recovery below 1000ms', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      loopConfig: {
        systemPrompt: 'test',
        maxToolCalls: 20,
        responseFormat: 'markdown',
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTimeout: 500,
        },
      },
    };
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('recoveryTimeout')));
  });

  test('rejects telegram config without token', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      telegram: {
        token: '',
      },
    };
    const result = validateAgentConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('telegram.token')));
  });

  test('accepts valid fallback providers', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      fallbackProviders: {
        providers: [
          { provider: 'openai', apiKey: 'key1', model: 'gpt-4' },
          { provider: 'anthropic', apiKey: 'key2', model: 'claude-3' },
        ],
        log: true,
      },
    };
    const result = validateAgentConfig(config);
    assert.ok(result.valid);
  });

  test('accepts fallback provider with missing apiKey (optional)', () => {
    const config: AgentConfig = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      fallbackProviders: {
        providers: [
          { provider: 'openai', model: 'gpt-4' } as ProviderConfig,
        ],
        log: true,
      },
    };
    const result = validateAgentConfig(config);
    assert.equal(result.valid, true);
  });
});

// ── Config File Validation ───────────────────────────────────────────────────

describe('validateConfigFile', () => {
  test('validates a correct config file', () => {
    const config: ConfigFile = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
    };
    const result = validateConfigFile(config);
    assert.ok(result.valid);
  });

  test('rejects invalid logLevel', () => {
    const config = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'verbose' as any,
      maxExecTimeout: 60,
      maxExecRetries: 3,
    } as ConfigFile;
    const result = validateConfigFile(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('logLevel')));
  });

  test('rejects maxExecTimeout below 1', () => {
    const config = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 0,
      maxExecRetries: 3,
    } as ConfigFile;
    const result = validateConfigFile(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('maxExecTimeout')));
  });

  test('rejects negative maxExecRetries', () => {
    const config = {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: -1,
    } as ConfigFile;
    const result = validateConfigFile(config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('maxExecRetries')));
  });

  test('accepts all valid log levels', () => {
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      const config: ConfigFile = {
        name: 'test-agent',
        version: '1.0.0',
        workspace: '/tmp/test',
        logLevel: level,
        maxExecTimeout: 60,
        maxExecRetries: 3,
      };
      const result = validateConfigFile(config);
      assert.ok(result.valid, `Should accept logLevel: ${level}`);
    }
  });
});
