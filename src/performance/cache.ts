/**
 * Response cache with TTL and LRU eviction for synthtek
 */

import type {
	CacheConfig,
	CacheEntry,
	CacheGetResult,
	CacheStats,
} from "./types.js";

const DEFAULT_CACHE_CONFIG: CacheConfig = {
	maxSize: 100,
	defaultTtlMs: 60_000,
	maxEntrySize: 4096,
};

export class ResponseCache {
	private readonly config: CacheConfig;
	private readonly entries: Map<string, CacheEntry<unknown>> = new Map();
	private hits = 0;
	private misses = 0;
	private evictions = 0;

	constructor(config?: Partial<CacheConfig>) {
		this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
	}

	async put<T = unknown>(key: string, value: T): Promise<void> {
		const size = this.estimateSize(value);
		if (size > this.config.maxEntrySize) {
			return; // Skip entries that are too large
		}

		const entry: CacheEntry<T> = {
			key,
			value,
			createdAt: Date.now(),
			expiresAt: Date.now() + this.config.defaultTtlMs,
			size,
			hitCount: 0,
		};

		this.entries.set(key, entry as CacheEntry<unknown>);

		// Evict if over max size
		while (this.entries.size > this.config.maxSize) {
			this.evictOldest();
		}
	}

	async get<T = unknown>(key: string): Promise<CacheGetResult<T>> {
		const entry = this.entries.get(key) as CacheEntry<T> | undefined;

		if (!entry) {
			this.misses++;
			return { hit: false, value: null };
		}

		// Check expiration
		if (Date.now() > entry.expiresAt) {
			this.entries.delete(key);
			this.misses++;
			return { hit: false, value: null };
		}

		this.hits++;
		entry.hitCount++;
		return { hit: true, value: entry.value };
	}

	stats(): CacheStats {
		const totalSize = Array.from(this.entries.values()).reduce(
			(sum, e) => sum + e.size,
			0,
		);
		const totalRequests = this.hits + this.misses;

		return {
			size: this.entries.size,
			hits: this.hits,
			misses: this.misses,
			evictions: this.evictions,
			totalSize,
			hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
		};
	}

	async clear(): Promise<void> {
		this.entries.clear();
	}

	// ── Private ──────────────────────────────────────────────────────────────

	private evictOldest(): void {
		let oldestKey: string | null = null;
		let oldestTime = Infinity;

		for (const [key, entry] of this.entries) {
			if (entry.createdAt < oldestTime) {
				oldestTime = entry.createdAt;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.entries.delete(oldestKey);
			this.evictions++;
		}
	}

	private estimateSize(value: unknown): number {
		return JSON.stringify(value).length;
	}
}
