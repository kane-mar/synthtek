/**
 * Tests for ContextManager (memory-efficient context management)
 */

import { describe, it, beforeEach } from 'node:test';
import { equal, ok } from 'node:assert';
import { ContextManager } from '../../src/performance/context-manager.js';
import type { ContextManagerConfig } from '../../src/performance/types.js';

const defaultConfig: ContextManagerConfig = {
  maxTokens: 4000,
  maxMessages: 100,
  compactionThreshold: 3500,
  minKeptMessages: 5,
};

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager(defaultConfig);
  });

  describe('addMessage', () => {
    it('adds messages to context', () => {
      manager.addMessage({
        role: 'user',
        content: 'Hello',
        tokens: 3,
        timestamp: Date.now(),
      });

      const snapshot = manager.snapshot();
      equal(snapshot.messageCount, 1);
    });

    it('tracks token count', () => {
      manager.addMessage({ role: 'user', content: 'msg1', tokens: 10, timestamp: Date.now() });
      manager.addMessage({ role: 'assistant', content: 'msg2', tokens: 20, timestamp: Date.now() });

      const snapshot = manager.snapshot();
      equal(snapshot.totalTokens, 30);
    });
  });

  describe('compaction', () => {
    it('compacts when tokens exceed threshold', () => {
      // Add many messages to exceed threshold
      for (let i = 0; i < 50; i++) {
        manager.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          tokens: 100,
          timestamp: Date.now() + i,
        });
      }

      const before = manager.snapshot();
      ok(before.totalTokens > defaultConfig.compactionThreshold, 'tokens exceed threshold');

      manager.compact();

      const after = manager.snapshot();
      ok(after.totalTokens < before.totalTokens, 'tokens reduced after compaction');
      ok(after.messageCount >= defaultConfig.minKeptMessages, 'min messages kept');
      ok(after.compacted, 'compaction flag set');
    });

    it('preserves recent messages', () => {
      const recentContent = 'Important recent message';
      for (let i = 0; i < 50; i++) {
        manager.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Old message ${i}`,
          tokens: 100,
          timestamp: Date.now() + i,
        });
      }
      manager.addMessage({
        role: 'user',
        content: recentContent,
        tokens: 10,
        timestamp: Date.now() + 100,
      });

      manager.compact();

      const snapshot = manager.snapshot();
      const hasRecent = snapshot.messages.some((m) => m.content === recentContent);
      ok(hasRecent, 'recent message preserved');
    });
  });

  describe('stats', () => {
    it('returns accurate stats', () => {
      manager.addMessage({ role: 'user', content: 'test', tokens: 50, timestamp: Date.now() });

      const stats = manager.stats();
      equal(stats.totalTokens, 50);
      equal(stats.messageCount, 1);
      equal(stats.maxTokens, defaultConfig.maxTokens);
      ok(stats.utilization > 0, 'utilization calculated');
    });
  });

  describe('clear', () => {
    it('clears all messages', () => {
      manager.addMessage({ role: 'user', content: 'test', tokens: 10, timestamp: Date.now() });
      manager.clear();

      const snapshot = manager.snapshot();
      equal(snapshot.messageCount, 0);
      equal(snapshot.totalTokens, 0);
    });
  });

  describe('maxMessages limit', () => {
    it('prevents adding beyond maxMessages', () => {
      const smallManager = new ContextManager({ ...defaultConfig, maxMessages: 3 });

      smallManager.addMessage({ role: 'system', content: 'sys', tokens: 10, timestamp: Date.now() });
      smallManager.addMessage({ role: 'user', content: 'u1', tokens: 10, timestamp: Date.now() });
      smallManager.addMessage({ role: 'assistant', content: 'a1', tokens: 10, timestamp: Date.now() });

      const snapshot = smallManager.snapshot();
      equal(snapshot.messageCount, 3);
    });
  });
});
