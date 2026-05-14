/**
 * Agent Error Handler Tests
 * Tests for the extracted error handling logic from AgentLoop.
 */

import { describe, it } from 'node:test';
import { equal, ok } from 'node:assert';
import { AgentErrorHandler } from '../../src/agent/error-handler.js';

describe('AgentErrorHandler', () => {
  let handler: AgentErrorHandler;

  describe('error classification', () => {
    it('classifies provider errors', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const error = new Error('API connection failed');
      equal(handler.classifyError(error, 'provider_error'), 'provider');
    });

    it('classifies tool errors', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const error = new Error('Tool execution failed');
      equal(handler.classifyError(error, 'tool_error'), 'tool');
    });

    it('classifies context errors', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const error = new Error('Context window exceeded');
      equal(handler.classifyError(error, 'context_error'), 'context');
    });

    it('classifies rate limit errors', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const error = new Error('Rate limit exceeded');
      equal(handler.classifyError(error, 'rate_limit'), 'rate_limit');
    });

    it('classifies timeout errors', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const error = new Error('Request timed out');
      equal(handler.classifyError(error, 'timeout'), 'timeout');
    });

    it('classifies network errors', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const error = new Error('Network unreachable');
      equal(handler.classifyError(error, 'network_error'), 'network');
    });

    it('classifies unknown errors', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const error = new Error('Something went wrong');
      equal(handler.classifyError(error, 'unknown'), 'unknown');
    });
  });

  describe('retry delay calculation', () => {
    it('calculates exponential backoff delay', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      equal(handler.calculateRetryDelay(0), 1000);
      equal(handler.calculateRetryDelay(1), 2000);
      equal(handler.calculateRetryDelay(2), 4000);
    });

    it('caps delay at maxDelay', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 5000, multiplier: 2 } });
      ok(handler.calculateRetryDelay(10) <= 5000);
    });
  });

  describe('retry eligibility', () => {
    it('allows retry when under maxRetries', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      ok(handler.shouldRetry(new Error('timeout'), 2));
    });

    it('denies retry when maxRetries exceeded', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 2, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      equal(handler.shouldRetry(new Error('timeout'), 2), false);
    });

    it('denies retry for non-retryable errors', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      equal(handler.shouldRetry(new Error('context window exceeded'), 0), false);
    });
  });

  describe('circuit breaker', () => {
    it('opens circuit after failure threshold', () => {
      handler = new AgentErrorHandler({
        retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 },
        circuitBreaker: { failureThreshold: 3, recoveryTimeout: 5000 },
      });
      handler.recordFailure();
      handler.recordFailure();
      handler.recordFailure();
      ok(handler.isCircuitOpen());
    });

    it('resets circuit on success', () => {
      handler = new AgentErrorHandler({
        retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 },
        circuitBreaker: { failureThreshold: 2, recoveryTimeout: 5000 },
      });
      handler.recordFailure();
      handler.recordFailure();
      ok(handler.isCircuitOpen());
      handler.recordSuccess();
      equal(handler.isCircuitOpen(), false);
    });

    it('half-opens after recovery timeout', async () => {
      handler = new AgentErrorHandler({
        retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 },
        circuitBreaker: { failureThreshold: 2, recoveryTimeout: 10 },
      });
      handler.recordFailure();
      handler.recordFailure();
      ok(handler.isCircuitOpen());
      // Wait for recovery timeout
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      await wait(50);
      equal(handler.isCircuitOpen(), false);
    });
  });

  describe('error message formatting', () => {
    it('formats provider error messages', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const msg = handler.formatErrorMessage('provider', new Error('API failed'), 1);
      ok(msg.includes('Provider error'));
      ok(msg.includes('API failed'));
    });

    it('formats tool error messages', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const msg = handler.formatErrorMessage('tool', new Error('Tool failed'), 0);
      ok(msg.includes('Tool error'));
      ok(msg.includes('Tool failed'));
    });

    it('formats context error messages', () => {
      handler = new AgentErrorHandler({ retry: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, multiplier: 2 } });
      const msg = handler.formatErrorMessage('context', new Error('Context exceeded'), 0);
      ok(msg.includes('Context error'));
    });
  });
});
