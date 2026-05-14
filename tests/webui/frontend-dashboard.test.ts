/**
 * Tests for WebUI Dashboard Component
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { DashboardComponent } from '../../src/webui/frontend/dashboard.js';
import type { DashboardMetrics, PluginInfo, ChannelInfo } from '../../src/webui/frontend/types.js';

describe('DashboardComponent', () => {
  let dashboard: DashboardComponent;

  beforeEach(() => {
    dashboard = new DashboardComponent();
  });

  describe('constructor', () => {
    it('creates dashboard with empty metrics', () => {
      ok(dashboard, 'dashboard created');
    });

    it('has default zero metrics', () => {
      strictEqual(dashboard.metrics.activeSessions, 0);
      strictEqual(dashboard.metrics.totalMessages, 0);
    });
  });

  describe('metrics update', () => {
    it('updates metrics from API response', () => {
      const metrics: DashboardMetrics = {
        activeSessions: 5,
        totalMessages: 150,
        uptime: 3600000,
        pluginsLoaded: 3,
        channelsConnected: 2,
        cpuUsage: 25.5,
        memoryUsage: 45.2,
      };
      dashboard.updateMetrics(metrics);
      strictEqual(dashboard.metrics.activeSessions, 5);
      strictEqual(dashboard.metrics.totalMessages, 150);
    });

    it('updates partial metrics', () => {
      dashboard.updateMetrics({
        activeSessions: 10,
        totalMessages: 0,
        uptime: 0,
        pluginsLoaded: 0,
        channelsConnected: 0,
        cpuUsage: 0,
        memoryUsage: 0,
      });
      strictEqual(dashboard.metrics.activeSessions, 10);
    });
  });

  describe('plugin management', () => {
    it('adds plugin info', () => {
      const plugin: PluginInfo = {
        name: 'test-plugin',
        version: '1.0.0',
        enabled: true,
        status: 'loaded',
      };
      dashboard.addPlugin(plugin);
      strictEqual(dashboard.plugins.length, 1);
      strictEqual(dashboard.plugins[0].name, 'test-plugin');
    });

    it('toggles plugin enabled state', () => {
      dashboard.addPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        enabled: true,
        status: 'loaded',
      });
      dashboard.togglePlugin('test-plugin');
      strictEqual(dashboard.plugins[0].enabled, false);
    });

    it('returns plugin count', () => {
      dashboard.addPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      dashboard.addPlugin({ name: 'p2', version: '1.0', enabled: true, status: 'loaded' });
      strictEqual(dashboard.getPluginCount(), 2);
    });

    it('returns loaded plugin count', () => {
      dashboard.addPlugin({ name: 'p1', version: '1.0', enabled: true, status: 'loaded' });
      dashboard.addPlugin({ name: 'p2', version: '1.0', enabled: false, status: 'disabled' });
      strictEqual(dashboard.getLoadedPluginCount(), 1);
    });
  });

  describe('channel management', () => {
    it('adds channel info', () => {
      const channel: ChannelInfo = {
        name: 'telegram',
        status: 'connected',
        messagesReceived: 10,
        messagesSent: 5,
      };
      dashboard.addChannel(channel);
      strictEqual(dashboard.channels.length, 1);
      strictEqual(dashboard.channels[0].name, 'telegram');
    });

    it('returns connected channel count', () => {
      dashboard.addChannel({ name: 'telegram', status: 'connected', messagesReceived: 0, messagesSent: 0 });
      dashboard.addChannel({ name: 'discord', status: 'disconnected', messagesReceived: 0, messagesSent: 0 });
      strictEqual(dashboard.getConnectedChannelCount(), 1);
    });

    it('returns total messages across channels', () => {
      dashboard.addChannel({ name: 'telegram', status: 'connected', messagesReceived: 10, messagesSent: 5 });
      dashboard.addChannel({ name: 'discord', status: 'connected', messagesReceived: 3, messagesSent: 2 });
      strictEqual(dashboard.getTotalMessages(), 20);
    });
  });

  describe('uptime formatting', () => {
    it('formats seconds', () => {
      dashboard.metrics.uptime = 45000;
      const formatted = dashboard.formatUptime();
      ok(formatted.includes('45'), 'includes seconds');
    });

    it('formats minutes', () => {
      dashboard.metrics.uptime = 3600000;
      const formatted = dashboard.formatUptime();
      ok(formatted.includes('1'), 'includes hours');
    });

    it('formats hours', () => {
      dashboard.metrics.uptime = 7200000;
      const formatted = dashboard.formatUptime();
      ok(formatted.includes('2'), 'includes hours');
    });

    it('formats days', () => {
      dashboard.metrics.uptime = 172800000;
      const formatted = dashboard.formatUptime();
      ok(formatted.includes('2'), 'includes days');
    });
  });

  describe('render', () => {
    it('renders dashboard HTML', () => {
      const html = dashboard.render();
      ok(typeof html === 'string', 'renders string');
      ok(html.includes('Dashboard'), 'includes title');
    });

    it('renders metrics in HTML', () => {
      dashboard.updateMetrics({
        activeSessions: 5,
        totalMessages: 100,
        uptime: 3600000,
        pluginsLoaded: 3,
        channelsConnected: 2,
        cpuUsage: 25,
        memoryUsage: 50,
      });
      const html = dashboard.render();
      ok(html.includes('5'), 'shows active sessions');
    });

    it('renders plugins list', () => {
      dashboard.addPlugin({ name: 'test-plugin', version: '1.0', enabled: true, status: 'loaded' });
      const html = dashboard.render();
      ok(html.includes('test-plugin'), 'shows plugin name');
    });

    it('renders channels list', () => {
      dashboard.addChannel({ name: 'telegram', status: 'connected', messagesReceived: 0, messagesSent: 0 });
      const html = dashboard.render();
      ok(html.includes('telegram'), 'shows channel name');
    });
  });

  describe('health status', () => {
    it('returns healthy when all channels connected', () => {
      dashboard.addChannel({ name: 'telegram', status: 'connected', messagesReceived: 0, messagesSent: 0 });
      ok(dashboard.isHealthy(), 'system is healthy');
    });

    it('returns unhealthy when channels disconnected', () => {
      dashboard.addChannel({ name: 'telegram', status: 'disconnected', messagesReceived: 0, messagesSent: 0 });
      ok(!dashboard.isHealthy(), 'system is unhealthy');
    });

    it('returns healthy with no channels', () => {
      ok(dashboard.isHealthy(), 'empty system is healthy');
    });
  });
});
