/**
 * Anthropic Provider Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicProvider } from '../../src/providers/anthropic/provider.js';
import { ProviderConfig } from '../../src/providers/types.js';

const TEST_CONFIG: ProviderConfig = {
  provider: 'anthropic',
  apiKey: 'test-key',
  model: 'claude-3-opus-20240229',
};

test('AnthropicProvider has correct name', () => {
  const provider = new AnthropicProvider(TEST_CONFIG);
  assert.equal(provider.name, 'anthropic');
});

test('AnthropicProvider returns config', () => {
  const provider = new AnthropicProvider(TEST_CONFIG);
  const config = provider.getConfig();

  assert.equal(config.provider, 'anthropic');
  assert.equal(config.apiKey, 'test-key');
  assert.equal(config.model, 'claude-3-opus-20240229');
  assert.equal(config.baseUrl, 'https://api.anthropic.com/v1');
  assert.equal(config.timeout, 60_000);
  assert.equal(config.retries, 3);
  assert.equal(config.retryDelay, 1000);
});

test('AnthropicProvider uses default baseUrl', () => {
  const provider = new AnthropicProvider({
    provider: 'anthropic',
    apiKey: 'test-key',
  });
  const config = provider.getConfig();
  assert.equal(config.baseUrl, 'https://api.anthropic.com/v1');
});

test('AnthropicProvider uses custom baseUrl', () => {
  const provider = new AnthropicProvider({
    provider: 'anthropic',
    apiKey: 'test-key',
    baseUrl: 'https://custom.anthropic.com/v1',
  });
  const config = provider.getConfig();
  assert.equal(config.baseUrl, 'https://custom.anthropic.com/v1');
});

test('AnthropicProvider healthCheck returns boolean', async () => {
  const provider = new AnthropicProvider(TEST_CONFIG);
  const result = await provider.healthCheck();
  assert.equal(typeof result, 'boolean');
});

test('AnthropicProvider chat returns response with required fields', async () => {
  const provider = new AnthropicProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        id: 'msg_123',
        model: 'claude-3-opus-20240229',
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;

  try {
    const response = await provider.chat({
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.equal(response.content, 'Hello!');
    assert.equal(response.model, 'claude-3-opus-20240229');
    assert.equal(response.inputTokens, 10);
    assert.equal(response.outputTokens, 5);
    assert.ok(typeof response.cost === 'number');
    assert.equal(response.finishReason, 'end_turn');
    assert.equal(response.id, 'msg_123');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider chat handles multiple content blocks', async () => {
  const provider = new AnthropicProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        id: 'msg_456',
        model: 'claude-3-opus-20240229',
        content: [
          { type: 'text', text: 'First block' },
          { type: 'text', text: 'Second block' },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;

  try {
    const response = await provider.chat({
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.equal(response.content, 'First blockSecond block');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider chatStream yields chunks', async () => {
  const provider = new AnthropicProvider(TEST_CONFIG);

  const chunks = [
    'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n',
    'data: {"type":"content_block_delta","delta":{"text":" world"}}\n',
    'data: {"type":"message_stop"}\n',
  ];

  const readableStream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      body: readableStream,
    }) as unknown as Response;

  try {
    const received: string[] = [];
    for await (const chunk of provider.chatStream({
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      received.push(chunk.delta);
    }

    assert.equal(received.length, 3);
    assert.equal(received[0], 'Hello');
    assert.equal(received[1], ' world');
    assert.equal(received[2], '');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider listModels returns known models', async () => {
  const provider = new AnthropicProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        data: [
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
          { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
        ],
      }),
    }) as unknown as Response;

  try {
    const models = await provider.listModels();
    assert.ok(Array.isArray(models));
    assert.ok(models.includes('claude-3-opus-20240229'));
    assert.ok(models.includes('claude-3-sonnet-20240229'));
    assert.ok(models.includes('claude-3-haiku-20240307'));
    assert.ok(models.includes('claude-3-5-sonnet-20241022'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider handles API errors', async () => {
  const provider = new AnthropicProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: false,
      status: 401,
      text: async () => 'Invalid API key',
    }) as unknown as Response;

  try {
    await assert.rejects(
      () =>
        provider.chat({
          model: 'claude-3-opus-20240229',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      /Anthropic API error \(401\)/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider respects system prompt', async () => {
  const provider = new AnthropicProvider(TEST_CONFIG);

  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('/messages')) {
      capturedBody = JSON.parse((init?.body as string) || '{}');
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'msg_789',
        model: 'claude-3-opus-20240229',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;
  };

  try {
    await provider.chat({
      model: 'claude-3-opus-20240229',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.ok(capturedBody);
    assert.equal((capturedBody as Record<string, unknown>).system, 'You are a helpful assistant.');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider converts tool definitions correctly', async () => {
  const provider = new AnthropicProvider(TEST_CONFIG);

  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('/messages')) {
      capturedBody = JSON.parse((init?.body as string) || '{}');
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'msg_999',
        model: 'claude-3-opus-20240229',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn',
      }),
    }) as unknown as Response;
  };

  try {
    await provider.chat({
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Search' }],
      tools: [
        {
          name: 'search',
          description: 'Search the web',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
          },
        },
      ],
    });

    assert.ok(capturedBody);
    const tools = (capturedBody as Record<string, unknown>).tools as Array<{ name: string; description: string; input_schema: unknown }>;
    assert.ok(Array.isArray(tools));
    assert.equal(tools[0].name, 'search');
    assert.equal(tools[0].description, 'Search the web');
    assert.ok(tools[0].input_schema);
  } finally {
    global.fetch = originalFetch;
  }
});
