/**
 * WebUI Frontend Types
 */

// ── Theme ─────────────────────────────────────────────────────────────────────

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeConfig {
	mode: ThemeMode;
	primaryColor: string;
	fontSize: number;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
	id: string;
	sessionId: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	isStreaming?: boolean;
}

export interface ChatState {
	messages: ChatMessage[];
	isLoading: boolean;
	isStreaming: boolean;
	error: string | null;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
	activeSessions: number;
	totalMessages: number;
	uptime: number;
	pluginsLoaded: number;
	channelsConnected: number;
	cpuUsage: number;
	memoryUsage: number;
}

export interface PluginInfo {
	name: string;
	version: string;
	enabled: boolean;
	status: "loaded" | "error" | "disabled";
}

export interface ChannelInfo {
	name: string;
	status: "connected" | "disconnected" | "connecting";
	messagesReceived: number;
	messagesSent: number;
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface ConfigField {
	key: string;
	label: string;
	type: "text" | "number" | "boolean" | "select" | "secret";
	value: string | number | boolean;
	options?: string[];
	required?: boolean;
	description?: string;
}

export interface ConfigSection {
	name: string;
	fields: ConfigField[];
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface SessionInfo {
	id: string;
	userId: string;
	createdAt: number;
	lastActivity: number;
	messageCount: number;
}

// ── Media Preview ─────────────────────────────────────────────────────────────

export interface MediaPreviewInfo {
	filename: string;
	mimeType: string;
	size: number;
	url: string;
	thumbnailUrl?: string;
}

// ── Navigation ────────────────────────────────────────────────────────────────

export type PageName =
	| "chat"
	| "plugins"
	| "config"
	| "sessions"
	| "media"
	| "analytics";

export interface NavigationItem {
	name: PageName;
	label: string;
	icon: string;
}

// ── App State ─────────────────────────────────────────────────────────────────

export interface AppState {
	currentPage: PageName;
	activeSessionId: string | null;
	theme: ThemeConfig;
	isAuthenticated: boolean;
	notifications: NotificationItem[];
}

export interface NotificationItem {
	id: string;
	type: "info" | "success" | "warning" | "error";
	message: string;
	timestamp: number;
	dismissed: boolean;
}

// ── API Client ────────────────────────────────────────────────────────────────

export interface APIClientConfig {
	baseUrl: string;
	apiKey: string;
	timeout: number;
}

export interface APIResponse<T = unknown> {
	status: number;
	body: T;
	error?: string;
}
