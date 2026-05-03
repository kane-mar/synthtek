/**
 * OpenRouter Provider Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterProvider } from '../../src/providers/openrouter/provider.js';
import { ProviderConfig } from '../../src/providers/types.js';

const TEST_CONFIG: ProviderConfig = {
  provider: 'openrouter',
  apiKey: 'test-key',
  model: 'openai/gpt-4o',
};

test('OpenRouterProvider has correct name', () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);
  assert.equal(provider.name, 'openrouter');
});

test('OpenRouterProvider returns config', () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);
  const config = provider.getConfig();

  assert.equal(config.provider, 'openrouter');
  assert.equal(config.apiKey, 'test-key');
  assert.equal(config.model, 'openai/gpt-4o');
  assert.equal(config.baseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(config.timeout, 60_000);
  assert.equal(config.retries, 3);
  assert.equal(config.retryDelay, 1000);
});

test('OpenRouterProvider uses default baseUrl', () => {
  const provider = new OpenRouterProvider({
    provider: 'openrouter',
    apiKey: 'test-key',
  });
  const config = provider.getConfig();
  assert.equal(config.baseUrl, 'https://openrouter.ai/api/v1');
});

test('OpenRouterProvider uses custom baseUrl', () => {
  const provider = new OpenRouterProvider({
    provider: 'openrouter',
    apiKey: 'test-key',
    baseUrl: 'https://custom.openrouter.ai/v1',
  });
  const config = provider.getConfig();
  assert.equal(config.baseUrl, 'https://custom.openrouter.ai/v1');
});

test('OpenRouterProvider healthCheck returns boolean', async () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);
  const result = await provider.healthCheck();
  assert.equal(typeof result, 'boolean');
});

test('OpenRouterProvider chat returns response with required fields', async () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-123',
        model: 'openai/gpt-4o',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello!',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        provider: { name: 'OpenAI' },
      }),
    }) as unknown as Response;

  try {
    const response = await provider.chat({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.equal(response.content, 'Hello!');
    assert.equal(response.model, 'openai/gpt-4o');
    assert.equal(response.inputTokens, 10);
    assert.equal(response.outputTokens, 5);
    assert.equal(response.totalTokens, 15);
    assert.ok(typeof response.cost === 'number');
    assert.equal(response.finishReason, 'stop');
    assert.equal(response.id, 'chatcmpl-123');
  } finally {
    global.fetch = originalFetch;
  }
});

test('OpenRouterProvider chat handles tool calls', async () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-456',
        model: 'openai/gpt-4o',
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: '{"query": "search"}',
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      }),
    }) as unknown as Response;

  try {
    const response = await provider.chat({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: 'Search for something' }],
    });

    assert.ok(response.toolCalls);
    assert.equal(response.toolCalls?.length, 1);
    assert.equal(response.toolCalls?.[0].id, 'call_123');
    assert.equal(response.toolCalls?.[0].name, '{"query": "search"}');
  } finally {
    global.fetch = originalFetch;
  }
});

test('OpenRouterProvider chatStream yields chunks', async () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);

  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n',
    'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}\n',
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
      model: 'openai/gpt-4o',
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

test('OpenRouterProvider listModels returns array', async () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', name: 'GPT-4o' },
          { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
          { id: 'google/gemini-pro', name: 'Gemini Pro' },
        ],
      }),
    }) as unknown as Response;

  try {
    const models = await provider.listModels();
    assert.ok(Array.isArray(models));
    assert.equal(models.length, 3);
    assert.ok(models.includes('openai/gpt-4o'));
    assert.ok(models.includes('anthropic/claude-3-opus'));
    assert.ok(models.includes('google/gemini-pro'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('OpenRouterProvider handles API errors', async () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);

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
          model: 'openai/gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      /OpenRouter API error \(401\)/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('OpenRouterProvider respects system prompt', async () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);

  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('chat/completions')) {
      capturedBody = JSON.parse((init?.body as string) || '{}');
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-789',
        model: 'openai/gpt-4o',
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
      model: 'openai/gpt-4o',
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

test('OpenRouterProvider includes referer and title headers', async () => {
  const provider = new OpenRouterProvider(TEST_CONFIG);

  let capturedHeaders: Record<string, string> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('chat/completions')) {
      capturedHeaders = init?.headers as Record<string, string> || {};
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-999',
        model: 'openai/gpt-4o',
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
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.ok(capturedHeaders);
    assert.ok('HTTP-Referer' in capturedHeaders);
    assert.ok('X-Title' in capturedHeaders);
    assert.ok((capturedHeaders['Authorization'] as string)?.startsWith('Bearer'));
  } finally {
    global.fetch = originalFetch;
  }
});
