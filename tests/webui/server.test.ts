/**
 * WebUI Server Tests
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebUIServer } from '../../src/webui/server.js';

describe('WebUIServer', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'synthtek-webui-'));
  let port = 19900;

  function freshConfig() {
    return { host: '127.0.0.1', port: port++, apiKey: '', maxSessions: 10, sessionTimeout: 3600 };
  }

  it('creates a server instance', () => {
    const server = new WebUIServer(freshConfig());
    assert.ok(server);
    assert.equal(server.backendInstance.status, 'stopped');
  });

  it('starts and stops the server', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    assert.equal(server.backendInstance.status, 'started');
    await server.stop();
    assert.equal(server.backendInstance.status, 'stopped');
  });

  it('serves the frontend HTML on /', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Synthtek'));
      assert.ok(html.includes('<!DOCTYPE html>'));
    } finally { await server.stop(); }
  });

  it('returns health check on /api/health', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.name, 'webui');
      assert.equal(data.status, 'started');
    } finally { await server.stop(); }
  });

  it('creates a session via POST /api/sessions', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'test-user' }),
      });
      assert.equal(res.status, 201);
      const session = await res.json();
      assert.ok(session.id);
      assert.equal(session.userId, 'test-user');
    } finally { await server.stop(); }
  });

  it('adds and retrieves messages', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const sessRes = await fetch(`http://${cfg.host}:${cfg.port}/api/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'test-user' }),
      });
      const session = await sessRes.json();

      const msgRes = await fetch(`http://${cfg.host}:${cfg.port}/api/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.id, role: 'user', content: 'hello' }),
      });
      assert.equal(msgRes.status, 201);

      const getRes = await fetch(`http://${cfg.host}:${cfg.port}/api/messages?sessionId=${session.id}`);
      assert.equal(getRes.status, 200);
      const messages = await getRes.json();
      assert.ok(messages.length >= 1);
      assert.equal(messages[0].content, 'hello');
    } finally { await server.stop(); }
  });

  it('returns stats on /api/stats', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/stats`);
      assert.equal(res.status, 200);
      const stats = await res.json();
      assert.ok(typeof stats.activeSessions === 'number');
    } finally { await server.stop(); }
  });

  it('returns 404 for unknown API routes', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/unknown`);
      assert.equal(res.status, 404);
    } finally { await server.stop(); }
  });

  it('handles CORS preflight', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/health`, { method: 'OPTIONS' });
      assert.equal(res.status, 204);
    } finally { await server.stop(); }
  });

  // ── Provider API tests ────────────────────────────────────────────────

  it('returns empty provider list initially', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`);
      assert.equal(res.status, 200);
      const providers = await res.json();
      assert.ok(Array.isArray(providers));
    } finally { await server.stop(); }
  });

  it('creates a provider via POST /api/providers', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test GPT', type: 'openai', baseUrl: '', apiKey: 'sk-test', models: [], defaultModel: '' }),
      });
      assert.equal(res.status, 201);
      const p = await res.json();
      assert.ok(p.id);
      assert.equal(p.name, 'Test GPT');
      assert.equal(p.type, 'openai');
    } finally { await server.stop(); }
  });

  it('rejects provider creation without name/type', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
    } finally { await server.stop(); }
  });

  it('gets a provider by ID via GET /api/providers/:id', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      // Create first
      const createRes = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Fetch Test', type: 'anthropic', baseUrl: '', apiKey: 'sk-test', models: [], defaultModel: '' }),
      });
      const p = await createRes.json();

      // Fetch by ID
      const getRes = await fetch(`http://${cfg.host}:${cfg.port}/api/providers/${p.id}`);
      assert.equal(getRes.status, 200);
      const fetched = await getRes.json();
      assert.equal(fetched.id, p.id);
    } finally { await server.stop(); }
  });

  it('returns 404 for non-existent provider ID', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/providers/nonexistent`);
      assert.equal(res.status, 404);
    } finally { await server.stop(); }
  });

  it('updates a provider via PUT /api/providers/:id', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const createRes = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Before Update', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' }),
      });
      const p = await createRes.json();

      const updateRes = await fetch(`http://${cfg.host}:${cfg.port}/api/providers/${p.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'After Update', temperature: 0.5 }),
      });
      assert.equal(updateRes.status, 200);
      const updated = await updateRes.json();
      assert.equal(updated.name, 'After Update');
      assert.equal(updated.temperature, 0.5);
    } finally { await server.stop(); }
  });

  it('deletes a provider via DELETE /api/providers/:id', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const createRes = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'To Delete', type: 'custom', baseUrl: '', models: [], defaultModel: '' }),
      });
      const p = await createRes.json();

      const delRes = await fetch(`http://${cfg.host}:${cfg.port}/api/providers/${p.id}`, { method: 'DELETE' });
      assert.equal(delRes.status, 200);

      // Verify gone
      const getRes = await fetch(`http://${cfg.host}:${cfg.port}/api/providers/${p.id}`);
      assert.equal(getRes.status, 404);
    } finally { await server.stop(); }
  });

  it('returns provider presets', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/providers/presets`);
      assert.equal(res.status, 200);
      const presets = await res.json();
      assert.ok(presets.openai);
      assert.ok(presets.anthropic);
      assert.ok(presets.ollama);
    } finally { await server.stop(); }
  });

  it('enforces API key auth on provider write', async () => {
    const cfg = freshConfig();
    cfg.apiKey = 'secret';
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      // Without auth — should get 401
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x', type: 'openai', baseUrl: '', models: [], defaultModel: '' }),
      });
      assert.equal(res.status, 401);

      // With auth — should succeed
      const res2 = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' }, body: JSON.stringify({ name: 'Authed', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' }),
      });
      assert.equal(res2.status, 201);
    } finally { await server.stop(); }
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));
});
