/**
 * Tests for WebUI Server — authentication enforcement
 */

import { describe, it, before, after } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { WebUIServer } from '../../src/webui/server.js';
import type { WebUIConfig } from '../../src/webui/types.js';

const TEST_PORT = 3999;

const config: WebUIConfig = {
  host: '127.0.0.1',
  port: TEST_PORT,
  apiKey: 'test-secret-key',
  maxSessions: 100,
  sessionTimeout: 3600,
};

describe('WebUIServer authentication', () => {
  let server: WebUIServer;

  before(async () => {
    server = new WebUIServer(config);
    await server.start();
  });

  after(async () => {
    await server.stop();
  });

  it('rejects API requests without Authorization header', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/sessions`);
    strictEqual(res.status, 401, 'should return 401 without auth');
  });

  it('rejects API requests with wrong API key', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/sessions`, {
      headers: { Authorization: 'Bearer wrong-key' },
    });
    strictEqual(res.status, 401, 'should return 401 with wrong key');
  });

  it('accepts API requests with correct API key', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/sessions`, {
      headers: { Authorization: 'Bearer test-secret-key' },
    });
    strictEqual(res.status, 200, 'should return 200 with correct key');
    const json = await res.json();
    ok(Array.isArray(json), 'should return array of sessions');
  });

  it('rejects POST /api/sessions without auth', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user1' }),
    });
    strictEqual(res.status, 401, 'should return 401 for POST without auth');
  });

  it('accepts POST /api/sessions with correct auth', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-key',
      },
      body: JSON.stringify({ userId: 'user1' }),
    });
    strictEqual(res.status, 201, 'should return 201 for POST with auth');
    const json = await res.json();
    ok(json.id, 'should return session with ID');
  });

  it('rejects DELETE /api/sessions/:id without auth', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/sessions/nonexistent`, {
      method: 'DELETE',
    });
    strictEqual(res.status, 401, 'should return 401 for DELETE without auth');
  });

  it('rejects PUT /api/providers/:id without auth', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/providers/test`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    });
    strictEqual(res.status, 401, 'should return 401 for PUT without auth');
  });

  it('rejects POST /api/chat/completions without auth', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    strictEqual(res.status, 401, 'should return 401 for chat without auth');
  });

  it('does NOT require auth for the frontend HTML page', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
    strictEqual(res.status, 200, 'frontend should be accessible without auth');
    const ct = res.headers.get('content-type');
    ok(ct?.includes('text/html'), 'should serve HTML');
  });

  it('does NOT require auth for /api/health', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/health`);
    strictEqual(res.status, 200, 'health endpoint should be public');
  });
});
