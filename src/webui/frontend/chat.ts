/**
 * WebUI Chat Component
 * 
 * Manages chat messages, streaming state, and rendering.
 */

import type { ChatMessage, ChatState, SessionInfo } from './types.js';
import { WebSocketManager } from './websocket-manager.js';
import type { WebSocketMessage } from '../types.js';

function generateId(): string {
  return `_${Math.random().toString(36).slice(2, 11)}`;
}

export class ChatComponent {
  public sessionId: string;
  public readonly state: ChatState;
  public availableSessions: SessionInfo[] = [];

  private readonly wsManager: WebSocketManager;
  private wsConnected_ = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.state = {
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
    };
    this.wsManager = new WebSocketManager();
    this.setupWebSocketHandlers();
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────

  get wsConnected(): boolean {
    return this.wsConnected_;
  }

  connectWebSocket(url: string, apiKey?: string, pollingInterval = 0): void {
    this.wsManager.connect({
      url,
      sessionId: this.sessionId,
      apiKey,
      pollingInterval,
    });
  }

  disconnectWebSocket(): void {
    this.wsManager.disconnect();
    this.wsConnected_ = false;
  }

  private setupWebSocketHandlers(): void {
    this.wsManager.onMessage((msg: WebSocketMessage) => {
      this.handleWebSocketMessage(msg);
    });

    this.wsManager.onStatus((connected: boolean, error?: string) => {
      this.wsConnected_ = connected;
      if (error) {
        this.setError(`WebSocket: ${error}`);
      }
    });
  }

  private handleWebSocketMessage(msg: WebSocketMessage): void {
    switch (msg.type) {
      case 'message': {
        const data = msg.data as { role?: string; content?: string };
        if (data?.role && data?.content !== undefined) {
          this.addMessage(data.role as 'user' | 'assistant' | 'system', data.content);
        }
        break;
      }
      case 'stream_start': {
        this.startStreaming();
        break;
      }
      case 'stream_chunk': {
        const data = msg.data as { text?: string };
        if (data?.text !== undefined) {
          this.appendStreaming(data.text);
        }
        break;
      }
      case 'stream_end': {
        this.finalizeStreaming();
        break;
      }
      case 'error': {
        const data = msg.data as { message?: string };
        if (data?.message) {
          this.setError(data.message);
        }
        break;
      }
      case 'session_update': {
        // Session metadata updated — no action needed
        break;
      }
      case 'ping':
      case 'pong': {
        // Keep-alive — no action needed
        break;
      }
    }
  }

  // ── Session Selection ──────────────────────────────────────────────────────

  setSessions(sessions: SessionInfo[]): void {
    this.availableSessions = [...sessions];
  }

  selectSession(sessionId: string): boolean {
    const session = this.availableSessions.find((s) => s.id === sessionId);
    if (!session) return false;

    this.sessionId = sessionId;
    this.clearMessages();

    // Reconnect WebSocket with new session
    if (this.wsConnected_) {
      this.disconnectWebSocket();
      // Note: caller should reconnect with new session ID
    }

    return true;
  }

  // ── Message Handling ───────────────────────────────────────────────────────

  sendMessage(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) return false;

    this.addMessage('user', trimmed);

    // Send via WebSocket if connected
    if (this.wsConnected_) {
      this.wsManager.sendMessage(trimmed);
    }

    return true;
  }

  addMessage(role: 'user' | 'assistant' | 'system', content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateId(),
      sessionId: this.sessionId,
      role,
      content,
      timestamp: Date.now(),
      isStreaming: false,
    };

    this.state.messages.push(message);
    return message;
  }

  // ── Streaming ──────────────────────────────────────────────────────────────

  startStreaming(): void {
    this.state.isStreaming = true;
    this.addMessage('assistant', '');
  }

  stopStreaming(): void {
    this.state.isStreaming = false;
  }

  appendStreaming(text: string): void {
    if (this.state.messages.length > 0) {
      const last = this.state.messages[this.state.messages.length - 1];
      last.content += text;
      last.isStreaming = true;
    }
  }

  finalizeStreaming(): void {
    this.state.isStreaming = false;
    if (this.state.messages.length > 0) {
      this.state.messages[this.state.messages.length - 1].isStreaming = false;
    }
  }

  // ── Loading & Error ────────────────────────────────────────────────────────

  setLoading(loading: boolean): void {
    this.state.isLoading = loading;
  }

  setError(error: string): void {
    this.state.error = error;
  }

  clearError(): void {
    this.state.error = null;
  }

  // ── Clear ──────────────────────────────────────────────────────────────────

  clearMessages(): void {
    this.state.messages = [];
    this.state.error = null;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getMessageCount(): number {
    return this.state.messages.length;
  }

  // ── Markdown Rendering ─────────────────────────────────────────────────────

  renderMarkdown(text: string): string {
    if (!text) return '';

    let html = text;

    // Code blocks (```language\ncode\n```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      return `<pre class="code-block language-${lang}"><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**text**)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic (*text*)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Headings (## text)
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

    // Blockquotes (> text)
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rules (---)
    html = html.replace(/^---$/gm, '<hr>');

    // Unordered lists (- item)
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Ordered lists (1. item)
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    // Only wrap if not already wrapped in <ul>
    html = html.replace(/((?!<ul>)(?:<li>.*<\/li>\n?)+)/g, '<ol>$1</ol>');

    return html;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  renderSessionSelector(): string {
    if (this.availableSessions.length === 0) {
      return `<div class="session-selector">
        <span class="empty-state">No sessions</span>
      </div>`;
    }

    const optionsHtml = this.availableSessions
      .map(
        (s) =>
          `<option value="${s.id}" ${s.id === this.sessionId ? 'selected' : ''}>${s.id} (${s.messageCount} messages)</option>`,
      )
      .join('\n');

    return `<div class="session-selector">
      <label for="session-select">Session:</label>
      <select id="session-select" data-session-id="${this.sessionId}">
        ${optionsHtml}
      </select>
    </div>`;
  }

  renderInput(): string {
    const disabledAttr = this.state.isStreaming ? 'disabled' : '';
    return `<div class="chat-input">
      <input type="text" id="message-input" placeholder="Type a message..." ${disabledAttr} />
      <button id="send-button" ${disabledAttr}>Send</button>
    </div>`;
  }

  render(): string {
    const sessionSelectorHtml = this.renderSessionSelector();

    if (this.state.isLoading) {
      return `<div class="chat-container loading">
        ${sessionSelectorHtml}
        <div class="loading-indicator">Loading...</div>
        ${this.renderInput()}
      </div>`;
    }

    if (this.state.error) {
      return `<div class="chat-container error">
        ${sessionSelectorHtml}
        <div class="error-message">${this.state.error}</div>
        ${this.renderInput()}
      </div>`;
    }

    if (this.state.messages.length === 0) {
      return `<div class="chat-container">
        ${sessionSelectorHtml}
        <div class="empty-state">No messages</div>
        ${this.renderInput()}
      </div>`;
    }

    const messagesHtml = this.state.messages
      .map((msg) => {
        const roleClass = `role-${msg.role}`;
        const streamingClass = msg.isStreaming ? ' streaming' : '';
        const content = msg.role === 'assistant' ? this.renderMarkdown(msg.content) : this.escapeHtml(msg.content);
        return `<div class="message ${roleClass}${streamingClass}" data-id="${msg.id}">
          <span class="message-role">${msg.role}</span>
          <span class="message-content">${content}</span>
          <span class="message-timestamp">${new Date(msg.timestamp).toISOString()}</span>
        </div>`;
      })
      .join('\n');

    return `<div class="chat-container">
      ${sessionSelectorHtml}
      <div class="messages">${messagesHtml}</div>
      ${this.renderInput()}
    </div>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
