/**
 * Tests for WebUI Backend
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { WebUIBackend } from '../../src/webui/backend.js';
import type { WebUIConfig } from '../../src/webui/types.js';

const defaultConfig: WebUIConfig = {
  host: 'localhost',
  port: 3000,
  apiKey: 'test-api-key',
  maxSessions: 100,
  sessionTimeout: 3600,
};

describe('WebUIBackend', () => {
  let backend: WebUIBackend;

  beforeEach(() => {
    backend = new WebUIBackend(defaultConfig);
  });

  describe('constructor', () => {
    it('creates backend with config', () => {
      ok(backend, 'backend created');
    });

    it('starts in stopped state', () => {
      strictEqual(backend.status, 'stopped');
    });
  });

  describe('session management', () => {
    it('creates a new session', () => {
      const session = backend.createSession('user123');
      ok(session, 'session created');
      strictEqual(session.userId, 'user123');
      ok(session.id, 'has session ID');
      ok(session.createdAt, 'has creation timestamp');
    });

    it('retrieves existing session', () => {
      const created = backend.createSession('user456');
      const retrieved = backend.getSession(created!.id);
      ok(retrieved, 'session retrieved');
      strictEqual(retrieved.id, created!.id);
    });

    it('returns null for non-existent session', () => {
      const retrieved = backend.getSession('nonexistent');
      strictEqual(retrieved, null);
    });

    it('lists all sessions', () => {
      backend.createSession('user1');
      backend.createSession('user2');
      const sessions = backend.listSessions();
      strictEqual(sessions.length, 2);
    });

    it('deletes a session', () => {
      const created = backend.createSession('user789');
      const deleted = backend.deleteSession(created!.id);
      ok(deleted, 'session deleted');
      strictEqual(backend.getSession(created!.id), null);
    });

    it('respects max sessions limit', () => {
      const smallConfig: WebUIConfig = { ...defaultConfig, maxSessions: 2 };
      const limitedBackend = new WebUIBackend(smallConfig);
      limitedBackend.createSession('user1');
      limitedBackend.createSession('user2');
      const third = limitedBackend.createSession('user3');
      ok(!third, 'third session rejected');
    });
  });

  describe('message handling', () => {
    it('adds message to session', () => {
      const session = backend.createSession('user123');
      const message = backend.addMessage(session!.id, {
        role: 'user',
        content: 'Hello',
      });
      ok(message, 'message added');
      strictEqual(message.role, 'user');
      strictEqual(message.content, 'Hello');
    });

    it('retrieves messages for session', () => {
      const session = backend.createSession('user456');
      backend.addMessage(session!.id, { role: 'user', content: 'Hi' });
      backend.addMessage(session!.id, { role: 'assistant', content: 'Hello!' });
      const messages = backend.getMessages(session!.id);
      strictEqual(messages.length, 2);
    });

    it('returns empty array for session with no messages', () => {
      const session = backend.createSession('user789');
      const messages = backend.getMessages(session!.id);
      strictEqual(messages.length, 0);
    });
  });

  describe('authentication', () => {
    it('validates correct API key', () => {
      const valid = backend.authenticate('test-api-key');
      ok(valid, 'correct key authenticated');
    });

    it('rejects incorrect API key', () => {
      const valid = backend.authenticate('wrong-key');
      ok(!valid, 'wrong key rejected');
    });

    it('rejects empty API key', () => {
      const valid = backend.authenticate('');
      ok(!valid, 'empty key rejected');
    });
  });

  describe('authentication in open mode (no API key)', () => {
    let openBackend: WebUIBackend;

    beforeEach(() => {
      const openConfig: WebUIConfig = {
        host: 'localhost',
        port: 3000,
        apiKey: '',  // no API key = open mode
        maxSessions: 100,
        sessionTimeout: 3600,
      };
      openBackend = new WebUIBackend(openConfig);
    });

    it('allows any key in open mode', () => {
      ok(openBackend.authenticate('anything'), 'any key accepted');
    });

    it('allows empty key in open mode', () => {
      ok(openBackend.authenticate(''), 'empty key accepted in open mode');
    });
  });

  describe('file upload handling', () => {
    it('handles file upload', () => {
      const session = backend.createSession('user123');
      const result = backend.handleFileUpload(session!.id, {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 102400,
      });
      ok(result.success, 'upload successful');
      ok(result.url, 'has upload URL');
    });

    it('rejects oversized files', () => {
      const session = backend.createSession('user456');
      const result = backend.handleFileUpload(session!.id, {
        filename: 'large.bin',
        mimeType: 'application/octet-stream',
        size: 100 * 1024 * 1024, // 100MB
      });
      ok(!result.success, 'oversized file rejected');
    });
  });

  describe('health check', () => {
    it('returns health status', () => {
      const health = backend.healthCheck();
      ok(health, 'health check returns result');
      strictEqual(health.name, 'webui');
    });

    it('returns stats', () => {
      const stats = backend.getStats();
      ok(stats, 'stats returned');
      strictEqual(stats.activeSessions, 0);
      strictEqual(stats.totalMessages, 0);
    });
  });

  describe('WebSocket support', () => {
    it('supports WebSocket connection', () => {
      ok(typeof backend.handleWebSocket === 'function', 'has handleWebSocket');
    });

    it('broadcasts to connected clients', () => {
      ok(typeof backend.broadcast === 'function', 'has broadcast');
    });
  });

  describe('REST API', () => {
    it('handles GET /api/sessions', () => {
      const handler = backend.handleRequest('GET', '/api/sessions', {});
      ok(handler, 'handler returns response');
    });

    it('handles POST /api/sessions', () => {
      const handler = backend.handleRequest('POST', '/api/sessions', {
        userId: 'user123',
      });
      ok(handler, 'handler returns response');
    });

    it('handles POST /api/messages', () => {
      const session = backend.createSession('user456');
      const handler = backend.handleRequest('POST', '/api/messages', {
        sessionId: session!.id,
        role: 'user',
        content: 'Hello',
      });
      ok(handler, 'handler returns response');
    });

    it('returns 404 for unknown routes', () => {
      const handler = backend.handleRequest('GET', '/unknown', {});
      ok(handler, 'handler returns response');
      strictEqual(handler.status, 404);
    });
  });
});
