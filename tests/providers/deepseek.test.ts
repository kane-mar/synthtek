/**
 * DeepSeek Provider Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekProvider } from '../../src/providers/deepseek/provider.js';
import { ProviderConfig } from '../../src/providers/types.js';

const TEST_CONFIG: ProviderConfig = {
  provider: 'deepseek',
  apiKey: 'test-key',
  model: 'deepseek-chat',
};

test('DeepSeekProvider has correct name', () => {
  const provider = new DeepSeekProvider(TEST_CONFIG);
  assert.equal(provider.name, 'deepseek');
});

test('DeepSeekProvider returns config', () => {
  const provider = new DeepSeekProvider(TEST_CONFIG);
  const config = provider.getConfig();

  assert.equal(config.provider, 'deepseek');
  assert.equal(config.apiKey, 'test-key');
  assert.equal(config.model, 'deepseek-chat');
  assert.equal(config.baseUrl, 'https://api.deepseek.com/v1');
  assert.equal(config.timeout, 60_000);
  assert.equal(config.retries, 3);
  assert.equal(config.retryDelay, 1000);
});

test('DeepSeekProvider uses default baseUrl', () => {
  const provider = new DeepSeekProvider({
    provider: 'deepseek',
    apiKey: 'test-key',
  });
  const config = provider.getConfig();
  assert.equal(config.baseUrl, 'https://api.deepseek.com/v1');
});

test('DeepSeekProvider uses custom baseUrl', () => {
  const provider = new DeepSeekProvider({
    provider: 'deepseek',
    apiKey: 'test-key',
    baseUrl: 'https://custom.deepseek.com/v1',
  });
  const config = provider.getConfig();
  assert.equal(config.baseUrl, 'https://custom.deepseek.com/v1');
});

test('DeepSeekProvider healthCheck returns boolean', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as Response;

  try {
    const provider = new DeepSeekProvider(TEST_CONFIG);
    const result = await provider.healthCheck();
    assert.equal(typeof result, 'boolean');
  } finally {
    global.fetch = originalFetch;
  }
});

test('DeepSeekProvider chat returns response with required fields', async () => {
  const provider = new DeepSeekProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-ds-123',
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello from DeepSeek!',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
        },
      }),
    }) as unknown as Response;

  try {
    const response = await provider.chat({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.equal(response.content, 'Hello from DeepSeek!');
    assert.equal(response.model, 'deepseek-chat');
    assert.equal(response.inputTokens, 10);
    assert.equal(response.outputTokens, 8);
    assert.equal(response.totalTokens, 18);
    assert.ok(typeof response.cost === 'number');
    assert.equal(response.finishReason, 'stop');
    assert.equal(response.id, 'chatcmpl-ds-123');
  } finally {
    global.fetch = originalFetch;
  }
});

test('DeepSeekProvider chatStream yields chunks', async () => {
  const provider = new DeepSeekProvider(TEST_CONFIG);

  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n',
    'data: {"choices":[{"delta":{"content":" from"},"finish_reason":null}]}\n',
    'data: {"choices":[{"delta":{"content":"DeepSeek"},"finish_reason":null}]}\n',
    'data: [DONE]\n',
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
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      received.push(chunk.delta);
    }

    assert.equal(received.length, 4);
    assert.equal(received[0], 'Hello');
    assert.equal(received[1], ' from');
    assert.equal(received[2], 'DeepSeek');
    assert.equal(received[3], '');
  } finally {
    global.fetch = originalFetch;
  }
});

test('DeepSeekProvider listModels returns array', async () => {
  const provider = new DeepSeekProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        data: [
          { id: 'deepseek-chat' },
          { id: 'deepseek-reasoner' },
        ],
      }),
    }) as unknown as Response;

  try {
    const models = await provider.listModels();
    assert.ok(Array.isArray(models));
    assert.equal(models.length, 2);
    assert.ok(models.includes('deepseek-chat'));
    assert.ok(models.includes('deepseek-reasoner'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('DeepSeekProvider handles API errors', async () => {
  const provider = new DeepSeekProvider(TEST_CONFIG);

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
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      /DeepSeek API error \(401\)/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('DeepSeekProvider respects system prompt', async () => {
  const provider = new DeepSeekProvider(TEST_CONFIG);

  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('chat/completions')) {
      capturedBody = JSON.parse((init?.body as string) || '{}');
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-ds-789',
        model: 'deepseek-chat',
        choices: [
          {
            message: { role: 'assistant', content: 'Response', tool_calls: undefined },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }),
    }) as unknown as Response;
  };

  try {
    await provider.chat({
      model: 'deepseek-chat',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.ok(capturedBody);
    const msgs = (capturedBody as Record<string, unknown>).messages as Array<{ role: string; content: string }>;
    assert.ok(Array.isArray(msgs));
    assert.equal(msgs[0].role, 'system');
    assert.equal(msgs[0].content, 'You are a helpful assistant.');
  } finally {
    global.fetch = originalFetch;
  }
});
