/**
 * WebUI Backend
 *
 * REST API + WebSocket backend for the WebUI frontend.
 * Handles sessions, messages, file uploads, authentication, and analytics.
 */

import {
	getAgentConfig as getSharedAgentConfig,
	setAgentConfig as setSharedAgentConfig,
} from "../config/agent-config.js";
import { AnalyticsTracker } from "./analytics.js";
import type {
	AnalyticsSummary,
	APIResponse,
	CronJob,
	FileUploadResult,
	Message,
	Session,
	ToolInfo,
	WebSocketClient,
	WebUIConfig,
	WebUIStats,
} from "./types.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function generateId(): string {
	return `_${Math.random().toString(36).slice(2, 11)}`;
}

export class WebUIBackend {
	public status: "started" | "stopped" = "stopped";
	public readonly analytics: AnalyticsTracker;

	private readonly config: WebUIConfig;
	private readonly sessions: Map<string, Session> = new Map();
	private readonly wsClients: Map<string, WebSocketClient> = new Map();
	private readonly cronJobs: Map<string, CronJob> = new Map();
	private agentConfig: import("./types.js").AgentConfig = {
		systemPrompt: getSharedAgentConfig().systemPrompt,
		language: getSharedAgentConfig().language,
	};
	private startedAt: number | null = null;

	constructor(config: WebUIConfig) {
		this.config = config;
		this.analytics = new AnalyticsTracker();
		this.initDefaultTools();
	}

	// ── Session Management ─────────────────────────────────────────────────────

	createSession(userId: string): Session | null {
		if (this.sessions.size >= this.config.maxSessions) {
			return null;
		}

		const session: Session = {
			id: generateId(),
			userId,
			createdAt: Date.now(),
			lastActivity: Date.now(),
			messages: [],
		};

		this.sessions.set(session.id, session);
		return session;
	}

	getSession(id: string): Session | null {
		return this.sessions.get(id) ?? null;
	}

	listSessions(): Session[] {
		return Array.from(this.sessions.values());
	}

	deleteSession(id: string): boolean {
		return this.sessions.delete(id);
	}

	// ── Message Handling ───────────────────────────────────────────────────────

	addMessage(
		sessionId: string,
		msg: { role: "user" | "assistant" | "system"; content: string },
	): Message | null {
		const session = this.sessions.get(sessionId);
		if (!session) return null;

		const message: Message = {
			id: generateId(),
			sessionId,
			role: msg.role,
			content: msg.content,
			timestamp: Date.now(),
		};

		session.messages.push(message);
		session.lastActivity = Date.now();
		return message;
	}

	getMessages(sessionId: string): Message[] {
		const session = this.sessions.get(sessionId);
		return session ? session.messages : [];
	}

	// ── Authentication ─────────────────────────────────────────────────────────

	authenticate(key: string): boolean {
		// If no API key is configured, allow all requests (open mode)
		if (!this.config.apiKey) {
			return true;
		}
		return key === this.config.apiKey;
	}

	// ── File Upload Handling ───────────────────────────────────────────────────

	handleFileUpload(
		sessionId: string,
		file: { filename: string; mimeType: string; size: number },
	): FileUploadResult {
		if (file.size > MAX_FILE_SIZE) {
			return { success: false, error: "File exceeds maximum size" };
		}

		const session = this.sessions.get(sessionId);
		if (!session) {
			return { success: false, error: "Session not found" };
		}

		const url = `http://${this.config.host}:${this.config.port}/api/files/${encodeURIComponent(file.filename)}`;
		return { success: true, url };
	}

	// ── Health & Stats ─────────────────────────────────────────────────────────

	healthCheck(): {
		name: string;
		status: string;
		connected: boolean;
		uptime: number;
	} {
		return {
			name: "webui",
			status: this.status,
			connected: this.status === "started",
			uptime: this.startedAt ? Date.now() - this.startedAt : 0,
		};
	}

	getStats(): WebUIStats {
		let totalMessages = 0;
		for (const session of this.sessions.values()) {
			totalMessages += session.messages.length;
		}

		return {
			activeSessions: this.sessions.size,
			totalMessages,
			uptime: this.startedAt ? Date.now() - this.startedAt : 0,
		};
	}

	// ── Analytics Summary ──────────────────────────────────────────────────────

	getAnalyticsSummary(): AnalyticsSummary {
		const summary = this.analytics.getSummary();
		const stats = this.getStats();
		const uptime = this.startedAt ? Date.now() - this.startedAt : 0;

		// Merge session activity from backend state
		summary.sessionActivity = {
			totalSessions: stats.activeSessions,
			activeSessions: stats.activeSessions,
			totalMessages: stats.totalMessages,
			averageMessagesPerSession:
				stats.activeSessions > 0
					? Math.round(stats.totalMessages / stats.activeSessions)
					: 0,
		};

		summary.uptime = uptime;

		return summary;
	}

	// ── WebSocket Support ──────────────────────────────────────────────────────

	handleWebSocket(clientId: string, sessionId: string): WebSocketClient {
		const client: WebSocketClient = {
			id: clientId,
			sessionId,
			connected: true,
		};

		this.wsClients.set(clientId, client);
		return client;
	}

	broadcast(sessionId: string, data: unknown): void {
		for (const client of this.wsClients.values()) {
			if (client.sessionId === sessionId && client.connected) {
				// In a real implementation, this would send to the WebSocket
				void data;
			}
		}
	}

	// ── Tools ──────────────────────────────────────────────────────────────────

	private readonly tools: Map<string, ToolInfo> = new Map();

	private initDefaultTools(): void {
		for (const t of [
			{ name: "web_search", description: "Search the web", category: "search" },
			{ name: "web_fetch", description: "Fetch a URL", category: "search" },
			{
				name: "read_file",
				description: "Read file contents",
				category: "filesystem",
			},
			{
				name: "write_file",
				description: "Write file contents",
				category: "filesystem",
			},
			{
				name: "exec",
				description: "Execute shell commands",
				category: "system",
			},
			{
				name: "cron",
				description: "Schedule reminders and recurring tasks",
				category: "system",
			},
			{
				name: "memory",
				description: "Long-term memory access",
				category: "memory",
			},
		]) {
			this.tools.set(t.name, { ...t, createdAt: Date.now(), custom: false });
		}
	}

	listTools(): ToolInfo[] {
		return Array.from(this.tools.values());
	}

	addTool(name: string, description: string, category: string): ToolInfo {
		const tool: ToolInfo = {
			name,
			description,
			category,
			createdAt: Date.now(),
			custom: true,
		};
		this.tools.set(name, tool);
		return tool;
	}

	deleteTool(name: string): boolean {
		const tool = this.tools.get(name);
		// Only allow deleting custom tools or non-default tools
		if (!tool) return false;
		if (!tool.custom && this.tools.size > 1) {
			// Built-in tools can be "removed" from the list
			this.tools.delete(name);
			return true;
		}
		return this.tools.delete(name);
	}

	// ── Cron Jobs ──────────────────────────────────────────────────────────────

	listCronJobs(): CronJob[] {
		return Array.from(this.cronJobs.values());
	}

	createCronJob(schedule: string, message: string): CronJob {
		const job: CronJob = {
			id: generateId(),
			schedule,
			message,
			createdAt: Date.now(),
			status: "active",
		};
		this.cronJobs.set(job.id, job);
		return job;
	}

	deleteCronJob(id: string): boolean {
		return this.cronJobs.delete(id);
	}

	// ── Agent Config ───────────────────────────────────────────────────────────

	getAgentConfig(): import("./types.js").AgentConfig {
		const shared = getSharedAgentConfig();
		this.agentConfig.systemPrompt = shared.systemPrompt;
		this.agentConfig.language = shared.language;
		return { ...this.agentConfig };
	}

	updateAgentConfig(
		update: Partial<import("./types.js").AgentConfig>,
	): import("./types.js").AgentConfig {
		if (update.systemPrompt !== undefined) {
			this.agentConfig.systemPrompt = update.systemPrompt;
		}
		if (update.language !== undefined) {
			this.agentConfig.language = update.language;
		}
		// Persist to shared config (writes to disk, propagates to AgentLoop, CLI, etc.)
		setSharedAgentConfig({
			systemPrompt: this.agentConfig.systemPrompt,
			language: this.agentConfig.language,
		});
		return this.getAgentConfig();
	}

	// ── REST API ───────────────────────────────────────────────────────────────

	handleRequest(method: string, path: string, body: unknown): APIResponse {
		// GET /api/sessions
		if (method === "GET" && path === "/api/sessions") {
			return {
				status: 200,
				body: this.listSessions(),
			};
		}

		// POST /api/sessions
		if (method === "POST" && path === "/api/sessions") {
			const req = body as { userId?: string };
			const session = this.createSession(req.userId ?? "anonymous");
			if (session) {
				return { status: 201, body: session };
			}
			return { status: 400, body: { error: "Max sessions reached" } };
		}

		// GET /api/messages?sessionId=xxx
		if (method === "GET" && path.startsWith("/api/messages")) {
			const url = new URL(path, "http://localhost");
			const sessionId = url.searchParams.get("sessionId") ?? "";
			return { status: 200, body: this.getMessages(sessionId) };
		}

		// POST /api/messages
		if (method === "POST" && path === "/api/messages") {
			const req = body as {
				sessionId?: string;
				role?: string;
				content?: string;
			};
			const message = this.addMessage(req.sessionId ?? "", {
				role: req.role as "user" | "assistant" | "system",
				content: req.content ?? "",
			});
			if (message) {
				return { status: 201, body: message };
			}
			return { status: 404, body: { error: "Session not found" } };
		}

		// GET /api/tools
		if (method === "GET" && path === "/api/tools") {
			return { status: 200, body: this.listTools() };
		}

		// POST /api/tools
		if (method === "POST" && path === "/api/tools") {
			const req = body as {
				name?: string;
				description?: string;
				category?: string;
			};
			if (!req.name) {
				return { status: 400, body: { error: "name is required" } };
			}
			if (this.tools.has(req.name)) {
				return { status: 409, body: { error: "Tool already exists" } };
			}
			const tool = this.addTool(
				req.name,
				req.description || "",
				req.category || "custom",
			);
			return { status: 201, body: tool };
		}

		// DELETE /api/tools/:name
		if (method === "DELETE" && path.startsWith("/api/tools/")) {
			const name = decodeURIComponent(path.slice("/api/tools/".length));
			if (this.deleteTool(name)) {
				return { status: 200, body: { success: true } };
			}
			return { status: 404, body: { error: "Tool not found" } };
		}

		// GET /api/cron
		if (method === "GET" && path === "/api/cron") {
			return { status: 200, body: this.listCronJobs() };
		}

		// POST /api/cron
		if (method === "POST" && path === "/api/cron") {
			const req = body as { schedule?: string; message?: string };
			if (!req.schedule || !req.message) {
				return {
					status: 400,
					body: { error: "schedule and message are required" },
				};
			}
			const job = this.createCronJob(req.schedule, req.message);
			return { status: 201, body: job };
		}

		// DELETE /api/cron/:id
		if (method === "DELETE" && path.startsWith("/api/cron/")) {
			const id = path.slice("/api/cron/".length);
			if (this.deleteCronJob(id)) {
				return { status: 200, body: { success: true } };
			}
			return { status: 404, body: { error: "Cron job not found" } };
		}

		// GET /api/config/agent
		if (method === "GET" && path === "/api/config/agent") {
			return { status: 200, body: this.getAgentConfig() };
		}

		// PUT /api/config/agent
		if (method === "PUT" && path === "/api/config/agent") {
			const req = body as Partial<import("./types.js").AgentConfig>;
			return { status: 200, body: this.updateAgentConfig(req) };
		}

		// GET /api/health
		if (method === "GET" && path === "/api/health") {
			return { status: 200, body: this.healthCheck() };
		}

		// GET /api/stats
		if (method === "GET" && path === "/api/stats") {
			return { status: 200, body: this.getStats() };
		}

		// GET /api/analytics/summary
		if (method === "GET" && path === "/api/analytics/summary") {
			return { status: 200, body: this.getAnalyticsSummary() };
		}

		return { status: 404, body: { error: "Not found" } };
	}

	// ── Lifecycle ──────────────────────────────────────────────────────────────

	async start(): Promise<void> {
		this.status = "started";
		this.startedAt = Date.now();
	}

	async stop(): Promise<void> {
		this.status = "stopped";
		this.startedAt = null;
		for (const client of this.wsClients.values()) {
			client.connected = false;
		}
		this.wsClients.clear();
	}
}
