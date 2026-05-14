/**
 * Tests for WebUI Chat Component
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { ChatComponent } from '../../src/webui/frontend/chat.js';

describe('ChatComponent', () => {
  let chat: ChatComponent;

  beforeEach(() => {
    chat = new ChatComponent('session-123');
  });

  describe('constructor', () => {
    it('creates chat with session ID', () => {
      strictEqual(chat.sessionId, 'session-123');
    });

    it('starts with empty messages', () => {
      strictEqual(chat.state.messages.length, 0);
    });

    it('starts with no loading state', () => {
      strictEqual(chat.state.isLoading, false);
    });

    it('starts with no streaming state', () => {
      strictEqual(chat.state.isStreaming, false);
    });

    it('starts with no error', () => {
      strictEqual(chat.state.error, null);
    });
  });

  describe('message handling', () => {
    it('adds user message', () => {
      chat.addMessage('user', 'Hello');
      strictEqual(chat.state.messages.length, 1);
      strictEqual(chat.state.messages[0].role, 'user');
      strictEqual(chat.state.messages[0].content, 'Hello');
    });

    it('adds assistant message', () => {
      chat.addMessage('assistant', 'Hi there!');
      strictEqual(chat.state.messages[0].role, 'assistant');
    });

    it('adds system message', () => {
      chat.addMessage('system', 'System notice');
      strictEqual(chat.state.messages[0].role, 'system');
    });

    it('message has unique ID', () => {
      chat.addMessage('user', 'First');
      chat.addMessage('user', 'Second');
      ok(chat.state.messages[0].id !== chat.state.messages[1].id, 'IDs are unique');
    });

    it('message has timestamp', () => {
      chat.addMessage('user', 'Test');
      ok(chat.state.messages[0].timestamp > 0, 'has timestamp');
    });

    it('message belongs to session', () => {
      chat.addMessage('user', 'Test');
      strictEqual(chat.state.messages[0].sessionId, 'session-123');
    });
  });

  describe('streaming', () => {
    it('starts streaming', () => {
      chat.startStreaming();
      strictEqual(chat.state.isStreaming, true);
    });

    it('stops streaming', () => {
      chat.startStreaming();
      chat.stopStreaming();
      strictEqual(chat.state.isStreaming, false);
    });

    it('appends to streaming message', () => {
      chat.startStreaming();
      chat.appendStreaming('Hello ');
      chat.appendStreaming('World');
      strictEqual(chat.state.messages[0].content, 'Hello World');
      ok(chat.state.messages[0].isStreaming, 'marked as streaming');
    });

    it('finalizes streaming message', () => {
      chat.startStreaming();
      chat.appendStreaming('Response');
      chat.finalizeStreaming();
      strictEqual(chat.state.isStreaming, false);
      ok(!chat.state.messages[0].isStreaming, 'no longer streaming');
    });
  });

  describe('loading state', () => {
    it('sets loading state', () => {
      chat.setLoading(true);
      strictEqual(chat.state.isLoading, true);
    });

    it('clears loading state', () => {
      chat.setLoading(true);
      chat.setLoading(false);
      strictEqual(chat.state.isLoading, false);
    });
  });

  describe('error handling', () => {
    it('sets error message', () => {
      chat.setError('Connection failed');
      strictEqual(chat.state.error, 'Connection failed');
    });

    it('clears error', () => {
      chat.setError('Error occurred');
      chat.clearError();
      strictEqual(chat.state.error, null);
    });
  });

  describe('clear messages', () => {
    it('clears all messages', () => {
      chat.addMessage('user', 'First');
      chat.addMessage('assistant', 'Second');
      chat.clearMessages();
      strictEqual(chat.state.messages.length, 0);
    });

    it('clears error when clearing messages', () => {
      chat.setError('Error');
      chat.clearMessages();
      strictEqual(chat.state.error, null);
    });
  });

  describe('render', () => {
    it('renders chat messages as HTML', () => {
      chat.addMessage('user', 'Hello');
      const html = chat.render();
      ok(typeof html === 'string', 'renders string');
      ok(html.includes('Hello'), 'includes message content');
    });

    it('renders empty state', () => {
      const html = chat.render();
      ok(html.includes('No messages'), 'shows empty state');
    });

    it('renders loading indicator', () => {
      chat.setLoading(true);
      const html = chat.render();
      ok(html.includes('loading'), 'shows loading indicator');
    });

    it('renders error state', () => {
      chat.setError('Something went wrong');
      const html = chat.render();
      ok(html.includes('error'), 'shows error state');
    });

    it('renders message with role class', () => {
      chat.addMessage('user', 'Test');
      const html = chat.render();
      ok(html.includes('role-user'), 'includes role class');
    });
  });

  describe('message count', () => {
    it('returns message count', () => {
      chat.addMessage('user', 'First');
      chat.addMessage('assistant', 'Second');
      strictEqual(chat.getMessageCount(), 2);
    });

    it('returns zero for empty chat', () => {
      strictEqual(chat.getMessageCount(), 0);
    });
  });

  describe('WebSocket integration', () => {
    it('starts disconnected', () => {
      strictEqual(chat.wsConnected, false);
    });

    it('connects WebSocket', () => {
      chat.connectWebSocket('ws://localhost:3000/ws');
      strictEqual(chat.wsConnected, true);
    });

    it('disconnects WebSocket', () => {
      chat.connectWebSocket('ws://localhost:3000/ws');
      chat.disconnectWebSocket();
      strictEqual(chat.wsConnected, false);
    });

    it('sends message via WebSocket when connected', () => {
      chat.connectWebSocket('ws://localhost:3000/ws');
      const result = chat.sendMessage('Hello via WS');
      ok(result, 'returns true');
      strictEqual(chat.state.messages.length, 2); // user message + WS echo
    });

    it('does not send via WebSocket when disconnected', () => {
      const result = chat.sendMessage('Hello offline');
      ok(result, 'still returns true');
      strictEqual(chat.state.messages.length, 1);
    });

    it('handles incoming WebSocket messages', () => {
      chat.connectWebSocket('ws://localhost:3000/ws');
      // Simulate incoming message via internal handler
      chat.addMessage('assistant', 'WS response');
      strictEqual(chat.state.messages.length, 1);
      strictEqual(chat.state.messages[0].role, 'assistant');
    });

    it('disconnects on session change', () => {
      chat.connectWebSocket('ws://localhost:3000/ws');
      chat.setSessions([
        { id: 'session-123', userId: 'user-1', createdAt: Date.now(), lastActivity: Date.now(), messageCount: 0 },
        { id: 'session-456', userId: 'user-1', createdAt: Date.now(), lastActivity: Date.now(), messageCount: 0 },
      ]);
      chat.selectSession('session-456');
      strictEqual(chat.wsConnected, false);
    });
  });
});
