/**
 * Short-term Memory Tests
 */

import { describe, test, before } from 'node:test';
import assert from 'node:assert';
import { ShortTermMemoryImpl } from '../../src/memory/short-term.js';

describe('ShortTermMemoryImpl', () => {
  let memory: ShortTermMemoryImpl;

  before(() => {
    memory = new ShortTermMemoryImpl({
      maxMessages: 10,
      maxTokens: 1000,
      summarizationThreshold: 5,
    });
  });

  test('adds messages and retrieves them', () => {
    memory.reset();
    memory.addMessage({
      role: 'user',
      content: 'Hello',
      timestamp: new Date(),
    });
    memory.addMessage({
      role: 'assistant',
      content: 'Hi there!',
      timestamp: new Date(),
    });

    const messages = memory.getMessages();
    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, 'user');
    assert.equal(messages[1].role, 'assistant');
  });

  test('estimates token count automatically', () => {
    memory.reset();
    memory.addMessage({
      role: 'user',
      content: 'Hello world',
      timestamp: new Date(),
    });

    const messages = memory.getMessages();
    assert.ok(messages[0].tokenCount! > 0);
  });

  test('enforces max message limit', () => {
    memory.reset();

    for (let i = 0; i < 15; i++) {
      memory.addMessage({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
    }

    const messages = memory.getMessages();
    assert.ok(messages.length <= 10, `Expected <= 10 messages, got ${messages.length}`);
  });

  test('enforces max token limit', () => {
    const tokenLimitedMemory = new ShortTermMemoryImpl({
      maxMessages: 1000,
      maxTokens: 50,
      summarizationThreshold: 100,
    });

    // Add messages with known token counts
    tokenLimitedMemory.addMessage({
      role: 'user',
      content: 'A'.repeat(100), // ~25 tokens
      timestamp: new Date(),
      tokenCount: 25,
    });
    tokenLimitedMemory.addMessage({
      role: 'assistant',
      content: 'B'.repeat(100), // ~25 tokens
      timestamp: new Date(),
      tokenCount: 25,
    });
    tokenLimitedMemory.addMessage({
      role: 'user',
      content: 'C'.repeat(100), // ~25 tokens, should trigger eviction
      timestamp: new Date(),
      tokenCount: 25,
    });

    const stats = tokenLimitedMemory.getStats();
    assert.ok(stats.totalTokens <= 50 || stats.messageCount < 3);
  });

  test('getStats returns correct counts', () => {
    memory.reset();
    memory.addMessage({
      role: 'user',
      content: 'Test',
      timestamp: new Date(),
      tokenCount: 1,
    });

    const stats = memory.getStats();
    assert.equal(stats.messageCount, 1);
    assert.equal(stats.totalTokens, 1);
    assert.equal(stats.summaryCount, 0);
  });

  test('clear removes all messages', () => {
    memory.reset();
    memory.addMessage({
      role: 'user',
      content: 'Test',
      timestamp: new Date(),
    });
    memory.clear();

    assert.equal(memory.getMessages().length, 0);
  });

  test('reset clears messages and summaries', () => {
    memory.reset();
    assert.equal(memory.getMessages().length, 0);
    assert.equal(memory.getStats().summaryCount, 0);
  });

  test('getMessagesWithOptions limits results', () => {
    memory.reset();

    for (let i = 0; i < 5; i++) {
      memory.addMessage({
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
    }

    const limited = memory.getMessagesWithOptions({ limit: 2 });
    assert.equal(limited.length, 2);
  });

  test('summarize returns null below threshold', async () => {
    memory.reset();
    memory.addMessage({
      role: 'user',
      content: 'Hello',
      timestamp: new Date(),
    });

    const summary = await memory.summarize();
    assert.equal(summary, null);
  });

  test('summarize works above threshold', async () => {
    memory.reset();

    // Add enough messages to exceed threshold
    for (let i = 0; i < 6; i++) {
      memory.addMessage({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `This is message number ${i} with some content to make it longer`,
        timestamp: new Date(),
      });
    }

    const summary = await memory.summarize();
    assert.ok(summary !== null);
    assert.ok(summary!.summary.length > 0);
    assert.ok(summary!.messageCount > 0);
    // tokensSaved can be negative if summary is longer than original short messages
    assert.ok(typeof summary!.tokensSaved === 'number');
  });

  test('summarize reduces message count', async () => {
    memory.reset();

    for (let i = 0; i < 10; i++) {
      memory.addMessage({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
    }

    const beforeCount = memory.getMessages().length;
    await memory.summarize();
    const afterCount = memory.getMessages().length;

    assert.ok(afterCount < beforeCount);
  });

  test('getMessagesWithOptions includes summaries when enabled', async () => {
    memory.reset();

    for (let i = 0; i < 6; i++) {
      memory.addMessage({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
    }

    await memory.summarize();

    const withSummaries = memory.getMessagesWithOptions({ includeSummaries: true });
    const withoutSummaries = memory.getMessagesWithOptions({ includeSummaries: false });

    assert.ok(
      withSummaries.length > withoutSummaries.length,
      'Should include summary message when enabled',
    );
  });
});
