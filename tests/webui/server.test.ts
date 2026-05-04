/**
 * WebUI Server Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WebUIServer } from '../../src/webui/server.js';

describe('WebUIServer', () => {
  const config = {
    host: '127.0.0.1',
    port: 19876,
    apiKey: '',
    maxSessions: 10,
    sessionTimeout: 3600,
  };

  it('creates a server instance', () => {
    const server = new WebUIServer(config);
    assert.ok(server);
    assert.equal(server.backendInstance.status, 'stopped');
  });

  it('starts and stops the server', async () => {
    const server = new WebUIServer({ ...config, port: 19877 });
    await server.start();
    assert.equal(server.backendInstance.status, 'started');
    await server.stop();
    assert.equal(server.backendInstance.status, 'stopped');
  });

  it('serves the frontend HTML on /', async () => {
    const server = new WebUIServer({ ...config, port: 19878 });
    await server.start();

    try {
      const res = await fetch(`http://${config.host}:${19878}/`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Synthtek WebUI'));
      assert.ok(html.includes('<!DOCTYPE html>'));
    } finally {
      await server.stop();
    }
  });

  it('returns health check on /api/health', async () => {
    const server = new WebUIServer({ ...config, port: 19879 });
    await server.start();

    try {
      const res = await fetch(`http://${config.host}:${19879}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.name, 'webui');
      assert.equal(data.status, 'started');
    } finally {
      await server.stop();
    }
  });

  it('creates a session via POST /api/sessions', async () => {
    const server = new WebUIServer({ ...config, port: 19880 });
    await server.start();

    try {
      const res = await fetch(`http://${config.host}:${19880}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user' }),
      });
      assert.equal(res.status, 201);
      const session = await res.json();
      assert.ok(session.id);
      assert.equal(session.userId, 'test-user');
    } finally {
      await server.stop();
    }
  });

  it('lists sessions via GET /api/sessions', async () => {
    const server = new WebUIServer({ ...config, port: 19881 });
    await server.start();

    try {
      // Create a session first
      await fetch(`http://${config.host}:${19881}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user' }),
      });

      const res = await fetch(`http://${config.host}:${19881}/api/sessions`);
      assert.equal(res.status, 200);
      const sessions = await res.json();
      assert.ok(Array.isArray(sessions));
      assert.ok(sessions.length >= 1);
    } finally {
      await server.stop();
    }
  });

  it('adds and retrieves messages', async () => {
    const server = new WebUIServer({ ...config, port: 19882 });
    await server.start();

    try {
      // Create session
      const sessRes = await fetch(`http://${config.host}:${19882}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user' }),
      });
      const session = await sessRes.json();

      // Add message
      const msgRes = await fetch(`http://${config.host}:${19882}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, role: 'user', content: 'hello' }),
      });
      assert.equal(msgRes.status, 201);

      // Get messages
      const getRes = await fetch(`http://${config.host}:${19882}/api/messages?sessionId=${session.id}`);
      assert.equal(getRes.status, 200);
      const messages = await getRes.json();
      assert.ok(messages.length >= 1);
      assert.equal(messages[0].content, 'hello');
    } finally {
      await server.stop();
    }
  });

  it('returns stats on /api/stats', async () => {
    const server = new WebUIServer({ ...config, port: 19883 });
    await server.start();

    try {
      const res = await fetch(`http://${config.host}:${19883}/api/stats`);
      assert.equal(res.status, 200);
      const stats = await res.json();
      assert.ok(typeof stats.activeSessions === 'number');
      assert.ok(typeof stats.totalMessages === 'number');
    } finally {
      await server.stop();
    }
  });

  it('returns 404 for unknown API routes', async () => {
    const server = new WebUIServer({ ...config, port: 19884 });
    await server.start();

    try {
      const res = await fetch(`http://${config.host}:${19884}/api/unknown`);
      assert.equal(res.status, 404);
    } finally {
      await server.stop();
    }
  });

  it('handles CORS preflight', async () => {
    const server = new WebUIServer({ ...config, port: 19885 });
    await server.start();

    try {
      const res = await fetch(`http://${config.host}:${19885}/api/health`, {
        method: 'OPTIONS',
      });
      assert.equal(res.status, 204);
    } finally {
      await server.stop();
    }
  });

  it('enforces API key auth when configured', async () => {
    const securedConfig = { ...config, port: 19886, apiKey: 'secret-key' };
    const server = new WebUIServer(securedConfig);
    await server.start();

    try {
      // Without auth header — should get 401
      const res = await fetch(`http://${config.host}:${19886}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test' }),
      });
      assert.equal(res.status, 401);

      // With correct auth header — should succeed
      const res2 = await fetch(`http://${config.host}:${19886}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer secret-key' },
        body: JSON.stringify({ userId: 'test' }),
      });
      assert.equal(res2.status, 201);
    } finally {
      await server.stop();
    }
  });

  it('deletes a session via DELETE /api/sessions/:id', async () => {
    const server = new WebUIServer({ ...config, port: 19887 });
    await server.start();

    try {
      // Create session
      const sessRes = await fetch(`http://${config.host}:${19887}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user' }),
      });
      const session = await sessRes.json();

      // Delete it
      const delRes = await fetch(`http://${config.host}:${19887}/api/sessions/${session.id}`, {
        method: 'DELETE',
      });
      assert.equal(delRes.status, 200);

      // Verify gone
      const getRes = await fetch(`http://${config.host}:${19887}/api/messages?sessionId=${session.id}`);
      const messages = await getRes.json();
      assert.ok(messages.length === 0);
    } finally {
      await server.stop();
    }
  });
});
