/**
 * Tests for ResponseCache (response caching with TTL)
 */

import { describe, it, beforeEach } from 'node:test';
import { equal, ok, strictEqual } from 'node:assert';
import { ResponseCache } from '../../src/performance/cache.js';
import type { CacheConfig } from '../../src/performance/types.js';

const defaultConfig: CacheConfig = {
  maxSize: 100,
  defaultTtlMs: 5000,
  maxEntrySize: 1024,
};

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache(defaultConfig);
  });

  describe('put/get', () => {
    it('stores and retrieves a value', async () => {
      await cache.put('key1', { data: 'hello' });
      const result = await cache.get('key1');
      ok(result.hit, 'cache hit');
      strictEqual((result.value as { data: string }).data, 'hello');
    });

    it('returns miss for non-existent key', async () => {
      const result = await cache.get('missing');
      equal(result.hit, false, 'cache miss');
      equal(result.value, null);
    });

    it('expires entries after TTL', async () => {
      const shortCache = new ResponseCache({ ...defaultConfig, defaultTtlMs: 100 });
      await shortCache.put('key1', { data: 'expires' });

      await new Promise((r) => setTimeout(r, 150));

      const result = await shortCache.get('key1');
      equal(result.hit, false, 'entry expired');
    });
  });

  describe('eviction', () => {
    it('evicts oldest entries when max size reached', async () => {
      const smallCache = new ResponseCache({ ...defaultConfig, maxSize: 3 });

      await smallCache.put('a', { v: 1 });
      await smallCache.put('b', { v: 2 });
      await smallCache.put('c', { v: 3 });
      await smallCache.put('d', { v: 4 }); // should evict 'a'

      const aResult = await smallCache.get('a');
      equal(aResult.hit, false, 'oldest entry evicted');

      const dResult = await smallCache.get('d');
      ok(dResult.hit, 'newest entry still present');
    });
  });

  describe('stats', () => {
    it('tracks hits and misses', async () => {
      await cache.put('key1', { data: 'test' });
      await cache.get('key1'); // hit
      await cache.get('missing'); // miss

      const stats = cache.stats();
      equal(stats.hits, 1);
      equal(stats.misses, 1);
      ok(stats.hitRate > 0, 'hit rate calculated');
    });
  });

  describe('clear', () => {
    it('clears all entries', async () => {
      await cache.put('key1', { data: 'test' });
      await cache.clear();

      const result = await cache.get('key1');
      equal(result.hit, false, 'cache cleared');
    });
  });
});
