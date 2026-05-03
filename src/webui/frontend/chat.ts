/**
 * WebUI Chat Component
 * 
 * Manages chat messages, streaming state, and rendering.
 */

import type { ChatMessage, ChatState } from './types.js';

function generateId(): string {
  return `_${Math.random().toString(36).slice(2, 11)}`;
}

export class ChatComponent {
  public readonly sessionId: string;
  public readonly state: ChatState;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.state = {
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
    };
  }

  // ── Message Handling ───────────────────────────────────────────────────────

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

  // ── Rendering ──────────────────────────────────────────────────────────────

  render(): string {
    if (this.state.isLoading) {
      return `<div class="chat-container loading">
        <div class="loading-indicator">Loading...</div>
      </div>`;
    }

    if (this.state.error) {
      return `<div class="chat-container error">
        <div class="error-message">${this.state.error}</div>
      </div>`;
    }

    if (this.state.messages.length === 0) {
      return `<div class="chat-container">
        <div class="empty-state">No messages</div>
      </div>`;
    }

    const messagesHtml = this.state.messages
      .map((msg) => {
        const roleClass = `role-${msg.role}`;
        const streamingClass = msg.isStreaming ? ' streaming' : '';
        return `<div class="message ${roleClass}${streamingClass}" data-id="${msg.id}">
          <span class="message-role">${msg.role}</span>
          <span class="message-content">${this.escapeHtml(msg.content)}</span>
          <span class="message-timestamp">${new Date(msg.timestamp).toISOString()}</span>
        </div>`;
      })
      .join('\n');

    return `<div class="chat-container">
      <div class="messages">${messagesHtml}</div>
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
