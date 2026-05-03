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
