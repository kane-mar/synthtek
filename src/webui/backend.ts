/**
 * WebUI Backend
 *
 * REST API + WebSocket backend for the WebUI frontend.
 * Handles sessions, messages, file uploads, authentication, and analytics.
 */

import {
	getAgentConfig as getSharedAgentConfig,
	resetAgentConfig as resetSharedAgentConfig,
	setAgentConfig as setSharedAgentConfig,
} from "../config/agent-config.js";
import { ConversationStore } from "../messaging/conversation-store.js";
import { AnalyticsTracker } from "./analytics.js";
import type { ProviderManager } from "./provider-manager.js";
import { handleProviderRoutes } from "./provider-routes.js";
import type { SkillManager } from "./skill-manager.js";
import { handleSkillRoutes } from "./skill-routes.js";
import type {
	AnalyticsSummary,
	APIResponse,
	CronJob,
	FileUploadResult,
	Message,
	Session,
	ToolInfo,
	WebUIConfig,
	WebUIStats,
} from "./types.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** Built-in theme definitions served by GET /api/themes */
const AVAILABLE_THEMES: Array<{ id: string; name: string }> = [
	{ id: "dark", name: "Dark (GitHub)" },
	{ id: "light", name: "Light" },
	{ id: "midnight", name: "Midnight" },
	{ id: "ocean", name: "Ocean" },
	{ id: "nord", name: "Nord" },
];

function generateId(): string {
	return `_${Math.random().toString(36).slice(2, 11)}`;
}

type RouteHandler = (body: unknown, params: RouteParams) => APIResponse;

interface RouteEntry {
	method: string;
	/** Exact path, e.g. "/api/sessions" */
	exactPath?: string;
	/** Prefix path for routes with path params, e.g. "/api/tools/" */
	prefixPath?: string;
	/** Name of the dynamic path parameter (e.g. "name" for /api/tools/:name) */
	paramName?: string;
	handler: RouteHandler;
}

export interface RouteParams extends Record<string, string> {
	/** Full path including query string, if available */
	_fullPath: string;
}

export class WebUIBackend {
	public status: "started" | "stopped" = "stopped";
	public readonly analytics: AnalyticsTracker;
	public readonly conversationStore: ConversationStore;

	private readonly config: WebUIConfig;
	private readonly sessions: Map<string, Session> = new Map();
	private readonly cronJobs: Map<string, CronJob> = new Map();
	private readonly routes: RouteEntry[] = [];
	private agentConfig: import("./types.js").AgentConfig = {
		systemPrompt: getSharedAgentConfig().systemPrompt,
		language: getSharedAgentConfig().language,
		maxToolCalls: getSharedAgentConfig().maxToolCalls,
		maxRetries: getSharedAgentConfig().maxRetries,
		temperature: getSharedAgentConfig().temperature,
		maxTokens: getSharedAgentConfig().maxTokens,
	};
	private startedAt: number | null = null;

	constructor(
		config: WebUIConfig,
		workspaceDir?: string,
		private providerManager?: ProviderManager,
		private skillManager?: SkillManager,
	) {
		this.config = config;
		this.analytics = new AnalyticsTracker();
		this.conversationStore = new ConversationStore(
			workspaceDir ?? process.cwd(),
		);
		this.loadSessionsFromStore();
		this.initDefaultTools();
		this.initRoutes();
	}

	/** Load persisted conversations as sessions on startup. */
	private loadSessionsFromStore(): void {
		const convs = this.conversationStore.list();
		for (const conv of convs) {
			if (conv.messages.length === 0) continue;
			const session: Session = {
				id: conv.id,
				userId: "persisted",
				createdAt: conv.createdAt,
				lastActivity: conv.updatedAt,
				messages: conv.messages.map((m, i) => ({
					id: `msg_${conv.id}_${i}`,
					sessionId: conv.id,
					role: m.role,
					content: m.content,
					timestamp: m.timestamp,
				})),
			};
			this.sessions.set(session.id, session);
		}
	}

	// ── Route Registration ────────────────────────────────────────────────────

	private initRoutes(): void {
		this.get("/api/sessions", (_body, _params) => ({
			status: 200,
			body: this.listSessions(),
		}));

		this.post("/api/sessions", (body) => {
			const req = body as { userId?: string };
			const session = this.createSession(req.userId ?? "anonymous");
			if (session) {
				return { status: 201, body: session };
			}
			return { status: 400, body: { error: "Max sessions reached" } };
		});

		this.getWithPrefix("/api/messages", (_body, params) => {
			const url = new URL(params._fullPath, "http://localhost");
			const sessionId = url.searchParams.get("sessionId") ?? "";
			return { status: 200, body: this.syncAndGetMessages(sessionId) };
		});

		this.post("/api/messages", (body) => {
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
		});

		this.get("/api/tools", (_body, _params) => ({
			status: 200,
			body: this.listTools(),
		}));

		this.post("/api/tools", (body) => {
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
		});

		this.delete("/api/tools/:name", (_body, params) => {
			const name = decodeURIComponent(params.name);
			if (this.deleteTool(name)) {
				return { status: 200, body: { success: true } };
			}
			return { status: 404, body: { error: "Tool not found" } };
		});

		this.get("/api/cron", (_body, _params) => ({
			status: 200,
			body: this.listCronJobs(),
		}));

		this.post("/api/cron", (body) => {
			const req = body as { schedule?: string; message?: string };
			if (!req.schedule || !req.message) {
				return {
					status: 400,
					body: { error: "schedule and message are required" },
				};
			}
			const job = this.createCronJob(req.schedule, req.message);
			return { status: 201, body: job };
		});

		this.delete("/api/cron/:id", (_body, params) => {
			const id = params.id;
			if (this.deleteCronJob(id)) {
				return { status: 200, body: { success: true } };
			}
			return { status: 404, body: { error: "Cron job not found" } };
		});

		this.get("/api/config/agent", (_body, _params) => ({
			status: 200,
			body: this.getAgentConfig(),
		}));

		this.put("/api/config/agent", (body) => {
			const req = body as Record<string, unknown>;
			const validation = this.validateAgentConfig(req);
			if (!validation.valid) {
				return { status: 400, body: { error: validation.error } };
			}
			return {
				status: 200,
				body: this.updateAgentConfig(
					req as Partial<import("./types.js").AgentConfig>,
				),
			};
		});

		this.delete("/api/config/agent", (_body, _params) => ({
			status: 200,
			body: this.resetAgentConfig(),
		}));

		this.get("/api/health", (_body, _params) => ({
			status: 200,
			body: this.healthCheck(),
		}));

		this.get("/api/stats", (_body, _params) => ({
			status: 200,
			body: this.getStats(),
		}));

		this.get("/api/analytics/summary", (_body, _params) => ({
			status: 200,
			body: this.getAnalyticsSummary(),
		}));

		this.get("/api/analytics/token-usage", (_body, _params) => ({
			status: 200,
			body: this.analytics.getTokenUsageByHour(),
		}));

		this.get("/api/analytics/provider-health", (_body, _params) => ({
			status: 200,
			body: this.analytics.getProviderHealth(),
		}));

		this.get("/api/themes", (_body, _params) => ({
			status: 200,
			body: this.listThemes(),
		}));

		this.get("/api/config", (_body, _params) => ({
			status: 200,
			body: this.getSanitizedConfig(),
		}));

		this.delete("/api/sessions/:id", (_body, params) => ({
			status: this.deleteSession(params.id) ? 200 : 404,
			body: {},
		}));
	}

	private register(method: string, path: string, handler: RouteHandler): void {
		if (path.includes(":")) {
			const prefix = path.split(":")[0];
			const paramName = path.slice(prefix.length + 1);
			this.routes.push({ method, prefixPath: prefix, paramName, handler });
		} else {
			this.routes.push({ method, exactPath: path, handler });
		}
	}

	private get(path: string, handler: RouteHandler): void {
		this.register("GET", path, handler);
	}

	private post(path: string, handler: RouteHandler): void {
		this.register("POST", path, handler);
	}

	private put(path: string, handler: RouteHandler): void {
		this.register("PUT", path, handler);
	}

	private delete(path: string, handler: RouteHandler): void {
		this.register("DELETE", path, handler);
	}

	/** Register a prefix-based route (for routes with query params) */
	private getWithPrefix(prefix: string, handler: RouteHandler): void {
		this.routes.push({ method: "GET", prefixPath: prefix, handler });
	}

	// ── Session Management ─────────────────────────────────────────────────────

	createSession(userId: string): Session | null {
		if (this.sessions.size >= this.config.maxSessions) {
			return null;
		}

		const sessionId = generateId();
		const session: Session = {
			id: sessionId,
			userId,
			createdAt: Date.now(),
			lastActivity: Date.now(),
			messages: [],
		};

		this.sessions.set(session.id, session);

		// Persist so the TUI can see this conversation
		const conv = this.conversationStore.create(`Chat with ${userId}`);
		// Re-align: delete the store-generated conv and save one with session id
		if (conv) {
			this.conversationStore.delete(conv.id);
			this.conversationStore.save({
				...conv,
				id: sessionId,
			});
		}

		return session;
	}

	getSession(id: string): Session | null {
		// Always prefer store data (source of truth)
		const conv = this.conversationStore.get(id);
		if (conv && conv.messages.length > 0) {
			const session = this.convToSession(conv);
			this.sessions.set(session.id, session); // sync memory
			return session;
		}
		return this.sessions.get(id) ?? null;
	}

	listSessions(): Session[] {
		// Start with store conversations (source of truth)
		const convs = this.conversationStore.list();
		const merged = new Map<string, Session>();
		for (const conv of convs) {
			if (conv.messages.length === 0) continue;
			const session = this.convToSession(conv);
			merged.set(session.id, session);
		}
		// Merge in-memory sessions that aren't yet persisted
		for (const [id, session] of this.sessions) {
			if (!merged.has(id)) {
				merged.set(id, session);
			}
		}
		// Sort by most recent activity first
		return Array.from(merged.values()).sort(
			(a, b) => b.lastActivity - a.lastActivity,
		);
	}

	private convToSession(conv: {
		id: string;
		createdAt: number;
		updatedAt: number;
		messages: Array<{ role: string; content: string; timestamp: number }>;
	}): Session {
		return {
			id: conv.id,
			userId: "persisted",
			createdAt: conv.createdAt,
			lastActivity: conv.updatedAt,
			messages: conv.messages.map((m, i) => ({
				id: `msg_${conv.id}_${i}`,
				sessionId: conv.id,
				role: m.role as "user" | "assistant" | "system",
				content: m.content,
				timestamp: m.timestamp,
			})),
		};
	}

	deleteSession(id: string): boolean {
		this.conversationStore.delete(id);
		return this.sessions.delete(id);
	}

	// ── Message Handling ───────────────────────────────────────────────────────

	addMessage(
		sessionId: string,
		msg: {
			role: string;
			content: string;
			toolCallId?: string;
			toolCalls?: Array<{
				id: string;
				name: string;
				arguments: Record<string, unknown>;
			}>;
		},
	): Message | null {
		// Load or create session from store (source of truth)
		const session = this.getSession(sessionId);
		if (!session) {
			return null;
		}

		const message: Message = {
			id: generateId(),
			sessionId,
			role: msg.role as Message["role"],
			content: msg.content,
			timestamp: Date.now(),
			toolCallId: msg.toolCallId,
			toolCalls: msg.toolCalls,
		};

		session.messages.push(message);
		session.lastActivity = Date.now();

		// Persist to shared store
		this.conversationStore.addMessage(sessionId, {
			role: msg.role as "user" | "assistant" | "system",
			content: msg.content,
		});

		return message;
	}

	/**
	 * Get messages for a session, syncing from the conversation store first.
	 * Note: syncs state from the persistent store before returning.
	 */
	syncAndGetMessages(sessionId: string): Message[] {
		// Always load from store (source of truth)
		const conv = this.conversationStore.get(sessionId);
		if (conv) {
			// Sync in-memory session if it exists
			const session = this.sessions.get(sessionId);
			if (session) {
				const updated = this.convToSession(conv);
				session.messages = updated.messages;
				session.lastActivity = updated.lastActivity;
			}
			return this.convToSession(conv).messages;
		}
		const session = this.sessions.get(sessionId);
		return session ? session.messages : [];
	}

	// ── Authentication ─────────────────────────────────────────────────────────

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

	// ── Themes ─────────────────────────────────────────────────────────────────

	listThemes(): Array<{ id: string; name: string }> {
		return [...AVAILABLE_THEMES];
	}

	// ── Plugins ────────────────────────────────────────────────────────────────

	// ── Sanitized Config ───────────────────────────────────────────────────────

	getSanitizedConfig(): Record<string, unknown> {
		return {
			host: this.config.host,
			port: this.config.port,
			maxSessions: this.config.maxSessions,
			sessionTimeout: this.config.sessionTimeout,
			apiKeyConfigured: this.config.apiKey !== "",
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
		this.agentConfig.maxToolCalls = shared.maxToolCalls;
		this.agentConfig.maxRetries = shared.maxRetries;
		this.agentConfig.temperature = shared.temperature;
		this.agentConfig.maxTokens = shared.maxTokens;
		return { ...this.agentConfig };
	}

	validateAgentConfig(
		update: Record<string, unknown>,
	): { valid: true } | { valid: false; error: string } {
		if (
			update.systemPrompt !== undefined &&
			typeof update.systemPrompt !== "string"
		) {
			return { valid: false, error: "systemPrompt must be a string" };
		}
		if (update.language !== undefined && typeof update.language !== "string") {
			return { valid: false, error: "language must be a string" };
		}
		if (
			update.maxToolCalls !== undefined &&
			typeof update.maxToolCalls !== "number"
		) {
			return { valid: false, error: "maxToolCalls must be a number" };
		}
		if (
			update.maxRetries !== undefined &&
			typeof update.maxRetries !== "number"
		) {
			return { valid: false, error: "maxRetries must be a number" };
		}
		if (
			update.temperature !== undefined &&
			typeof update.temperature !== "number"
		) {
			return { valid: false, error: "temperature must be a number" };
		}
		if (
			update.maxTokens !== undefined &&
			typeof update.maxTokens !== "number"
		) {
			return { valid: false, error: "maxTokens must be a number" };
		}
		return { valid: true };
	}

	updateAgentConfig(
		update: Partial<import("./types.js").AgentConfig>,
	): import("./types.js").AgentConfig {
		const validation = this.validateAgentConfig(
			update as Record<string, unknown>,
		);
		if (!validation.valid) {
			throw new Error(validation.error);
		}

		if (update.systemPrompt !== undefined) {
			this.agentConfig.systemPrompt = update.systemPrompt;
		}
		if (update.language !== undefined) {
			this.agentConfig.language = update.language;
		}
		if (update.maxToolCalls !== undefined) {
			this.agentConfig.maxToolCalls = update.maxToolCalls;
		}
		if (update.maxRetries !== undefined) {
			this.agentConfig.maxRetries = update.maxRetries;
		}
		if (update.temperature !== undefined) {
			this.agentConfig.temperature = update.temperature;
		}
		if (update.maxTokens !== undefined) {
			this.agentConfig.maxTokens = update.maxTokens;
		}
		// Persist to shared config (writes to disk, propagates to AgentLoop, CLI, etc.)
		setSharedAgentConfig({
			systemPrompt: this.agentConfig.systemPrompt,
			language: this.agentConfig.language,
			maxToolCalls: this.agentConfig.maxToolCalls,
			maxRetries: this.agentConfig.maxRetries,
			temperature: this.agentConfig.temperature,
			maxTokens: this.agentConfig.maxTokens,
		});
		return this.getAgentConfig();
	}

	resetAgentConfig(): import("./types.js").AgentConfig {
		const defaults = resetSharedAgentConfig();
		this.agentConfig.systemPrompt = defaults.systemPrompt;
		this.agentConfig.language = defaults.language;
		this.agentConfig.maxToolCalls = defaults.maxToolCalls;
		this.agentConfig.maxRetries = defaults.maxRetries;
		this.agentConfig.temperature = defaults.temperature;
		this.agentConfig.maxTokens = defaults.maxTokens;
		return { ...this.agentConfig };
	}

	// ── REST API ───────────────────────────────────────────────────────────────

	handleRequest(
		method: string,
		fullPath: string,
		body: unknown,
		queryString?: string,
	): APIResponse {
		// Check provider CRUD routes first
		if (this.providerManager) {
			const providerResult = handleProviderRoutes(
				method,
				fullPath,
				body,
				this.providerManager,
			);
			if (providerResult.handled && providerResult.response) {
				return providerResult.response;
			}
		}

		// Check skill routes
		if (this.skillManager) {
			const skillResult = handleSkillRoutes(
				method,
				fullPath,
				body,
				this.skillManager,
			);
			if (skillResult.handled && skillResult.response) {
				return skillResult.response;
			}
		}

		const fullUrl = queryString ? `${fullPath}?${queryString}` : fullPath;

		for (const route of this.routes) {
			if (route.method !== method) continue;

			if (route.exactPath !== undefined && route.exactPath === fullPath) {
				return route.handler(body, { _fullPath: fullUrl });
			}

			if (
				route.prefixPath !== undefined &&
				fullPath.startsWith(route.prefixPath)
			) {
				const paramValue = fullPath.slice(route.prefixPath.length);
				const params: RouteParams = { _fullPath: fullUrl };
				if (route.paramName && paramValue) {
					params[route.paramName] = paramValue;
				}
				return route.handler(body, params);
			}
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
	}
}
