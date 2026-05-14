/**
 * Provider Registry Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRegistry,
  resetRegistry,
  registerDefaultProviders,
  ProviderRegistry,
  OpenAIProvider,
} from '../../src/providers/index.js';
import type { ProviderFactory, ProviderConfig } from '../../src/providers/types.js';

// Simple inline factory for testing registration
const openaiFactory: ProviderFactory = {
  create: (config: ProviderConfig) => new OpenAIProvider(config),
};

test('ProviderRegistry creates a new instance', () => {
  const registry = new ProviderRegistry();
  assert.equal(registry.listTypes().length, 0);
});

test('ProviderRegistry registers and retrieves factories', () => {
  const registry = new ProviderRegistry();

  assert.equal(registry.listTypes().length, 0);
  registry.register('openai', openaiFactory);
  assert.equal(registry.listTypes().length, 1);
  assert.ok(registry.has('openai'));
});

test('ProviderRegistry throws on duplicate registration', () => {
  const registry = new ProviderRegistry();

  registry.register('openai', openaiFactory);
  assert.throws(
    () => registry.register('openai', openaiFactory),
    /already registered/,
  );
});

test('ProviderRegistry throws on unknown type', () => {
  const registry = new ProviderRegistry();
  assert.throws(
    () => registry.create('openai' as any, { provider: 'openai', apiKey: 'test' }),
    /Unknown provider type/,
  );
});

test('getRegistry returns singleton', () => {
  resetRegistry();
  const r1 = getRegistry();
  const r2 = getRegistry();
  assert.equal(r1, r2);
});

test('registerDefaultProviders registers all three providers', () => {
  resetRegistry();
  registerDefaultProviders();

  const registry = getRegistry();
  const types = registry.listTypes();

  assert.ok(types.includes('openai'));
  assert.ok(types.includes('anthropic'));
  assert.ok(types.includes('openrouter'));
});

test('ProviderRegistry creates provider instances', () => {
  resetRegistry();
  registerDefaultProviders();

  const registry = getRegistry();
  const provider = registry.create('openai', {
    provider: 'openai',
    apiKey: 'test-key',
    model: 'gpt-4',
  });

  assert.equal(provider.name, 'openai');
});
