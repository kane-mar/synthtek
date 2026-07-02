/**
 * WebSocket Channel for synthtek
 * Real-time bidirectional communication via WebSocket
 */

import type {
	WebSocketChannelConfig,
	WebSocketClient,
	WebSocketMessage,
	WebSocketSession,
} from "./types.js";

const HEARTBEAT_INTERVAL = 30_000;
const MESSAGE_TIMEOUT = 30_000;

const DEFAULT_CONFIG: WebSocketChannelConfig = {
	port: 8080,
	host: "0.0.0.0",
	maxConnections: 100,
	heartbeatIntervalMs: HEARTBEAT_INTERVAL,
	messageTimeoutMs: MESSAGE_TIMEOUT,
	authRequired: false,
	authToken: undefined,
	ssl: false,
};

let clientCounter = 0;
let sessionCounter = 0;

export class WebSocketChannel {
	private readonly _config: WebSocketChannelConfig;
	private readonly _sessions: Map<string, WebSocketSession> = new Map();
	private readonly _clients: Map<string, WebSocketClient> = new Map();
	private _running = false;
	private messageHandlers: Array<(msg: WebSocketMessage) => Promise<void>> = [];

	constructor(config?: Partial<WebSocketChannelConfig>) {
		this._config = { ...DEFAULT_CONFIG, ...config };
	}

	get name(): string {
		return "websocket";
	}

	get port(): number {
		return this._config.port ?? 8080;
	}

	get host(): string {
		return this._config.host ?? "0.0.0.0";
	}

	get maxConnections(): number {
		return this._config.maxConnections ?? 100;
	}

	get heartbeatIntervalMs(): number {
		return this._config.heartbeatIntervalMs ?? 30000;
	}

	get messageTimeoutMs(): number {
		return this._config.messageTimeoutMs ?? 30000;
	}

	get authRequired(): boolean {
		return this._config.authRequired ?? false;
	}

	// ─── Session Management ───────────────────────────────────────────────────

	createSession(): WebSocketSession {
		sessionCounter++;
		const session: WebSocketSession = {
			id: `ws-session-${sessionCounter}`,
			createdAt: Date.now(),
			lastActivity: Date.now(),
			authenticated: false,
			messages: [],
		};
		this._sessions.set(session.id, session);
		return session;
	}

	getSession(sessionId: string): WebSocketSession | null {
		return this._sessions.get(sessionId) ?? null;
	}

	removeSession(sessionId: string): boolean {
		return this._sessions.delete(sessionId);
	}

	// ─── Client Management ────────────────────────────────────────────────────

	registerClient(sessionId: string): WebSocketClient {
		clientCounter++;
		const client: WebSocketClient = {
			id: `ws-client-${clientCounter}`,
			sessionId,
			connectedAt: Date.now(),
			lastPing: Date.now(),
			authenticated: false,
		};
		this._clients.set(client.id, client);
		return client;
	}

	unregisterClient(clientId: string): boolean {
		return this._clients.delete(clientId);
	}

	getConnectedClients(): WebSocketClient[] {
		return Array.from(this._clients.values());
	}

	// ─── Message Handling ─────────────────────────────────────────────────────

	canHandleMessage(message: unknown): boolean {
		if (typeof message !== "object" || message === null) return false;
		const msg = message as Record<string, unknown>;
		const validTypes = [
			"chat",
			"system",
			"error",
			"ping",
			"pong",
			"auth",
			"session",
			"stream",
			"stream_end",
		];
		return typeof msg.type === "string" && validTypes.includes(msg.type);
	}

	handleMessage(message: WebSocketMessage, sessionId?: string): void {
		const session = sessionId ? this._sessions.get(sessionId) : null;
		if (session) {
			session.lastActivity = Date.now();
			session.messages.push(message);
		}
	}

	// ─── Authentication ───────────────────────────────────────────────────────

	validateToken(token: string): boolean {
		if (!this._config.authRequired) return true;
		return token === this._config.authToken;
	}

	// ─── Broadcasting ─────────────────────────────────────────────────────────

	broadcast(message: WebSocketMessage): void {
		// In a real implementation, this would send to all connected WebSocket clients
		// For now, we just track the message
		message.timestamp = Date.now();
	}

	sendToSession(sessionId: string, message: WebSocketMessage): boolean {
		const session = this._sessions.get(sessionId);
		if (!session) return false;

		message.timestamp = Date.now();
		session.messages.push(message);
		return true;
	}

	// ─── Handler Registration (standard interface for AgentRunner) ──────────

	/**
	 * Register a handler for incoming messages.
	 * Called by AgentRunner.wireChannel() for agent loop integration.
	 */
	onMessage(handler: (msg: WebSocketMessage) => Promise<void>): void {
		this.messageHandlers.push(handler);
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────

	/**
	 * Connect / start the WebSocket server.
	 * Compatible with AgentRunner.wireChannel() duck-type interface.
	 */
	async connect(): Promise<void> {
		this._running = true;
		// In a real implementation, this would start the WebSocket server
	}

	/**
	 * Disconnect / stop the WebSocket server.
	 * Compatible with AgentRunner.wireChannel() duck-type interface.
	 */
	async disconnect(): Promise<void> {
		this._running = false;
		// In a real implementation, this would close all connections
		this._clients.clear();
	}

	/**
	 * Send a message via the WebSocket channel.
	 * Compatible with AgentRunner.wireChannel() duck-type interface.
	 */
	async sendMessage(options: {
		text?: string;
		content?: string;
		body?: string;
		sessionId?: string;
	}): Promise<boolean> {
		const content = options.text ?? options.content ?? options.body ?? "";
		const message: WebSocketMessage = {
			type: "chat",
			content,
			timestamp: Date.now(),
		};
		if (options.sessionId) {
			return this.sendToSession(options.sessionId, message);
		}
		this.broadcast(message);
		return true;
	}

	/** Legacy alias for connect() — kept for backward compatibility */
	async start(): Promise<void> {
		return this.connect();
	}

	/** Legacy alias for disconnect() — kept for backward compatibility */
	async stop(): Promise<void> {
		return this.disconnect();
	}

	get isRunning(): boolean {
		return this._running;
	}
}
