/**
 * Observability module types for synthtek
 */

// ── Langfuse Config ─────────────────────────────────────────────────────────

export interface LangfuseConfig {
  /** Public API key */
  publicKey?: string;
  /** Secret API key */
  secretKey?: string;
  /** Base URL for Langfuse instance */
  baseUrl?: string;
  /** Whether tracing is enabled */
  enabled?: boolean;
  /** Release/version identifier */
  release?: string;
}

// ── Langfuse Trace ──────────────────────────────────────────────────────────

export interface LangfuseTrace {
  id: string;
  name: string;
  sessionId?: string;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface LangfuseTraceOptions {
  name: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

// ── Langfuse Span ───────────────────────────────────────────────────────────

export type LangfuseSpanType = 'chain' | 'tool' | 'llm' | 'embedding' | 'unknown';

export interface LangfuseSpan {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  type: LangfuseSpanType;
  startTime: number;
  endTime?: number;
  input?: unknown;
  output?: unknown;
  level?: 'DEFAULT' | 'DEBUG' | 'WARNING' | 'ERROR';
  statusMessage?: string;
}

export interface LangfuseSpanOptions {
  traceId: string;
  parentId?: string;
  name: string;
  type: LangfuseSpanType;
  input?: unknown;
}

// ── Token Usage ─────────────────────────────────────────────────────────────

export interface TokenUsage {
  traceId: string;
  spanId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ── Cost Tracking ───────────────────────────────────────────────────────────

export interface CostRecord {
  traceId: string;
  spanId?: string;
  cost: number;
  currency?: string;
}

// ── LangSmith Config ────────────────────────────────────────────────────────

export interface LangSmithConfig {
  /** API key for LangSmith */
  apiKey?: string;
  /** Tracer name */
  tracerName?: string;
  /** Project name */
  projectName?: string;
  /** Whether tracing is enabled */
  enabled?: boolean;
  /** API endpoint */
  apiUrl?: string;
}

// ── LangSmith Trace ─────────────────────────────────────────────────────────

export interface LangSmithTrace {
  id: string;
  name: string;
  runType: 'chain' | 'llm' | 'tool' | 'retriever' | 'embedding' | 'prompt';
  startTime: number;
  endTime?: number;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// ── LangSmith Dataset ───────────────────────────────────────────────────────

export interface LangSmithDataset {
  id: string;
  name: string;
  description?: string;
  inputs: Record<string, unknown>[];
  outputs?: Record<string, unknown>[];
}

// ── LangSmith Evaluation ────────────────────────────────────────────────────

export interface LangSmithEvaluation {
  id?: string;
  traceId: string;
  name: string;
  score: number;
  feedbackSource?: string;
  comment?: string;
}
