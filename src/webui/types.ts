/**
 * WebUI Backend Types
 */

export interface WebUIConfig {
	host: string;
	port: number;
	apiKey: string;
	maxSessions: number;
	sessionTimeout: number; // seconds
}

export interface Session {
	id: string;
	userId: string;
	createdAt: number;
	lastActivity: number;
	messages: Message[];
}

export interface Message {
	id: string;
	sessionId: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
}

export interface WebUIStats {
	activeSessions: number;
	totalMessages: number;
	uptime: number;
}

export interface FileUploadResult {
	success: boolean;
	url?: string;
	error?: string;
}

export interface APIResponse {
	status: number;
	body: unknown;
}

export interface WebSocketClient {
	id: string;
	sessionId: string;
	connected: boolean;
}

// ── Analytics ───────────────────────────────────────────────────────────────

/** A single recorded request to the LLM provider */
export interface LLMRequestRecord {
	id: string;
	provider: string;
	model: string;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	latencyMs: number;
	cost: number;
	timestamp: number;
	success: boolean;
	errorMessage?: string;
}

/** A recorded error event */
export interface ErrorRecord {
	id: string;
	type: "api" | "provider" | "channel" | "plugin" | "system";
	source: string;
	message: string;
	timestamp: number;
}

/** Channel message count snapshot */
export interface ChannelUsageRecord {
	channel: string;
	messagesSent: number;
	messagesReceived: number;
	timestamp: number;
}

/** Aggregated analytics summary for a time range */
export interface AnalyticsSummary {
	requestVolume: {
		total: number;
		byEndpoint: Record<string, number>;
	};
	tokenUsage: {
		total: number;
		promptTokens: number;
		completionTokens: number;
		averagePerRequest: number;
	};
	latency: {
		average: number;
		min: number;
		max: number;
		recentRequests: number;
	};
	errors: {
		total: number;
		rate: number;
		byType: Record<string, number>;
	};
	providerCosts: {
		byProvider: Record<string, number>;
		total: number;
	};
	sessionActivity: {
		totalSessions: number;
		activeSessions: number;
		totalMessages: number;
		averageMessagesPerSession: number;
	};
	channelUsage: {
		byChannel: Record<string, { sent: number; received: number }>;
		totalMessages: number;
	};
	uptime: number;
}

// ── WebSocket Message Protocol ──────────────────────────────────────────────

export interface WebSocketMessage {
	type:
		| "message"
		| "stream_start"
		| "stream_chunk"
		| "stream_end"
		| "error"
		| "ping"
		| "pong"
		| "session_update";
	sessionId?: string;
	data?: unknown;
}

export interface WebSocketSendOptions {
	url: string;
	sessionId: string;
	apiKey?: string;
	pollingInterval?: number; // ms, 0 = no polling fallback
}

export type WebSocketEventHandler = (event: WebSocketMessage) => void;
export type WebSocketStatusHandler = (
	connected: boolean,
	error?: string,
) => void;

// ── Tools ───────────────────────────────────────────────────────────────────

export interface ToolInfo {
	name: string;
	description: string;
	category: string;
	createdAt?: number;
	custom?: boolean;
}

// ── Skills ──────────────────────────────────────────────────────────────────

export interface SkillInfo {
	name: string;
	description: string;
	homepage?: string;
	emoji?: string;
	enabled: boolean;
	installedAt: number;
	custom?: boolean;
}

// ── Cron Jobs ───────────────────────────────────────────────────────────────

export interface CronJob {
	id: string;
	schedule: string;
	message: string;
	createdAt: number;
	status: "active" | "paused" | "completed";
}

// ── Agent Config ────────────────────────────────────────────────────────────

export interface AgentConfig {
	systemPrompt: string;
	language: string;
}
