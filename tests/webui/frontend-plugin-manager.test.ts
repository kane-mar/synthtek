/**
 * Tests for WebUI Plugin Manager Component
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { PluginManagerComponent } from '../../src/webui/frontend/plugin-manager.js';
import type { PluginInfo } from '../../src/webui/frontend/types.js';

describe('PluginManagerComponent', () => {
  let manager: PluginManagerComponent;

  beforeEach(() => {
    manager = new PluginManagerComponent();
  });

  describe('constructor', () => {
    it('creates plugin manager', () => {
      ok(manager, 'manager created');
    });

    it('starts with empty plugin list', () => {
      strictEqual(manager.plugins.length, 0);
    });
  });

  describe('plugin registration', () => {
    it('registers a plugin', () => {
      const plugin: PluginInfo = {
        name: 'test-plugin',
        version: '1.0.0',
        enabled: true,
        status: 'loaded',
      };
      manager.registerPlugin(plugin);
      strictEqual(manager.plugins.length, 1);
    });

    it('prevents duplicate registration', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      manager.registerPlugin({ name: 'p1', version: '2.0', enabled: true, status: 'loaded' });
      strictEqual(manager.plugins.length, 1);
    });

    it('updates plugin on re-registration', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      manager.registerPlugin({ name: 'p1', version: '2.0', enabled: true, status: 'loaded' });
      strictEqual(manager.plugins[0].version, '2.0');
    });
  });

  describe('plugin enable/disable', () => {
    it('enables a plugin', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: false, status: 'disabled' });
      manager.enablePlugin('p1');
      ok(manager.plugins[0].enabled, 'plugin enabled');
    });

    it('disables a plugin', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      manager.disablePlugin('p1');
      ok(!manager.plugins[0].enabled, 'plugin disabled');
    });

    it('returns false for non-existent plugin', () => {
      ok(!manager.enablePlugin('nonexistent'), 'returns false');
    });
  });

  describe('plugin search', () => {
    it('finds plugin by name', () => {
      manager.registerPlugin({ name: 'search-me', version: '1.0', enabled: true, status: 'loaded' });
      const found = manager.findPlugin('search-me');
      ok(found, 'plugin found');
      strictEqual(found.name, 'search-me');
    });

    it('returns null for non-existent plugin', () => {
      const found = manager.findPlugin('missing');
      strictEqual(found, null);
    });

    it('filters plugins by status', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      manager.registerPlugin({ name: 'p2', version: '1.0', enabled: false, status: 'disabled' });
      const loaded = manager.filterByStatus('loaded');
      strictEqual(loaded.length, 1);
    });

    it('filters plugins by enabled state', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      manager.registerPlugin({ name: 'p2', version: '1.0', enabled: false, status: 'disabled' });
      const enabled = manager.filterByEnabled(true);
      strictEqual(enabled.length, 1);
    });
  });

  describe('plugin stats', () => {
    it('returns total plugin count', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      manager.registerPlugin({ name: 'p2', version: '1.0', enabled: true, status: 'loaded' });
      strictEqual(manager.getTotalCount(), 2);
    });

    it('returns enabled plugin count', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      manager.registerPlugin({ name: 'p2', version: '1.0', enabled: false, status: 'disabled' });
      strictEqual(manager.getEnabledCount(), 1);
    });

    it('returns error plugin count', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'error' });
      strictEqual(manager.getErrorCount(), 1);
    });
  });

  describe('render', () => {
    it('renders plugin list HTML', () => {
      manager.registerPlugin({ name: 'test-plugin', version: '1.0', enabled: true, status: 'loaded' });
      const html = manager.render();
      ok(typeof html === 'string', 'renders string');
      ok(html.includes('test-plugin'), 'includes plugin name');
    });

    it('renders empty state', () => {
      const html = manager.render();
      ok(html.includes('No plugins'), 'shows empty state');
    });

    it('renders plugin status badge', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      const html = manager.render();
      ok(html.includes('status-loaded'), 'includes status class');
    });

    it('renders plugin version', () => {
      manager.registerPlugin({ name: 'p1', version: '2.5.0', enabled: true, status: 'loaded' });
      const html = manager.render();
      ok(html.includes('2.5.0'), 'includes version');
    });
  });

  describe('plugin removal', () => {
    it('removes a plugin', () => {
      manager.registerPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      manager.removePlugin('p1');
      strictEqual(manager.plugins.length, 0);
    });

    it('returns false when removing non-existent plugin', () => {
      ok(!manager.removePlugin('missing'), 'returns false');
    });
  });
});
