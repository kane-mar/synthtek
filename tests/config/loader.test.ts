/**
 * Configuration Loader Tests
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigLoader } from '../../src/config/loader.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTempDir(): string {
  const dir = join(tmpdir(), `synthtek-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createConfigFile(dir: string, name: string, content: Record<string, unknown>): string {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(content, null, 2), 'utf-8');
  return path;
}

function cleanupDir(dir: string): void {
  if (!existsSync(dir)) return;
  try {
    const files = require('node:fs').readdirSync(dir);
    for (const file of files) {
      const path = join(dir, file);
      if (require('node:fs').statSync(path).isDirectory()) {
        require('node:fs').rmSync(path, { recursive: true });
      } else {
        require('node:fs').unlinkSync(path);
      }
    }
    require('node:fs').rmdirSync(dir);
  } catch {
    // Ignore cleanup errors
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConfigLoader', () => {
  test('loads default config when no config file exists', () => {
    const dir = createTempDir();
    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.equal(config.name, 'synthtek');
    assert.equal(config.version, '1.0.0');
    assert.equal(config.logLevel, 'info');
    assert.equal(config.maxExecTimeout, 60);
    assert.equal(config.maxExecRetries, 3);
    assert.equal(config.spawnTimeout, 300);
    assert.ok(!loader.hasConfigFile());

    cleanupDir(dir);
  });

  test('loads config from .synthtek-config.json', () => {
    const dir = createTempDir();
    const configPath = createConfigFile(dir, '.synthtek-config.json', {
      name: 'custom-agent',
      version: '2.0.0',
      logLevel: 'debug',
      maxExecTimeout: 120,
      maxExecRetries: 5,
    });

    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.equal(config.name, 'custom-agent');
    assert.equal(config.version, '2.0.0');
    assert.equal(config.logLevel, 'debug');
    assert.equal(config.maxExecTimeout, 120);
    assert.equal(config.maxExecRetries, 5);
    assert.ok(loader.hasConfigFile());
    assert.equal(loader.getConfigPath(), configPath);

    cleanupDir(dir);
  });

  test('environment variables override file config', () => {
    const dir = createTempDir();
    createConfigFile(dir, '.synthtek-config.json', {
      name: 'file-agent',
      logLevel: 'info',
    });

    const origProvider = process.env.SYNTHTEK_PROVIDER;
    const origApiKey = process.env.SYNTHTEK_API_KEY;
    const origLogLevel = process.env.SYNTHTEK_LOG_LEVEL;

    process.env.SYNTHTEK_PROVIDER = 'anthropic';
    process.env.SYNTHTEK_API_KEY = 'env-key';
    process.env.SYNTHTEK_LOG_LEVEL = 'warn';

    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.equal(config.name, 'file-agent'); // file config still applies
    assert.equal(config.logLevel, 'warn'); // env overrides file

    if (origProvider === undefined) delete process.env.SYNTHTEK_PROVIDER; else process.env.SYNTHTEK_PROVIDER = origProvider;
    if (origApiKey === undefined) delete process.env.SYNTHTEK_API_KEY; else process.env.SYNTHTEK_API_KEY = origApiKey;
    if (origLogLevel === undefined) delete process.env.SYNTHTEK_LOG_LEVEL; else process.env.SYNTHTEK_LOG_LEVEL = origLogLevel;

    cleanupDir(dir);
  });

  test('finds config file in parent directories', () => {
    const dir = createTempDir();
    const subDir = join(dir, 'sub', 'nested');
    mkdirSync(subDir, { recursive: true });

    createConfigFile(dir, '.synthtek-config.json', {
      name: 'parent-config',
      logLevel: 'debug',
    });

    const loader = new ConfigLoader();
    const config = loader.load(subDir);

    assert.equal(config.name, 'parent-config');
    assert.equal(config.logLevel, 'debug');
    assert.ok(loader.hasConfigFile());

    cleanupDir(dir);
  });

  test('prefers closer config file over parent', () => {
    const dir = createTempDir();
    const subDir = join(dir, 'sub');
    mkdirSync(subDir, { recursive: true });

    createConfigFile(dir, '.synthtek-config.json', {
      name: 'parent-config',
      logLevel: 'debug',
    });

    createConfigFile(subDir, '.synthtek-config.json', {
      name: 'child-config',
      logLevel: 'info',
    });

    const loader = new ConfigLoader();
    const config = loader.load(subDir);

    assert.equal(config.name, 'child-config');
    assert.equal(config.logLevel, 'info');

    cleanupDir(dir);
  });

  test('loads provider config from file', () => {
    const dir = createTempDir();
    createConfigFile(dir, '.synthtek-config.json', {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      provider: {
        provider: 'openai',
        apiKey: 'sk-file-key',
        baseUrl: 'https://custom.openai.com',
        model: 'gpt-4-turbo',
        timeout: 30000,
        maxRetries: 5,
      },
    });

    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.ok(config.provider);
    assert.equal(config.provider.provider, 'openai');
    assert.equal(config.provider.apiKey, 'sk-file-key');
    assert.equal(config.provider.baseUrl, 'https://custom.openai.com');
    assert.equal(config.provider.model, 'gpt-4-turbo');
    assert.equal(config.provider.timeout, 30000);
    assert.equal(config.provider.maxRetries, 5);

    cleanupDir(dir);
  });

  test('loads telegram config from file', () => {
    const dir = createTempDir();
    createConfigFile(dir, '.synthtek-config.json', {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      telegram: {
        token: '123456:ABC-DEF',
        webhookUrl: 'https://example.com/webhook',
        usePolling: false,
        pollingTimeout: 60,
        maxRetries: 10,
        retryDelay: 2000,
      },
    });

    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.ok(config.telegram);
    assert.equal(config.telegram.token, '123456:ABC-DEF');
    assert.equal(config.telegram.webhookUrl, 'https://example.com/webhook');
    assert.equal(config.telegram.usePolling, false);
    assert.equal(config.telegram.pollingTimeout, 60);
    assert.equal(config.telegram.maxRetries, 10);
    assert.equal(config.telegram.retryDelay, 2000);

    cleanupDir(dir);
  });

  test('loads loop config from file', () => {
    const dir = createTempDir();
    createConfigFile(dir, '.synthtek-config.json', {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      loopConfig: {
        systemPrompt: 'You are a helpful assistant.',
        maxToolCalls: 30,
        responseFormat: 'json',
        model: 'gpt-4',
        maxTokens: 4096,
        temperature: 0.7,
        topP: 0.9,
        stop: ['\n\n', '---'],
        retry: {
          maxRetries: 5,
          initialDelay: 1000,
          maxDelay: 30000,
          multiplier: 2,
        },
        circuitBreaker: {
          failureThreshold: 10,
          recoveryTimeout: 120000,
        },
      },
    });

    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.ok(config.loopConfig);
    assert.equal(config.loopConfig.systemPrompt, 'You are a helpful assistant.');
    assert.equal(config.loopConfig.maxToolCalls, 30);
    assert.equal(config.loopConfig.responseFormat, 'json');
    assert.equal(config.loopConfig.model, 'gpt-4');
    assert.equal(config.loopConfig.maxTokens, 4096);
    assert.equal(config.loopConfig.temperature, 0.7);
    assert.equal(config.loopConfig.topP, 0.9);
    assert.deepStrictEqual(config.loopConfig.stop, ['\n\n', '---']);
    assert.equal(config.loopConfig.retry?.maxRetries, 5);
    assert.equal(config.loopConfig.retry?.initialDelay, 1000);
    assert.equal(config.loopConfig.retry?.maxDelay, 30000);
    assert.equal(config.loopConfig.retry?.multiplier, 2);
    assert.equal(config.loopConfig.circuitBreaker?.failureThreshold, 10);
    assert.equal(config.loopConfig.circuitBreaker?.recoveryTimeout, 120000);

    cleanupDir(dir);
  });

  test('loads fallback providers from file', () => {
    const dir = createTempDir();
    createConfigFile(dir, '.synthtek-config.json', {
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
        strategy: 'sequential',
      },
    });

    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.ok(config.fallbackProviders);
    assert.equal(config.fallbackProviders.providers.length, 2);
    assert.equal(config.fallbackProviders.providers[0].provider, 'openai');
    assert.equal(config.fallbackProviders.providers[1].provider, 'anthropic');
    assert.equal(config.fallbackProviders.log, true);
    assert.equal(config.fallbackProviders.strategy, 'sequential');

    cleanupDir(dir);
  });

  test('loads plugins from file', () => {
    const dir = createTempDir();
    createConfigFile(dir, '.synthtek-config.json', {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
      plugins: [
        { name: 'filesystem', enabled: true, config: { root: '/tmp' } },
        { name: 'web-search', enabled: false },
      ],
    });

    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.ok(config.plugins);
    assert.equal(config.plugins.length, 2);
    assert.equal(config.plugins[0].name, 'filesystem');
    assert.equal(config.plugins[0].enabled, true);
    assert.deepStrictEqual(config.plugins[0].config, { root: '/tmp' });
    assert.equal(config.plugins[1].name, 'web-search');
    assert.equal(config.plugins[1].enabled, false);

    cleanupDir(dir);
  });

  test('ignores invalid JSON config file', () => {
    const dir = createTempDir();
    const path = join(dir, '.synthtek-config.json');
    writeFileSync(path, '{ invalid json }', 'utf-8');

    const loader = new ConfigLoader();
    const config = loader.load(dir);

    assert.ok(!loader.hasConfigFile()); // Invalid JSON is treated as not found
    assert.equal(config.name, 'synthtek'); // Falls back to defaults

    cleanupDir(dir);
  });

  test('returns config copy (immutable)', () => {
    const dir = createTempDir();
    createConfigFile(dir, '.synthtek-config.json', {
      name: 'test-agent',
      version: '1.0.0',
      workspace: '/tmp/test',
      logLevel: 'info',
      maxExecTimeout: 60,
      maxExecRetries: 3,
      spawnTimeout: 300,
    });

    const loader = new ConfigLoader();
    loader.load(dir);

    const config1 = loader.getConfig();
    config1.name = 'modified';
    config1.logLevel = 'debug';

    const config2 = loader.getConfig();
    assert.equal(config2.name, 'test-agent');
    assert.equal(config2.logLevel, 'info');

    cleanupDir(dir);
  });

  test('supports all config file name variants', () => {
    const variants = [
      '.synthtek-config.json',
      'synthtek.config.json',
    ];

    for (const variant of variants) {
      const dir = createTempDir();
      createConfigFile(dir, variant, {
        name: 'variant-test',
        version: '1.0.0',
        workspace: '/tmp/test',
        logLevel: 'info',
        maxExecTimeout: 60,
        maxExecRetries: 3,
        spawnTimeout: 300,
      });

      const loader = new ConfigLoader();
      const config = loader.load(dir);

      assert.equal(config.name, 'variant-test', `Should find ${variant}`);
      assert.ok(loader.hasConfigFile(), `Should detect ${variant}`);

      cleanupDir(dir);
    }
  });
});
