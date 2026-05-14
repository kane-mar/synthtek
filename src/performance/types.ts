/**
 * Performance module type definitions for synthtek
 */

// ── General Performance Config ──────────────────────────────────────────────

export interface PerformanceConfig {
  connectionPool?: PoolConfig;
  cache?: CacheConfig;
  parallelExecutor?: ParallelExecutorConfig;
  contextManager?: ContextManagerConfig;
  streaming?: StreamingConfig;
}

// ── Connection Pool ─────────────────────────────────────────────────────────

export interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeoutMs: number;
  acquireTimeoutMs: number;
  maxRetries: number;
}

export interface PoolStats {
  activeConnections: number;
  idleConnections: number;
  totalAcquired: number;
  totalReleased: number;
  totalFailed: number;
  waitingRequests: number;
}

export interface PoolConnection {
  id: string;
  provider: string;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}

// ── Cache ───────────────────────────────────────────────────────────────────

export interface CacheConfig {
  maxSize: number;
  defaultTtlMs: number;
  maxEntrySize: number;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  size: number;
  hitCount: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  hitRate: number;
}

export interface CacheGetResult<T = unknown> {
  hit: boolean;
  value: T | null;
}

// ── Parallel Executor ───────────────────────────────────────────────────────

export interface ParallelExecutorConfig {
  maxConcurrency: number;
  timeoutMs: number;
  failFast: boolean;
}

export interface ToolTask {
  id: string;
  name: string;
  fn: () => Promise<unknown>;
  timeoutMs?: number;
}

export interface ToolTaskResult {
  id: string;
  name: string;
  success: boolean;
  value?: unknown;
  error?: string;
  duration: number;
}

// ── Context Manager ─────────────────────────────────────────────────────────

export interface ContextManagerConfig {
  maxTokens: number;
  maxMessages: number;
  compactionThreshold: number;
  minKeptMessages: number;
}

export interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokens: number;
  timestamp: number;
}

export interface ContextSnapshot {
  messages: ContextMessage[];
  totalTokens: number;
  messageCount: number;
  truncated: boolean;
  compacted: boolean;
}

export interface ContextStats {
  totalTokens: number;
  messageCount: number;
  maxTokens: number;
  utilization: number;
  compactions: number;
}

// ── Streaming ───────────────────────────────────────────────────────────────

export interface StreamingConfig {
  chunkSize: number;
  flushIntervalMs: number;
  maxBufferedChunks: number;
  enableCompression: boolean;
}

export interface StreamChunk {
  id: string;
  content: string;
  timestamp: number;
  isFinal: boolean;
}

export interface StreamStats {
  totalChunks: number;
  totalBytes: number;
  averageLatencyMs: number;
  compressedBytes: number;
}
