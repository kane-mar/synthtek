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
  role: 'user' | 'assistant' | 'system';
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

// ── WebSocket Message Protocol ────────────────────────────────────────────────

export interface WebSocketMessage {
  type: 'message' | 'stream_start' | 'stream_chunk' | 'stream_end' | 'error' | 'ping' | 'pong' | 'session_update';
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
export type WebSocketStatusHandler = (connected: boolean, error?: string) => void;
