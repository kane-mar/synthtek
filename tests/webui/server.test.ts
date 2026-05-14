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

  it('frontend meets accessibility guidelines', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/`);
      const html = await res.text();

      // C5: Skip-to-content link
      assert.ok(html.includes('skip-link'), 'should have skip-to-content link');
      assert.ok(html.includes('Skip to main content'), 'skip link should have accessible text');

      // C5: Semantic <main> element
      assert.ok(html.includes('<main'), 'should use semantic <main> element');

      // C1: aria-live on chat messages container
      assert.ok(html.includes('aria-live="polite"'), 'chat container should have aria-live');
      assert.ok(html.includes('role="log"'), 'chat container should have role=log');

      // C2: focus-visible states in CSS
      assert.ok(html.includes('focus-visible'), 'should define :focus-visible styles');

      // I1: aria-hidden on decorative icons
      assert.ok(html.includes('aria-hidden="true"'), 'decorative icons should have aria-hidden');

      // I2: form labels with for attribute (formGroup generates <label for="...">)
      assert.ok(html.includes('<label for="'), 'form labels should use for attribute');

      // I3: name and autocomplete on form inputs
      assert.ok(html.includes('name="chat-message"'), 'chat input should have name attribute');
      assert.ok(html.includes('autocomplete="off"'), 'chat input should disable autocomplete');

      // I4: prefers-reduced-motion media query
      assert.ok(html.includes('prefers-reduced-motion'), 'should honor reduced motion preference');

      // I5: proper ellipsis character
      assert.ok(html.includes('Connecting…'), 'should use proper ellipsis character');

      // I6: color-scheme: dark
      assert.ok(html.includes('color-scheme: dark'), 'should set color-scheme: dark');

      // I7: theme-color meta tag
      assert.ok(html.includes('theme-color'), 'should have theme-color meta tag');

      // N2: dynamic viewport height for notch support
      assert.ok(html.includes('100dvh'), 'should use dynamic viewport height');

      // N1: touch-action on buttons
      assert.ok(html.includes('touch-action:manipulation'), 'buttons should have touch-action');

      // C3: hash-based routing
      assert.ok(html.includes('hashchange'), 'should use hash-based routing');
      assert.ok(html.includes('window.location.hash'), 'should sync URL hash with page state');

      // C4: inline error messages (no alert())
      assert.ok(html.includes('modal-error'), 'should have inline error container');
      assert.ok(html.includes('role="alert"'), 'error container should have role=alert');

      // N4: unsaved changes warning
      assert.ok(html.includes('unsaved changes'), 'should warn about unsaved changes');

      // N3: loading state on save button
      assert.ok(html.includes('spinner'), 'should show spinner during save');
      assert.ok(html.includes('Saving…'), 'should show saving text');

      // NEW TEST: Check for correct chat input bar ID (detects the typo I introduced)
      assert.ok(html.includes('id="chat-input-bar"'), 'chat input bar should have correct ID');
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

  it('returns sanitized config on /api/config', async () => {
    const cfg = freshConfig();
    cfg.apiKey = 'secret-key-123';
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/config`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.host, '127.0.0.1');
      assert.equal(data.port, cfg.port);
      assert.equal(data.maxSessions, 10);
      assert.equal(data.sessionTimeout, 3600);
      assert.equal(data.apiKeyConfigured, true);
      assert.equal(data.apiKey, undefined); // must NOT leak the key
    } finally { await server.stop(); }
  });

  it('shows apiKeyConfigured=false when no key set on /api/config', async () => {
    const cfg = freshConfig();
    cfg.apiKey = '';
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/config`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.apiKeyConfigured, false);
    } finally { await server.stop(); }
  });

  it('returns empty plugin list on /api/plugins when standalone', async () => {
    const cfg = freshConfig();
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/plugins`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
      assert.equal(data.length, 0);
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

  it('allows provider writes without auth header when no API key is set', async () => {
    // When no API key is configured, the WebUI operates in open mode.
    // The frontend does not send Authorization headers — this is fine
    // when the server is configured without an API key (local/dev mode).
    const cfg = freshConfig();
    cfg.apiKey = '';  // no API key = open mode
    const server = new WebUIServer(cfg);
    await server.start();
    try {
      // Without auth header — should succeed in open mode
      const res = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'NoAuth', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' }),
      });
      assert.equal(res.status, 201);

      // With auth header — should also succeed (any key works in open mode)
      const res2 = await fetch(`http://${cfg.host}:${cfg.port}/api/providers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anything' }, body: JSON.stringify({ name: 'Authed', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' }),
      });
      assert.equal(res2.status, 201);
    } finally { await server.stop(); }
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));
});
