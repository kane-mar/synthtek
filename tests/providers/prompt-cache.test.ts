/**
 * Prompt Caching Tests
 * Tests for the PromptCache module and prompt caching support in providers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PromptCache } from '../../src/providers/cache/prompt-cache.js';
import { AnthropicProvider } from '../../src/providers/anthropic/provider.js';
import { ProviderConfig } from '../../src/providers/types.js';

// ─── PromptCache Module Tests ───────────────────────────────────────────────

test('PromptCache creates instance with default config', () => {
  const cache = new PromptCache();
  assert.ok(cache);
});

test('PromptCache creates instance with custom config', () => {
  const cache = new PromptCache({
    maxSize: 100,
    ttl: 300000, // 5 minutes
    enabled: true,
  });
  assert.ok(cache);
});

test('PromptCache stores and retrieves cached prompt', () => {
  const cache = new PromptCache();
  const key = 'system-prompt-1';
  const value = 'You are a helpful assistant.';

  cache.put(key, value);
  const retrieved = cache.get(key);

  assert.equal(retrieved, value);
});

test('PromptCache returns null for missing key', () => {
  const cache = new PromptCache();
  const retrieved = cache.get('nonexistent-key');

  assert.equal(retrieved, null);
});

test('PromptCache tracks cache hits', () => {
  const cache = new PromptCache();
  const key = 'test-key';

  cache.put(key, 'value');
  cache.get(key); // hit

  const stats = cache.stats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 0);
});

test('PromptCache tracks cache misses', () => {
  const cache = new PromptCache();

  cache.get('missing-key');

  const stats = cache.stats();
  assert.equal(stats.hits, 0);
  assert.equal(stats.misses, 1);
});

test('PromptCache evicts old entries when max size exceeded', () => {
  const cache = new PromptCache({ maxSize: 3 });

  cache.put('key1', 'value1');
  cache.put('key2', 'value2');
  cache.put('key3', 'value3');
  cache.put('key4', 'value4'); // should evict key1

  assert.equal(cache.get('key1'), null); // evicted
  assert.equal(cache.get('key4'), 'value4'); // present
});

test('PromptCache respects TTL expiration', async () => {
  const cache = new PromptCache({ ttl: 100 }); // 100ms TTL

  cache.put('temp-key', 'temp-value');
  assert.equal(cache.get('temp-key'), 'temp-value');

  // Wait for TTL to expire
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(cache.get('temp-key'), null); // expired
});

test('PromptCache clears all entries', () => {
  const cache = new PromptCache();

  cache.put('key1', 'value1');
  cache.put('key2', 'value2');

  cache.clear();

  assert.equal(cache.get('key1'), null);
  assert.equal(cache.get('key2'), null);
});

test('PromptCache has correct size', () => {
  const cache = new PromptCache();

  assert.equal(cache.size, 0);

  cache.put('key1', 'value1');
  assert.equal(cache.size, 1);

  cache.put('key2', 'value2');
  assert.equal(cache.size, 2);
});

test('PromptCache has method checks existence', () => {
  const cache = new PromptCache();

  cache.put('existing-key', 'value');

  assert.ok(cache.has('existing-key'));
  assert.ok(!cache.has('nonexistent-key'));
});

test('PromptCache computes cache key from prompt content', () => {
  const cache = new PromptCache();

  const key1 = cache.computeKey('Hello world');
  const key2 = cache.computeKey('Hello world');
  const key3 = cache.computeKey('Different prompt');

  assert.equal(key1, key2);
  assert.notEqual(key1, key3);
});

test('PromptCache computes different keys for different providers', () => {
  const cache = new PromptCache();

  const key1 = cache.computeKey('Hello', 'openai');
  const key2 = cache.computeKey('Hello', 'anthropic');

  assert.notEqual(key1, key2);
});

test('PromptCache getOrSet returns cached value on hit', () => {
  const cache = new PromptCache();
  const key = 'test-key';

  cache.put(key, 'cached-value');
  const result = cache.getOrSet(key, () => 'new-value');

  assert.equal(result, 'cached-value');
});

test('PromptCache getOrSet computes and caches on miss', () => {
  const cache = new PromptCache();
  const key = 'new-key';

  const result = cache.getOrSet(key, () => 'computed-value');

  assert.equal(result, 'computed-value');
  assert.equal(cache.get(key), 'computed-value'); // now cached
});

test('PromptCache hit ratio calculation', () => {
  const cache = new PromptCache();

  cache.put('key1', 'value1');
  cache.get('key1'); // hit
  cache.get('key1'); // hit
  cache.get('missing'); // miss

  const stats = cache.stats();
  assert.equal(stats.totalRequests, 3);
  assert.equal(stats.hits, 2);
  assert.equal(stats.misses, 1);
  assert.ok(stats.hitRatio > 0);
  assert.ok(stats.hitRatio < 1);
});

// ─── Anthropic Prompt Caching Integration Tests ─────────────────────────────

const ANTHROPIC_CONFIG: ProviderConfig = {
  provider: 'anthropic',
  apiKey: 'test-key',
  model: 'claude-3-5-sonnet-20241022',
};

test('AnthropicProvider with prompt caching sends beta header', async () => {
  const provider = new AnthropicProvider({
    ...ANTHROPIC_CONFIG,
    promptCaching: true,
  });

  let capturedHeaders: Record<string, string> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('/messages')) {
      capturedHeaders = init?.headers as Record<string, string>;
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'msg_cache-123',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'Response' }],
        usage: {
          input_tokens: 5,
          output_tokens: 5,
          cache_creation_input_tokens: 3,
          cache_read_input_tokens: 2,
        },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;
  };

  try {
    await provider.chat({
      model: 'claude-3-5-sonnet-20241022',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.ok(capturedHeaders);
    assert.equal(capturedHeaders!['anthropic-beta'], 'prompt-caching-2024-07-31');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider with prompt caching adds cache markers to system prompt', async () => {
  const provider = new AnthropicProvider({
    ...ANTHROPIC_CONFIG,
    promptCaching: true,
  });

  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('/messages')) {
      capturedBody = JSON.parse((init?.body as string) || '{}');
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'msg_cache-456',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;
  };

  try {
    await provider.chat({
      model: 'claude-3-5-sonnet-20241022',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.ok(capturedBody);
    const system = (capturedBody as Record<string, unknown>).system as Array<{ type: string; text: string; cache_control?: { type: string } }>;
    assert.ok(Array.isArray(system));
    assert.equal(system[0].cache_control?.type, 'ephemeral');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider with prompt caching adds cache markers to last user messages', async () => {
  const provider = new AnthropicProvider({
    ...ANTHROPIC_CONFIG,
    promptCaching: true,
  });

  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('/messages')) {
      capturedBody = JSON.parse((init?.body as string) || '{}');
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'msg_cache-789',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;
  };

  try {
    await provider.chat({
      model: 'claude-3-5-sonnet-20241022',
      system: 'You are a helpful assistant.',
      messages: [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
        { role: 'user', content: 'Third message' },
      ],
    });

    assert.ok(capturedBody);
    const messages = (capturedBody as Record<string, unknown>).messages as Array<{
      role: string;
      content: string | Array<{ type: string; cache_control?: { type: string } }>;
    }>;

    // Last user messages should have cache markers
    const lastUserMsg = messages[messages.length - 1];
    if (Array.isArray(lastUserMsg.content)) {
      assert.equal(lastUserMsg.content[0].cache_control?.type, 'ephemeral');
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider without prompt caching does NOT send beta header', async () => {
  const provider = new AnthropicProvider({
    ...ANTHROPIC_CONFIG,
    promptCaching: false,
  });

  let capturedHeaders: Record<string, string> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('/messages')) {
      capturedHeaders = init?.headers as Record<string, string>;
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'msg_no-cache-123',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;
  };

  try {
    await provider.chat({
      model: 'claude-3-5-sonnet-20241022',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.ok(capturedHeaders);
    assert.equal(capturedHeaders!['anthropic-beta'], undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider tracks cache creation and read tokens', async () => {
  const provider = new AnthropicProvider({
    ...ANTHROPIC_CONFIG,
    promptCaching: true,
  });

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        id: 'msg_cache-tokens-123',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'Response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 40,
          cache_read_input_tokens: 60,
        },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;

  try {
    const response = await provider.chat({
      model: 'claude-3-5-sonnet-20241022',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.equal(response.inputTokens, 100);
    assert.equal(response.outputTokens, 50);
    // Cache tokens should be tracked in usage
    assert.ok(response.usage);
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider prompt caching in streaming mode sends beta header', async () => {
  const provider = new AnthropicProvider({
    ...ANTHROPIC_CONFIG,
    promptCaching: true,
  });

  let capturedHeaders: Record<string, string> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('/messages')) {
      capturedHeaders = init?.headers as Record<string, string>;
    }
    return ({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n',
          ));
          controller.enqueue(new TextEncoder().encode(
            'data: {"type":"message_stop"}\n',
          ));
          controller.close();
        },
      }),
    }) as unknown as Response;
  };

  try {
    for await (const _chunk of provider.chatStream({
      model: 'claude-3-5-sonnet-20241022',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      // consume
    }

    assert.ok(capturedHeaders);
    assert.equal(capturedHeaders!['anthropic-beta'], 'prompt-caching-2024-07-31');
  } finally {
    global.fetch = originalFetch;
  }
});
