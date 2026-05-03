/**
 * Response cache with TTL and LRU eviction for synthtek
 */

import type { CacheConfig, CacheEntry, CacheStats, CacheGetResult } from './types.js';

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 100,
  defaultTtlMs: 60_000,
  maxEntrySize: 4096,
};

export class ResponseCache {
  private readonly _config: CacheConfig;
  private readonly _entries: Map<string, CacheEntry<unknown>> = new Map();
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;

  constructor(config?: Partial<CacheConfig>) {
    this._config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  async put<T = unknown>(key: string, value: T): Promise<void> {
    const size = this._estimateSize(value);
    if (size > this._config.maxEntrySize) {
      return; // Skip entries that are too large
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + this._config.defaultTtlMs,
      size,
      hitCount: 0,
    };

    this._entries.set(key, entry as CacheEntry<unknown>);

    // Evict if over max size
    while (this._entries.size > this._config.maxSize) {
      this._evictOldest();
    }
  }

  async get<T = unknown>(key: string): Promise<CacheGetResult<T>> {
    const entry = this._entries.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this._misses++;
      return { hit: false, value: null };
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this._entries.delete(key);
      this._misses++;
      return { hit: false, value: null };
    }

    this._hits++;
    entry.hitCount++;
    return { hit: true, value: entry.value };
  }

  stats(): CacheStats {
    const totalSize = Array.from(this._entries.values()).reduce((sum, e) => sum + e.size, 0);
    const totalRequests = this._hits + this._misses;

    return {
      size: this._entries.size,
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      totalSize,
      hitRate: totalRequests > 0 ? this._hits / totalRequests : 0,
    };
  }

  async clear(): Promise<void> {
    this._entries.clear();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this._entries) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this._entries.delete(oldestKey);
      this._evictions++;
    }
  }

  private _estimateSize(value: unknown): number {
    return JSON.stringify(value).length;
  }
}
