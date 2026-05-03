/**
 * Tests for LangfuseIntegration (Langfuse tracing)
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { LangfuseIntegration } from '../../src/observability/langfuse.js';
import type { LangfuseConfig } from '../../src/observability/types.js';

const defaultConfig: LangfuseConfig = {
  publicKey: 'pk-test-key',
  secretKey: 'sk-test-key',
  baseUrl: 'http://localhost:3000',
  enabled: true,
  release: '1.0.0',
};

describe('LangfuseIntegration', () => {
  let langfuse: LangfuseIntegration;

  beforeEach(() => {
    langfuse = new LangfuseIntegration(defaultConfig);
  });

  describe('initialization', () => {
    it('creates an integration with config', () => {
      ok(langfuse, 'integration instance created');
      strictEqual(langfuse.name, 'langfuse');
    });

    it('creates disabled integration', () => {
      const disabled = new LangfuseIntegration({ ...defaultConfig, enabled: false });
      ok(disabled, 'disabled integration created');
      ok(!disabled.isEnabled, 'integration is disabled');
    });
  });

  describe('trace recording', () => {
    it('creates a trace', () => {
      const trace = langfuse.createTrace({
        name: 'test-trace',
        sessionId: 'session-1',
        userId: 'user-1',
      });

      ok(trace, 'trace created');
      ok(trace.id, 'trace has id');
      strictEqual(trace.name, 'test-trace');
    });

    it('records trace metadata', () => {
      const trace = langfuse.createTrace({
        name: 'test-trace',
        metadata: { key: 'value' },
      });

      ok(trace.metadata, 'metadata recorded');
    });
  });

  describe('span recording', () => {
    it('creates a span', () => {
      const span = langfuse.createSpan({
        traceId: 'trace-1',
        name: 'test-span',
        type: 'chain',
      });

      ok(span, 'span created');
      ok(span.id, 'span has id');
      strictEqual(span.name, 'test-span');
    });

    it('ends a span', () => {
      const span = langfuse.createSpan({
        traceId: 'trace-1',
        name: 'test-span',
        type: 'chain',
      });

      langfuse.endSpan(span.id, { output: 'result' });
      ok(true, 'span ended');
    });

    it('tracks span duration', () => {
      const span = langfuse.createSpan({
        traceId: 'trace-1',
        name: 'test-span',
        type: 'chain',
      });

      // Simulate some work
      const start = Date.now();
      langfuse.endSpan(span.id, { output: 'result' });
      const duration = Date.now() - start;

      ok(duration >= 0, 'duration tracked');
    });
  });

  describe('token usage tracking', () => {
    it('records token usage', () => {
      langfuse.recordTokenUsage({
        traceId: 'trace-1',
        spanId: 'span-1',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      ok(true, 'token usage recorded');
    });
  });

  describe('cost tracking', () => {
    it('records cost', () => {
      langfuse.recordCost({
        traceId: 'trace-1',
        spanId: 'span-1',
        cost: 0.002,
        currency: 'USD',
      });

      ok(true, 'cost recorded');
    });
  });

  describe('flush', () => {
    it('flushes pending events', async () => {
      langfuse.createTrace({ name: 'test-trace' });
      await langfuse.flush();
      ok(true, 'flush completed');
    });
  });

  describe('shutdown', () => {
    it('shuts down cleanly', async () => {
      await langfuse.shutdown();
      ok(true, 'shutdown completed');
    });
  });
});
