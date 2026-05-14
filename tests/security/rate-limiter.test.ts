/**
 * Tests for RateLimiter (request rate limiting)
 */

import { describe, it, beforeEach } from 'node:test';
import { equal, ok } from 'node:assert';
import { RateLimiter } from '../../src/security/rate-limiter.js';
import type { RateLimitConfig } from '../../src/security/types.js';

const defaultConfig: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000,
  slidingWindow: false,
  banOnExceed: false,
  banDurationMs: 300000,
};

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(defaultConfig);
  });

  describe('check', () => {
    it('allows requests within limit', () => {
      const result = limiter.check('user1');
      ok(result.allowed, 'request allowed');
      ok(result.remaining > 0, 'remaining requests tracked');
    });

    it('blocks requests exceeding limit', async () => {
      // Exhaust the limit
      for (let i = 0; i < (defaultConfig.maxRequests ?? 10); i++) {
        limiter.check('user1');
      }

      const result = limiter.check('user1');
      ok(!result.allowed, 'request blocked');
      equal(result.remaining, 0, 'no remaining requests');
    });

    it('tracks per-user limits independently', () => {
      limiter.check('user1');
      limiter.check('user2');

      const result1 = limiter.check('user1');
      const result2 = limiter.check('user2');

      ok(result1.allowed, 'user1 allowed');
      ok(result2.allowed, 'user2 allowed');
    });

    it('resets after window expires', async () => {
      const shortLimiter = new RateLimiter({
        ...defaultConfig,
        windowMs: 100,
        maxRequests: 2,
      });

      shortLimiter.check('user1');
      shortLimiter.check('user1');

      await new Promise((r) => setTimeout(r, 150));

      const result = shortLimiter.check('user1');
      ok(result.allowed, 'request allowed after window reset');
    });
  });

  describe('per-user limits', () => {
    it('applies per-user overrides', () => {
      const customLimiter = new RateLimiter({
        ...defaultConfig,
        perUserLimits: {
          'vip-user': { maxRequests: 100, windowMs: 60000 },
        },
      });

      // Regular user should hit limit at 10
      for (let i = 0; i < 10; i++) {
        customLimiter.check('regular-user');
      }
      const regularResult = customLimiter.check('regular-user');
      ok(!regularResult.allowed, 'regular user blocked');

      // VIP user should have higher limit
      for (let i = 0; i < 100; i++) {
        customLimiter.check('vip-user');
      }
      const vipResult = customLimiter.check('vip-user');
      ok(!vipResult.allowed, 'vip user blocked at higher limit');
    });
  });

  describe('ban on exceed', () => {
    it('bans user after exceeding limit', () => {
      const banLimiter = new RateLimiter({
        ...defaultConfig,
        maxRequests: 2,
        banOnExceed: true,
        banDurationMs: 1000,
      });

      banLimiter.check('bad-user');
      banLimiter.check('bad-user');
      const exceeded = banLimiter.check('bad-user');

      ok(!exceeded.allowed, 'request blocked');
      ok(exceeded.banned, 'user banned');
    });
  });

  describe('stats', () => {
    it('returns rate limit stats', () => {
      limiter.check('user1');
      const stats = limiter.stats('user1');
      ok(stats, 'stats returned');
    });
  });
});
