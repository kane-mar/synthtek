/**
 * WebUI Backend
 * 
 * REST API + WebSocket backend for the WebUI frontend.
 * Handles sessions, messages, file uploads, and authentication.
 */

import type {
  WebUIConfig,
  Session,
  Message,
  WebUIStats,
  FileUploadResult,
  APIResponse,
  WebSocketClient,
} from './types.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function generateId(): string {
  return `_${Math.random().toString(36).slice(2, 11)}`;
}

export class WebUIBackend {
  public status: 'started' | 'stopped' = 'stopped';

  private readonly config: WebUIConfig;
  private readonly sessions: Map<string, Session> = new Map();
  private readonly wsClients: Map<string, WebSocketClient> = new Map();
  private startedAt: number | null = null;

  constructor(config: WebUIConfig) {
    this.config = config;
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

  addMessage(sessionId: string, msg: { role: 'user' | 'assistant' | 'system'; content: string }): Message | null {
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
    return key === this.config.apiKey && key.length > 0;
  }

  // ── File Upload Handling ───────────────────────────────────────────────────

  handleFileUpload(
    sessionId: string,
    file: { filename: string; mimeType: string; size: number },
  ): FileUploadResult {
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: 'File exceeds maximum size' };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const url = `http://${this.config.host}:${this.config.port}/api/files/${encodeURIComponent(file.filename)}`;
    return { success: true, url };
  }

  // ── Health & Stats ─────────────────────────────────────────────────────────

  healthCheck(): { name: string; status: string; connected: boolean; uptime: number } {
    return {
      name: 'webui',
      status: this.status,
      connected: this.status === 'started',
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

  // ── REST API ───────────────────────────────────────────────────────────────

  handleRequest(method: string, path: string, body: unknown): APIResponse {
    // GET /api/sessions
    if (method === 'GET' && path === '/api/sessions') {
      return {
        status: 200,
        body: this.listSessions(),
      };
    }

    // POST /api/sessions
    if (method === 'POST' && path === '/api/sessions') {
      const req = body as { userId?: string };
      const session = this.createSession(req.userId ?? 'anonymous');
      if (session) {
        return { status: 201, body: session };
      }
      return { status: 400, body: { error: 'Max sessions reached' } };
    }

    // POST /api/messages
    if (method === 'POST' && path === '/api/messages') {
      const req = body as { sessionId?: string; role?: string; content?: string };
      const message = this.addMessage(req.sessionId ?? '', {
        role: req.role as 'user' | 'assistant' | 'system',
        content: req.content ?? '',
      });
      if (message) {
        return { status: 201, body: message };
      }
      return { status: 404, body: { error: 'Session not found' } };
    }

    // GET /api/health
    if (method === 'GET' && path === '/api/health') {
      return { status: 200, body: this.healthCheck() };
    }

    // GET /api/stats
    if (method === 'GET' && path === '/api/stats') {
      return { status: 200, body: this.getStats() };
    }

    return { status: 404, body: { error: 'Not found' } };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.status = 'started';
    this.startedAt = Date.now();
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.startedAt = null;
    for (const client of this.wsClients.values()) {
      client.connected = false;
    }
    this.wsClients.clear();
  }
}
