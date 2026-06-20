/**
 * Prompt Cache Module
 *
 * Provides an in-memory LRU cache with TTL support for caching
 * prompt processing results across provider calls.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PromptCacheConfig {
	/** Maximum number of entries in the cache (default: 1000) */
	maxSize?: number;
	/** Time-to-live in milliseconds (default: 1 hour) */
	ttl?: number;
	/** Whether caching is enabled (default: true) */
	enabled?: boolean;
}

export interface CacheStats {
	/** Total cache hits */
	hits: number;
	/** Total cache misses */
	misses: number;
	/** Total requests (hits + misses) */
	totalRequests: number;
	/** Hit ratio (0.0 to 1.0) */
	hitRatio: number;
	/** Current number of entries */
	size: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

// ─── Cache Entry ────────────────────────────────────────────────────────────

interface CacheEntry<T> {
	value: T;
	createdAt: number;
	expiresAt: number;
}

// ─── Class ──────────────────────────────────────────────────────────────────

export class PromptCache {
	private readonly maxSize: number;
	private readonly ttl: number;
	private readonly enabled: boolean;
	private readonly store = new Map<string, CacheEntry<string>>();
	private _hits = 0;
	private _misses = 0;

	constructor(config: PromptCacheConfig = {}) {
		this.maxSize = config.maxSize ?? DEFAULT_MAX_SIZE;
		this.ttl = config.ttl ?? DEFAULT_TTL;
		this.enabled = config.enabled ?? true;
	}

	// ── Core Operations ──────────────────────────────────────────────────────

	/**
	 * Store a value in the cache.
	 */
	put(key: string, value: string): void {
		if (!this.enabled) return;

		// Evict if at capacity
		if (this.store.size >= this.maxSize) {
			this.evictOldest();
		}

		this.store.set(key, {
			value,
			createdAt: Date.now(),
			expiresAt: Date.now() + this.ttl,
		});
	}

	/**
	 * Retrieve a value from the cache.
	 * Returns null if the key is not found or has expired.
	 */
	get(key: string): string | null {
		if (!this.enabled) {
			this._misses++;
			return null;
		}

		const entry = this.store.get(key);
		if (!entry) {
			this._misses++;
			return null;
		}

		// Check TTL
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			this._misses++;
			return null;
		}

		this._hits++;
		return entry.value;
	}

	/**
	 * Get a cached value, or compute and cache it on miss.
	 */
	getOrSet(key: string, compute: () => string): string {
		const cached = this.get(key);
		if (cached !== null) {
			return cached;
		}

		const value = compute();
		this.put(key, value);
		return value;
	}

	/**
	 * Check if a key exists in the cache (and is not expired).
	 */
	has(key: string): boolean {
		const entry = this.store.get(key);
		if (!entry) return false;

		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * Remove a specific key from the cache.
	 */
	delete(key: string): void {
		this.store.delete(key);
	}

	/**
	 * Clear all entries from the cache.
	 */
	clear(): void {
		this.store.clear();
	}

	// ── Stats ────────────────────────────────────────────────────────────────

	/**
	 * Get the current number of entries in the cache.
	 */
	get size(): number {
		return this.store.size;
	}

	/**
	 * Get cache statistics.
	 */
	stats(): CacheStats {
		const total = this._hits + this._misses;
		return {
			hits: this._hits,
			misses: this._misses,
			totalRequests: total,
			hitRatio: total > 0 ? this._hits / total : 0,
			size: this.store.size,
		};
	}

	// ── Key Computation ──────────────────────────────────────────────────────

	/**
	 * Compute a cache key from prompt content and optional provider name.
	 * Uses a simple hash of the content.
	 */
	computeKey(content: string, provider?: string): string {
		const prefix = provider ? `${provider}:` : "";
		// Simple hash: use content length + first/last chars as a quick key
		// For production, consider using a proper hash function
		const hash = this.simpleHash(content);
		return `${prefix}${hash}`;
	}

	// ── Private Helpers ──────────────────────────────────────────────────────

	private evictOldest(): void {
		let oldestKey: string | null = null;
		let oldestTime = Infinity;

		for (const [key, entry] of this.store.entries()) {
			if (entry.createdAt < oldestTime) {
				oldestTime = entry.createdAt;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.store.delete(oldestKey);
		}
	}

	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}
}
