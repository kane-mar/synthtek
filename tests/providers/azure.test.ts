/**
 * Azure OpenAI Provider Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { AzureOpenAIProvider } from '../../src/providers/azure/provider.js';
import { ProviderConfig } from '../../src/providers/types.js';

const TEST_CONFIG: ProviderConfig = {
  provider: 'azure',
  apiKey: 'test-key',
  model: 'gpt-4o',
};

test('AzureOpenAIProvider has correct name', () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);
  assert.equal(provider.name, 'azure');
});

test('AzureOpenAIProvider returns config', () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);
  const config = provider.getConfig();

  assert.equal(config.provider, 'azure');
  assert.equal(config.apiKey, 'test-key');
  assert.equal(config.model, 'gpt-4o');
  assert.equal(config.baseUrl, 'https://openai.azure.com');
  assert.equal(config.timeout, 60_000);
  assert.equal(config.retries, 3);
  assert.equal(config.retryDelay, 1000);
});

test('AzureOpenAIProvider uses default baseUrl', () => {
  const provider = new AzureOpenAIProvider({
    provider: 'azure',
    apiKey: 'test-key',
  });
  const config = provider.getConfig();
  assert.equal(config.baseUrl, 'https://openai.azure.com');
});

test('AzureOpenAIProvider uses custom baseUrl', () => {
  const provider = new AzureOpenAIProvider({
    provider: 'azure',
    apiKey: 'test-key',
    baseUrl: 'https://my-resource.openai.azure.com',
  });
  const config = provider.getConfig();
  assert.equal(config.baseUrl, 'https://my-resource.openai.azure.com');
});

test('AzureOpenAIProvider uses deployment from config', async () => {
  const provider = new AzureOpenAIProvider({
    provider: 'azure',
    apiKey: 'test-key',
    model: 'gpt-4o',
    deployment: 'my-gpt4o-deployment',
  } as ProviderConfig);

  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL) => {
    if (typeof input === 'string' && input.includes('chat/completions')) {
      assert.ok(input.includes('my-gpt4o-deployment'));
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-azure-123',
        model: 'gpt-4o',
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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('AzureOpenAIProvider healthCheck returns boolean', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as Response;

  try {
    const provider = new AzureOpenAIProvider(TEST_CONFIG);
    const result = await provider.healthCheck();
    assert.equal(typeof result, 'boolean');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AzureOpenAIProvider chat returns response with required fields', async () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-azure-123',
        model: 'gpt-4o',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello from Azure!',
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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.equal(response.content, 'Hello from Azure!');
    assert.equal(response.model, 'gpt-4o');
    assert.equal(response.inputTokens, 10);
    assert.equal(response.outputTokens, 8);
    assert.equal(response.totalTokens, 18);
    assert.ok(typeof response.cost === 'number');
    assert.equal(response.finishReason, 'stop');
    assert.equal(response.id, 'chatcmpl-azure-123');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AzureOpenAIProvider chat handles tool calls', async () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-azure-456',
        model: 'gpt-4o',
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_azure_123',
                  type: 'function',
                  function: { name: 'search', arguments: '{"query":"test"}' },
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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Search for something' }],
    });

    assert.ok(response.toolCalls);
    assert.equal(response.toolCalls?.length, 1);
    assert.equal(response.toolCalls?.[0].id, 'call_azure_123');
    assert.equal(response.toolCalls?.[0].name, 'search');
    assert.deepStrictEqual(response.toolCalls?.[0].arguments, { query: 'test' });
  } finally {
    global.fetch = originalFetch;
  }
});

test('AzureOpenAIProvider chatStream yields chunks', async () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);

  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n',
    'data: {"choices":[{"delta":{"content":" from"},"finish_reason":null}]}\n',
    'data: {"choices":[{"delta":{"content":"Azure"},"finish_reason":null}]}\n',
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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      received.push(chunk.delta);
    }

    assert.equal(received.length, 4);
    assert.equal(received[0], 'Hello');
    assert.equal(received[1], ' from');
    assert.equal(received[2], 'Azure');
    assert.equal(received[3], '');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AzureOpenAIProvider listModels returns array', async () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);

  const originalFetch = global.fetch;
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        data: [
          { id: 'gpt-4o' },
          { id: 'gpt-4o-mini' },
          { id: 'gpt-35-turbo' },
        ],
      }),
    }) as unknown as Response;

  try {
    const models = await provider.listModels();
    assert.ok(Array.isArray(models));
    assert.equal(models.length, 3);
    assert.ok(models.includes('gpt-4o'));
    assert.ok(models.includes('gpt-4o-mini'));
    assert.ok(models.includes('gpt-35-turbo'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('AzureOpenAIProvider handles API errors', async () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);

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
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      /Azure OpenAI API error \(401\)/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('AzureOpenAIProvider respects system prompt', async () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);

  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('chat/completions')) {
      capturedBody = JSON.parse((init?.body as string) || '{}');
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-azure-789',
        model: 'gpt-4o',
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
      model: 'gpt-4o',
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

test('AzureOpenAIProvider uses api-key header instead of Authorization', async () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);

  let capturedHeaders: Record<string, string> | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.includes('chat/completions')) {
      capturedHeaders = init?.headers as Record<string, string> || {};
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-azure-headers',
        model: 'gpt-4o',
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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.ok(capturedHeaders);
    assert.equal(capturedHeaders['api-key'], 'test-key');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AzureOpenAIProvider includes api-version query parameter', async () => {
  const provider = new AzureOpenAIProvider(TEST_CONFIG);

  let capturedUrl: string | null = null;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL) => {
    if (typeof input === 'string' && input.includes('chat/completions')) {
      capturedUrl = input;
    }
    return ({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-azure-version',
        model: 'gpt-4o',
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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.ok(capturedUrl);
    assert.ok((capturedUrl as string).includes('api-version='));
  } finally {
    global.fetch = originalFetch;
  }
});
