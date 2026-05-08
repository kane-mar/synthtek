/**
 * Tests: WebSocket Manager
 *
 * Tests for WebSocketManager: connection, disconnection, message handling,
 * polling, ping/pong, reconnection, and status notifications.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketManager } from '../../src/webui/frontend/websocket-manager.js';
import type { WebSocketMessage } from '../../src/webui/types.js';

describe('WebSocketManager', () => {
  // ── Connection ─────────────────────────────────────────────────────────────

  it('should start disconnected', () => {
    const manager = new WebSocketManager();
    assert.equal(manager.isConnected, false);
  });

  it('should connect with options', () => {
    const manager = new WebSocketManager();
    let statusCalled = false;

    manager.onStatus((connected) => {
      statusCalled = true;
      assert.equal(connected, true);
    });

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    assert.equal(manager.isConnected, true);
    assert.equal(statusCalled, true);
  });

  it('should disconnect', () => {
    const manager = new WebSocketManager();
    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    manager.disconnect();
    assert.equal(manager.isConnected, false);
  });

  it('should report disconnected status', () => {
    const manager = new WebSocketManager();
    let disconnected = false;

    manager.onStatus((connected) => {
      if (!connected) disconnected = true;
    });

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });
    manager.disconnect();

    assert.equal(disconnected, true);
  });

  // ── Message Handling ───────────────────────────────────────────────────────

  it('should deliver messages to handlers', () => {
    const manager = new WebSocketManager();
    const messages: WebSocketMessage[] = [];

    manager.onMessage((msg) => {
      messages.push(msg);
    });

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    manager.send('message', { role: 'user', content: 'hello' });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'message');
    assert.equal(messages[0].sessionId, 'test-session');
  });

  it('should support multiple message handlers', () => {
    const manager = new WebSocketManager();
    let count1 = 0;
    let count2 = 0;

    manager.onMessage(() => count1++);
    manager.onMessage(() => count2++);

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    manager.send('message', { content: 'test' });
    assert.equal(count1, 1);
    assert.equal(count2, 1);
  });

  it('should not send when disconnected', () => {
    const manager = new WebSocketManager();
    const messages: WebSocketMessage[] = [];

    manager.onMessage((msg) => {
      messages.push(msg);
    });

    // Don't connect — send should be a no-op
    manager.send('message', { content: 'test' });
    assert.equal(messages.length, 0);
  });

  // ── sendMessage Helper ─────────────────────────────────────────────────────

  it('should send user messages via sendMessage', () => {
    const manager = new WebSocketManager();
    const messages: WebSocketMessage[] = [];

    manager.onMessage((msg) => {
      messages.push(msg);
    });

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    manager.sendMessage('hello');
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'message');
    assert.deepStrictEqual(messages[0].data, { role: 'user', content: 'hello' });
  });

  // ── Ping ───────────────────────────────────────────────────────────────────

  it('should send ping messages', () => {
    const manager = new WebSocketManager();
    const messages: WebSocketMessage[] = [];

    manager.onMessage((msg) => {
      messages.push(msg);
    });

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    manager.sendPing();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'ping');
  });

  // ── Status Handlers ────────────────────────────────────────────────────────

  it('should support multiple status handlers', () => {
    const manager = new WebSocketManager();
    let count1 = 0;
    let count2 = 0;

    manager.onStatus(() => count1++);
    manager.onStatus(() => count2++);

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    assert.equal(count1, 1);
    assert.equal(count2, 1);
  });

  it('should report error in status handler', () => {
    const manager = new WebSocketManager();
    let errorReceived = '';

    manager.onStatus((connected, error) => {
      if (!connected && error) {
        errorReceived = error;
      }
    });

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });
    manager.disconnect();

    assert.equal(errorReceived, 'Disconnected');
  });

  // ── Polling ────────────────────────────────────────────────────────────────

  it('should accept polling interval option', () => {
    const manager = new WebSocketManager();
    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
      pollingInterval: 1000,
    });

    assert.equal(manager.isConnected, true);
    manager.disconnect();
  });

  it('should skip polling when interval is 0', () => {
    const manager = new WebSocketManager();
    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
      pollingInterval: 0,
    });

    assert.equal(manager.isConnected, true);
    manager.disconnect();
  });

  // ── Handler Error Isolation ────────────────────────────────────────────────

  it('should not crash if a handler throws', () => {
    const manager = new WebSocketManager();
    let goodHandlerCalled = false;

    manager.onMessage(() => {
      throw new Error('bad handler');
    });
    manager.onMessage(() => {
      goodHandlerCalled = true;
    });

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    manager.send('message', { content: 'test' });
    assert.equal(goodHandlerCalled, true);
  });

  it('should not crash if a status handler throws', () => {
    const manager = new WebSocketManager();
    let goodStatusCalled = false;

    manager.onStatus(() => {
      throw new Error('bad status handler');
    });
    manager.onStatus(() => {
      goodStatusCalled = true;
    });

    manager.connect({
      url: 'ws://localhost:3000/ws',
      sessionId: 'test-session',
    });

    assert.equal(goodStatusCalled, true);
  });
});
