/**
 * Provider Manager Tests
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderManager } from '../../src/webui/provider-manager.js';

describe('ProviderManager', () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'synthtek-pm-'));

  function freshWorkspace() {
    return mkdtempSync(join(baseDir, 'w-'));
  }

  it('loads empty when no file exists', () => {
    const mgr = new ProviderManager(freshWorkspace());
    assert.ok(mgr.list().length === 0);
  });

  it('creates a provider with OpenAI preset defaults', () => {
    const mgr = new ProviderManager(freshWorkspace());
    const p = mgr.create({ name: 'My GPT', type: 'openai', baseUrl: '', apiKey: 'sk-test', models: [], defaultModel: '' });
    assert.equal(p.type, 'openai');
    assert.equal(p.baseUrl, 'https://api.openai.com/v1');
    assert.ok(p.models.includes('gpt-4o'));
    assert.equal(p.defaultModel, 'gpt-4o');
    assert.equal(p.status, 'active');
  });

  it('creates a provider with custom values', () => {
    const mgr = new ProviderManager(freshWorkspace());
    const p = mgr.create({ name: 'Local Ollama', type: 'ollama', baseUrl: 'http://myhost:11434/v1', models: ['llama3'], defaultModel: 'llama3', temperature: 0.2, maxTokens: 8192 });
    assert.equal(p.name, 'Local Ollama');
    assert.equal(p.baseUrl, 'http://myhost:11434/v1');
    assert.equal(p.defaultModel, 'llama3');
    assert.equal(p.temperature, 0.2);
    assert.equal(p.maxTokens, 8192);
  });

  it('lists all providers', () => {
    const ws = freshWorkspace();
    const mgr = new ProviderManager(ws);
    mgr.create({ name: 'A', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' });
    mgr.create({ name: 'B', type: 'anthropic', baseUrl: '', apiKey: '', models: [], defaultModel: '' });
    const list = mgr.list();
    assert.equal(list.length, 2);
  });

  it('gets a provider by ID', () => {
    const ws = freshWorkspace();
    const mgr = new ProviderManager(ws);
    const created = mgr.create({ name: 'X', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' });
    const p = mgr.get(created.id);
    assert.equal(p?.id, created.id);
  });

  it('returns undefined for non-existent ID', () => {
    const mgr = new ProviderManager(freshWorkspace());
    assert.equal(mgr.get('nonexistent'), undefined);
  });

  it('updates a provider', () => {
    const ws = freshWorkspace();
    const mgr = new ProviderManager(ws);
    const created = mgr.create({ name: 'Before', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' });
    const p = mgr.update(created.id, { name: 'After', temperature: 1.0 });
    assert.ok(p);
    assert.equal(p.name, 'After');
    assert.equal(p.temperature, 1.0);
  });

  it('returns null when updating non-existent provider', () => {
    const mgr = new ProviderManager(freshWorkspace());
    assert.equal(mgr.update('nonexistent', { name: 'x' }), null);
  });

  it('deletes a provider', () => {
    const ws = freshWorkspace();
    const mgr = new ProviderManager(ws);
    const created = mgr.create({ name: 'Del Me', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' });
    assert.ok(mgr.delete(created.id));
    assert.equal(mgr.get(created.id), undefined);
  });

  it('returns false when deleting non-existent provider', () => {
    const mgr = new ProviderManager(freshWorkspace());
    assert.equal(mgr.delete('nonexistent'), false);
  });

  it('persists to disk and reloads', () => {
    const ws = freshWorkspace();
    const mgr1 = new ProviderManager(ws);
    mgr1.create({ name: 'Persisted', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' });
    // New manager instance should load from same file
    const mgr2 = new ProviderManager(ws);
    assert.equal(mgr2.list().length, 1);
    assert.equal(mgr2.list()[0].name, 'Persisted');
  });

  it('returns presets', () => {
    const mgr = new ProviderManager(freshWorkspace());
    const presets = mgr.getPresets();
    assert.ok(presets.openai);
    assert.ok(presets.anthropic);
    assert.ok(presets.ollama);
  });

  it('creates custom provider type', () => {
    const mgr = new ProviderManager(freshWorkspace());
    const p = mgr.create({ name: 'Custom API', type: 'custom', baseUrl: 'http://example.com/v1', models: ['my-model'], defaultModel: 'my-model' });
    assert.equal(p.type, 'custom');
    assert.equal(p.baseUrl, 'http://example.com/v1');
  });

  it('updates provider status', () => {
    const ws = freshWorkspace();
    const mgr = new ProviderManager(ws);
    const created = mgr.create({ name: 'Status Test', type: 'openai', baseUrl: '', apiKey: '', models: [], defaultModel: '' });
    const p = mgr.update(created.id, { status: 'inactive' });
    assert.ok(p);
    assert.equal(p.status, 'inactive');
  });

  after(() => rmSync(baseDir, { recursive: true, force: true }));
});
