/**
 * Agent Loop — Core type definitions for synthtek
 */

// ─── Message ────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface AgentMessage {
  role: MessageRole;
  content: string;
  /** Optional metadata (channel, timestamp, etc.) */
  metadata?: Record<string, unknown>;
  /** For tool messages: the tool call ID this result belongs to */
  toolCallId?: string;
}

// ─── Tool Call ──────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  content: string;
  error?: string;
}

// ─── Context Window ─────────────────────────────────────────────────────────

export interface ContextWindowConfig {
  /** Maximum tokens allowed in the context window */
  maxTokens: number;
  /** Token count at which to start compaction */
  compactThreshold: number;
  /** Minimum number of recent messages to always keep */
  minRecentMessages: number;
  /** Whether to summarize older messages during compaction */
  summarizeOldMessages: boolean;
}

export interface ContextSnapshot {
  messages: AgentMessage[];
  tokenCount: number;
  truncated: boolean;
}

export interface ContextCompactionResult {
  /** Messages after compaction */
  messages: AgentMessage[];
  /** Token count after compaction */
  tokenCount: number;
  /** Whether compaction was needed */
  needed: boolean;
  /** Summary of what was done */
  summary: string;
}

// ─── Agent Loop ─────────────────────────────────────────────────────────────

export interface AgentLoopConfig {
  /** System prompt for the agent */
  systemPrompt: string;
  /** Maximum LLM calls per message (prevents infinite loops) */
  maxToolCalls: number;
  /** Default context window config */
  contextWindow?: Partial<ContextWindowConfig>;
  /** Model to use (overrides provider default) */
  model?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0.0–2.0) */
  temperature?: number;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stop?: string[];
  /** Tool definitions for function calling */
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  /** Whether to force tool usage */
  toolChoice?: string | { type: string; name?: string };
  /** Response format type */
  responseFormat?: 'markdown' | 'json' | 'plain' | 'structured';
  /** Retry settings for LLM calls */
  retry?: {
    /** Maximum number of retries */
    maxRetries: number;
    /** Initial delay in milliseconds */
    initialDelay: number;
    /** Maximum delay in milliseconds */
    maxDelay: number;
    /** Multiplier for exponential backoff */
    multiplier: number;
    /** Error patterns that should trigger a retry */
    retryableErrors?: RegExp[];
  };
  /** Circuit breaker settings */
  circuitBreaker?: {
    /** Number of failures before opening the circuit */
    failureThreshold: number;
    /** Time in milliseconds to wait before half-opening */
    recoveryTimeout: number;
  };
}

export interface AgentLoopResult {
  /** Final response text */
  response: string;
  /** Total tokens used */
  tokensUsed: number;
  /** Number of tool calls made */
  toolCallsMade: number;
  /** Duration in ms */
  duration: number;
  /** Errors encountered */
  errors: string[];
}

export type AgentLoopState = 'idle' | 'processing' | 'waiting_for_tool' | 'error';

// ─── Agent Lifecycle Hooks ──────────────────────────────────────────────────

export interface AgentHooks {
  /** Called when the agent is initialized */
  onInit?: () => void | Promise<void>;
  /** Called when the agent is destroyed */
  onDestroy?: () => void | Promise<void>;
  /** Called before processing a message */
  onBeforeMessage?: (message: AgentMessage) => void | Promise<void>;
  /** Called after processing a message */
  onAfterMessage?: (result: AgentLoopResult) => void | Promise<void>;
  /** Called before an LLM call */
  onBeforeLLMCall?: (messages: AgentMessage[]) => void | Promise<void>;
  /** Called after an LLM call */
  onAfterLLMCall?: (response: string, tokens: number) => void | Promise<void>;
  /** Called before executing a tool */
  onBeforeToolCall?: (toolCall: ToolCall) => void | Promise<void>;
  /** Called after executing a tool */
  onAfterToolCall?: (result: ToolResult) => void | Promise<void>;
}

// ─── Agent State ────────────────────────────────────────────────────────────

export interface AgentState {
  /** Current agent status */
  status: 'idle' | 'running' | 'paused' | 'error';
  /** Total messages processed */
  messagesProcessed: number;
  /** Total tokens used */
  tokensUsed: number;
  /** Total tool calls made */
  toolCallsMade: number;
  /** Current context window token count */
  currentTokens: number;
  /** Last error message */
  lastError?: string;
  /** Started at timestamp */
  startedAt?: Date;
  /** Last activity timestamp */
  lastActivityAt?: Date;
}

// ─── Heartbeat ──────────────────────────────────────────────────────────────

export interface HeartbeatConfig {
  /** Interval in milliseconds */
  interval: number;
  /** Callback to invoke on each heartbeat */
  onTick: () => void | Promise<void>;
  /** Whether to start immediately */
  startImmediately?: boolean;
}

export interface HeartbeatState {
  /** Whether the heartbeat is running */
  running: boolean;
  /** Total ticks fired */
  ticks: number;
  /** Last tick timestamp */
  lastTickAt?: Date;
  /** Errors encountered */
  errors: string[];
}

// ─── Subagent Spawning ────────────────────────────────────────────────────────

export interface SubagentConfig {
  /** Task description for the subagent */
  task: string;
  /** Maximum tokens for the subagent's context window */
  maxTokens?: number;
  /** Model to use (defaults to parent's model) */
  model?: string;
  /** Temperature (defaults to parent's temperature) */
  temperature?: number;
  /** System prompt override */
  systemPrompt?: string;
  /** Maximum tool calls for the subagent */
  maxToolCalls?: number;
  /** Timeout in seconds */
  timeout?: number;
  /** Whether to inherit the parent's context */
  inheritContext?: boolean;
  /** Whether to merge subagent results back into parent context */
  mergeResults?: boolean;
}

export interface SubagentResult {
  /** Subagent ID */
  id: string;
  /** Final response from the subagent */
  response: string;
  /** Total tokens used */
  tokensUsed: number;
  /** Number of tool calls made */
  toolCallsMade: number;
  /** Duration in ms */
  duration: number;
  /** Errors encountered */
  errors: string[];
  /** Status of the subagent */
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
}
