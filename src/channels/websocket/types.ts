/**
 * WebSocket Channel types for synthtek
 */

// ── WebSocket Channel Config ────────────────────────────────────────────────

export interface WebSocketChannelConfig {
	/** Port to listen on */
	port?: number;
	/** Host to bind to */
	host?: string;
	/** Maximum concurrent connections */
	maxConnections?: number;
	/** Heartbeat interval in milliseconds */
	heartbeatIntervalMs?: number;
	/** Message timeout in milliseconds */
	messageTimeoutMs?: number;
	/** Whether authentication is required */
	authRequired?: boolean;
	/** Auth token for connections */
	authToken?: string;
	/** Whether to enable SSL/TLS */
	ssl?: boolean;
	/** SSL certificate path */
	sslCertPath?: string;
	/** SSL key path */
	sslKeyPath?: string;
}

// ── WebSocket Messages ──────────────────────────────────────────────────────

export type WebSocketMessageType =
	| "chat"
	| "system"
	| "error"
	| "ping"
	| "pong"
	| "auth"
	| "session"
	| "stream"
	| "stream_end";

export interface WebSocketMessage {
	type: WebSocketMessageType;
	content?: string;
	sessionId?: string;
	timestamp?: number;
	error?: string;
	metadata?: Record<string, unknown>;
}

export interface WebSocketAuthMessage {
	type: "auth";
	token: string;
}

export interface WebSocketChatMessage {
	type: "chat";
	content: string;
	sessionId?: string;
}

export interface WebSocketStreamMessage {
	type: "stream";
	content: string;
	sessionId: string;
	isFinal: boolean;
}

// ── WebSocket Session ───────────────────────────────────────────────────────

export interface WebSocketSession {
	id: string;
	createdAt: number;
	lastActivity: number;
	authenticated: boolean;
	userId?: string;
	messages: WebSocketMessage[];
}

// ── WebSocket Client ────────────────────────────────────────────────────────

export interface WebSocketClient {
	id: string;
	sessionId: string;
	connectedAt: number;
	lastPing: number;
	authenticated: boolean;
}
